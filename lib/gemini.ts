import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Mode,
  TranscriptEntry,
  SummaryResult,
} from "./types";

export const NORMAL_PROMPT = `You are an expert content summarizer. Given the following YouTube video transcript, generate a structured summary in JSON format.

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, no explanation.

The JSON must follow this exact structure:
{
  "title": "inferred video title or main topic",
  "summary": "A comprehensive 2-3 paragraph summary covering the main points of the video",
  "timestamps": [
    { "time": "MM:SS", "topic": "Short topic name", "description": "Brief 1-2 sentence description of what is discussed" }
  ],
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3", "takeaway 4", "takeaway 5"],
  "gist": "One-line essence of the entire video"
}

Rules:
- Generate 8-15 timestamp entries depending on video length
- Time format must be MM:SS (e.g., 01:30, 12:45)
- keyTakeaways should have 5-8 items
- The gist should be a single powerful sentence
- Write in clear, professional English
- Focus on actionable insights and key concepts

Transcript:
`;

export const SYSTEM_DESIGN_PROMPT = `You are an expert system design educator and technical architect. Given the following YouTube video transcript about a system design or technical topic, generate a detailed structured summary in JSON format.

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, no explanation.

The JSON must follow this exact structure:
{
  "title": "inferred video title or main topic",
  "summary": "A comprehensive 2-3 paragraph summary of the system design concepts discussed",
  "timestamps": [
    { "time": "MM:SS", "topic": "Short topic name", "description": "Brief 1-2 sentence description" }
  ],
  "diagrams": [
    {
      "title": "Diagram title",
      "mermaidCode": "valid mermaid.js syntax",
      "description": "What this diagram illustrates"
    }
  ],
  "tradeoffs": [
    { "decision": "The design decision made", "pros": ["advantage 1", "advantage 2"], "cons": ["disadvantage 1", "disadvantage 2"] }
  ],
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3", "takeaway 4", "takeaway 5"],
  "gist": "One-line essence of the system design topic"
}

IMPORTANT RULES for mermaidCode:
- Use ONLY valid Mermaid.js syntax
- ONLY use "graph TD" or "flowchart TD" — do NOT use sequenceDiagram, classDiagram, erDiagram, or stateDiagram-v2
- Keep diagrams VERY SIMPLE: max 6-8 nodes per diagram
- Use descriptive node labels in quotes
- Node IDs must be simple single letters (A, B, C, etc.)
- Use only these arrow types: --> (solid), -.-> (dashed), ==> (thick)
- Do NOT use subgraphs, styling directives, classDef, click, or any %% directives
- Do NOT use special characters in labels (no colons, semicolons inside quotes)
- Example: graph TD\n  A["Client"] --> B["Load Balancer"]\n  B --> C["Server"]\n  B --> D["Cache"]
- Generate exactly 3 diagrams: 1) High-level architecture 2) Data flow 3) Key component interaction
- Each diagram MUST be under 10 lines of Mermaid code
- Every mermaidCode MUST be a complete, valid diagram that renders without errors
- CRITICAL: Keep mermaidCode minimal. Complex diagrams time out. Less is more.

Rules:
- Generate 8-15 timestamp entries depending on video length
- Time format must be MM:SS (e.g., 01:30, 12:45)
- Generate 2-4 Mermaid diagrams that illustrate the system architecture
- Include 3-6 tradeoffs explaining design decisions
- keyTakeaways should have 5-8 items
- Focus on architectural patterns, scalability, and real-world applicability

Transcript:
`;

export const PRO_PROMPT = `You are an expert content analyst and technical writer. Your task is to transform a YouTube video transcript into a comprehensive, structured document that captures EVERY concept, example, and explanation from the video.

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, no explanation.

The JSON must follow this exact structure:
{
  "title": "inferred video title",
  "summary": "A comprehensive 4-5 paragraph summary that covers ALL major topics discussed in the video. Do not omit any significant point. Write as if explaining the entire video to someone who hasn't seen it.",
  "timestamps": [
    { "time": "MM:SS", "topic": "Specific topic name", "description": "A detailed 2-3 sentence description of what is discussed at this timestamp, including key examples or explanations" }
  ],
  "sections": [
    {
      "heading": "Clear section heading that captures the topic",
      "startTime": "MM:SS",
      "endTime": "MM:SS",
      "keyPoints": ["Key point 1 from this section", "Key point 2", "Key point 3"]
    }
  ],
  "overview": "2-3 sentences describing what this video is generally about — the big picture themes and who would benefit from watching it",
  "focusAreas": ["Main theme or topic 1", "Main theme or topic 2", "Main theme or topic 3"],
  "definitions": [
    { "term": "Technical term or jargon", "explanation": "Clear, concise explanation of what this term means in the context of the video" }
  ],
  "callouts": [
    { "type": "insight", "title": "Important insight", "content": "The full explanation of this insight from the video" }
  ],
  "qa": [
    { "question": "A question this video section answers", "answer": "The complete answer based on the video content" }
  ],
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3", "takeaway 4", "takeaway 5", "takeaway 6", "takeaway 7", "takeaway 8"],
  "gist": "One-line essence of the entire video"
}

CRITICAL RULES — YOU MUST FOLLOW ALL OF THESE:

1. SECTIONS (most important): Divide the video into 5-10 meaningful sections. Each section should cover a distinct topic or concept. For each section provide:
   - heading: A clear, descriptive section title
   - startTime/endTime: MM:SS format marking when this section starts and ends in the video
   - keyPoints: 3-5 bullet points capturing the essential ideas from this section

2. TIMESTAMPS: Generate 15-25 timestamp entries with DETAILED descriptions (2-3 sentences each). Cover every significant moment in the video.

3. DEFINITIONS: List ALL technical terms, jargon, acronyms, and concepts mentioned in the video. Each must have a clear explanation. Include 8-20 terms.

4. CALLOUTS: Extract 5-10 notable points from the video:
   - "insight" — important realizations or conclusions the speaker draws
   - "warning" — pitfalls, common mistakes, or things to be careful about
   - "tip" — practical advice or recommendations from the speaker
   Each callout must have a specific title and detailed content.

5. Q&A: Create 6-10 questions that the video explicitly or implicitly answers. Each answer should be comprehensive (2-3 sentences), based purely on video content.

6. FOCUS AREAS: List 3-6 main themes or topics the video focuses on.

7. OVERVIEW: Write 2-3 sentences about what the video covers generally and who it's for.

8. KEY TAKEAWAYS: 8-12 actionable takeaways that capture the most important lessons.

9. SUMMARY: 4-5 paragraphs that comprehensively cover ALL topics. Do not skip or abbreviate any major point.

10. DO NOT SUMMARIZE AWAY CONTENT. Every concept, example, and explanation from the video should appear somewhere in the output — either in sections, definitions, callouts, Q&A, or timestamps.

Transcript:
`;

export function formatTranscript(transcript: TranscriptEntry[]): string {
  return transcript
    .map((entry) => {
      const minutes = Math.floor(entry.offset / 60000);
      const seconds = Math.floor((entry.offset % 60000) / 1000);
      const timeStr = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      return `[${timeStr}] ${entry.text}`;
    })
    .join("\n");
}

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("429") || msg.includes("quota") || msg.includes("rate") || msg.includes("resource_exhausted") || msg.includes("too many requests")) {
      return true;
    }
  }
  return false;
}

function normalizeProSummary(parsed: Record<string, unknown>): void {
  if (!Array.isArray(parsed.sections)) parsed.sections = [];
  if (!Array.isArray(parsed.definitions)) parsed.definitions = [];
  if (!Array.isArray(parsed.callouts)) parsed.callouts = [];
  if (!Array.isArray(parsed.qa)) parsed.qa = [];
  if (!Array.isArray(parsed.focusAreas)) parsed.focusAreas = [];
  if (typeof parsed.overview !== "string") parsed.overview = "";

  parsed.sections = (parsed.sections as unknown[]).map(
    (item) => {
      const s = item as Record<string, unknown>;
      return {
        heading: (s.heading as string) || "Untitled Section",
        startTime: (s.startTime as string) || "00:00",
        endTime: (s.endTime as string) || "00:00",
        keyPoints: Array.isArray(s.keyPoints)
          ? (s.keyPoints as unknown[]).map((p: unknown) => String(p))
          : [],
      };
    }
  );

  parsed.definitions = (parsed.definitions as unknown[]).map(
    (item) => {
      const d = item as Record<string, unknown>;
      return {
        term: (d.term as string) || "Unknown term",
        explanation: (d.explanation as string) || "",
      };
    }
  );

  parsed.callouts = (parsed.callouts as unknown[]).map(
    (item) => {
      const c = item as Record<string, unknown>;
      return {
        type: (["insight", "warning", "tip"] as string[]).includes(c.type as string)
          ? c.type
          : "insight",
        title: (c.title as string) || "Note",
        content: (c.content as string) || "",
      };
    }
  );

  parsed.qa = (parsed.qa as unknown[]).map(
    (item) => {
      const q = item as Record<string, unknown>;
      return {
        question: (q.question as string) || "",
        answer: (q.answer as string) || "",
      };
    }
  );

  parsed.focusAreas = (parsed.focusAreas as unknown[]).map((f: unknown) => String(f));

  if (!Array.isArray(parsed.keyTakeaways)) parsed.keyTakeaways = [];
  parsed.keyTakeaways = (parsed.keyTakeaways as unknown[]).map((t: unknown) => String(t));
}

export async function summarizeTranscript(
  transcript: TranscriptEntry[],
  mode: Mode,
  title: string,
  videoId: string
): Promise<SummaryResult> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

  let prompt: string;
  if (mode === "normal") prompt = NORMAL_PROMPT;
  else if (mode === "system-design") prompt = SYSTEM_DESIGN_PROMPT;
  else prompt = PRO_PROMPT;

  const formattedTranscript = formatTranscript(transcript);

  const fullPrompt = `${prompt}
Video Title: ${title}
Video ID: ${videoId}

${formattedTranscript}`;

  const maxRetries = 3;
  const baseDelay = 2000;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      const cleanedText = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      const parsed = JSON.parse(cleanedText);

      if (mode === "system-design") {
        if (!parsed.diagrams || !Array.isArray(parsed.diagrams)) {
          parsed.diagrams = [];
        }
        if (!parsed.tradeoffs || !Array.isArray(parsed.tradeoffs)) {
          parsed.tradeoffs = [];
        }
        parsed.diagrams = parsed.diagrams.map(
          (d: { mermaidCode?: string; title?: string; description?: string }) => ({
            title: d.title || "Untitled Diagram",
            mermaidCode: (d.mermaidCode || "").replace(/\\n/g, "\n"),
            description: d.description || "",
          })
        );
      }

      if (mode === "pro") {
        normalizeProSummary(parsed);
      }

      return parsed as SummaryResult;
    } catch (error) {
      lastError = error as Error;

      if (isRateLimitError(error)) {
        throw new Error(
          "Gemini AI rate limit reached. Free tier allows 15 requests per minute. Please wait 60 seconds and try again."
        );
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to generate summary after ${maxRetries + 1} attempts: ${lastError?.message}`
  );
}