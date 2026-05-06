"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { UrlInput } from "@/components/UrlInput";
import { ModeSelector } from "@/components/ModeSelector";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { PdfPreview } from "@/components/PdfPreview";
import { PaymentModal } from "@/components/PaymentModal";
import { PaymentProvider, usePayment } from "@/components/PaymentProvider";
import { Mode, ProcessingStep, SummaryResult } from "@/lib/types";
import { isPaidMode } from "@/lib/pricing";

type AppState = "idle" | "processing" | "done" | "error";

function HomeContent() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("normal");
  const [state, setState] = useState<AppState>("idle");
  const [steps, setSteps] = useState<ProcessingStep[]>([]);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);

  const payment = usePayment();

  const initialSteps: ProcessingStep[] = [
    { id: "extract", label: "Getting video content", status: "pending" },
    { id: "summarize", label: "Analyzing video", status: "pending" },
    { id: "generate", label: "Creating PDF", status: "pending" },
  ];

  const updateStep = (
    stepId: string,
    status: ProcessingStep["status"],
    errorMsg?: string
  ) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId ? { ...s, status, error: errorMsg } : s
      )
    );
  };

  const extractVideoId = (input: string): string | null => {
    if (input.length === 11 && /^[a-zA-Z0-9_-]+$/.test(input)) return input;
    const match = input.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
    );
    return match?.[1] ?? null;
  };

  const handleGenerate = async (inputUrl: string, regenerate = false) => {
    const videoId = extractVideoId(inputUrl);
    if (!videoId) {
      setError("Could not extract video ID from the URL");
      setState("error");
      return;
    }

    if (!regenerate) {
      setUrl(inputUrl);
    }

    if (isPaidMode(mode)) {
      const alreadyPaid = payment.isPaid(mode as "pro" | "system-design-pro" | "technical-course-pro", videoId);
      setPaymentVerified(alreadyPaid);
    } else {
      setPaymentVerified(true);
    }

    setError("");
    setSummary(null);
    setPdfBuffer(null);
    setFromCache(false);
    setState("processing");
    setSteps(initialSteps);

    try {
      updateStep("extract", "in_progress");

      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });

      if (!extractRes.ok) {
        const err = await extractRes.json();
        throw new Error(err.error || "Failed to extract transcript");
      }

      const { videoId: vidId, title, transcript: extractedTranscript } = await extractRes.json();
      updateStep("extract", "done");

      updateStep("summarize", "in_progress");

      const summarizeRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: extractedTranscript,
          mode,
          title,
          videoId: vidId,
        }),
      });

      if (!summarizeRes.ok) {
        const err = await summarizeRes.json();
        throw new Error(err.error || "Failed to generate summary");
      }

      const summaryResult = await summarizeRes.json();
      setSummary(summaryResult);
      updateStep("summarize", "done");

      updateStep("generate", "in_progress");

      const pdfRes = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: summaryResult,
          mode,
          videoId: vidId,
          title,
          ...(mode === "pro" || mode === "system-design-pro" || mode === "technical-course-pro" ? { transcript: extractedTranscript } : {}),
        }),
      });

      if (!pdfRes.ok) {
        const err = await pdfRes.json();
        throw new Error(err.error || "Failed to generate PDF");
      }

      const pdfArrayBuffer = await pdfRes.arrayBuffer();
      setPdfBuffer(pdfArrayBuffer);
      updateStep("generate", "done");
      setState("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setState("error");

      const currentStep = steps.find((s) => s.status === "in_progress");
      if (currentStep) {
        updateStep(currentStep.id, "error", message);
      }
    }
  };

  const handleDownload = async () => {
    if (!pdfBuffer) return;

    if (isPaidMode(mode) && !paymentVerified) {
      return;
    }

    const videoId = extractVideoId(url);
    const orderId = localStorage.getItem(`payment_${mode}_${videoId}`);
    let razorpayOrderId = null;
    if (orderId) {
      try {
        const data = JSON.parse(orderId);
        razorpayOrderId = data.razorpayOrderId;
      } catch {}
    }

    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${summary?.title || "video"}-${mode}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    if (razorpayOrderId && videoId) {
      try {
        await fetch("/api/delete-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ razorpayOrderId, videoId, mode }),
        });
      } catch {}
    }
  };

  const handlePayAndDownload = () => {
    if (!summary) return;
    const videoId = extractVideoId(url);
    if (!videoId) return;

    if (payment.isPaid(mode as "pro" | "system-design-pro" | "technical-course-pro", videoId)) {
      setPaymentVerified(true);
      handleDownload();
      return;
    }

    payment.openPayment(
      mode as "pro" | "system-design-pro" | "technical-course-pro",
      videoId,
      summary.title
    );
  };

  const handlePaymentSuccess = () => {
    payment.closePayment();
    setPaymentVerified(true);
    handleDownload();
  };

  const handlePaymentCancel = () => {
    payment.closePayment();
  };

  const handleReset = () => {
    setUrl("");
    setState("idle");
    setSteps([]);
    setError("");
    setSummary(null);
    setPdfBuffer(null);
    setFromCache(false);
    setIsRegenerating(false);
    setPaymentVerified(false);
  };

  const handleBack = useCallback(() => {
    if (state === "done" && pdfBuffer) {
      setShowBackConfirm(true);
    } else {
      handleReset();
    }
  }, [state, pdfBuffer]);

  const confirmBack = () => {
    setShowBackConfirm(false);
    handleReset();
  };

  const cancelBack = () => {
    setShowBackConfirm(false);
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state === "done" && pdfBuffer) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state, pdfBuffer]);

  const isNoCaptionsError = error.toLowerCase().includes("could not extract") ||
    error.toLowerCase().includes("captions disabled") ||
    error.toLowerCase().includes("no transcripts") ||
    error.toLowerCase().includes("transcript not available");

  const isVideoTooLong = error.toLowerCase().includes("too long") || error.toLowerCase().includes("too short");

  const isModeMismatch = error.includes("SD_PRO_MISMATCH") || error.includes("TC_PRO_MISMATCH");

  const isInsufficientContent = error.includes("INSUFFICIENT_CONTENT") || error.toLowerCase().includes("insufficient content") || error.toLowerCase().includes("doesn't have enough");

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {state === "idle" && (
            <div className="space-y-8">
              <div className="text-center space-y-3">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  YouTube Videos to{" "}
                  <span className="text-indigo-600 dark:text-indigo-400">PDFs</span>
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto">
                  Convert any YouTube video into a beautifully formatted PDF with
                  summaries, timestamps, and key takeaways. Perfect for readers
                  who prefer text over video.
                </p>
              </div>

              <UrlInput
                onSubmit={(u) => handleGenerate(u)}
                isLoading={false}
              />

              <ModeSelector
                mode={mode}
                onModeChange={setMode}
                disabled={false}
              />

              {mode === "system-design" && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        System Design — Basic
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        Best for architecture and engineering videos. Generates
                        flowchart diagrams, trade-offs analysis, and system breakdowns.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {mode === "system-design-pro" && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        System Design Pro — ₹5 ($0.10)/PDF
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        Auto-detects system design videos and generates architecture,
                        sequence, class, ER, and state diagrams tailored to the content.
                        Full video content as a structured document with sections, definitions,
                        Q&amp;A, and callouts. Payment required to download PDF.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {mode === "pro" && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        Pro — ₹5 ($0.10)/PDF
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        The entire video content as a structured, book-like PDF. Includes sections,
                        definitions, Q&amp;A, callouts, and full transcript text — nothing is left out.
                        Payment required to download PDF.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-3">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Smart Summaries
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    AI-powered summaries that capture the essence of any video
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center mb-3">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Timestamped Topics
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Navigate to any section with detailed timestamp breakdowns
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-3">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Architecture Diagrams
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    System design mode creates Mermaid diagrams from video content
                  </p>
                </div>
              </div>
            </div>
          )}

          {state === "processing" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <button
                  onClick={handleReset}
                  className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                >
                  Home
                </button>
                <span>/</span>
                <span className="text-zinc-900 dark:text-zinc-100">
                  Processing
                </span>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200 truncate">
                      {url}
                    </p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">
                      Mode: {mode === "system-design-pro" ? "System Design Pro" : mode === "system-design" ? "System Design" : mode === "pro" ? "Pro" : mode === "technical-course-pro" ? "Technical Course Pro" : mode === "technical-course" ? "Technical Course" : "Normal"}
                    </p>
                  </div>
                </div>
              </div>

              <ProcessingStatus steps={steps} fromCache={fromCache} />

              <button
                onClick={handleReset}
                className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {state === "error" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <button
                  onClick={handleReset}
                  className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                >
                  Home
                </button>
                <span>/</span>
                <span className="text-red-500 dark:text-red-400">Error</span>
              </div>

              <div className={`p-6 rounded-xl border ${
                isNoCaptionsError || isModeMismatch || isInsufficientContent
                  ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                  : error.toLowerCase().includes("rate limit") || error.toLowerCase().includes("429")
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                    : isVideoTooLong
                      ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                      : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
              }`}>
                <div className="flex items-start gap-3">
                  {isNoCaptionsError ? (
                    <svg className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  ) : isModeMismatch ? (
                    <svg className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.65-.166-.822M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.381 5.387a2.25 2.25 0 00-.527.898l-.646 2.577a1.375 1.375 0 01-1.082.982l-2.577.646a1.375 1.375 0 01-1.082-.982l-.646-2.577a2.25 2.25 0 00-.527-.898L3.822 7.409a2.25 2.25 0 01-.659-1.591V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                    </svg>
                  ) : (error.toLowerCase().includes("rate limit") || error.toLowerCase().includes("429")) ? (
                    <svg className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                  ) : isVideoTooLong ? (
                    <svg className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                  )}
                  <div>
                    <h3 className={`font-semibold ${
                      isNoCaptionsError || isModeMismatch || isInsufficientContent
                        ? "text-amber-800 dark:text-amber-300"
                        : error.toLowerCase().includes("rate limit") || error.toLowerCase().includes("429")
                          ? "text-amber-800 dark:text-amber-300"
                          : isVideoTooLong
                            ? "text-amber-800 dark:text-amber-300"
                            : "text-red-800 dark:text-red-300"
                    }`}>
                      {isNoCaptionsError
                        ? "No captions available"
                        : isModeMismatch
                          ? "Mode mismatch"
                          : isInsufficientContent
                            ? "Not enough content for this mode"
                            : isVideoTooLong
                              ? "Video too long"
                              : error.toLowerCase().includes("rate limit") || error.toLowerCase().includes("429")
                                ? "Rate limit reached"
                                : "Something went wrong"
                      }
                    </h3>
                    <p className={`text-sm mt-1 ${
                      isNoCaptionsError || isInsufficientContent || error.toLowerCase().includes("rate limit") || error.toLowerCase().includes("429") || isVideoTooLong
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {isNoCaptionsError
                        ? "This video doesn't have captions available (not even auto-generated). We can only process videos that have YouTube captions. Try a different video."
                        : isInsufficientContent
                          ? error.replace("INSUFFICIENT_CONTENT:", "").trim()
                          : isVideoTooLong
                            ? error
                            : error
                      }
                    </p>
                    {isInsufficientContent && (
                      <p className="text-xs mt-2 text-amber-600 dark:text-amber-500">
                        Normal and Pro modes work with any video type — give them a try!
                      </p>
                    )}
                    {(error.toLowerCase().includes("rate limit") || error.toLowerCase().includes("429")) && (
                      <p className="text-xs mt-2 text-amber-600 dark:text-amber-500">
                        The free Gemini tier allows 15 requests per minute. Wait about 60 seconds before retrying.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-medium transition-all"
              >
                Try Again
              </button>
            </div>
          )}

          {state === "done" && summary && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <button
                  onClick={handleBack}
                  className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                >
                  Home
                </button>
                <span>/</span>
                <span className="text-zinc-900 dark:text-zinc-100">Result</span>
              </div>

              {fromCache && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-300">
                  Result loaded from cache — no AI calls needed!
                </div>
              )}

              <ProcessingStatus steps={steps} fromCache={fromCache} />

              <PdfPreview
                summary={{
                  title: summary.title,
                  overview: (summary as unknown as Record<string, unknown>).overview as string | undefined,
                  keyTakeaways: ((summary as unknown as Record<string, unknown>).keyTakeaways as string[] | undefined) || [],
                }}
                pdfBuffer={pdfBuffer}
                mode={mode}
                paymentVerified={paymentVerified}
                onDownload={handleDownload}
                onPayAndDownload={handlePayAndDownload}
                onReset={handleReset}
                onRegenerate={() => handleGenerate(url, true)}
                isRegenerating={isRegenerating}
              />
            </div>
          )}
        </div>
      </main>

      {payment.showPaymentModal && payment.pendingMode && payment.pendingVideoId && (
        <PaymentModal
          mode={payment.pendingMode}
          videoId={payment.pendingVideoId}
          videoTitle={payment.pendingVideoTitle || summary?.title || "YouTube Video"}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      )}

      {showBackConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={cancelBack}
          />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Go back?
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              You have a generated PDF. Going back will clear it. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelBack}
                className="flex-1 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Stay
              </button>
              <button
                onClick={confirmBack}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-center text-zinc-400 dark:text-zinc-500">
            yt2pdf — Transform YouTube videos into readable PDFs. Powered by Google Gemini AI.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <PaymentProvider>
      <HomeContent />
    </PaymentProvider>
  );
}