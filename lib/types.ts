export type Mode = "normal" | "system-design" | "system-design-pro" | "pro" | "technical-course" | "technical-course-pro";

export type DiagramType = "flowchart" | "sequence" | "class" | "er" | "state" | "mindmap";

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
  relatedSection?: string;
}

export interface ProSection {
  heading: string;
  startTime: string;
  endTime: string;
  keyPoints: string[];
  sectionSummary?: string;
}

export interface Definition {
  term: string;
  explanation: string;
  introducedIn?: string;
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

// System Design specific types
export interface CapacityEstimate {
  metric: string;
  value: string;
  explanation: string;
}

export interface ApiEndpoint {
  endpoint: string;
  method: string;
  description: string;
  requestParams?: string[];
  responseParams?: string[];
}

export interface DataEntity {
  entity: string;
  attributes: string[];
  relationships: string[];
}

export interface FailureScenario {
  scenario: string;
  impact: string;
  mitigation: string;
}

export interface NFR {
  category: "scalability" | "reliability" | "performance" | "security";
  requirements: string[];
}

// Technical Course specific types
export interface Lesson {
  title: string;
  startTime: string;
  endTime: string;
  concepts: string[];
  keyPoints: string[];
  codeExamples?: CodeExample[];
  pitfalls?: string[];
  bestPractices?: string[];
  exerciseSuggestions?: string[];
}

export interface CodeExample {
  language: string;
  code: string;
  explanation: string;
  timestamp?: string;
}

export interface KeyConcept {
  term: string;
  definition: string;
  introducedIn: string;
}

// Dynamic section metadata
export interface SectionMetadata {
  sectionId: string;
  present: boolean;
  confidence: number;
  inferred: boolean;
}

// Base summary with dynamic sections
export interface BaseSummary {
  title: string;
  videoType: "system-design" | "tutorial" | "course" | "talk" | "interview" | "other";
  sectionsIncluded: string[];
  sectionsSkipped: string[];
  sectionMetadata: SectionMetadata[];
}

// Mode-specific summaries
export interface NormalSummary extends BaseSummary {
  mode: "normal";
  overview?: string;
  summary?: string;
  timestamps?: TimestampEntry[];
  keyTakeaways?: string[];
}

export interface SystemDesignSummary extends BaseSummary {
  mode: "system-design";
  overview?: string;
  summary?: string;
  timestamps?: TimestampEntry[];
  diagrams?: MermaidDiagram[];
  tradeoffs?: Tradeoff[];
  keyTakeaways?: string[];
}

export interface ProSummary extends BaseSummary {
  mode: "pro";
  overview?: string;
  summary?: string;
  sections?: ProSection[];
  definitions?: Definition[];
  callouts?: Callout[];
  qa?: QA[];
  keyTakeaways?: string[];
}

export interface SystemDesignProSummary extends BaseSummary {
  mode: "system-design-pro";
  isSystemDesign: boolean;
  overview?: string;
  summary?: string;
  capacityEstimates?: CapacityEstimate[];
  dataModel?: DataEntity[];
  apiDesign?: ApiEndpoint[];
  sections?: ProSection[];
  diagrams?: MermaidDiagram[];
  tradeoffs?: Tradeoff[];
  failureScenarios?: FailureScenario[];
  nfrs?: NFR[];
  definitions?: Definition[];
  callouts?: Callout[];
  qa?: QA[];
  keyTakeaways?: string[];
}

export interface TechnicalCourseSummary extends BaseSummary {
  mode: "technical-course";
  overview?: string;
  targetAudience?: "beginner" | "intermediate" | "advanced";
  lessons?: Lesson[];
  keyConcepts?: KeyConcept[];
  toolsMentioned?: string[];
  keyTakeaways?: string[];
}

export interface TechnicalCourseProSummary extends BaseSummary {
  mode: "technical-course-pro";
  overview?: string;
  targetAudience?: "beginner" | "intermediate" | "advanced";
  prerequisites?: string[];
  lessons?: Lesson[];
  keyConcepts?: KeyConcept[];
  implementationSteps?: string[];
  commonPitfalls?: string[];
  toolsMentioned?: string[];
  resources?: string[];
  exerciseSuggestions?: string[];
  bestPractices?: string[];
  keyTakeaways?: string[];
}

export type SummaryResult = NormalSummary | SystemDesignSummary | ProSummary | SystemDesignProSummary | TechnicalCourseSummary | TechnicalCourseProSummary;

// Type guards
export function isNormalSummary(result: SummaryResult): result is NormalSummary {
  return result.mode === "normal";
}

export function isSystemDesignSummary(result: SummaryResult): result is SystemDesignSummary {
  return result.mode === "system-design";
}

export function isProSummary(result: SummaryResult): result is ProSummary {
  return result.mode === "pro";
}

export function isSystemDesignProSummary(result: SummaryResult): result is SystemDesignProSummary {
  return result.mode === "system-design-pro";
}

export function isTechnicalCourseSummary(result: SummaryResult): result is TechnicalCourseSummary {
  return result.mode === "technical-course";
}

export function isTechnicalCourseProSummary(result: SummaryResult): result is TechnicalCourseProSummary {
  return result.mode === "technical-course-pro";
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
