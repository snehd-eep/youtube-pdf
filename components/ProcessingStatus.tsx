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

  const currentStep = steps.find(s => s.status === "in_progress");
  const completedCount = steps.filter(s => s.status === "done").length;
  const totalSteps = steps.length;
  const progress = Math.round((completedCount / totalSteps) * 100);

  const hasError = steps.some(s => s.status === "error");
  const errorStep = steps.find(s => s.status === "error");

  return (
    <div className="w-full p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
          {hasError ? "Something went wrong" : "Processing your video"}
        </h3>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {hasError ? "" : `${completedCount}/${totalSteps} complete`}
        </span>
      </div>

      {!hasError && (
        <>
          <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-4">
            <div 
              className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {currentStep?.label || "Starting..."}
          </p>
        </>
      )}

      {hasError && errorStep?.error && (
        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
          {errorStep.error}
        </p>
      )}
    </div>
  );
}