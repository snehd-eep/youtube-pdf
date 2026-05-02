import { ExtractResponse } from "./types";

const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)";

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

const INNERTUBE_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

const INNER_TUBE_CLIENTS = [
  {
    name: "ANDROID",
    client: { clientName: "ANDROID", clientVersion: "20.10.38" },
    ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
  },
  {
    name: "IOS",
    client: {
      clientName: "IOS",
      clientVersion: "20.10.38",
      hl: "en",
      gl: "US",
    },
    ua: "com.google.ios.youtube/20.10.38 (iPhone16,2; iOS 17.5.1)",
  },
  {
    name: "WEB",
    client: {
      clientName: "WEB",
      clientVersion: "2.20240510.00.00",
      hl: "en",
      gl: "US",
    },
    ua: BROWSER_UA,
  },
];

function proxyUrl(url: string): string {
  return `https://corsproxy.io/?${encodeURIComponent(url)}`;
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
        signal: AbortSignal.timeout(10000),
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
  try {
    const response = await fetch(
      proxyUrl(`https://www.youtube.com/watch?v=${videoId}`),
      {
        headers: { Accept: "text/html,*/*" },
        signal: AbortSignal.timeout(10000),
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

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    );
}

function parseXmlTranscript(xml: string, lang: string): TranscriptEntry[] {
  const results: TranscriptEntry[] = [];

  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(match[1], 10);
    const durMs = parseInt(match[2], 10);
    let text = match[3] || "";

    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sText = "";
    let sMatch: RegExpExecArray | null;
    while ((sRegex.lastIndex = sText.length > 0 ? sRegex.lastIndex : 0, (sMatch = sRegex.exec(text)) !== null)) {
      sText += sMatch[1];
    }
    if (sText.trim()) {
      text = sText.trim();
    } else {
      text = text.replace(/<[^>]+>/g, "");
    }

    text = decodeEntities(text).replace(/\n/g, " ").trim();
    if (text) {
      results.push({ text, duration: durMs, offset: startMs, lang });
    }
  }

  if (results.length > 0) return results;

  const textRegex =
    /<text\s+start="([^"]*)"\s+dur="([^"]*)"[^>]*>([^<]*)<\/text>/g;
  while ((match = textRegex.exec(xml)) !== null) {
    const start = parseFloat(match[1]) * 1000;
    const dur = parseFloat(match[2]) * 1000;
    let text = decodeEntities(match[3]).replace(/\n/g, " ").trim();
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

  // 1. Direct fetch (works locally, fast)
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/xml,*/*" },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const text = await r.text();
      if (text.length > 100) {
        console.log("Caption: direct fetch succeeded");
        return text;
      }
    }
  } catch {}

  // 2. Proxy fetch via corsproxy.io (works on Vercel/cloud)
  try {
    const r = await fetch(proxyUrl(url), {
      headers: { Accept: "text/xml,*/*" },
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const text = await r.text();
      if (text.length > 100 && text.includes("<")) {
        console.log("Caption: proxy fetch succeeded");
        return text;
      }
    }
  } catch {}

  throw new Error("Failed to fetch caption XML from all methods");
}

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
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) continue;

      const data = await response.json();

      if (data?.playabilityStatus?.status !== "OK") continue;

      const tracks =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (Array.isArray(tracks) && tracks.length > 0) {
        const title = data?.videoDetails?.title || `Video ${videoId}`;
        console.log(
          `InnerTube ${client.name} found ${tracks.length} caption tracks for ${videoId}`
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

async function tryWebPageScrape(
  videoId: string
): Promise<{ tracks: CaptionTrack[]; title: string } | null> {
  const fetchStrategies = [
    // Direct fetch
    async () => {
      const r = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept-Language": "en-US,en;q=0.9",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(8000),
      });
      return r;
    },
    // Proxy fetch
    async () => {
      const r = await fetch(
        proxyUrl(`https://www.youtube.com/watch?v=${videoId}`),
        {
          headers: { Accept: "text/html,*/*" },
          signal: AbortSignal.timeout(10000),
        }
      );
      return r;
    },
  ];

  for (const fetchFn of fetchStrategies) {
    try {
      const response = await fetchFn();
      if (!response.ok) continue;

      const html = await response.text();

      if (html.includes('class="g-recaptcha"')) continue;

      const startMarker = "var ytInitialPlayerResponse = ";
      const startIndex = html.indexOf(startMarker);
      if (startIndex === -1) continue;

      const jsonStart = html.indexOf("{", startIndex);
      if (jsonStart === -1) continue;

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

      if (endIndex === -1) continue;

      const jsonStr = html.substring(jsonStart, endIndex);

      const playerData = JSON.parse(jsonStr);
      const tracks =
        playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (Array.isArray(tracks) && tracks.length > 0) {
        const title =
          playerData?.videoDetails?.title ||
          playerData?.microformat?.playerMicroformatRenderer?.title?.simpleText ||
          `Video ${videoId}`;

        console.log(
          `Web scrape found ${tracks.length} caption tracks for ${videoId}`
        );
        return { tracks, title };
      }
    } catch (e) {
      console.log(`Web scrape strategy failed: ${(e as Error).message}`);
    }
  }
  return null;
}

export async function extractTranscript(
  url: string
): Promise<ExtractResponse> {
  const videoId = extractVideoId(url);

  type StrategyResult = { tracks: CaptionTrack[]; title: string } | null;
  type StrategyFn = () => Promise<StrategyResult>;

  const findTrackStrategies: StrategyFn[] = [
    () => tryInnerTube(videoId),
    () => tryWebPageScrape(videoId),
  ];

  for (const strategy of findTrackStrategies) {
    const result = await strategy();
    if (!result || result.tracks.length === 0) continue;

    const selected = selectCaptionTrack(result.tracks);
    const lang = selected.languageCode || "en";

    try {
      const xml = await fetchCaptionXml(selected);
      const transcript = parseXmlTranscript(xml, lang);

      if (transcript && transcript.length > 0) {
        return { videoId, title: result.title, transcript };
      }
    } catch (e) {
      console.log(`Caption fetch failed: ${(e as Error).message}`);
    }
  }

  throw new Error(
    `Could not extract transcript for video ${videoId}. ` +
      `This can happen when: 1) The video has captions disabled, ` +
      `2) YouTube is blocking server requests, 3) The video is private. ` +
      `Try a different video or try again later.`
  );
}