"use client";

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

// Client-side base64url encoder for Mermaid diagrams
function getClientMermaidUrl(mermaidCode: string): string {
  try {
    const trimmed = mermaidCode.trim();
    let finalCode = trimmed;
    
    // Auto-detect flowchart to inject the forest theme
    const isFlowchart = !trimmed.startsWith("sequenceDiagram") && 
                        !trimmed.startsWith("classDiagram") && 
                        !trimmed.startsWith("erDiagram") && 
                        !trimmed.startsWith("stateDiagram-v2") && 
                        !trimmed.startsWith("stateDiagram") && 
                        !trimmed.startsWith("mindmap");
                        
    if (isFlowchart) {
      if (trimmed.startsWith("%%{init:")) {
        finalCode = trimmed.replace(/%%{init:\s*{/, `%%{init: {'theme': 'forest', `);
      } else {
        finalCode = `%%{init: {'theme': 'forest'}}%%\n${trimmed}`;
      }
    }

    const bytes = new TextEncoder().encode(finalCode.trim());
    let binString = "";
    for (let i = 0; i < bytes.length; i++) {
      binString += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binString);
    const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `https://mermaid.ink/img/${base64url}`;
  } catch (e) {
    console.error("Failed to encode mermaid code on client:", e);
    return "";
  }
}

export function PdfPreview({
  summary,
  mode,
  paymentVerified,
  onDownload,
  onPayAndDownload,
  onReset,
  onRegenerate,
  isRegenerating,
}: PdfPreviewProps) {
  if (!summary) return null;

  const needsPayment = isPaidMode(mode) && !paymentVerified;
  const s = summary as any; // Cast as any for easy dynamic field lookup

  // Render components dynamically based on available content
  return (
    <div className="w-full space-y-6 animate-slide-in">
      
      {/* ACTION BAR (Buttons) - Hidden during print */}
      <div className="no-print flex flex-col sm:flex-row gap-3 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
        {needsPayment ? (
          <button
            onClick={onPayAndDownload}
            className="flex-1 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:scale-[1.01]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Unlock & Save PDF — {PRICING[mode].labelInr}
          </button>
        ) : (
          <button
            onClick={onDownload}
            className="flex-1 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-medium transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:scale-[1.01]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l-2.25 2.25M19.5 12H3.75m16.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Print / Save to PDF
          </button>
        )}
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

      {/* DOCUMENT PRINT CONTAINER */}
      <div className="print-container p-6 md:p-12 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 shadow-sm relative overflow-hidden">
        
        {/* Cover Page Header - Always Printed */}
        <div className="border-b-2 border-zinc-900 dark:border-zinc-100 pb-6 mb-8">
          <div className="flex justify-between items-start gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                {mode.replace(/-/g, " ")} Summary Document
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 mt-1 leading-tight">
                {s.title}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>•</span>
            <span>Video ID: {s.videoId || "N/A"}</span>
          </div>
        </div>

        {/* 1. Overview */}
        {s.overview && (
          <div className="mb-8 print-avoid-break">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3 border-l-4 border-indigo-600 pl-3">
              Overview
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-sm italic bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-950">
              {s.overview}
            </p>
          </div>
        )}

        {/* 2. Executive Summary */}
        {s.summary && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-3 border-l-4 border-indigo-600 pl-3">
              Executive Summary
            </h2>
            <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-sm space-y-4">
              {s.summary.split('\n\n').map((para: string, idx: number) => (
                <p key={idx}>{para}</p>
              ))}
            </div>
          </div>
        )}

        {/* Lock Screen Overlay (Only shown for unpaid modes, placed right before restricted sections) */}
        {needsPayment && (
          <div className="relative border-t border-zinc-200 dark:border-zinc-800 pt-8 mt-8">
            {/* Blurry preview block to show there is content underneath */}
            <div className="space-y-4 opacity-15 filter blur-xs select-none pointer-events-none no-print">
              <div className="h-6 bg-zinc-400 rounded w-1/4"></div>
              <div className="h-4 bg-zinc-300 rounded w-3/4"></div>
              <div className="h-4 bg-zinc-300 rounded w-5/6"></div>
              <div className="h-32 bg-zinc-200 rounded"></div>
              <div className="h-6 bg-zinc-400 rounded w-1/3"></div>
              <div className="h-4 bg-zinc-300 rounded w-full"></div>
            </div>

            {/* Lock Modal Card */}
            <div className="no-print absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-white/80 dark:bg-zinc-950/80">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 border border-amber-200 dark:border-amber-900 shadow-sm animate-bounce">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                Content Locked
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-xs max-w-md mb-6 leading-relaxed">
                To unlock the full summary document containing architecture diagrams, detailed lessons, code snippets, trade-offs, and Q&amp;A, click below.
              </p>
              <button
                onClick={onPayAndDownload}
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-all shadow-md cursor-pointer hover:scale-[1.02]"
              >
                Unlock Full Document — {PRICING[mode].labelInr}
              </button>
            </div>
            
            {/* Print fallback to warn user if they try window.print() anyway */}
            <div className="hidden print:block text-center py-12 border border-dashed border-zinc-300 rounded-2xl bg-zinc-50">
              <p className="text-zinc-500 font-semibold">This section is locked. Please unlock the document on the website before printing.</p>
            </div>
          </div>
        )}

        {/* RESTRICTED CONTENT SECTION (Rendered only if paid/free) */}
        {!needsPayment && (
          <div className="space-y-10 border-t border-zinc-200 dark:border-zinc-800 pt-8 mt-8">

            {/* 3. Capacity Estimates (System Design Pro) */}
            {Array.isArray(s.capacityEstimates) && s.capacityEstimates.length > 0 && (
              <div className="print-avoid-break">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  Back-of-Envelope Estimates
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {s.capacityEstimates.map((est: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{est.metric}</span>
                      <div className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-0.5">{est.value}</div>
                      <p className="text-zinc-650 dark:text-zinc-400 text-xs mt-1.5 leading-relaxed">{est.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. API Design (System Design Pro) */}
            {Array.isArray(s.apiDesign) && s.apiDesign.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  API Endpoint Specifications
                </h2>
                <div className="space-y-4">
                  {s.apiDesign.map((api: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 print-avoid-break">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          api.method === "GET" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-350" :
                          api.method === "POST" ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-350" :
                          "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-350"
                        }`}>
                          {api.method}
                        </span>
                        <code className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{api.endpoint}</code>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400 text-xs mb-3">{api.description}</p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        {Array.isArray(api.requestParams) && api.requestParams.length > 0 && (
                          <div>
                            <span className="font-semibold text-zinc-400 block mb-1">Request Parameters</span>
                            <div className="flex flex-wrap gap-1">
                              {api.requestParams.map((p: string, pIdx: number) => (
                                <code key={pIdx} className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">{p}</code>
                              ))}
                            </div>
                          </div>
                        )}
                        {Array.isArray(api.responseParams) && api.responseParams.length > 0 && (
                          <div>
                            <span className="font-semibold text-zinc-400 block mb-1">Response Fields</span>
                            <div className="flex flex-wrap gap-1">
                              {api.responseParams.map((p: string, pIdx: number) => (
                                <code key={pIdx} className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">{p}</code>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Data Model / Entities (System Design Pro) */}
            {Array.isArray(s.dataModel) && s.dataModel.length > 0 && (
              <div className="print-avoid-break">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  Database Schema &amp; Entities
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {s.dataModel.map((model: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                      <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mb-2">{model.entity}</h4>
                      <div className="mb-2">
                        <span className="text-zinc-400 font-semibold block mb-0.5">Attributes</span>
                        <div className="flex flex-wrap gap-1">
                          {model.attributes.map((attr: string, aIdx: number) => (
                            <code key={aIdx} className="bg-white dark:bg-zinc-850 px-1.5 py-0.5 rounded text-[10px] border border-zinc-150 dark:border-zinc-800">{attr}</code>
                          ))}
                        </div>
                      </div>
                      {Array.isArray(model.relationships) && model.relationships.length > 0 && (
                        <div>
                          <span className="text-zinc-400 font-semibold block mb-0.5">Relationships</span>
                          <ul className="list-disc pl-4 space-y-0.5 text-zinc-600 dark:text-zinc-450">
                            {model.relationships.map((rel: string, rIdx: number) => (
                              <li key={rIdx}>{rel}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. Pro Chapters/Sections (Pro / System Design Pro) */}
            {Array.isArray(s.sections) && s.sections.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  Chapters Breakdown
                </h2>
                <div className="space-y-6">
                  {s.sections.map((sect: any, idx: number) => (
                    <div key={idx} className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/20 print-avoid-break">
                      <div className="flex justify-between items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
                        <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">{sect.heading}</h4>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{sect.startTime} - {sect.endTime}</span>
                      </div>
                      {sect.sectionSummary && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
                          {sect.sectionSummary}
                        </p>
                      )}
                      {Array.isArray(sect.keyPoints) && sect.keyPoints.length > 0 && (
                        <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-700 dark:text-zinc-350">
                          {sect.keyPoints.map((pt: string, pIdx: number) => (
                            <li key={pIdx}>{pt}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Architecture Diagrams (System Design / System Design Pro) */}
            {Array.isArray(s.diagrams) && s.diagrams.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  Architecture Diagrams
                </h2>
                <div className="space-y-6">
                  {s.diagrams.map((diag: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col items-center print-avoid-break">
                      <h4 className="font-semibold text-zinc-850 dark:text-zinc-100 text-sm mb-3 self-start">{diag.title}</h4>
                      
                      {/* Diagram Embed using mermaid.ink */}
                      <div className="bg-zinc-50 p-4 rounded-lg flex items-center justify-center border border-zinc-100 w-full mb-3 min-h-40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={getClientMermaidUrl(diag.mermaidCode)} 
                          alt={diag.title} 
                          className="max-h-96 object-contain"
                          onError={(e) => {
                            // Hide the broken image if render fails
                            (e.target as any).style.display = "none";
                          }}
                        />
                      </div>
                      
                      <p className="text-zinc-600 dark:text-zinc-400 text-xs self-start leading-relaxed">{diag.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. Course Modules/Lessons (Technical Course / Technical Course Pro) */}
            {Array.isArray(s.lessons) && s.lessons.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  Course Modules &amp; Lessons
                </h2>
                <div className="space-y-6">
                  {s.lessons.map((lesson: any, idx: number) => (
                    <div key={idx} className="p-6 border border-zinc-250 dark:border-zinc-800 rounded-2xl bg-zinc-50/10 space-y-4 print-avoid-break">
                      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-2">
                        <h4 className="font-extrabold text-zinc-800 dark:text-zinc-200 text-sm">{lesson.title}</h4>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{lesson.startTime} - {lesson.endTime}</span>
                      </div>
                      
                      {Array.isArray(lesson.keyPoints) && lesson.keyPoints.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Lesson Points</span>
                          <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-700 dark:text-zinc-355">
                            {lesson.keyPoints.map((pt: string, pIdx: number) => (
                              <li key={pIdx}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Code Examples (Technical Course Pro) */}
                      {Array.isArray(lesson.codeExamples) && lesson.codeExamples.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Code Snippets</span>
                          {lesson.codeExamples.map((ex: any, eIdx: number) => (
                            <div key={eIdx} className="bg-zinc-950 text-zinc-200 p-4 rounded-xl font-mono text-xs overflow-x-auto relative">
                              {ex.timestamp && <span className="absolute top-2 right-2 text-[9px] text-zinc-600 font-bold uppercase">{ex.timestamp}</span>}
                              {ex.language && <span className="text-[9px] text-zinc-500 font-bold uppercase block mb-1 border-b border-zinc-900 pb-0.5">{ex.language}</span>}
                              <pre className="mt-1"><code>{ex.code}</code></pre>
                              {ex.explanation && <p className="text-[10px] text-zinc-400 mt-2 font-sans italic border-t border-zinc-900 pt-1.5">{ex.explanation}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Lesson Exercises (Technical Course Pro) */}
                      {Array.isArray(lesson.exerciseSuggestions) && lesson.exerciseSuggestions.length > 0 && (
                        <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-950/20 text-xs">
                          <span className="font-semibold text-indigo-700 dark:text-indigo-400 block mb-1">Practice Exercises</span>
                          <ul className="list-disc pl-4 space-y-0.5 text-zinc-700 dark:text-zinc-300">
                            {lesson.exerciseSuggestions.map((ex: string, eIdx: number) => (
                              <li key={eIdx}>{ex}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9. Glossary / Definitions (Pro / SD Pro / Course / Course Pro) */}
            {Array.isArray(s.definitions) && s.definitions.length > 0 && (
              <div className="print-avoid-break">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  Technical Glossary
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {s.definitions.map((def: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs bg-zinc-50/30">
                      <strong className="text-zinc-850 dark:text-zinc-200 block mb-1">{def.term}</strong>
                      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{def.explanation}</p>
                      {def.introducedIn && <span className="text-[9px] font-medium text-zinc-400 mt-1.5 block">Introduced in: {def.introducedIn}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 10. Design Trade-offs (System Design / System Design Pro) */}
            {Array.isArray(s.tradeoffs) && s.tradeoffs.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  Architectural Trade-offs
                </h2>
                <div className="space-y-4">
                  {s.tradeoffs.map((trade: any, idx: number) => (
                    <div key={idx} className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 print-avoid-break bg-zinc-50/10">
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider">{trade.decision}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-emerald-50/40 dark:bg-emerald-950/10 p-3 rounded-lg border border-emerald-100/40 dark:border-emerald-900/10">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-450 block mb-1 uppercase tracking-wider text-[9px]">Pros</span>
                          <ul className="list-disc pl-4 space-y-0.5 text-zinc-700 dark:text-zinc-350">
                            {trade.pros.map((p: string, pIdx: number) => <li key={pIdx}>{p}</li>)}
                          </ul>
                        </div>
                        <div className="bg-red-50/40 dark:bg-red-950/10 p-3 rounded-lg border border-red-100/40 dark:border-red-900/10">
                          <span className="font-semibold text-red-600 dark:text-red-450 block mb-1 uppercase tracking-wider text-[9px]">Cons</span>
                          <ul className="list-disc pl-4 space-y-0.5 text-zinc-700 dark:text-zinc-350">
                            {trade.cons.map((c: string, cIdx: number) => <li key={cIdx}>{c}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 11. Failure Scenarios (System Design Pro) */}
            {Array.isArray(s.failureScenarios) && s.failureScenarios.length > 0 && (
              <div className="print-avoid-break">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  Failure Scenarios &amp; Mitigations
                </h2>
                <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 font-bold text-zinc-500 text-left">
                      <tr>
                        <th className="px-4 py-2">Scenario</th>
                        <th className="px-4 py-2">Impact</th>
                        <th className="px-4 py-2">Mitigation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-850">
                      {s.failureScenarios.map((scen: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-2.5 font-semibold text-zinc-850 dark:text-zinc-250 align-top w-1/3">{scen.scenario}</td>
                          <td className="px-4 py-2.5 text-zinc-650 dark:text-zinc-400 align-top w-1/3">{scen.impact}</td>
                          <td className="px-4 py-2.5 text-zinc-650 dark:text-zinc-400 align-top w-1/3 font-medium text-emerald-600 dark:text-emerald-450">{scen.mitigation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 12. Non-Functional Requirements (System Design Pro) */}
            {Array.isArray(s.nfrs) && s.nfrs.length > 0 && (
              <div className="print-avoid-break">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  Non-Functional Requirements (NFRs)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {s.nfrs.map((nfr: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <span className="font-semibold text-indigo-600 uppercase tracking-widest text-[9px]">{nfr.category}</span>
                      <ul className="list-disc pl-4 space-y-0.5 mt-1.5 text-zinc-650 dark:text-zinc-400">
                        {nfr.requirements.map((req: string, rIdx: number) => (
                          <li key={rIdx}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 13. Insights / Warnings / Tips (Pro / SD Pro) */}
            {Array.isArray(s.callouts) && s.callouts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {s.callouts.map((call: any, idx: number) => (
                  <div key={idx} className={`p-4 rounded-xl border print-avoid-break text-xs ${
                    call.type === "warning" ? "bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/30 text-amber-800 dark:text-amber-400" :
                    call.type === "tip" ? "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-450" :
                    "bg-blue-50/40 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-900/30 text-blue-800 dark:text-blue-450"
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] mb-1.5">
                      {call.type === "warning" && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                      )}
                      {call.type === "tip" && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21m8.913-9.361a9 9 0 01-9.762 9.762M9.813 15.904L9 21m8.913-9.361A9 9 0 009 9m8.913 2.639a9 9 0 01-9.762 0M9 9V3m0 6a9 9 0 019.762 0" />
                        </svg>
                      )}
                      {call.type === "insight" && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a3 3 0 11-6 0v5.25m6-5.25a3 3 0 106 0v5.25M12 18a.75.75 0 110-1.5.75.75 0 010 1.5zm0-10.5h.008v.008H12V7.5z" />
                        </svg>
                      )}
                      {call.title || call.type}
                    </div>
                    <p className="leading-relaxed font-medium">{call.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 14. Systems Q&A (Pro / SD Pro) */}
            {Array.isArray(s.qa) && s.qa.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  Questions &amp; Answers
                </h2>
                <div className="space-y-3">
                  {s.qa.map((q: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs bg-zinc-50/20 print-avoid-break">
                      <strong className="text-zinc-850 dark:text-zinc-200 block mb-1">Q: {q.question}</strong>
                      <p className="text-zinc-600 dark:text-zinc-405 leading-relaxed bg-white dark:bg-zinc-900 p-2.5 rounded-lg mt-1 border border-zinc-100 dark:border-zinc-850">
                        {q.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 15. Timeline / Moments (Normal / Pro / SD / SD Pro) */}
            {Array.isArray(s.timestamps) && s.timestamps.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  Timestamped Timeline
                </h2>
                <div className="relative border-l-2 border-indigo-100 dark:border-indigo-900 pl-6 ml-3 space-y-6">
                  {s.timestamps.map((stamp: any, idx: number) => (
                    <div key={idx} className="relative print-avoid-break">
                      {/* Timeline dot */}
                      <span className="absolute -left-[31px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-indigo-600 ring-4 ring-white dark:ring-zinc-950"></span>
                      
                      <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{stamp.time}</div>
                      <h4 className="font-bold text-zinc-850 dark:text-zinc-100 text-sm mt-0.5">{stamp.topic}</h4>
                      <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1 leading-relaxed">{stamp.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 16. Key Takeaways (All Modes) */}
            {Array.isArray(s.keyTakeaways) && s.keyTakeaways.length > 0 && (
              <div className="print-avoid-break">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 border-l-4 border-indigo-600 pl-3">
                  Critical Takeaways
                </h2>
                <ul className="space-y-2">
                  {s.keyTakeaways.map((takeaway: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 text-xs text-zinc-700 dark:text-zinc-300">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px] border border-indigo-100 dark:border-indigo-900">
                        {idx + 1}
                      </span>
                      <p className="mt-0.5 leading-relaxed">{takeaway}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}