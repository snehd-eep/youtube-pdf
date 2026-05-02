import { ExtractResponse } from "./types";

const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

const INNERTUBE_API_URL = "https://www.youtube.com/youtubei/v1/player";

const CLIENTS = {
  android: {
    clientName: "ANDROID",
    clientVersion: "19.29.37",
    androidSdkVersion: 30,
    userAgent: "com.google.android.youtube/19.29.37 (Linux; U; Android 14)",
  },
  ios: {
    clientName: "IOS",
    clientVersion: "19.29.1",
    deviceMake: "Apple",
    deviceModel: "iPhone16,2",
    osVersion: "17.5.1",
    userAgent: "com.google.ios.youtube/19.29.1 (iPhone16,2; iOS 17.5.1)",
  },
  web: {
    clientName: "WEB",
    clientVersion: "2.20240510.00.00",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  },
  tvhtml5: {
    clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    clientVersion: "2.0",
    userAgent: "Mozilla/5.0 (TV; rv:88.0) Gecko/88.0 Firefox/88.0",
  },
};

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
  const clients = [CLIENTS.android, CLIENTS.ios, CLIENTS.web];
  for (const client of clients) {
    try {
      const body = buildInnerTubeBody(client, videoId);
      const response = await fetch(INNERTUBE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": client.userAgent,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const title =
        data?.videoDetails?.title ||
        data?.microformat?.playerMicroformatRenderer?.title?.simpleText;
      if (title) return title;
    } catch {}
  }
  return `Video ${videoId}`;
}

function buildInnerTubeBody(
  client: (typeof CLIENTS)[keyof typeof CLIENTS],
  videoId: string
) {
  const clientContext: Record<string, unknown> = {
    clientName: client.clientName,
    clientVersion: client.clientVersion,
    hl: "en",
    gl: "US",
  };

  if ("androidSdkVersion" in client) {
    clientContext.androidSdkVersion = client.androidSdkVersion;
  }
  if ("deviceMake" in client) {
    clientContext.deviceMake = client.deviceMake;
    clientContext.deviceModel = client.deviceModel;
    clientContext.osVersion = client.osVersion;
  }

  return {
    context: {
      client: clientContext,
    },
    videoId,
  };
}

async function getCaptionTracks(
  videoId: string
): Promise<{ tracks: CaptionTrack[]; clientName: string }> {
  const clientOrder = [CLIENTS.ios, CLIENTS.android, CLIENTS.tvhtml5, CLIENTS.web];

  for (const client of clientOrder) {
    try {
      const body = buildInnerTubeBody(client, videoId);
      const response = await fetch(INNERTUBE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": client.userAgent,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const tracks =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (Array.isArray(tracks) && tracks.length > 0) {
        console.log(
          `Got ${tracks.length} caption tracks via ${client.clientName} client`
        );
        return { tracks, clientName: client.clientName };
      }
    } catch (error) {
      console.log(
        `InnerTube ${client.clientName} failed: ${error instanceof Error ? error.message : error}`
      );
      continue;
    }
  }

  throw new Error(
    "No captions available for this video. The video may have captions disabled or may not have auto-generated captions yet."
  );
}

async function fetchCaptionXml(
  captionTrack: CaptionTrack
): Promise<string> {
  const url = new URL(captionTrack.baseUrl);
  url.searchParams.set("fmt", "srv3");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": CLIENTS.ios.userAgent,
      Accept: "text/xml,application/xml",
    },
  });

  if (!response.ok) {
    const fallbackResponse = await fetch(captionTrack.baseUrl, {
      headers: {
        "User-Agent": CLIENTS.ios.userAgent,
      },
    });
    if (!fallbackResponse.ok) {
      throw new Error(`Failed to fetch captions: ${fallbackResponse.status}`);
    }
    return fallbackResponse.text();
  }

  return response.text();
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
    let sMatch: RegExpExecArray | null;
    let sText = "";
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
      results.push({
        text,
        duration: durMs,
        offset: startMs,
        lang,
      });
    }
  }

  if (results.length > 0) return results;

  const textRegex = /<text\s+start="([^"]*)"\s+dur="([^"]*)"[^>]*>([^<]*)<\/text>/g;
  while ((match = textRegex.exec(xml)) !== null) {
    const start = parseFloat(match[1]) * 1000;
    const dur = parseFloat(match[2]) * 1000;
    let text = unescape(match[3]).replace(/\n/g, " ").trim();
    if (text) {
      results.push({
        text,
        duration: dur,
        offset: start,
        lang,
      });
    }
  }

  return results;
}

function selectCaptionTrack(tracks: CaptionTrack[]): CaptionTrack {
  const manualEn = tracks.find(
    (t) => t.languageCode === "en" && t.kind !== "asr"
  );
  if (manualEn) return manualEn;

  const autoEn = tracks.find((t) => t.languageCode === "en");
  if (autoEn) return autoEn;

  const manualFirst = tracks.find((t) => t.kind !== "asr");
  if (manualFirst) return manualFirst;

  return tracks[0];
}

export async function extractTranscript(
  url: string
): Promise<ExtractResponse> {
  const videoId = extractVideoId(url);

  const { tracks } = await getCaptionTracks(videoId);

  const selected = selectCaptionTrack(tracks);
  const lang = selected.languageCode || "en";

  console.log(
    `Fetching caption track: lang=${lang}, kind=${selected.kind || "manual"}, name=${selected.name?.simpleText || "N/A"}`
  );

  const xml = await fetchCaptionXml(selected);
  const transcript = parseXmlTranscript(xml, lang);

  if (!transcript || transcript.length === 0) {
    throw new Error(
      "Transcript was found but could not be parsed. Please try a different video."
    );
  }

  const title = await getVideoTitle(videoId);

  return {
    videoId,
    title,
    transcript,
  };
}