import { NextRequest, NextResponse } from "next/server";
import { summarizeWithFailover } from "@/lib/llm";
import { getCachedSummary, setCachedSummary } from "@/lib/kv";
import { Mode, TranscriptEntry } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, mode, title, videoId } = body;

    if (!transcript || !Array.isArray(transcript)) {
      return NextResponse.json(
        { error: "Missing or invalid 'transcript' field" },
        { status: 400 }
      );
    }

    const VALID_MODES = ["normal", "system-design", "system-design-pro", "pro", "technical-course", "technical-course-pro"];
    if (!mode || !VALID_MODES.includes(mode)) {
      return NextResponse.json(
        { error: `Missing or invalid 'mode' field. Must be one of: ${VALID_MODES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!videoId || typeof videoId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'videoId' field" },
        { status: 400 }
      );
    }

    const MAX_TRANSCRIPT_CHARS = 240000;

    const totalChars = (transcript as TranscriptEntry[]).reduce((sum, e) => sum + (e.text?.length || 0), 0);
    if (totalChars > MAX_TRANSCRIPT_CHARS) {
      return NextResponse.json(
        { error: `This video is too long. We support videos up to ~4 hours. Please try a shorter video.` },
        { status: 413 }
      );
    }

    const cachedSummary = await getCachedSummary(videoId, mode as Mode);
    if (cachedSummary) {
      console.log(`Cache hit for summary: ${videoId}:${mode}`);
      return NextResponse.json(cachedSummary);
    }

    console.log(`Generating summary for video ${videoId} in ${mode} mode...`);
    const summary = await summarizeWithFailover(
      transcript as TranscriptEntry[],
      mode as Mode,
      title || `Video ${videoId}`,
      videoId
    );
    console.log(`Summary generated successfully for video ${videoId}`);

    try {
      await setCachedSummary(videoId, mode as Mode, summary as unknown as Record<string, unknown>);
    } catch (cacheError) {
      console.warn("Failed to cache summary:", cacheError);
    }

    return NextResponse.json(summary);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate summary";

    console.error("Summarize error:", message);

    if (message.includes("API_KEY")) {
      return NextResponse.json(
        { error: "AI service not configured. Please set API keys in environment variables." },
        { status: 503 }
      );
    }

    if (message.includes("rate limit") || message.includes("429") || message.includes("quota")) {
      return NextResponse.json(
        {
          error: "All AI providers rate-limited. Please wait 60 seconds and try again.",
          retryAfter: 60,
        },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    if (message.includes("JSON") || message.includes("parse")) {
      return NextResponse.json(
        { error: "AI generated an invalid response. Please try again — this is usually temporary." },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}