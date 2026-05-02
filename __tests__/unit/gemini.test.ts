import { describe, it, expect } from "vitest";
import {
  NORMAL_PROMPT,
  SYSTEM_DESIGN_PROMPT,
  formatTranscript,
} from "@/lib/gemini";
import { TranscriptEntry } from "@/lib/types";

describe("formatTranscript", () => {
  it("formats transcript entries with timestamps", () => {
    const transcript: TranscriptEntry[] = [
      { text: "Hello world", duration: 5000, offset: 0 },
      { text: "Second point", duration: 8000, offset: 30000 },
    ];

    const result = formatTranscript(transcript);

    expect(result).toContain("[00:00] Hello world");
    expect(result).toContain("[00:30] Second point");
  });

  it("handles large offsets correctly", () => {
    const transcript: TranscriptEntry[] = [
      { text: "Later topic", duration: 60000, offset: 3600000 },
    ];

    const result = formatTranscript(transcript);

    expect(result).toContain("[60:00] Later topic");
  });
});

describe("prompt content", () => {
  it("normal prompt includes JSON format instruction", () => {
    expect(NORMAL_PROMPT).toContain("JSON");
    expect(NORMAL_PROMPT).toContain("title");
    expect(NORMAL_PROMPT).toContain("summary");
    expect(NORMAL_PROMPT).toContain("timestamps");
  });

  it("system design prompt includes mermaid instruction", () => {
    expect(SYSTEM_DESIGN_PROMPT).toContain("mermaidCode");
    expect(SYSTEM_DESIGN_PROMPT).toContain("diagrams");
    expect(SYSTEM_DESIGN_PROMPT).toContain("tradeoffs");
  });
});