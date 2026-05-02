export type Mode = "normal" | "system-design";

export interface TranscriptEntry {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
}

export interface TimestampEntry {
  time: string;
  topic: string;
  description: string;
}

export interface Tradeoff {
  decision: string;
  pros: string[];
  cons: string[];
}

export interface MermaidDiagram {
  title: string;
  mermaidCode: string;
  description: string;
}

export interface NormalSummary {
  title: string;
  summary: string;
  timestamps: TimestampEntry[];
  keyTakeaways: string[];
  gist: string;
}

export interface SystemDesignSummary {
  title: string;
  summary: string;
  timestamps: TimestampEntry[];
  diagrams: MermaidDiagram[];
  tradeoffs: Tradeoff[];
  keyTakeaways: string[];
  gist: string;
}

export type SummaryResult = NormalSummary | SystemDesignSummary;

export function isSystemDesignSummary(
  result: SummaryResult
): result is SystemDesignSummary {
  return "diagrams" in result;
}

export interface ExtractRequest {
  url: string;
}

export interface ExtractResponse {
  videoId: string;
  title: string;
  transcript: TranscriptEntry[];
}

export interface SummarizeRequest {
  transcript: TranscriptEntry[];
  mode: Mode;
  title: string;
  videoId: string;
}

export interface GeneratePdfRequest {
  summary: SummaryResult;
  mode: Mode;
  videoId: string;
  title: string;
}

export interface CacheEntry {
  videoId: string;
  mode: Mode;
  pdfUrl: string;
  generatedAt: number;
}

export interface ProcessingStep {
  id: "extract" | "summarize" | "generate";
  label: string;
  status: "pending" | "in_progress" | "done" | "error";
  error?: string;
}