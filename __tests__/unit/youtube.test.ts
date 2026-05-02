import { describe, it, expect } from "vitest";
import { extractVideoId } from "@/lib/youtube";

describe("extractVideoId", () => {
  it("extracts video ID from a standard YouTube URL", () => {
    const result = extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).toBe("dQw4w9WgXcQ");
  });

  it("extracts video ID from a short YouTube URL", () => {
    const result = extractVideoId("https://youtu.be/dQw4w9WgXcQ");
    expect(result).toBe("dQw4w9WgXcQ");
  });

  it("extracts video ID from an embedded YouTube URL", () => {
    const result = extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(result).toBe("dQw4w9WgXcQ");
  });

  it("returns raw ID when given an 11-character video ID", () => {
    const result = extractVideoId("dQw4w9WgXcQ");
    expect(result).toBe("dQw4w9WgXcQ");
  });

  it("extracts video ID from URL with additional query params", () => {
    const result = extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s");
    expect(result).toBe("dQw4w9WgXcQ");
  });

  it("throws error for invalid YouTube URL", () => {
    expect(() => extractVideoId("https://example.com/not-youtube")).toThrow(
      "Invalid YouTube URL"
    );
  });

  it("throws error for empty string", () => {
    expect(() => extractVideoId("")).toThrow();
  });

  it("handles YouTube URL with search params", () => {
    const result = extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share");
    expect(result).toBe("dQw4w9WgXcQ");
  });
});