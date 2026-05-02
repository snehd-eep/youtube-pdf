import { describe, it, expect } from "vitest";
import { generatePdf } from "@/lib/pdf-generator";
import { NormalSummary, SystemDesignSummary } from "@/lib/types";

const normalSummary: NormalSummary = {
  title: "Test Video: Understanding APIs",
  summary: "This video explains the basics of APIs and how they work in modern web development.",
  timestamps: [
    { time: "00:00", topic: "Introduction", description: "Overview of the video content" },
    { time: "03:45", topic: "What is an API?", description: "Definition and explanation of APIs" },
    { time: "08:20", topic: "REST APIs", description: "How REST APIs work with examples" },
  ],
  keyTakeaways: [
    "APIs are interfaces between software systems",
    "REST is the most common API paradigm",
    "Always version your APIs",
  ],
  gist: "APIs are the backbone of modern software communication",
};

const systemDesignSummary: SystemDesignSummary = {
  title: "Designing a URL Shortener",
  summary: "This video covers the system design of a URL shortening service like bit.ly.",
  timestamps: [
    { time: "00:00", topic: "Requirements", description: "Functional and non-functional requirements" },
    { time: "05:30", topic: "High-level Design", description: "Architecture overview" },
  ],
  diagrams: [
    {
      title: "Architecture Overview",
      mermaidCode: "graph TD\n  A[Client] --> B[Load Balancer]\n  B --> C[App Server]\n  C --> D[Database]",
      description: "High-level architecture of the URL shortener",
    },
  ],
  tradeoffs: [
    {
      decision: "Use base62 encoding",
      pros: ["Short URLs", "Simple implementation"],
      cons: ["Collision possible at scale", "Base62 is slower than base10"],
    },
  ],
  keyTakeaways: [
    "URL shorteners use encoding to convert long URLs",
    "Caching is critical for read-heavy workloads",
  ],
  gist: "A URL shortener trades storage for convenience",
};

describe("generatePdf", () => {
  it("generates a valid PDF buffer for normal mode", async () => {
    const pdfBuffer = await generatePdf(normalSummary, "normal", "test123");

    expect(pdfBuffer).toBeTruthy();
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer[0]).toBe(0x25);
    expect(pdfBuffer[1]).toBe(0x50);
    expect(pdfBuffer[2]).toBe(0x44);
    expect(pdfBuffer[3]).toBe(0x46);
  });

  it("generates a valid PDF buffer for system design mode", async () => {
    const pdfBuffer = await generatePdf(systemDesignSummary, "system-design", "sd123");

    expect(pdfBuffer).toBeTruthy();
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.toString("ascii", 0, 4)).toBe("%PDF");
  });

  it("generates different PDFs for different modes", async () => {
    const normalPdf = await generatePdf(normalSummary, "normal", "test123");
    const sdPdf = await generatePdf(systemDesignSummary, "system-design", "test123");

    expect(normalPdf.length).not.toEqual(sdPdf.length);
  });

  it("handles empty timestamps", async () => {
    const emptyTimestamps: NormalSummary = {
      ...normalSummary,
      timestamps: [],
    };

    const pdfBuffer = await generatePdf(emptyTimestamps, "normal", "test123");
    expect(pdfBuffer).toBeTruthy();
    expect(pdfBuffer.toString("ascii", 0, 4)).toBe("%PDF");
  });
});