import { YoutubeTranscript } from "youtube-transcript";
import { ExtractResponse } from "./types";

const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ANDROID_USER_AGENT =
  "com.google.android.youtube/20.10.38 (Linux; U; Android 14)";

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
          "User-Agent": BROWSER_USER_AGENT,
          "Accept-Language": "en-US,en;q=0.9",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      }
    );
    if (response.ok) {
      const html = await response.text();
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        return titleMatch[1].replace(" - YouTube", "").trim();
      }
    }
  } catch {}
  return `Video ${videoId}`;
}

function createBrowserFetch(): typeof globalThis.fetch {
  return async (url: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", BROWSER_USER_AGENT);
    }
    if (!headers.has("Accept-Language")) {
      headers.set("Accept-Language", "en-US,en;q=0.9");
    }
    if (!headers.has("Accept")) {
      headers.set("Accept", "*/*");
    }
    return globalThis.fetch(url, { ...init, headers });
  };
}

function createAndroidFetch(): typeof globalThis.fetch {
  return async (url: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set("User-Agent", ANDROID_USER_AGENT);
    headers.set("Content-Type", "application/json");
    return globalThis.fetch(url, { ...init, headers });
  };
}

export async function extractTranscript(
  url: string
): Promise<ExtractResponse> {
  const videoId = extractVideoId(url);

  const approaches = [
    { name: "browser-fetch", fetch: createBrowserFetch() },
    { name: "android-fetch", fetch: createAndroidFetch() },
    { name: "default-fetch", fetch: undefined },
  ];

  let lastError: Error | null = null;

  for (const approach of approaches) {
    try {
      const config = approach.fetch ? { fetch: approach.fetch } : undefined;
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, config);

      if (transcript && transcript.length > 0) {
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
    } catch (error) {
      lastError = error as Error;
      console.log(`Transcript approach "${approach.name}" failed: ${lastError.message}, trying next...`);
    }
  }

  throw new Error(
    `Could not extract transcript for video ${videoId}. ` +
    `This can happen when: 1) The video has captions disabled, 2) YouTube is blocking requests from the server, 3) The video is private or unavailable. ` +
    `Error: ${lastError?.message || "All approaches failed"}`
  );
}