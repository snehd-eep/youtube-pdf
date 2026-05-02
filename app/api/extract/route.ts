import { NextRequest, NextResponse } from "next/server";
import { extractTranscript } from "@/lib/youtube";
import { setCachedTranscript } from "@/lib/kv";
import { ExtractResponse } from "@/lib/types";

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

    const result = await extractTranscript(url);

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