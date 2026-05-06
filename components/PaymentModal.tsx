"use client";

import { useState, useEffect } from "react";

type PaidMode = "pro" | "system-design-pro" | "technical-course-pro";

interface PaymentModalProps {
  mode: PaidMode;
  videoId: string;
  videoTitle: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type ModalState = "creating_order" | "checkout" | "verifying" | "success" | "error";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (response: RazorpayResponse) => void;
  modal: {
    ondismiss: () => void;
  };
  theme: {
    color: string;
  };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, callback: (response: unknown) => void) => void;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PaymentModal({ mode, videoId, videoTitle, onSuccess, onCancel }: PaymentModalProps) {
  const [state, setState] = useState<ModalState>("creating_order");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function initiatePayment() {
      try {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          setErrorMsg("Failed to load payment gateway. Please check your internet connection.");
          setState("error");
          return;
        }

        const res = await fetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, videoId }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create order");
        }

        const order = await res.json();

        if (cancelled) return;

        setState("checkout");

        const options: RazorpayOptions = {
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: "yt2pdf",
          description: mode === "system-design-pro"
            ? `System Design Pro PDF — ${videoTitle}`
            : mode === "technical-course-pro"
            ? `Technical Course Pro PDF — ${videoTitle}`
            : `Pro PDF — ${videoTitle}`,
          handler: async (response: RazorpayResponse) => {
            setState("verifying");

            try {
              const verifyRes = await fetch("/api/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  videoId,
                  mode,
                }),
              });

              const verifyData = await verifyRes.json();

              if (verifyData.verified) {
                const paymentKey = `payment_${mode}_${videoId}`;
                localStorage.setItem(paymentKey, JSON.stringify({
                  mode,
                  videoId,
                  razorpayOrderId: response.razorpay_order_id,
                  verifiedAt: Date.now(),
                  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                  razorpay_payment_id: response.razorpay_payment_id,
                }));

                setState("success");
                setTimeout(() => onSuccess(), 800);
              } else {
                setErrorMsg("Payment verification failed. Please try again.");
                setState("error");
              }
            } catch {
              setErrorMsg("Could not verify payment. Please contact support.");
              setState("error");
            }
          },
          modal: {
            ondismiss: () => {
              if (!cancelled) {
                onCancel();
              }
            },
          },
          theme: {
            color: "#d97706",
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (response: unknown) => {
          const err = (response as { error?: { code?: string; description?: string } })?.error;
          console.error("Razorpay payment failed:", err?.code, err?.description);
          setErrorMsg(`Payment failed: ${err?.description || "Unknown error"}. Please try again.`);
          setState("error");
        });
        rzp.open();
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "Failed to initiate payment");
          setState("error");
        }
      }
    }

    initiatePayment();

    return () => {
      cancelled = true;
    };
  }, [mode, videoId, videoTitle, onSuccess, onCancel]);

  if (state === "checkout") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6">
        {state === "creating_order" && (
          <div className="py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Preparing payment...
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              Setting up secure checkout
            </p>
          </div>
        )}

        {state === "verifying" && (
          <div className="py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Verifying payment...
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              Please wait while we confirm your payment.
            </p>
          </div>
        )}

        {state === "success" && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Payment successful!
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              Your PDF is ready to download.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="py-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Payment failed
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errorMsg}</p>
            <div className="flex gap-3 mt-4 justify-center">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setErrorMsg("");
                  setState("creating_order");
                }}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}