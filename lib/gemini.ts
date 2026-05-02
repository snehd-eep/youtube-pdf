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

export async function summarizeTranscript(
  transcript: TranscriptEntry[],
  mode: Mode,
  title: string,
  videoId: string
): Promise<SummaryResult> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = mode === "normal" ? NORMAL_PROMPT : SYSTEM_DESIGN_PROMPT;
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