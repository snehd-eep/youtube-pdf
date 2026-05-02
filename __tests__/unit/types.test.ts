import { describe, it, expect } from "vitest";
import { isSystemDesignSummary, NormalSummary, SystemDesignSummary } from "@/lib/types";

describe("isSystemDesignSummary", () => {
  it("returns true for system design summary", () => {
    const summary: SystemDesignSummary = {
      title: "Test",
      summary: "Test summary",
      timestamps: [],
      diagrams: [{ title: "Arch", mermaidCode: "graph TD; A-->B", description: "Test" }],
      tradeoffs: [],
      keyTakeaways: [],
      gist: "Test gist",
    };

    expect(isSystemDesignSummary(summary)).toBe(true);
  });

  it("returns false for normal summary", () => {
    const summary: NormalSummary = {
      title: "Test",
      summary: "Test summary",
      timestamps: [],
      keyTakeaways: [],
      gist: "Test gist",
    };

    expect(isSystemDesignSummary(summary)).toBe(false);
  });
});