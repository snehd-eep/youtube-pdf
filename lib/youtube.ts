import { fetchTranscript } from "youtube-transcript";
import { ExtractResponse } from "./types";

const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

export function extractVideoId(input: string): string {
  if (input.length === 11 && /^[a-zA-Z0-9_-]+$/.test(input)) {
    return input;
  }
  const match = input.match(RE_YOUTUBE);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error("Invalid YouTube URL. Please provide a valid YouTube video URL or video ID.");
}

export async function getVideoTitle(videoId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    );
    const html = await response.text();
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      return titleMatch[1].replace(" - YouTube", "").trim();
    }
  } catch {}
  return `Video ${videoId}`;
}

export async function extractTranscript(
  url: string
): Promise<ExtractResponse> {
  const videoId = extractVideoId(url);
  const transcript = await fetchTranscript(videoId);

  if (!transcript || transcript.length === 0) {
    throw new Error(
      "No transcript available for this video. The video may have captions disabled or may not have auto-generated captions yet."
    );
  }

  const title = await getVideoTitle(videoId);

  return {
    videoId,
    title,
    transcript: transcript.map((entry) => ({
      text: entry.text,
      duration: entry.duration,
      offset: entry.offset,
    })),
  };
}