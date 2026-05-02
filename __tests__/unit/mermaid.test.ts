import { describe, it, expect } from "vitest";
import { encodeMermaidCode, getMermaidImageUrl, cleanMermaidCode } from "@/lib/mermaid";

describe("encodeMermaidCode", () => {
  it("encodes simple mermaid code to base64url", () => {
    const code = "graph TD; A-->B";
    const result = encodeMermaidCode(code);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("handles empty string by injecting theme", () => {
    const result = encodeMermaidCode("");
    expect(result).toBeTruthy();
    const decoded = Buffer.from(result, "base64url").toString("utf-8");
    expect(decoded).toContain("forest");
  });

  it("produces url-safe base64", () => {
    const result = encodeMermaidCode("graph TD\n  A[\"Client\"]-->B[\"Server\"]");
    expect(result).not.toContain("+");
    expect(result).not.toContain("/");
    expect(result).not.toContain("=");
  });
});

describe("getMermaidImageUrl", () => {
  it("generates correct mermaid.ink URL", () => {
    const code = "graph TD; A-->B";
    const result = getMermaidImageUrl(code);

    expect(result).toContain("mermaid.ink/img/");
    expect(result).toContain(encodeMermaidCode(code));
  });

  it("starts with https://", () => {
    const result = getMermaidImageUrl("graph TD; A-->B");
    expect(result).toMatch(/^https:\/\//);
  });
});

describe("cleanMermaidCode", () => {
  it("removes markdown code fences", () => {
    const code = "```mermaid\ngraph TD\n  A-->B\n```";
    const result = cleanMermaidCode(code);
    expect(result).not.toContain("```");
    expect(result).toContain("graph TD");
  });

  it("converts escaped newlines", () => {
    const code = "graph TD\\nA-->B";
    const result = cleanMermaidCode(code);
    expect(result).toContain("\n");
    expect(result).not.toContain("\\n");
  });

  it("trims whitespace", () => {
    const code = "  graph TD\n  A-->B  ";
    const result = cleanMermaidCode(code);
    expect(result.startsWith("graph")).toBe(true);
  });
});