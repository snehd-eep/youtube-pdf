"use client";

import { useState } from "react";
import { Mode } from "@/lib/types";

interface ModeSelectorProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  disabled: boolean;
}

export function ModeSelector({ mode, onModeChange, disabled }: ModeSelectorProps) {
  const [sdTier, setSdTier] = useState<"basic" | "detailed">(
    mode === "system-design-pro" ? "detailed" : "basic"
  );

  const handleSdTierChange = (tier: "basic" | "detailed") => {
    setSdTier(tier);
    onModeChange(tier === "basic" ? "system-design" : "system-design-pro");
  };

  const sdSelected = mode === "system-design" || mode === "system-design-pro";

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        type="button"
        onClick={() => onModeChange("normal")}
        disabled={disabled}
        className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${
          mode === "normal"
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-400"
            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              mode === "normal"
                ? "bg-indigo-100 dark:bg-indigo-900"
                : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625a1.125 1.125 0 0 0-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h1.5m-1.5 0h3.75m-3.75 0v3.75m0 0H5.625a1.125 1.125 0 0 1-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125h1.5m0 0h3.75" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              Normal
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Summary, timestamps & takeaways
            </p>
          </div>
        </div>
      </button>

      <div
        className={`flex-1 rounded-xl border-2 transition-all ${
          sdSelected
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-400"
            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <button
          type="button"
          onClick={() => handleSdTierChange(sdTier)}
          disabled={disabled}
          className="w-full p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                sdSelected
                  ? "bg-indigo-100 dark:bg-indigo-900"
                  : "bg-zinc-100 dark:bg-zinc-800"
              }`}
            >
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                System Design
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {sdTier === "detailed"
                  ? "Full content + multi-type diagrams & trade-offs"
                  : "Flowchart diagrams & trade-offs"}
              </p>
            </div>
          </div>
        </button>

        <div className="px-4 pb-3 pt-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSdTierChange("basic")}
              disabled={disabled}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                sdTier === "basic"
                  ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              Basic (Free)
            </button>
            <button
              type="button"
              onClick={() => handleSdTierChange("detailed")}
              disabled={disabled}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                sdTier === "detailed"
                  ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              Detailed (₹5)
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onModeChange("pro")}
        disabled={disabled}
        className={`flex-1 p-4 rounded-xl border-2 transition-all text-left relative ${
          mode === "pro"
            ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-400"
            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-amber-300 dark:hover:border-amber-600"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div className="absolute -top-2.5 right-3">
          <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            ₹5
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              mode === "pro"
                ? "bg-amber-100 dark:bg-amber-900"
                : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              Pro
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Full content as structured document
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}