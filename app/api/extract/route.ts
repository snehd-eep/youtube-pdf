import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    const body = await request.json();
    const { url } = body;
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const RE_YOUTUBE = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const videoId = url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url) ? url : url.match(RE_YOUTUBE)?.[1];
    if (!videoId) {
      return NextResponse.json({ error: "Invalid URL", logs }, { status: 400 });
    }

    log(`Video ID: ${videoId}`);

    const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
    const CLIENTS = [
      { name: "ANDROID", client: { clientName: "ANDROID", clientVersion: "20.10.38" }, ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)" },
      { name: "IOS", client: { clientName: "IOS", clientVersion: "20.10.38", hl: "en", gl: "US" }, ua: "com.google.ios.youtube/20.10.38 (iPhone16,2; iOS 17.5.1)" },
    ];

    // Strategy 1: InnerTube API
    for (const c of CLIENTS) {
      try {
        log(`Trying InnerTube ${c.name}...`);
        const r = await fetch(INNERTUBE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": c.ua },
          body: JSON.stringify({ context: { client: c.client }, videoId }),
          signal: AbortSignal.timeout(8000),
        });
        log(`  Status: ${r.status}`);
        if (!r.ok) continue;
        const data = await r.json();
        log(`  Playability: ${data?.playabilityStatus?.status}`);
        const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        log(`  Tracks: ${Array.isArray(tracks) ? tracks.length : 0}`);
        if (Array.isArray(tracks) && tracks.length > 0) {
          const track = tracks.find((t: any) => t.languageCode === "en") || tracks[0];
          const title = data?.videoDetails?.title || `Video ${videoId}`;
          log(`  Selected track: ${track.languageCode} kind=${track.kind || "manual"}`);
          log(`  baseUrl: ${track.baseUrl.substring(0, 80)}...`);

          // Try direct caption fetch
          log("  Fetching caption XML (direct)...");
          try {
            let capUrl = track.baseUrl;
            if (!capUrl.includes("fmt=")) capUrl += "&fmt=srv3";
            const cr = await fetch(capUrl, {
              headers: { "User-Agent": c.ua, Accept: "text/xml,*/*" },
              signal: AbortSignal.timeout(8000),
            });
            const ct = await cr.text();
            log(`  Direct: status=${cr.status} length=${ct.length}`);
            if (ct.length > 100) {
              log(`  Direct caption SUCCESS (${ct.length} chars)`);
              // Parse and return
              const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
              const entries: {text:string,duration:number,offset:number}[] = [];
              let m;
              while ((m = pRegex.exec(ct)) !== null) {
                let text = m[3] || "";
                text = text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
                if (text) entries.push({ text, duration: parseInt(m[2],10), offset: parseInt(m[1],10) });
              }
              if (entries.length > 0) {
                return NextResponse.json({ videoId, title, transcript: entries, debug: logs });
              }
            }
          } catch (e: any) { log(`  Direct caption error: ${e.message}`); }

          // Try proxy caption fetch
          log("  Fetching caption XML (proxy corsproxy.io)...");
          try {
            let capUrl = track.baseUrl;
            if (!capUrl.includes("fmt=")) capUrl += "&fmt=srv3";
            const pr = await fetch(`https://corsproxy.io/?${encodeURIComponent(capUrl)}`, {
              headers: { Accept: "text/xml,*/*" },
              signal: AbortSignal.timeout(10000),
            });
            const pt = await pr.text();
            log(`  Proxy: status=${pr.status} length=${pt.length}`);
            if (pt.length > 100 && pt.includes("<")) {
              log(`  Proxy caption SUCCESS (${pt.length} chars)`);
              const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
              const entries: {text:string,duration:number,offset:number}[] = [];
              let m;
              while ((m = pRegex.exec(pt)) !== null) {
                let text = m[3] || "";
                text = text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
                if (text) entries.push({ text, duration: parseInt(m[2],10), offset: parseInt(m[1],10) });
              }
              if (entries.length > 0) {
                return NextResponse.json({ videoId, title, transcript: entries, debug: logs });
              }
            }
          } catch (e: any) { log(`  Proxy caption error: ${e.message}`); }
        }
      } catch (e: any) { log(`InnerTube ${c.name} error: ${e.message}`); }
    }

    // Strategy 2: Web page scrape
    log("Trying web page scrape...");
    try {
      const wr = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)", "Accept-Language": "en-US,en;q=0.9" },
        signal: AbortSignal.timeout(8000),
      });
      log(`  Page status: ${wr.status} length: ${(await wr.clone().text()).length}`);
      const html = await wr.text();
      const hasCaptcha = html.includes('class="g-recaptcha"');
      const hasPlayer = html.includes("ytInitialPlayerResponse");
      log(`  Has captcha: ${hasCaptcha}, Has player: ${hasPlayer}`);
      // ... parse player response
      const startMarker = "var ytInitialPlayerResponse = ";
      const startIndex = html.indexOf(startMarker);
      if (startIndex !== -1) {
        const jsonStart = html.indexOf("{", startIndex);
        let depth = 0, endIndex = -1;
        for (let i = jsonStart; i < html.length; i++) {
          if (html[i] === "{") depth++;
          else if (html[i] === "}") { depth--; if (depth === 0) { endIndex = i + 1; break; } }
        }
        if (endIndex !== -1) {
          const pd = JSON.parse(html.substring(jsonStart, endIndex));
          const tracks = pd?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          log(`  Scrape tracks: ${Array.isArray(tracks) ? tracks.length : 0}`);
          if (Array.isArray(tracks) && tracks.length > 0) {
            const track = tracks.find((t: any) => t.languageCode === "en") || tracks[0];
            const title = pd?.videoDetails?.title || `Video ${videoId}`;
            log(`  Scrape track baseUrl: ${track.baseUrl.substring(0, 80)}...`);
            // Try proxy for caption
            let capUrl = track.baseUrl;
            if (!capUrl.includes("fmt=")) capUrl += "&fmt=srv3";
            log("  Fetching caption via proxy...");
            try {
              const pr = await fetch(`https://corsproxy.io/?${encodeURIComponent(capUrl)}`, {
                headers: { Accept: "text/xml,*/*" },
                signal: AbortSignal.timeout(10000),
              });
              const pt = await pr.text();
              log(`  Proxy caption: status=${pr.status} length=${pt.length}`);
              if (pt.length > 100 && pt.includes("<")) {
                const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
                const entries: {text:string,duration:number,offset:number}[] = [];
                let m;
                while ((m = pRegex.exec(pt)) !== null) {
                  let text = m[3] || "";
                  text = text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
                  if (text) entries.push({ text, duration: parseInt(m[2],10), offset: parseInt(m[1],10) });
                }
                if (entries.length > 0) {
                  return NextResponse.json({ videoId, title, transcript: entries, debug: logs });
                }
              }
            } catch (e: any) { log(`  Proxy caption error: ${e.message}`); }
          }
        }
      }
    } catch (e: any) { log(`Web scrape error: ${e.message}`); }

    // Strategy 3: Proxy web scrape
    log("Trying web page scrape via corsproxy.io...");
    try {
      const pr = await fetch(`https://corsproxy.io/?${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, {
        headers: { Accept: "text/html,*/*" },
        signal: AbortSignal.timeout(10000),
      });
      log(`  Proxy page status: ${pr.status}`);
      const html = await pr.text();
      log(`  Proxy page length: ${html.length}`);
      const hasPlayer = html.includes("ytInitialPlayerResponse");
      log(`  Has player: ${hasPlayer}`);
      const startMarker = "var ytInitialPlayerResponse = ";
      const startIndex = html.indexOf(startMarker);
      if (startIndex !== -1) {
        const jsonStart = html.indexOf("{", startIndex);
        let depth = 0, endIndex = -1;
        for (let i = jsonStart; i < html.length; i++) {
          if (html[i] === "{") depth++;
          else if (html[i] === "}") { depth--; if (depth === 0) { endIndex = i + 1; break; } }
        }
        if (endIndex !== -1) {
          const pd = JSON.parse(html.substring(jsonStart, endIndex));
          const tracks = pd?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          log(`  Proxy scrape tracks: ${Array.isArray(tracks) ? tracks.length : 0}`);
          if (Array.isArray(tracks) && tracks.length > 0) {
            const track = tracks.find((t: any) => t.languageCode === "en") || tracks[0];
            const title = pd?.videoDetails?.title || `Video ${videoId}`;
            let capUrl = track.baseUrl;
            if (!capUrl.includes("fmt=")) capUrl += "&fmt=srv3";
            log("  Fetching caption via proxy (from proxied page)...");
            try {
              const cr = await fetch(`https://corsproxy.io/?${encodeURIComponent(capUrl)}`, {
                headers: { Accept: "text/xml,*/*" },
                signal: AbortSignal.timeout(10000),
              });
              const ct = await cr.text();
              log(`  Caption: status=${cr.status} length=${ct.length}`);
              if (ct.length > 100 && ct.includes("<")) {
                const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
                const entries: {text:string,duration:number,offset:number}[] = [];
                let m;
                while ((m = pRegex.exec(ct)) !== null) {
                  let text = m[3] || "";
                  text = text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
                  if (text) entries.push({ text, duration: parseInt(m[2],10), offset: parseInt(m[1],10) });
                }
                if (entries.length > 0) {
                  return NextResponse.json({ videoId, title, transcript: entries, debug: logs });
                }
              }
            } catch (e: any) { log(`  Caption proxy error: ${e.message}`); }
          }
        }
      }
    } catch (e: any) { log(`Proxy scrape error: ${e.message}`); }

    return NextResponse.json({ error: "All strategies failed", logs }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, logs }, { status: 500 });
  }
}