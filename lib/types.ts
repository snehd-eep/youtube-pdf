export type Mode = "normal" | "system-design" | "system-design-pro" | "pro";

export type DiagramType = "flowchart" | "sequence" | "class" | "er" | "state" | "mindmap";

export type PaymentState = "idle" | "modal_open" | "processing" | "success" | "error";

export interface PricingInfo {
  mode: Mode;
  price: number;
  label: string;
  isFree: boolean;
  currency?: string;
}

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
  diagramType?: DiagramType;
}

export interface ProSection {
  heading: string;
  startTime: string;
  endTime: string;
  keyPoints: string[];
}

export interface Definition {
  term: string;
  explanation: string;
}

export interface Callout {
  type: "insight" | "warning" | "tip";
  title: string;
  content: string;
}

export interface QA {
  question: string;
  answer: string;
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

export interface ProSummary {
  title: string;
  summary: string;
  timestamps: TimestampEntry[];
  keyTakeaways: string[];
  gist: string;
  sections: ProSection[];
  overview: string;
  focusAreas: string[];
  definitions: Definition[];
  callouts: Callout[];
  qa: QA[];
}

export interface SystemDesignProSummary {
  title: string;
  summary: string;
  timestamps: TimestampEntry[];
  keyTakeaways: string[];
  gist: string;
  sections: ProSection[];
  overview: string;
  focusAreas: string[];
  definitions: Definition[];
  callouts: Callout[];
  qa: QA[];
  diagrams: MermaidDiagram[];
  tradeoffs: Tradeoff[];
  isSystemDesign: boolean;
  videoType: "system-design" | "tutorial" | "talk" | "interview" | "other";
}

export type SummaryResult = NormalSummary | SystemDesignSummary | ProSummary | SystemDesignProSummary;

export function isSystemDesignSummary(
  result: SummaryResult
): result is SystemDesignSummary {
  return "diagrams" in result && !("sections" in result);
}

export function isProSummary(
  result: SummaryResult
): result is ProSummary {
  return "sections" in result && !("diagrams" in result);
}

export function isSystemDesignProSummary(
  result: SummaryResult
): result is SystemDesignProSummary {
  return "diagrams" in result && "sections" in result;
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