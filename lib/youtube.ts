import { ExtractResponse } from "./types";

const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

const INNER_TUBE_CLIENTS = [
  {
    name: "IOS",
    client: { clientName: "IOS", clientVersion: "19.29.1", hl: "en", gl: "US", deviceMake: "Apple", deviceModel: "iPhone16,2", osVersion: "17.5.1" },
    ua: "com.google.ios.youtube/19.29.1 (iPhone16,2; iOS 17.5.1)",
  },
  {
    name: "ANDROID",
    client: { clientName: "ANDROID", clientVersion: "19.29.37", hl: "en", gl: "US", androidSdkVersion: 30 },
    ua: "com.google.android.youtube/19.29.37 (Linux; U; Android 14)",
  },
  {
    name: "TVHTML5",
    client: { clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER", clientVersion: "2.0", hl: "en", gl: "US" },
    ua: "Mozilla/5.0 (TV; rv:88.0) Gecko/88.0 Firefox/88.0",
  },
  {
    name: "WEB",
    client: { clientName: "WEB", clientVersion: "2.20240510.00.00", hl: "en", gl: "US" },
    ua: BROWSER_UA,
  },
];

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

// Strategy 1: Scrape YouTube page HTML for caption tracks
async function tryWebPageScrape(
  videoId: string
): Promise<{ tracks: CaptionTrack[]; title: string } | null> {
  try {
    const response = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept-Language": "en-US,en;q=0.9",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      }
    );

    if (!response.ok) return null;

    const html = await response.text();

    // Extract ytInitialPlayerResponse from the page
    // YouTube puts it in: var ytInitialPlayerResponse = {...};
    const varStart = html.indexOf("var ytInitialPlayerResponse = ");
    if (varStart === -1) {
      // Try alternative format: ytInitialPlayerResponse = {...};
      const altStart = html.indexOf("ytInitialPlayerResponse = ");
      if (altStart === -1) return null;
    }

    const startMarker = "var ytInitialPlayerResponse = ";
    const startIndex = html.indexOf(startMarker);
    if (startIndex === -1) return null;

    const jsonStart = html.indexOf("{", startIndex);
    if (jsonStart === -1) return null;

    // Find the matching closing brace
    let depth = 0;
    let endIndex = -1;
    for (let i = jsonStart; i < html.length; i++) {
      if (html[i] === "{") depth++;
      else if (html[i] === "}") {
        depth--;
        if (depth === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    if (endIndex === -1) return null;

    const jsonStr = html.substring(jsonStart, endIndex);

    try {
      const playerData = JSON.parse(jsonStr);
      const tracks =
        playerData?.captions?.playerCaptionsTracklistRenderer
          ?.captionTracks;

      if (Array.isArray(tracks) && tracks.length > 0) {
        const title =
          playerData?.videoDetails?.title ||
          playerData?.microformat?.playerMicroformatRenderer?.title
            ?.simpleText ||
          `Video ${videoId}`;

        console.log(
          `Web scrape found ${tracks.length} caption tracks for ${videoId}`
        );
        return { tracks, title };
      }
    } catch (e) {
      console.log("Failed to parse ytInitialPlayerResponse:", (e as Error).message?.substring(0, 100));
    }

    console.log(`Web scrape found no captions for ${videoId}`);
    return null;
  } catch (error) {
    console.log(
      `Web scrape failed: ${error instanceof Error ? error.message : error}`
    );
    return null;
  }
}

// Strategy 2: InnerTube API with multiple client contexts
async function tryInnerTube(
  videoId: string
): Promise<{ tracks: CaptionTrack[]; title: string } | null> {
  for (const client of INNER_TUBE_CLIENTS) {
    try {
      const body = {
        context: { client: client.client },
        videoId,
      };

      const response = await fetch(INNERTUBE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": client.ua,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const tracks =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (Array.isArray(tracks) && tracks.length > 0) {
        const title =
          data?.videoDetails?.title || `Video ${videoId}`;

        console.log(
          `InnerTube ${client.name} found ${tracks.length} caption tracks`
        );
        return { tracks, title };
      }
    } catch (e) {
      console.log(
        `InnerTube ${client.name} failed: ${e instanceof Error ? e.message : e}`
      );
    }
  }
  return null;
}

export async function extractTranscript(
  url: string
): Promise<ExtractResponse> {
  const videoId = extractVideoId(url);

  // Strategy 1: Scrape the YouTube page HTML (most reliable)
  const pageResult = await tryWebPageScrape(videoId);
  if (pageResult && pageResult.tracks.length > 0) {
    const selected = selectCaptionTrack(pageResult.tracks);
    const lang = selected.languageCode || "en";

    try {
      const xml = await fetchCaptionXml(selected);
      const transcript = parseXmlTranscript(xml, lang);

      if (transcript && transcript.length > 0) {
        return { videoId, title: pageResult.title, transcript };
      }
    } catch (e) {
      console.log("Failed to parse captions from web scrape:", (e as Error).message);
    }
  }

  // Strategy 2: InnerTube API
  const apiResult = await tryInnerTube(videoId);
  if (apiResult && apiResult.tracks.length > 0) {
    const selected = selectCaptionTrack(apiResult.tracks);
    const lang = selected.languageCode || "en";

    try {
      const xml = await fetchCaptionXml(selected);
      const transcript = parseXmlTranscript(xml, lang);

      if (transcript && transcript.length > 0) {
        return { videoId, title: apiResult.title, transcript };
      }
    } catch (e) {
      console.log("Failed to parse captions from InnerTube:", (e as Error).message);
    }
  }

  throw new Error(
    `Could not extract transcript for video ${videoId}. ` +
      `This can happen when: 1) The video has captions disabled, ` +
      `2) YouTube is blocking server requests, 3) The video is private. ` +
      `Try a different video or try again later.`
  );
}