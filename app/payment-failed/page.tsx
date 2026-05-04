"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "unknown";

  const errorMessages: Record<string, string> = {
    missing_params: "Payment parameters were missing. Please try again.",
    invalid_signature: "Payment verification failed. Please try again.",
    server_error: "An error occurred while processing your payment. Please try again.",
    unknown: "Something went wrong with your payment. Please try again.",
  };

  const message = errorMessages[error] || errorMessages.unknown;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-md w-full mx-4 p-8 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Payment failed
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          {message}
        </p>
        <a href="/" className="inline-block mt-6 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors">
          Try Again
        </a>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
      </div>
    }>
      <PaymentFailedContent />
    </Suspense>
  );
}