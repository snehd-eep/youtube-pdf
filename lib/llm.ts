import { summarizeTranscript as geminiSummarize } from "./gemini";
import { groqSummarize } from "./groq";
import { openrouterSummarize } from "./openrouter";
import { cerebrasSummarize } from "./cerebras";
import { mistralSummarize } from "./mistral";
import { Mode, TranscriptEntry, SummaryResult } from "./types";

function isConfigured(envVar: string): boolean {
  return !!process.env[envVar];
}

export async function summarizeWithFailover(
  transcript: TranscriptEntry[],
  mode: Mode,
  title: string,
  videoId: string
): Promise<SummaryResult> {
  const allProviders: { name: string; fn: () => Promise<SummaryResult>; envKey: string; modes: Mode[] }[] = [
    { name: "Gemini", fn: () => geminiSummarize(transcript, mode, title, videoId), envKey: "GEMINI_API_KEY", modes: ["normal", "system-design", "system-design-pro", "pro"] },
    { name: "Groq", fn: () => groqSummarize(transcript, mode, title, videoId), envKey: "GROQ_API_KEY", modes: ["normal", "system-design", "system-design-pro", "pro"] },
    { name: "Cerebras", fn: () => cerebrasSummarize(transcript, mode, title, videoId), envKey: "CEREBRAS_API_KEY", modes: ["normal", "system-design", "system-design-pro", "pro"] },
    { name: "Mistral", fn: () => mistralSummarize(transcript, mode, title, videoId), envKey: "MISTRAL_API_KEY", modes: ["normal", "system-design", "system-design-pro", "pro"] },
    { name: "OpenRouter", fn: () => openrouterSummarize(transcript, mode, title, videoId), envKey: "OPENROUTER_API_KEY", modes: ["normal", "system-design", "system-design-pro", "pro"] },
  ];

  const providers = allProviders.filter(p => isConfigured(p.envKey) && p.modes.includes(mode));

  if (providers.length === 0) {
    throw new Error(`No LLM providers configured for mode: ${mode}`);
  }

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      console.log(`[LLM] Trying ${provider.name} (mode: ${mode})...`);
      const result = await provider.fn();
      console.log(`[LLM] Success with ${provider.name}`);
      return result;
    } catch (error) {
      const err = error as Error;
      lastError = err;

      if (err.message.includes("rate limit") || err.message.includes("429") || err.message.includes("quota") || err.message.includes("Too Many Requests") || err.message.includes("413") || err.message.includes("too large") || err.message.includes("404") || err.message.includes("does not exist") || err.message.includes("No endpoints") || err.message.includes("422") || err.message.includes("failed after")) {
        console.log(`[LLM] ${provider.name} rate-limited/unavailable, trying next...`);
        continue;
      }

      console.log(`[LLM] ${provider.name} failed: ${err.message}`);
      throw error;
    }
  }

  throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
}