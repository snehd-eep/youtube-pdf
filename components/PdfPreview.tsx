"use client";

import { Mode } from "@/lib/types";
import { PRICING, isPaidMode } from "@/lib/pricing";

interface PdfPreviewProps {
  summary: {
    title: string;
    overview?: string;
    keyTakeaways: string[];
  } | null;
  pdfBuffer: ArrayBuffer | null;
  mode: Mode;
  paymentVerified: boolean;
  onDownload: () => void;
  onPayAndDownload: () => void;
  onReset: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function PdfPreview({
  summary,
  pdfBuffer,
  mode,
  paymentVerified,
  onDownload,
  onPayAndDownload,
  onReset,
  onRegenerate,
  isRegenerating,
}: PdfPreviewProps) {
  if (!pdfBuffer && !summary) return null;

  const needsPayment = isPaidMode(mode) && !paymentVerified;

  return (
    <div className="w-full space-y-6 animate-slide-in">
      {summary && (
        <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
            {summary.title}
          </h2>
          {summary.overview && (
            <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-indigo-800 dark:text-indigo-300 italic">
                {summary.overview}
              </p>
            </div>
          )}
          {summary.keyTakeaways.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Key Takeaways
              </h3>
              <ul className="space-y-1.5">
                {summary.keyTakeaways.map((takeaway, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-medium">
                      {i + 1}
                    </span>
                    {takeaway}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {pdfBuffer && (
        <div className="flex flex-col sm:flex-row gap-3">
          {needsPayment ? (
            <button
              onClick={onPayAndDownload}
              className="flex-1 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Download Full PDF — {PRICING[mode].labelInr}
            </button>
          ) : (
            <button
              onClick={onDownload}
              className="flex-1 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-medium transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
              </svg>
              Download PDF
            </button>
          )}
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="px-6 py-3.5 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRegenerating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Regenerating...
              </>
            ) : (
              "Regenerate"
            )}
          </button>
          <button
            onClick={onReset}
            className="px-6 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-medium transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center gap-2"
          >
            New Video
          </button>
        </div>
      )}
    </div>
  );
}