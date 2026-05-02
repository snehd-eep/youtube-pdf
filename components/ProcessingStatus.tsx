"use client";

import { ProcessingStep } from "@/lib/types";

interface ProcessingStatusProps {
  steps: ProcessingStep[];
  fromCache?: boolean;
}

export function ProcessingStatus({ steps, fromCache }: ProcessingStatusProps) {
  if (fromCache) {
    return (
      <div className="w-full p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 animate-slide-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-emerald-800 dark:text-emerald-300">
              Result from cache!
            </h3>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              This video was already processed. Downloading instantly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        Processing your video
      </h3>
      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {step.status === "done" && (
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-9" />
                  </svg>
                </div>
              )}
              {step.status === "in_progress" && (
                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
              {step.status === "pending" && (
                <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                </div>
              )}
              {step.status === "error" && (
                <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  step.status === "in_progress"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : step.status === "done"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : step.status === "error"
                    ? "text-red-600 dark:text-red-400"
                    : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {step.label}
              </p>
              {step.error && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                  {step.error}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}