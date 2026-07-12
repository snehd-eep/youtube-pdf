"use client";

import { useState, useEffect } from "react";
import { Mode, SummaryResult } from "@/lib/types";
import { PRICING, isPaidMode } from "@/lib/pricing";

interface PdfPreviewProps {
  summary: SummaryResult | null;
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (pdfBuffer) {
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPdfUrl(null);
    }
  }, [pdfBuffer]);

  if (!pdfBuffer && !summary) return null;

  const needsPayment = isPaidMode(mode) && !paymentVerified;
  const s = summary as any;

  return (
    <div className="w-full space-y-6 animate-slide-in">
      
      {/* 1. Unpaid State - Truncated text and lock screen overlay */}
      {needsPayment && s && (
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 shadow-sm relative overflow-hidden space-y-6">
          <div className="border-b border-zinc-150 dark:border-zinc-850 pb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              {mode.replace(/-/g, " ")} Summary Document
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
              {s.title}
            </h2>
          </div>

          {s.overview && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                Overview
              </h3>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 italic bg-indigo-50/50 dark:bg-indigo-950/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-950/20">
                {s.overview}
              </p>
            </div>
          )}

          {Array.isArray(s.keyTakeaways) && s.keyTakeaways.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2.5">
                Key Takeaways Preview
              </h3>
              <ul className="space-y-2">
                {s.keyTakeaways.slice(0, 3).map((takeaway: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-zinc-650 dark:text-zinc-350">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                      {i + 1}
                    </span>
                    <p className="mt-0.5 leading-relaxed">{takeaway}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Locked Overlay block */}
          <div className="relative border-t border-zinc-200 dark:border-zinc-800 pt-8 mt-4">
            <div className="space-y-3 opacity-10 filter blur-xs select-none pointer-events-none">
              <div className="h-6 bg-zinc-400 rounded w-1/4"></div>
              <div className="h-4 bg-zinc-300 rounded w-3/4"></div>
              <div className="h-4 bg-zinc-300 rounded w-5/6"></div>
              <div className="h-28 bg-zinc-200 rounded"></div>
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-white/80 dark:bg-zinc-950/80">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 border border-amber-200 dark:border-amber-900 shadow-sm animate-bounce">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                PDF Summary Locked
              </h3>
              <p className="text-zinc-650 dark:text-zinc-400 text-xs max-w-sm mb-5 leading-relaxed">
                Unlock the full document to preview and download all chapters, architecture diagrams, code listings, tradeoffs, and Q&amp;A.
              </p>
              <button
                onClick={onPayAndDownload}
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-all shadow-md cursor-pointer hover:scale-[1.02]"
              >
                Unlock Document — {PRICING[mode].labelInr}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Paid / Free State - Embed real PDF viewer iframe & actions */}
      {!needsPayment && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <button
              onClick={onDownload}
              className="flex-1 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-medium transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:scale-[1.01]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
              </svg>
              Download PDF File
            </button>
            
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="px-6 py-3.5 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
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
              className="px-6 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-medium transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-2 cursor-pointer"
            >
              New Video
            </button>
          </div>

          {/* Interactive PDF Preview Iframe */}
          <div className="w-full aspect-[3/4] md:h-[800px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm relative">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full border-none"
                title="PDF Preview"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-3">
                <svg className="w-8 h-8 animate-spin text-indigo-650" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-xs font-semibold">Compiling PDF preview...</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}