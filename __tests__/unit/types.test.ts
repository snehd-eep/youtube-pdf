import { describe, it, expect } from "vitest";
import { isSystemDesignSummary, isNormalSummary, NormalSummary, SystemDesignSummary } from "@/lib/types";

describe("isSystemDesignSummary", () => {
  it("returns true for system design summary", () => {
    const summary: SystemDesignSummary = {
      mode: "system-design",
      title: "Test",
      videoType: "system-design",
      sectionsIncluded: ["overview", "summary"],
      sectionsSkipped: [],
      sectionMetadata: [],
      summary: "Test summary",
      timestamps: [],
      diagrams: [{ title: "Arch", mermaidCode: "graph TD; A-->B", description: "Test" }],
      tradeoffs: [],
      keyTakeaways: [],
    };

    expect(isSystemDesignSummary(summary)).toBe(true);
  });

  it("returns false for normal summary", () => {
    const summary: NormalSummary = {
      mode: "normal",
      title: "Test",
      videoType: "other",
      sectionsIncluded: ["overview", "summary"],
      sectionsSkipped: [],
      sectionMetadata: [],
      summary: "Test summary",
      timestamps: [],
      keyTakeaways: [],
    };

    expect(isSystemDesignSummary(summary)).toBe(false);
    expect(isNormalSummary(summary)).toBe(true);
  });
});
