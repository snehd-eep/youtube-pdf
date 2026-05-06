import OpenAI from "openai";
import {
  Mode,
  TranscriptEntry,
  SummaryResult,
} from "./types";
import { formatTranscript, NORMAL_PROMPT, SYSTEM_DESIGN_PROMPT, PRO_PROMPT, SYSTEM_DESIGN_PRO_PROMPT, TECHNICAL_COURSE_PROMPT, TECHNICAL_COURSE_PRO_PROMPT } from "./gemini";

let mistralClient: OpenAI | null = null;

function getMistralClient(): OpenAI {
  if (!mistralClient) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error("MISTRAL_API_KEY environment variable is not set");
    }
    mistralClient = new OpenAI({
      apiKey,
      baseURL: "https://api.mistral.ai/v1",
    });
  }
  return mistralClient;
}

function pickMistralModel(transcriptChars: number, mode: Mode): string {
  if (mode === "normal" && transcriptChars < 30000) {
    return "mistral-small-latest";
  }
  return "mistral-medium-latest";
}

function isRecoverableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("429") || msg.includes("rate") || msg.includes("quota") || msg.includes("too many requests") || msg.includes("413") || msg.includes("too large") || msg.includes("404") || msg.includes("does not exist") || msg.includes("no endpoints") || msg.includes("422");
  }
  return false;
}

export async function mistralSummarize(
  transcript: TranscriptEntry[],
  mode: Mode,
  title: string,
  videoId: string
): Promise<SummaryResult> {
  const client = getMistralClient();
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

  const maxRetries = 1;
  let lastError: Error | null = null;

  const models = [pickMistralModel(transcriptChars, mode)];
  if (models[0] !== "mistral-medium-latest") {
    models.push("mistral-medium-latest");
  }

  for (const model of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Mistral] Trying ${model} (${transcriptChars} chars, ${mode})...`);
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: fullPrompt },
          ],
          temperature: 0.7,
          max_tokens: 8192,
        });

        const text = completion.choices[0]?.message?.content || "";

        const cleanedText = text
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();

        const parsed = JSON.parse(cleanedText);
        
        // Check for insufficient content
        if (parsed.insufficientContent) {
          const reason = parsed.reason || "";
          const modeLabel = mode === "system-design-pro" ? "System Design Pro"
            : mode === "system-design" ? "System Design"
              : mode === "technical-course-pro" ? "Technical Course Pro"
                : mode === "technical-course" ? "Technical Course"
                  : mode === "pro" ? "Pro" : mode;
          const suggestion = mode === "system-design-pro" || mode === "system-design"
            ? "Try Normal or Pro mode instead — they work with any video type."
            : mode === "technical-course-pro" || mode === "technical-course"
              ? "Try Normal or Pro mode instead — they work with any video type."
              : "";
          throw new Error(
            `INSUFFICIENT_CONTENT:This video doesn't have enough content for ${modeLabel} mode. ${reason}${suggestion ? " " + suggestion : ""}`.trim()
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
        
        console.log(`[Mistral] Success with ${model}`);
        return parsed as SummaryResult;
      } catch (error) {
        lastError = error as Error;

        if (isRecoverableError(error)) {
          console.log(`[Mistral] ${model} rate-limited/unavailable, trying next...`);
          break;
        }

        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt);
          console.log(`[Mistral] ${model} retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw new Error(`Mistral failed: ${lastError?.message}`);
}
