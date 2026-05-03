"use client";

import { useState } from "react";
import { PRICING } from "@/lib/pricing";

interface PaymentModalProps {
  mode: "system-design-pro" | "pro";
  videoId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type ModalState = "form" | "processing" | "success" | "error";

export function PaymentModal({ mode, videoId, onSuccess, onCancel }: PaymentModalProps) {
  const [state, setState] = useState<ModalState>("form");
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/28");
  const [cvv, setCvv] = useState("123");
  const [name, setName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const pricing = PRICING[mode];

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) {
      return digits.slice(0, 2) + "/" + digits.slice(2);
    }
    return digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cardDigits = cardNumber.replace(/\s/g, "");
    const expiryDigits = expiry.replace("/", "");
    const cvvDigits = cvv.replace(/\D/g, "");

    if (cardDigits.length !== 16) {
      setErrorMsg("Card number must be 16 digits");
      setState("error");
      return;
    }
    if (expiryDigits.length !== 4 || parseInt(expiryDigits.slice(0, 2)) > 12 || parseInt(expiryDigits.slice(0, 2)) < 1) {
      setErrorMsg("Invalid expiry date (MM/YY)");
      setState("error");
      return;
    }
    if (cvvDigits.length !== 3) {
      setErrorMsg("CVV must be 3 digits");
      setState("error");
      return;
    }

    setState("processing");

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const paymentKey = `mockPayment_${mode}_${videoId}`;
    const paymentData = {
      mode,
      videoId,
      paidAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
    localStorage.setItem(paymentKey, JSON.stringify(paymentData));

    setState("success");

    await new Promise((resolve) => setTimeout(resolve, 1000));
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={state === "form" || state === "error" ? onCancel : undefined} />

      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6">
          {state === "form" && (
            <>
              <button
                onClick={onCancel}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {mode === "system-design-pro" ? "System Design Pro" : "Pro"}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {pricing.label}/PDF
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Card Number
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    placeholder="4242 4242 4242 4242"
                    maxLength={19}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      MM/YY
                    </label>
                    <input
                      type="text"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                      placeholder="12/28"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      CVV
                    </label>
                    <input
                      type="text"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                      placeholder="123"
                      maxLength={3}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Name on card
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    placeholder="Jane Doe"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                >
                  Pay {pricing.label}
                </button>
              </form>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Secure payment powered by Razorpay
              </div>
            </>
          )}

          {state === "processing" && (
            <div className="py-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Processing payment...</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Please wait while we process your payment.</p>
            </div>
          )}

          {state === "success" && (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Payment successful!</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Generating your PDF now...</p>
            </div>
          )}

          {state === "error" && (
            <div className="py-8 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Payment failed</h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errorMsg}</p>
              <button
                onClick={() => setState("form")}
                className="mt-4 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}