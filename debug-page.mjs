// Debug: check what YouTube page HTML contains for captions
const videoId = "i53Gi_K3o7I";

async function test() {
  const url = "https://www.youtube.com/watch?v=" + videoId;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await res.text();
  
  console.log("Response status:", res.status);
  console.log("HTML length:", html.length);
  console.log("Has captionTracks:", html.includes("captionTracks"));
  console.log("Has timedtext:", html.includes("timedtext"));
  console.log("Has ytInitialPlayerResponse:", html.includes("ytInitialPlayerResponse"));
  console.log("Has playerCaptionsTracklistRenderer:", html.includes("playerCaptionsTracklistRenderer"));
  
  // Try to extract caption tracks from the page
  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
  if (playerResponseMatch) {
    try {
      const playerData = JSON.parse(playerResponseMatch[1]);
      const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      console.log("Found caption tracks in ytInitialPlayerResponse:", tracks ? tracks.length : 0);
      if (tracks) {
        tracks.forEach(t => console.log("  -", t.languageCode, t.kind || "manual", t.name?.simpleText));
      }
    } catch (e) {
      console.log("Failed to parse ytInitialPlayerResponse");
    }
    
    // Check playability
    try {
      const playerData = JSON.parse(playerResponseMatch[1]);
      console.log("Playability:", playerData?.playabilityStatus?.status);
    } catch (e) {}
  }
  
  // Try to find caption URL directly
  const urlMatch = html.match(/https?:\/\/[^\s"']*timedtext[^\s"']*/);
  if (urlMatch) {
    console.log("Found timedtext URL:", urlMatch[0].substring(0, 120));
  }
}

test().catch(e => console.error(e.message));