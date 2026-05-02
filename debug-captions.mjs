// Debug script to test InnerTube API responses
const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const VIDEO_ID = "i53Gi_K3o7I";

const clients = [
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
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  },
  {
    name: "ANDROID_CREATOR",
    client: { clientName: "ANDROID_CREATOR", clientVersion: "24.05.010", hl: "en", gl: "US", androidSdkVersion: 30 },
    ua: "com.google.android.apps.youtube.creator/24.05.010 (Linux; U; Android 14)",
  },
  {
    name: "MWEB",
    client: { clientName: "MWEB", clientVersion: "2.20240510.00.00", hl: "en", gl: "US" },
    ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  },
];

async function testClient(c) {
  try {
    const res = await fetch(INNERTUBE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": c.ua },
      body: JSON.stringify({ context: { client: c.client }, videoId: VIDEO_ID }),
    });
    const data = await res.json();
    const playability = data?.playabilityStatus?.status;
    const captions = data?.captions;
    const captionTracks = captions?.playerCaptionsTracklistRenderer?.captionTracks;
    const hasCaptions = Array.isArray(captionTracks) && captionTracks.length > 0;

    // Check for videoDetails
    const title = data?.videoDetails?.title?.substring(0, 50);
    const isLive = data?.videoDetails?.isLiveContent;

    console.log(`\n=== ${c.name} ===`);
    console.log(`  Status: ${res.status}`);
    console.log(`  Playability: ${playability}`);
    console.log(`  Title: ${title}`);
    console.log(`  Has captions: ${hasCaptions}`);
    if (hasCaptions) {
      console.log(`  Caption tracks: ${captionTracks.length}`);
      captionTracks.forEach(t => {
        console.log(`    - ${t.languageCode} (${t.kind || "manual"}): ${t.name?.simpleText || "N/A"} baseUrl=${t.baseUrl ? t.baseUrl.substring(0, 60) + "..." : "MISSING"}`);
      });
    } else {
      console.log(`  Captions object keys: ${Object.keys(captions || {}).join(", ")}`);
    }
  } catch (e) {
    console.log(`\n=== ${c.name} === FAILED: ${e.message}`);
  }
}

(async () => {
  for (const c of clients) {
    await testClient(c);
  }
})();