import { ExtractResponse } from "./types";

const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)";

const YT_PROXY = process.env.YT_PROXY_URL || "https://yt-proxy.snehd-yt-proxy.workers.dev";

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
    const response = await proxyFetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      { headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" } }
    );
    if (response.ok) {
      const titleMatch = response.body.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        return titleMatch[1].replace(" - YouTube", "").trim();
      }
    }
  } catch {}
  try {
    const data = await proxyInnerTube(videoId, "ANDROID");
    if (data) return data.videoDetails?.title || `Video ${videoId}`;
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
    const originalLastIndex = sRegex.lastIndex;
    sRegex.lastIndex = 0;
    while ((sMatch = sRegex.exec(text)) !== null) {
      sText += sMatch[1];
    }
    sRegex.lastIndex = originalLastIndex;
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
    const text = decodeEntities(match[3]).replace(/\n/g, " ").trim();
    if (text) {
      results.push({ text, duration: dur, offset: start, lang });
    }
  }

  return results;
}

async function proxyFetch(
  targetUrl: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<{ ok: boolean; status: number; body: string }> {
  const proxyUrl = `${YT_PROXY}?url=${encodeURIComponent(targetUrl)}`;
  const response = await fetch(proxyUrl, {
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body || undefined,
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.text();
  return { ok: response.ok, status: response.status, body };
}

async function proxyInnerTube(
  videoId: string,
  clientName: string
): Promise<any> {
  const client = INNER_TUBE_CLIENTS.find((c) => c.name === clientName);
  if (!client) return null;

  const body = JSON.stringify({
    context: { client: client.client },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  });

  const proxyUrl = `${YT_PROXY}?url=${encodeURIComponent(INNERTUBE_URL)}`;
  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": client.ua,
    },
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data?.playabilityStatus?.status !== "OK") return null;

  const tracks =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (Array.isArray(tracks) && tracks.length > 0) {
    return data;
  }

  return null;
}

async function tryInnerTubeDirect(
  videoId: string
): Promise<{ tracks: CaptionTrack[]; title: string } | null> {
  for (const client of INNER_TUBE_CLIENTS) {
    try {
      const body = JSON.stringify({
        context: { client: client.client },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      });

      const response = await fetch(INNERTUBE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": client.ua,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (data?.playabilityStatus?.status !== "OK") continue;

      const tracks =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (Array.isArray(tracks) && tracks.length > 0) {
        const title = data?.videoDetails?.title || `Video ${videoId}`;
        console.log(`InnerTube ${client.name} found ${tracks.length} tracks`);
        return { tracks, title };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function tryInnerTubeViaProxy(
  videoId: string
): Promise<{ tracks: CaptionTrack[]; title: string } | null> {
  for (const client of INNER_TUBE_CLIENTS) {
    try {
      const data = await proxyInnerTube(videoId, client.name);
      if (!data) continue;

      const tracks =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (Array.isArray(tracks) && tracks.length > 0) {
        const title = data?.videoDetails?.title || `Video ${videoId}`;
        console.log(`Proxy+InnerTube ${client.name} found ${tracks.length} tracks`);
        return { tracks, title };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function tryWebPageDirect(
  videoId: string
): Promise<{ tracks: CaptionTrack[]; title: string } | null> {
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
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) return null;
    const html = await response.text();
    return parsePlayerResponse(html, videoId);
  } catch {
    return null;
  }
}

async function tryWebPageViaProxy(
  videoId: string
): Promise<{ tracks: CaptionTrack[]; title: string } | null> {
  try {
    const result = await proxyFetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept-Language": "en-US,en;q=0.9",
        },
      }
    );

    if (!result.ok) return null;
    return parsePlayerResponse(result.body, videoId);
  } catch {
    return null;
  }
}

function parsePlayerResponse(
  html: string,
  videoId: string
): { tracks: CaptionTrack[]; title: string } | null {
  if (html.includes('class="g-recaptcha"')) return null;

  const startMarker = "var ytInitialPlayerResponse = ";
  const startIndex = html.indexOf(startMarker);
  if (startIndex === -1) return null;

  const jsonStart = html.indexOf("{", startIndex);
  if (jsonStart === -1) return null;

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

  try {
    const playerData = JSON.parse(html.substring(jsonStart, endIndex));
    const tracks =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (Array.isArray(tracks) && tracks.length > 0) {
      const title =
        playerData?.videoDetails?.title ||
        playerData?.microformat?.playerMicroformatRenderer?.title?.simpleText ||
        `Video ${videoId}`;
      return { tracks, title };
    }
  } catch {}

  return null;
}

async function fetchCaptionXml(track: CaptionTrack): Promise<string> {
  let url = track.baseUrl;
  if (!url.includes("fmt=")) {
    url += (url.includes("?") ? "&" : "?") + "fmt=srv3";
  }

  const onServerless = isServerless();

  // On serverless, prefer proxy first (direct always fails on Vercel IPs)
  const fetchOrder: Array<() => Promise<string | null>> = onServerless
    ? [
        // Proxy first on serverless
        async () => {
          try {
            const result = await proxyFetch(url, { headers: { Accept: "text/xml,*/*" } });
            if (result.ok && result.body.length > 100 && result.body.includes("<")) {
              console.log("Caption: proxy fetch succeeded");
              return result.body;
            }
          } catch {}
          return null;
        },
        // Direct as fallback
        async () => {
          try {
            const response = await fetch(url, {
              headers: { "User-Agent": BROWSER_UA, Accept: "text/xml,*/*" },
              signal: AbortSignal.timeout(5000),
            });
            if (response.ok) {
              const text = await response.text();
              if (text.length > 100) {
                console.log("Caption: direct fetch succeeded");
                return text;
              }
            }
          } catch {}
          return null;
        },
      ]
    : [
        // Direct first on local
        async () => {
          try {
            const response = await fetch(url, {
              headers: { "User-Agent": BROWSER_UA, Accept: "text/xml,*/*" },
              signal: AbortSignal.timeout(8000),
            });
            if (response.ok) {
              const text = await response.text();
              if (text.length > 100) {
                console.log("Caption: direct fetch succeeded");
                return text;
              }
            }
          } catch {}
          return null;
        },
        async () => {
          try {
            const result = await proxyFetch(url, { headers: { Accept: "text/xml,*/*" } });
            if (result.ok && result.body.length > 100 && result.body.includes("<")) {
              console.log("Caption: proxy fetch succeeded");
              return result.body;
            }
          } catch {}
          return null;
        },
      ];

  for (const fn of fetchOrder) {
    const result = await fn();
    if (result) return result;
  }

  // If not English, try translating with &tlang=en
  if (track.languageCode !== "en") {
    const separator = url.includes("?") ? "&" : "?";
    const translatedUrl = url + separator + "tlang=en";
    console.log(`Caption: trying tlang=en translation for ${track.languageCode}`);

    const translationOrder: Array<() => Promise<string | null>> = onServerless
      ? [
          async () => {
            try {
              const result = await proxyFetch(translatedUrl, { headers: { Accept: "text/xml,*/*" } });
              if (result.ok && result.body.length > 100 && (result.body.includes("<p") || result.body.includes("<text"))) {
                console.log(`Caption: proxy tlang=en translation succeeded for ${track.languageCode}`);
                return result.body;
              }
            } catch {}
            return null;
          },
          async () => {
            try {
              const response = await fetch(translatedUrl, {
                headers: { "User-Agent": BROWSER_UA, Accept: "text/xml,*/*" },
                signal: AbortSignal.timeout(5000),
              });
              if (response.ok) {
                const text = await response.text();
                if (text.length > 100 && (text.includes("<p") || text.includes("<text"))) {
                  console.log(`Caption: direct tlang=en translation succeeded for ${track.languageCode}`);
                  return text;
                }
              }
            } catch {}
            return null;
          },
        ]
      : [
          async () => {
            try {
              const response = await fetch(translatedUrl, {
                headers: { "User-Agent": BROWSER_UA, Accept: "text/xml,*/*" },
                signal: AbortSignal.timeout(8000),
              });
              if (response.ok) {
                const text = await response.text();
                if (text.length > 100 && (text.includes("<p") || text.includes("<text"))) {
                  console.log(`Caption: direct tlang=en translation succeeded for ${track.languageCode}`);
                  return text;
                }
              }
            } catch {}
            return null;
          },
          async () => {
            try {
              const result = await proxyFetch(translatedUrl, { headers: { Accept: "text/xml,*/*" } });
              if (result.ok && result.body.length > 100 && (result.body.includes("<p") || result.body.includes("<text"))) {
                console.log(`Caption: proxy tlang=en translation succeeded for ${track.languageCode}`);
                return result.body;
              }
            } catch {}
            return null;
          },
        ];

    for (const fn of translationOrder) {
      const result = await fn();
      if (result) return result;
    }
  }

  throw new Error("Failed to fetch caption XML");
}

function isServerless(): boolean {
  return !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY
  );
}

async function extractTranscriptWithRetry(
  url: string,
  maxRetries: number = 1
): Promise<ExtractResponse> {
  const videoId = extractVideoId(url);

  type StrategyResult = { tracks: CaptionTrack[]; title: string } | null;
  type StrategyFn = () => Promise<StrategyResult>;

  const onServerless = isServerless();

  const trackStrategies: StrategyFn[] = onServerless
    ? [
        () => tryInnerTubeViaProxy(videoId),
        () => tryWebPageViaProxy(videoId),
      ]
    : [
        () => tryInnerTubeDirect(videoId),
        () => tryWebPageDirect(videoId),
        () => tryInnerTubeViaProxy(videoId),
        () => tryWebPageViaProxy(videoId),
      ];

  const errors: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = onServerless ? 2000 : 1000;
      console.log(`[Extract] Retry attempt ${attempt}/${maxRetries} for ${videoId} after ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    for (const strategy of trackStrategies) {
      const result = await strategy();
      if (!result || result.tracks.length === 0) continue;

      const preferred = selectCaptionTrack(result.tracks);
      const seen = new Set<string>();
      const uniqueTracks: CaptionTrack[] = [];

      const preferredKey = preferred.baseUrl.split("&")[0];
      seen.add(preferredKey);
      uniqueTracks.push(preferred);

      for (const t of result.tracks) {
        const key = t.baseUrl.split("&")[0];
        if (!seen.has(key)) {
          seen.add(key);
          uniqueTracks.push(t);
        }
      }

      for (const track of uniqueTracks) {
        const lang = track.languageCode || "en";

        try {
          const xml = await fetchCaptionXml(track);
          const transcript = parseXmlTranscript(xml, lang);

          if (transcript && transcript.length > 0) {
            return { videoId, title: result.title, transcript };
          }
        } catch (e) {
          const msg = (e as Error).message;
          console.log(`Caption fetch failed for ${lang}: ${msg}`);
          errors.push(`attempt${attempt} ${strategy.name || "strategy"} ${lang}: ${msg}`);
        }
      }
    }
  }

  throw new Error(
    `Could not extract transcript for video ${videoId}. ` +
      `This can happen when: 1) The video has captions disabled, ` +
      `2) YouTube is blocking server requests, 3) The video is private. ` +
      `Try a different video or try again later.`
  );
}

export async function extractTranscript(
  url: string
): Promise<ExtractResponse> {
  return extractTranscriptWithRetry(url, 1);
}