import { NextRequest, NextResponse } from "next/server";
import { extractTranscript, extractVideoId } from "@/lib/youtube";
import { getCachedTranscript, setCachedTranscript } from "@/lib/kv";
import { ExtractResponse, TranscriptEntry } from "@/lib/types";

const MAX_TRANSCRIPT_CHARS = 240000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'url' field" },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);

    // Check cache first to avoid re-extracting
    try {
      const cached = await getCachedTranscript(videoId);
      if (cached && Array.isArray(cached.transcript) && cached.transcript.length > 0) {
        console.log(`[Extract] Cache hit for ${videoId}`);
        return NextResponse.json({
          videoId: (cached.videoId as string) || videoId,
          title: (cached.title as string) || `Video ${videoId}`,
          transcript: cached.transcript as TranscriptEntry[],
        } satisfies ExtractResponse);
      }
    } catch (e) {
      console.warn("Cache read failed, continuing with extraction:", e);
    }

    const result = await extractTranscript(url);

    const totalChars = result.transcript.reduce((sum, e) => sum + (e.text?.length || 0), 0);
    if (totalChars > MAX_TRANSCRIPT_CHARS) {
      return NextResponse.json(
        { error: `This video is too long (~${Math.round(Math.round(totalChars / 900) / 60 * 10) / 10} hours). We support videos up to ~4 hours. Please try a shorter video.` },
        { status: 413 }
      );
    }

    try {
      await setCachedTranscript(result.videoId, {
        videoId: result.videoId,
        title: result.title,
        transcript: result.transcript,
        extractedAt: Date.now(),
      });
    } catch (cacheError) {
      console.warn("Failed to cache transcript:", cacheError);
    }

    return NextResponse.json(result satisfies ExtractResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to extract transcript";

    if (message.includes("Invalid YouTube URL")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (
      message.includes("no transcripts") ||
      message.includes("disabled") ||
      message.includes("unavailable")
    ) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("Too many requests") || message.includes("captcha")) {
      return NextResponse.json(
        { error: "YouTube is rate limiting requests. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}