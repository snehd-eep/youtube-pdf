import { describe, it, expect } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const SERVER_AVAILABLE = process.env.RUN_INTEGRATION === "true";

describe.skipIf(!SERVER_AVAILABLE)("POST /api/extract", () => {
  it("returns 400 when url is missing", async () => {
    const res = await fetch(`${BASE_URL}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("url");
  });

  it("returns 400 for invalid YouTube URL", async () => {
    const res = await fetch(`${BASE_URL}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/not-youtube" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe.skipIf(!SERVER_AVAILABLE)("POST /api/summarize", () => {
  it("returns 400 when transcript is missing", async () => {
    const res = await fetch(`${BASE_URL}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "normal", videoId: "test" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("transcript");
  });

  it("returns 400 for invalid mode", async () => {
    const res = await fetch(`${BASE_URL}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: [{ text: "test", offset: 0, duration: 5000 }],
        mode: "invalid",
        videoId: "test",
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("mode");
  });
});

describe.skipIf(!SERVER_AVAILABLE)("POST /api/generate-pdf", () => {
  it("returns 400 when summary is missing", async () => {
    const res = await fetch(`${BASE_URL}/api/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "normal", videoId: "test" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("summary");
  });
});