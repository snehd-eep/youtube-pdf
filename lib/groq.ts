import OpenAI from "openai";
import {
  Mode,
  TranscriptEntry,
  SummaryResult,
} from "./types";
import { formatTranscript, NORMAL_PROMPT, SYSTEM_DESIGN_PROMPT, PRO_PROMPT, SYSTEM_DESIGN_PRO_PROMPT } from "./gemini";

let groqClient: OpenAI | null = null;

function getGroqClient(): OpenAI {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }
    groqClient = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return groqClient;
}

function pickGroqModel(transcriptChars: number, mode: Mode): string {
  if (mode === "normal" && transcriptChars < 15000) {
    return "llama-3.1-8b-instant";
  }
  return "llama-3.3-70b-versatile";
}

function isRecoverableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("429") || msg.includes("rate") || msg.includes("quota") || msg.includes("too many requests") || msg.includes("413") || msg.includes("too large") || msg.includes("404") || msg.includes("does not exist") || msg.includes("no endpoints");
  }
  return false;
}

export async function groqSummarize(
  transcript: TranscriptEntry[],
  mode: Mode,
  title: string,
  videoId: string
): Promise<SummaryResult> {
  const client = getGroqClient();
  const transcriptChars = transcript.reduce((sum, e) => sum + (e.text?.length || 0), 0);

  let systemPrompt: string;
  if (mode === "normal") systemPrompt = NORMAL_PROMPT;
  else if (mode === "system-design") systemPrompt = SYSTEM_DESIGN_PROMPT;
  else if (mode === "system-design-pro") systemPrompt = SYSTEM_DESIGN_PRO_PROMPT;
  else systemPrompt = PRO_PROMPT;

  const formattedTranscript = formatTranscript(transcript);

  const fullPrompt = `${systemPrompt}
Video Title: ${title}
Video ID: ${videoId}

${formattedTranscript}`;

  const maxRetries = 2;
  let lastError: Error | null = null;

  const models = [pickGroqModel(transcriptChars, mode)];
  if (models[0] !== "llama-3.3-70b-versatile") {
    models.push("llama-3.3-70b-versatile");
  }

  for (const model of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Groq] Trying ${model} (${transcriptChars} chars, ${mode})...`);
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: fullPrompt },
          ],
          temperature: 0.7,
          max_completion_tokens: 8192,
        });

        const text = completion.choices[0]?.message?.content || "";

        const cleanedText = text
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();

        const parsed = JSON.parse(cleanedText);
        console.log(`[Groq] Success with ${model}`);
        return parsed as SummaryResult;
      } catch (error) {
        lastError = error as Error;

        if (isRecoverableError(error)) {
          console.log(`[Groq] ${model} rate-limited/unavailable, trying next...`);
          break;
        }

        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt);
          console.log(`[Groq] ${model} retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw new Error(`Groq failed: ${lastError?.message}`);
}