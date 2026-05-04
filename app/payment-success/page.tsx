"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    const paymentId = searchParams.get("paymentId");
    const videoId = searchParams.get("videoId");
    const mode = searchParams.get("mode");

    if (!orderId || !paymentId || !videoId || !mode) {
      setStatus("error");
      return;
    }

    try {
      const key = `payment_${mode}_${videoId}`;
      localStorage.setItem(key, JSON.stringify({
        mode,
        videoId,
        razorpayOrderId: orderId,
        razorpay_payment_id: paymentId,
        verifiedAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }));
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        window.location.href = "/";
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-md w-full mx-4 p-8 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl text-center">
        {status === "loading" && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Verifying payment...
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2">
              Please wait while we confirm your payment.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Payment successful!
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2">
              Redirecting you back...
            </p>
            <a href="/" className="inline-block mt-6 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors">
              Go to Home
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Payment verification issue
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2">
              Your payment may have succeeded but we couldn&apos;t verify it automatically. Please try generating your PDF again.
            </p>
            <a href="/" className="inline-block mt-6 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors">
              Go to Home
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}