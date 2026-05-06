import OpenAI from "openai";
import {
  Mode,
  TranscriptEntry,
  SummaryResult,
} from "./types";
import { formatTranscript, NORMAL_PROMPT, SYSTEM_DESIGN_PROMPT, PRO_PROMPT, SYSTEM_DESIGN_PRO_PROMPT, TECHNICAL_COURSE_PROMPT, TECHNICAL_COURSE_PRO_PROMPT } from "./gemini";

let cerebrasClient: OpenAI | null = null;

function getCerebrasClient(): OpenAI {
  if (!cerebrasClient) {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) {
      throw new Error("CEREBRAS_API_KEY environment variable is not set");
    }
    cerebrasClient = new OpenAI({
      apiKey,
      baseURL: "https://api.cerebras.ai/v1",
    });
  }
  return cerebrasClient;
}

function pickCerebrasModel(transcriptChars: number, mode: Mode): string {
  if (mode === "normal" && transcriptChars < 20000) {
    return "llama3.1-8b";
  }
  return "llama-3.3-70b";
}

function isRecoverableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("429") || msg.includes("rate") || msg.includes("quota") || msg.includes("too many requests") || msg.includes("413") || msg.includes("too large") || msg.includes("404") || msg.includes("does not exist") || msg.includes("no endpoints") || msg.includes("422");
  }
  return false;
}

export async function cerebrasSummarize(
  transcript: TranscriptEntry[],
  mode: Mode,
  title: string,
  videoId: string
): Promise<SummaryResult> {
  const client = getCerebrasClient();
  const transcriptChars = transcript.reduce((sum, e) => sum + (e.text?.length || 0), 0);

  let systemPrompt: string;
  switch (mode) {
    case "normal":
      systemPrompt = NORMAL_PROMPT;
      break;
    case "system-design":
      systemPrompt = SYSTEM_DESIGN_PROMPT;
      break;
    case "pro":
      systemPrompt = PRO_PROMPT;
      break;
    case "system-design-pro":
      systemPrompt = SYSTEM_DESIGN_PRO_PROMPT;
      break;
    case "technical-course":
      systemPrompt = TECHNICAL_COURSE_PROMPT;
      break;
    case "technical-course-pro":
      systemPrompt = TECHNICAL_COURSE_PRO_PROMPT;
      break;
    default:
      systemPrompt = NORMAL_PROMPT;
  }

  const formattedTranscript = formatTranscript(transcript);

  const fullPrompt = `${systemPrompt}
Video Title: ${title}
Video ID: ${videoId}

${formattedTranscript}`;

  const maxRetries = 2;
  let lastError: Error | null = null;

  const models = [pickCerebrasModel(transcriptChars, mode)];
  if (models[0] !== "llama-3.3-70b") {
    models.push("llama-3.3-70b");
  }

  for (const model of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Cerebras] Trying ${model} (${transcriptChars} chars, ${mode})...`);
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
        
        // Check for insufficient content
        if (parsed.insufficientContent) {
          throw new Error(
            `This video doesn't have enough content for ${mode} mode. ${parsed.reason || ""}`
          );
        }
        
        // Check for mode mismatch errors
        if (parsed.mode === "system-design-pro" && parsed.isSystemDesign === false) {
          throw new Error(
            `SD_PRO_MISMATCH: This video appears to be a ${parsed.videoType || "non-system-design"} video, not a system design video.`
          );
        }
        
        if (parsed.mode === "technical-course-pro") {
          const videoType = parsed.videoType || "";
          if (videoType !== "course" && videoType !== "tutorial") {
            throw new Error(
              `TC_PRO_MISMATCH: This video appears to be a ${videoType || "non-course"} video, not a technical course.`
            );
          }
        }
        
        console.log(`[Cerebras] Success with ${model}`);
        return parsed as SummaryResult;
      } catch (error) {
        lastError = error as Error;

        if (isRecoverableError(error)) {
          console.log(`[Cerebras] ${model} rate-limited/unavailable, trying next...`);
          break;
        }

        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt);
          console.log(`[Cerebras] ${model} retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw new Error(`Cerebras failed: ${lastError?.message}`);
}
