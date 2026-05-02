import { YoutubeTranscript } from "youtube-transcript";
import { ExtractResponse } from "./types";

const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player";

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  name?: { simpleText: string };
  kind?: string;
}

interface TranscriptEntry {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
}

export function extractVideoId(input: string): string {
  if (input.length === 11 && /^[a-zA-Z0-9_-]+$/.test(input)) {
    return input;
  }
  const match = input.match(RE_YOUTUBE);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error(
    "Invalid YouTube URL. Please provide a valid YouTube video URL or video ID."
  );
}

export async function getVideoTitle(videoId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept-Language": "en-US,en;q=0.9",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

function makeBrowserFetch(): typeof globalThis.fetch {
  return async (url: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", BROWSER_UA);
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

async function tryWithLib(videoId: string): Promise<TranscriptEntry[] | null> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      fetch: makeBrowserFetch(),
    });
    if (transcript && transcript.length > 0) {
      return transcript.map((e) => ({
        text: e.text,
        duration: e.duration,
        offset: e.offset,
        lang: e.lang,
      }));
    }
  } catch (e) {
    console.log("youtube-transcript lib failed:", (e as Error).message);
  }
  return null;
}

async function tryWithInnerTube(
  videoId: string,
  clientName: string,
  clientVersion: string,
  userAgent: string,
  extraContext?: Record<string, unknown>
): Promise<{ tracks: CaptionTrack[]; title: string } | null> {
  try {
    const clientObj: Record<string, unknown> = {
      clientName,
      clientVersion,
      hl: "en",
      gl: "US",
      ...extraContext,
    };

    const body = {
      context: { client: clientObj },
      videoId,
    };

    const response = await fetch(INNERTUBE_URL + "?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": userAgent,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const tracks =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    const title =
      data?.videoDetails?.title ||
      data?.microformat?.playerMicroformatRenderer?.title?.simpleText ||
      `Video ${videoId}`;

    return { tracks, title };
  } catch (e) {
    console.log(`InnerTube ${clientName} failed:`, (e as Error).message);
    return null;
  }
}

const INNER_TUBE_CLIENTS = [
  {
    name: "IOS",
    version: "19.29.1",
    ua: "com.google.ios.youtube/19.29.1 (iPhone16,2; iOS 17.5.1)",
    extra: { deviceMake: "Apple", deviceModel: "iPhone16,2", osVersion: "17.5.1" },
  },
  {
    name: "ANDROID",
    version: "19.29.37",
    ua: "com.google.android.youtube/19.29.37 (Linux; U; Android 14)",
    extra: { androidSdkVersion: 30 },
  },
  {
    name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    version: "2.0",
    ua: "Mozilla/5.0 (TV; rv:88.0) Gecko/88.0 Firefox/88.0",
    extra: {},
  },
  {
    name: "WEB",
    version: "2.20240510.00.00",
    ua: BROWSER_UA,
    extra: {},
  },
];

function selectCaptionTrack(tracks: CaptionTrack[]): CaptionTrack {
  const manualEn = tracks.find(
    (t) => t.languageCode === "en" && t.kind !== "asr"
  );
  if (manualEn) return manualEn;

  const autoEn = tracks.find((t) => t.languageCode === "en");
  if (autoEn) return autoEn;

  const manualAny = tracks.find((t) => t.kind !== "asr");
  if (manualAny) return manualAny;

  return tracks[0];
}

async function fetchCaptionXml(track: CaptionTrack): Promise<string> {
  let url = track.baseUrl;
  if (!url.includes("fmt=")) {
    url += (url.includes("?") ? "&" : "?") + "fmt=srv3";
  }

  const response = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, Accept: "text/xml,*/*" },
  });

  if (response.ok) {
    return response.text();
  }

  const fallback = await fetch(track.baseUrl, {
    headers: { "User-Agent": BROWSER_UA },
  });
  if (fallback.ok) {
    return fallback.text();
  }

  throw new Error(`Failed to fetch caption XML: ${response.status}`);
}

function parseXmlTranscript(xml: string, lang: string): TranscriptEntry[] {
  const results: TranscriptEntry[] = [];

  const htmlUnescape: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };

  const unescape = (s: string) =>
    s.replace(/&[^;]+;/g, (m) => htmlUnescape[m] || m);

  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(match[1], 10);
    const durMs = parseInt(match[2], 10);
    let text = match[3] || "";

    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sText = "";
    let sMatch: RegExpExecArray | null;
    while ((sMatch = sRegex.exec(text)) !== null) {
      sText += sMatch[1] + " ";
    }
    if (sText.trim()) {
      text = sText.trim();
    } else {
      text = text.replace(/<[^>]+>/g, "");
    }

    text = unescape(text).replace(/\n/g, " ").trim();
    if (text) {
      results.push({ text, duration: durMs, offset: startMs, lang });
    }
  }

  if (results.length > 0) return results;

  const textRegex = /<text\s+start="([^"]*)"\s+dur="([^"]*)"[^>]*>([^<]*)<\/text>/g;
  while ((match = textRegex.exec(xml)) !== null) {
    const start = parseFloat(match[1]) * 1000;
    const dur = parseFloat(match[2]) * 1000;
    let text = unescape(match[3]).replace(/\n/g, " ").trim();
    if (text) {
      results.push({ text, duration: dur, offset: start, lang });
    }
  }

  return results;
}

export async function extractTranscript(
  url: string
): Promise<ExtractResponse> {
  const videoId = extractVideoId(url);

  // Strategy 1: Try youtube-transcript library (works locally)
  const libResult = await tryWithLib(videoId);
  if (libResult && libResult.length > 0) {
    const title = await getVideoTitle(videoId);
    return { videoId, title, transcript: libResult };
  }

  // Strategy 2: Try InnerTube API with multiple client contexts (for Vercel/serverless)
  for (const client of INNER_TUBE_CLIENTS) {
    const result = await tryWithInnerTube(
      videoId,
      client.name,
      client.version,
      client.ua,
      client.extra
    );
    if (!result) continue;

    const selected = selectCaptionTrack(result.tracks);
    const lang = selected.languageCode || "en";

    try {
      const xml = await fetchCaptionXml(selected);
      const transcript = parseXmlTranscript(xml, lang);

      if (transcript && transcript.length > 0) {
        return { videoId, title: result.title, transcript };
      }
    } catch (e) {
      console.log(
        `Failed to parse captions from ${client.name}:`,
        (e as Error).message
      );
    }
  }

  throw new Error(
    `Could not extract transcript for video ${videoId}. ` +
      `This can happen when: 1) The video has captions disabled, ` +
      `2) YouTube is blocking server requests, 3) The video is private. ` +
      `Try a different video or try again later.`
  );
}