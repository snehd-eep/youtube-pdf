import { jsPDF } from "jspdf";
import {
  SummaryResult,
  Mode,
  TimestampEntry,
  Tradeoff,
  MermaidDiagram,
  ProSection,
  Definition,
  Callout,
  QA,
  CapacityEstimate,
  ApiEndpoint,
  DataEntity,
  FailureScenario,
  NFR,
  Lesson,
  KeyConcept,
  isNormalSummary,
  isSystemDesignSummary,
  isProSummary,
  isSystemDesignProSummary,
  isTechnicalCourseSummary,
  isTechnicalCourseProSummary,
} from "./types";
import { fetchDiagramImages } from "./mermaid";
import { normalizeSummaryResult } from "./llm";

// ─── Constants ───────────────────────────────────────────────────
const PW = 210;
const PH = 297;
const MG = 20;
const CW = PW - 2 * MG;
const MY = PH - MG - 15;
const LH = 5;
const LHSM = 4.5;
const PGAP = 6;
const SGAP = 10;
const GOLD = { r: 180, g: 138, b: 0 };
const YELLOW_HIGHLIGHT = { r: 255, g: 241, b: 118 }; // #FFF176

// Soft page limits by mode
const RECOMMENDED_PAGES: Record<Mode, number> = {
  normal: 5,
  pro: 10,
  "system-design": 8,
  "system-design-pro": 15,
  "technical-course": 8,
  "technical-course-pro": 12,
};

const MAX_OVERFLOW = 3;

// ─── Helper Functions ────────────────────────────────────────────
function cpb(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > MY) {
    doc.addPage();
    return MG + 5;
  }
  return y;
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineH?: number): number {
  const lh = lineH || LH;
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    y = cpb(doc, y, lh);
    doc.text(line, x, y);
    y += lh;
  }
  return y;
}

function sep(doc: jsPDF, y: number): number {
  y = cpb(doc, y, 12);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(MG, y, PW - MG, y);
  return y + 8;
}

function secHead(doc: jsPDF, text: string, y: number, color?: { r: number; g: number; b: number }): number {
  y = cpb(doc, y, 20);
  y += 2;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 33, 62);
  doc.text(text, MG, y);
  y += 3;
  const c = color || { r: 99, g: 102, b: 241 };
  doc.setDrawColor(c.r, c.g, c.b);
  doc.setLineWidth(0.8);
  doc.line(MG, y, MG + 30, y);
  y += 5;
  return y;
}

function addHighlightedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number): number {
  // Parse {critical} markers and apply yellow highlighting
  const regex = /\{critical\}(.*?)\{\/critical\}/g;
  let match;
  let lastIndex = 0;
  const segments: { text: string; highlight: boolean }[] = [];
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), highlight: false });
    }
    segments.push({ text: match[1], highlight: true });
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlight: false });
  }
  
  // Render segments
  let currentY = y;
  for (const segment of segments) {
    const lines = doc.splitTextToSize(segment.text, maxWidth);
    
    if (segment.highlight) {
      // Draw yellow background
      doc.setFillColor(YELLOW_HIGHLIGHT.r, YELLOW_HIGHLIGHT.g, YELLOW_HIGHLIGHT.b);
      for (const line of lines) {
        const textWidth = doc.getTextWidth(line);
        doc.roundedRect(x - 1, currentY - 3, textWidth + 2, LH + 1, 1, 1, "F");
        doc.text(line, x, currentY);
        currentY = cpb(doc, currentY + LH, LH);
      }
    } else {
      for (const line of lines) {
        doc.text(line, x, currentY);
        currentY = cpb(doc, currentY + LH, LH);
      }
    }
  }
  
  return currentY;
}

function processReferences(text: string): string {
  // Replace [REF:section-title] with readable reference
  return text.replace(/\[REF:([^\]]+)\]/g, "(See $1)");
}

// ─── Cover Page ──────────────────────────────────────────────────
function addCoverPage(doc: jsPDF, title: string, mode: Mode, videoId: string, _y: number): number {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  const modeLabels: Record<Mode, string> = {
    normal: "Normal",
    pro: "Pro",
    "system-design": "System Design",
    "system-design-pro": "System Design Pro",
    "technical-course": "Technical Course",
    "technical-course-pro": "Technical Course Pro",
  };
  
  const isPro = mode.includes("pro");
  
  if (isPro) {
    // Pro-style cover
    doc.setFontSize(36);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    doc.text(modeLabels[mode].toUpperCase(), PW / 2, 80, { align: "center" });
    
    doc.setFontSize(22);
    doc.setTextColor(26, 26, 46);
    const titleLines = doc.splitTextToSize(title, CW);
    let titleY = 95;
    for (const line of titleLines) {
      doc.text(line, PW / 2, titleY, { align: "center" });
      titleY += 9;
    }
    titleY += 5;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`${date}  |  Video ID: ${videoId}`, PW / 2, titleY, { align: "center" });
    
    doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
    doc.setLineWidth(1);
    doc.line(PW / 2 - 40, titleY + 8, PW / 2 + 40, titleY + 8);
  } else {
    // Standard cover
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 46);
    const titleLines = doc.splitTextToSize(title, CW);
    let titleY = 40;
    for (const line of titleLines) {
      doc.text(line, MG, titleY);
      titleY += 7.5;
    }
    titleY += 2;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${date}  |  Mode: ${modeLabels[mode]}  |  Video ID: ${videoId}`, MG, titleY);
  }
  
  doc.addPage();
  return MG + 5;
}

// ─── Dynamic Section Renderers ───────────────────────────────────
function addOverview(doc: jsPDF, overview: string, y: number): number {
  if (!overview || overview.trim().length === 0) return y;
  
  y = secHead(doc, "OVERVIEW", y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 51, 51);
  
  const processedText = processReferences(overview);
  y = addHighlightedText(doc, processedText, MG, y, CW);
  y += PGAP;
  
  return sep(doc, y);
}

function addSummary(doc: jsPDF, summary: string, y: number): number {
  if (!summary || summary.trim().length === 0) return y;
  
  y = secHead(doc, "SUMMARY", y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 51, 51);
  
  const processedText = processReferences(summary);
  y = addHighlightedText(doc, processedText, MG, y, CW);
  y += PGAP;
  
  return sep(doc, y);
}

function addTableOfContents(doc: jsPDF, sections: Array<{title: string; time?: string}>, y: number): number {
  if (!sections || sections.length === 0) return y;
  
  y = secHead(doc, "TABLE OF CONTENTS", y, GOLD);
  
  for (let i = 0; i < sections.length; i++) {
    y = cpb(doc, y, LH + 2);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 51, 51);
    const titleText = `${i + 1}. ${sections[i].title}`;
    const titleMaxW = sections[i].time ? CW - 30 : CW - 4;
    const titleLines = doc.splitTextToSize(titleText, titleMaxW);
    doc.text(titleLines[0], MG + 2, y);
    
    if (sections[i].time) {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(sections[i].time || "", PW - MG, y, { align: "right" });
    }
    
    y += LH + 2;
    for (let j = 1; j < titleLines.length; j++) {
      y = cpb(doc, y, LH);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 51, 51);
      doc.text(titleLines[j], MG + 2, y);
      y += LH;
    }
  }
  
  y += PGAP;
  return sep(doc, y);
}

function addTimestamps(doc: jsPDF, timestamps: TimestampEntry[], y: number): number {
  if (!timestamps || timestamps.length === 0) return y;
  
  y = secHead(doc, "TIMELINE", y);
  
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    y = cpb(doc, y, 16);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text(ts.time, MG, y);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 46);
    const topicLines = doc.splitTextToSize(ts.topic, CW - 18);
    doc.text(topicLines[0], MG + 18, y);
    y += LHSM + 0.5;
    for (let j = 1; j < topicLines.length; j++) {
      y = cpb(doc, y, LHSM);
      doc.text(topicLines[j], MG + 18, y);
      y += LHSM;
    }
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const descLines = doc.splitTextToSize(ts.description, CW - 18);
    for (const line of descLines) {
      y = cpb(doc, y, LHSM);
      doc.text(line, MG + 18, y);
      y += LHSM;
    }
    y += 3;
    
    if (i < timestamps.length - 1) {
      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.2);
      doc.line(MG + 18, y, PW - MG, y);
      y += 3;
    }
  }
  
  return sep(doc, y);
}

function addTakeaways(doc: jsPDF, takeaways: string[], y: number): number {
  if (!takeaways || takeaways.length === 0) return y;
  
  y = secHead(doc, "KEY TAKEAWAYS", y);
  
  for (let i = 0; i < takeaways.length; i++) {
    y = cpb(doc, y, LH + 3);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text(`${i + 1}.`, MG, y);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 51, 51);
    const processedText = processReferences(takeaways[i]);
    const lines = doc.splitTextToSize(processedText, CW - 10);
    for (const line of lines) {
      y = cpb(doc, y, LH + 0.5);
      doc.text(line, MG + 8, y);
      y += LH + 0.5;
    }
    y += 3;
  }
  
  return y;
}

function addDefinitions(doc: jsPDF, definitions: Definition[], y: number): number {
  if (!definitions || definitions.length === 0) return y;
  
  y = secHead(doc, "KEY DEFINITIONS", y, GOLD);
  
  for (const def of definitions) {
    y = cpb(doc, y, LH * 2 + 4);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    const termLines = doc.splitTextToSize(def.term, CW - 4);
    for (const line of termLines) {
      doc.text(line, MG + 2, y);
      y += LH;
    }
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const processedText = processReferences(def.explanation);
    const explLines = doc.splitTextToSize(processedText, CW - 8);
    for (const line of explLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 6, y);
      y += LH;
    }
    
    if (def.introducedIn) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(150, 150, 150);
      y = wrapText(doc, `Introduced in: ${def.introducedIn}`, MG + 6, y, CW - 10, LHSM);
    }
    
    y += 4;
  }
  
  return sep(doc, y);
}

function addCallouts(doc: jsPDF, callouts: Callout[], y: number): number {
  if (!callouts || callouts.length === 0) return y;
  
  y = secHead(doc, "INSIGHTS & TIPS", y, GOLD);
  
  const STYLES: Record<string, { bg: number[]; border: number[]; text: number[]; label: string }> = {
    insight: { bg: [232, 240, 254], border: [59, 130, 246], text: [30, 64, 175], label: "Insight" },
    warning: { bg: [255, 243, 224], border: [217, 119, 6], text: [146, 64, 14], label: "Warning" },
    tip: { bg: [236, 253, 245], border: [22, 163, 74], text: [22, 101, 52], label: "Tip" },
  };
  
  for (const callout of callouts) {
    const style = STYLES[callout.type] || STYLES.insight;
    
    const contentLines = doc.splitTextToSize(callout.content, CW - 16);
    const titleTextLines = callout.title
      ? doc.splitTextToSize(`${style.label}: ${callout.title}`, CW - 16)
      : [style.label];
    const titleH = titleTextLines.length * LH + 2;
    const contentH = contentLines.length * LH;
    const boxHeight = titleH + contentH + 12;
    
    y = cpb(doc, y, boxHeight);
    
    doc.setFillColor(style.bg[0], style.bg[1], style.bg[2]);
    doc.setDrawColor(style.border[0], style.border[1], style.border[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(MG, y - 4, CW, boxHeight, 3, 3, "FD");
    
    let lineY = y + 2;
    
    if (callout.title) {
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(style.text[0], style.text[1], style.text[2]);
      for (const tl of titleTextLines) {
        doc.text(tl, MG + 6, lineY);
        lineY += LH;
      }
    } else {
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(style.text[0], style.text[1], style.text[2]);
      doc.text(`${style.label}`, MG + 6, lineY);
      lineY += LH + 2;
    }
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 51, 51);
    for (const line of contentLines) {
      doc.text(line, MG + 6, lineY);
      lineY += LH;
    }
    
    y += boxHeight + 3;
  }
  
  return sep(doc, y);
}

function addQA(doc: jsPDF, qa: QA[], y: number): number {
  if (!qa || qa.length === 0) return y;
  
  y = secHead(doc, "Q & A", y, GOLD);
  
  for (let i = 0; i < qa.length; i++) {
    const item = qa[i];
    y = cpb(doc, y, 15);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 33, 62);
    const qLines = doc.splitTextToSize(`Q: ${item.question}`, CW - 4);
    for (const line of qLines) {
      y = cpb(doc, y, LH + 0.5);
      doc.text(line, MG, y);
      y += LH + 0.5;
    }
    y += 2;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 51, 51);
    const aLines = doc.splitTextToSize(`A: ${item.answer}`, CW - 10);
    for (const line of aLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 5, y);
      y += LH;
    }
    y += 3;
    
    if (i < qa.length - 1) {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(MG, y, PW - MG, y);
      y += 4;
    }
  }
  
  return sep(doc, y);
}

// ─── System Design Specific Sections ────────────────────────────
function addCapacityEstimates(doc: jsPDF, estimates: CapacityEstimate[], y: number): number {
  if (!estimates || estimates.length === 0) return y;
  
  y = secHead(doc, "CAPACITY ESTIMATES", y, GOLD);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  doc.text("Note: These are back-of-envelope estimates typical for this system type.", MG, y);
  y += LH + 2;
  
  for (const est of estimates) {
    y = cpb(doc, y, LH * 3);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 46);
    const metricLines = doc.splitTextToSize(est.metric, CW - 4);
    for (const line of metricLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 2, y);
      y += LH;
    }
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    doc.text(est.value, MG + 2, y);
    y += LH;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const explLines = doc.splitTextToSize(est.explanation, CW - 8);
    for (const line of explLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 2, y);
      y += LH;
    }
    y += 4;
  }
  
  return sep(doc, y);
}

function addDataModel(doc: jsPDF, entities: DataEntity[], y: number): number {
  if (!entities || entities.length === 0) return y;
  
  y = secHead(doc, "DATA MODEL", y, GOLD);
  
  for (const entity of entities) {
    y = cpb(doc, y, LH * 2 + 4);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 33, 62);
    const entityLines = doc.splitTextToSize(entity.entity, CW - 4);
    for (const line of entityLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 2, y);
      y += LH;
    }
    y += 1;
    
    if (entity.attributes && entity.attributes.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const attrLines = doc.splitTextToSize(`Attributes: ${entity.attributes.join(", ")}`, CW - 8);
      for (const line of attrLines) {
        y = cpb(doc, y, LH);
        doc.text(line, MG + 4, y);
        y += LH;
      }
    }
    
    if (entity.relationships && entity.relationships.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      for (const rel of entity.relationships) {
        const relLines = doc.splitTextToSize(`• ${rel}`, CW - 8);
        for (const line of relLines) {
          y = cpb(doc, y, LH);
          doc.text(line, MG + 4, y);
          y += LH;
        }
      }
    }
    
    y += 4;
  }
  
  return sep(doc, y);
}

function addApiDesign(doc: jsPDF, endpoints: ApiEndpoint[], y: number): number {
  if (!endpoints || endpoints.length === 0) return y;
  
  y = secHead(doc, "API DESIGN", y, GOLD);
  
  for (const ep of endpoints) {
    y = cpb(doc, y, LH * 3 + 4);
    
    // Method badge
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(99, 102, 241);
    doc.roundedRect(MG, y - 3, 20, 6, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text(ep.method, MG + 2, y + 1);
    
    // Endpoint path
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 46);
    const epLines = doc.splitTextToSize(ep.endpoint, CW - 24);
    doc.text(epLines[0], MG + 24, y);
    y += LH;
    for (let j = 1; j < epLines.length; j++) {
      y = cpb(doc, y, LH);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 26, 46);
      doc.text(epLines[j], MG + 2, y);
      y += LH;
    }
    y += 2;
    
    // Description
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const descLines = doc.splitTextToSize(ep.description, CW - 8);
    for (const line of descLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 2, y);
      y += LH;
    }
    
    // Request/Response params if present
    if (ep.requestParams && ep.requestParams.length > 0) {
      y += 2;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      const reqLines = doc.splitTextToSize(`Request: ${ep.requestParams.join(", ")}`, CW - 8);
      for (const line of reqLines) {
        y = cpb(doc, y, LH);
        doc.text(line, MG + 2, y);
        y += LH;
      }
    }
    
    if (ep.responseParams && ep.responseParams.length > 0) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      const resLines = doc.splitTextToSize(`Response: ${ep.responseParams.join(", ")}`, CW - 8);
      for (const line of resLines) {
        y = cpb(doc, y, LH);
        doc.text(line, MG + 2, y);
        y += LH;
      }
    }
    
    y += 4;
  }
  
  return sep(doc, y);
}

function addTradeoffs(doc: jsPDF, tradeoffs: Tradeoff[], y: number): number {
  if (!tradeoffs || tradeoffs.length === 0) return y;
  
  y = secHead(doc, "DESIGN TRADE-OFFS", y, GOLD);
  
  for (const tradeoff of tradeoffs) {
    y = cpb(doc, y, 30);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 46);
    const titleLines = doc.splitTextToSize(tradeoff.decision, CW);
    for (const line of titleLines) {
      y = cpb(doc, y, LH + 1);
      doc.text(line, MG, y);
      y += LH + 1;
    }
    y += 3;
    
    const colWidth = (CW - 8) / 2;
    
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(MG, y - 3, colWidth + 4, 4, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52);
    doc.text("PROS", MG + 2, y);
    
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(MG + colWidth + 4, y - 3, colWidth + 4, 4, 2, 2, "F");
    doc.setTextColor(153, 27, 27);
    doc.text("CONS", MG + colWidth + 6, y);
    y += 5;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    const leftX = MG + 2;
    const rightX = MG + colWidth + 6;
    const maxItems = Math.max(tradeoff.pros.length, tradeoff.cons.length);
    for (let i = 0; i < maxItems; i++) {
      y = cpb(doc, y, LHSM + 2);
      
      const proText = i < tradeoff.pros.length ? `+ ${tradeoff.pros[i]}` : "";
      const conText = i < tradeoff.cons.length ? `- ${tradeoff.cons[i]}` : "";
      
      const proLines = proText ? doc.splitTextToSize(proText, colWidth - 8) : [""];
      const conLines = conText ? doc.splitTextToSize(conText, colWidth - 8) : [""];
      
      const proCount = proText ? proLines.length : 0;
      const conCount = conText ? conLines.length : 0;
      const rowLines = Math.max(proCount, conCount, 1);
      const rowHeight = rowLines * LHSM + 2;
      
      y = cpb(doc, y, rowHeight);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      
      if (proText) {
        doc.setTextColor(34, 120, 74);
        let proY = y;
        for (const line of proLines) {
          doc.text(line, leftX, proY);
          proY += LHSM;
        }
      }
      
      if (conText) {
        doc.setTextColor(190, 18, 60);
        let conY = y;
        for (const line of conLines) {
          doc.text(line, rightX, conY);
          conY += LHSM;
        }
      }
      
      y += rowHeight;
    }
    y += 4;
  }
  
  return sep(doc, y);
}

function addFailureScenarios(doc: jsPDF, scenarios: FailureScenario[], y: number): number {
  if (!scenarios || scenarios.length === 0) return y;
  
  y = secHead(doc, "FAILURE SCENARIOS", y, GOLD);
  
  for (const scenario of scenarios) {
    y = cpb(doc, y, LH * 4 + 4);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 83, 9);
    const scenarioLines = doc.splitTextToSize("⚠ " + scenario.scenario, CW - 4);
    for (const line of scenarioLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 2, y);
      y += LH;
    }
    y += 1;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Impact:", MG + 4, y);
    y += LH;
    
    doc.setTextColor(80, 80, 80);
    const impactLines = doc.splitTextToSize(scenario.impact, CW - 10);
    for (const line of impactLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 6, y);
      y += LH;
    }
    y += 2;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Mitigation:", MG + 4, y);
    y += LH;
    
    doc.setTextColor(34, 120, 74);
    const mitigationLines = doc.splitTextToSize(scenario.mitigation, CW - 10);
    for (const line of mitigationLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 6, y);
      y += LH;
    }
    
    y += 4;
  }
  
  return sep(doc, y);
}

function addNFRs(doc: jsPDF, nfrs: NFR[], y: number): number {
  if (!nfrs || nfrs.length === 0) return y;
  
  y = secHead(doc, "NON-FUNCTIONAL REQUIREMENTS", y, GOLD);
  
  const categoryColors: Record<string, { r: number; g: number; b: number }> = {
    scalability: { r: 59, g: 130, b: 246 },
    reliability: { r: 22, g: 163, b: 74 },
    performance: { r: 217, g: 119, b: 6 },
    security: { r: 220, g: 38, b: 38 },
  };
  
  for (const nfr of nfrs) {
    y = cpb(doc, y, LH * 2 + 4);
    
    const color = categoryColors[nfr.category] || { r: 99, g: 102, b: 241 };
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(color.r, color.g, color.b);
    doc.text(nfr.category.toUpperCase(), MG + 2, y);
    y += LH + 2;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    for (const req of nfr.requirements) {
      const reqLines = doc.splitTextToSize(`• ${req}`, CW - 10);
      for (const line of reqLines) {
        y = cpb(doc, y, LH);
        doc.text(line, MG + 4, y);
        y += LH;
      }
    }
    
    y += 4;
  }
  
  return sep(doc, y);
}

// ─── Diagram Rendering ──────────────────────────────────────────
async function addDiagrams(doc: jsPDF, diagrams: MermaidDiagram[], y: number): Promise<number> {
  if (!diagrams || diagrams.length === 0) return y;
  
  y = secHead(doc, "ARCHITECTURE DIAGRAMS", y);
  
  const imageMap = await fetchDiagramImages(diagrams);
  
  for (let i = 0; i < diagrams.length; i++) {
    const diagram = diagrams[i];
    y = cpb(doc, y, 35);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 33, 62);
    const titleLines = doc.splitTextToSize(`${i + 1}. ${diagram.title}`, CW);
    for (const line of titleLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG, y);
      y += LH;
    }
    
    if (diagram.relatedSection) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      y = wrapText(doc, `(Related to: ${diagram.relatedSection})`, MG + 2, y, CW - 4, LHSM);
      y += LHSM;
    }
    
    y += 2;
    
    const imageData = imageMap.get(diagram.title);
    if (imageData) {
      const imgFormat = imageData.format.toUpperCase() as "JPEG" | "PNG";
      const imgData = `data:image/${imageData.format};base64,${imageData.buffer.toString("base64")}`;
      
      const aspectRatio = imageData.height / imageData.width;
      const maxImgWidth = CW - 10;
      const maxImgHeight = 100;
      
      let imgWidth = maxImgWidth;
      let imgHeight = imgWidth * aspectRatio;
      
      if (imgHeight > maxImgHeight) {
        imgHeight = maxImgHeight;
        imgWidth = imgHeight / aspectRatio;
      }
      
      y = cpb(doc, y, imgHeight + 12);
      const xOffset = MG + (CW - imgWidth) / 2;
      doc.addImage(imgData, imgFormat, xOffset, y, imgWidth, imgHeight);
      y += imgHeight + 4;
    } else {
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      doc.setTextColor(100, 100, 100);
      const codeLines = doc.splitTextToSize(diagram.mermaidCode, CW - 8);
      doc.setFillColor(245, 245, 245);
      const codeHeight = Math.min(codeLines.length * 3.5 + 8, 50);
      y = cpb(doc, y, codeHeight);
      doc.roundedRect(MG, y - 3, CW, codeHeight, 2, 2, "F");
      let codeY = y + 2;
      const maxLines = Math.floor((codeHeight - 4) / 3.5);
      for (let j = 0; j < Math.min(codeLines.length, maxLines); j++) {
        doc.text(codeLines[j], MG + 4, codeY);
        codeY += 3.5;
      }
      if (codeLines.length > maxLines) {
        doc.text(`... (${codeLines.length - maxLines} more lines)`, MG + 4, codeY);
      }
      y += codeHeight + 4;
    }
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(102, 102, 102);
    const descLines = doc.splitTextToSize(diagram.description, CW);
    for (const line of descLines) {
      y = cpb(doc, y, LHSM);
      doc.text(line, MG, y);
      y += LHSM;
    }
    y += SGAP;
  }
  
  return sep(doc, y);
}

// ─── Pro Sections (Dynamic) ─────────────────────────────────────
function addProSections(doc: jsPDF, sections: ProSection[], y: number): number {
  if (!sections || sections.length === 0) return y;
  
  y = secHead(doc, "SECTIONS", y, GOLD);
  
  for (const section of sections) {
    y = cpb(doc, y, 20);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 33, 62);
    const headingLines = doc.splitTextToSize(section.heading, CW - 40);
    doc.text(headingLines[0], MG, y);
    doc.setFontSize(8);
    doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    doc.text(`${section.startTime} - ${section.endTime}`, PW - MG, y, { align: "right" });
    y += LH + 2;
    for (let hi = 1; hi < headingLines.length; hi++) {
      y = cpb(doc, y, LH);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 33, 62);
      doc.text(headingLines[hi], MG, y);
      y += LH;
    }
    
    if (section.sectionSummary && section.sectionSummary.trim().length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 51, 51);
      const processedText = processReferences(section.sectionSummary);
      y = addHighlightedText(doc, processedText, MG, y, CW);
      y += 3;
    } else {
      // No transcript fallback - show placeholder
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(150, 150, 150);
      doc.text("[Section content not available]", MG, y);
      y += LH + 2;
    }
    
    if (section.keyPoints && section.keyPoints.length > 0) {
      const kpLines: string[] = [];
      for (const kp of section.keyPoints) {
        kpLines.push(...doc.splitTextToSize(`• ${kp}`, CW - 14));
      }
      const kpBoxH = kpLines.length * (LH + 0.5) + 14;
      
      y = cpb(doc, y, kpBoxH);
      
      doc.setFillColor(235, 245, 255);
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.roundedRect(MG, y - 4, CW, kpBoxH, 3, 3, "FD");
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(59, 130, 246);
      doc.text("Key Points", MG + 5, y + 2);
      y += LH + 3;
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 51, 51);
      for (const kpl of kpLines) {
        y = cpb(doc, y, LH);
        doc.text(kpl, MG + 5, y);
        y += LH + 0.5;
      }
      y += 4;
    }
    
    y = sep(doc, y);
  }
  
  return y;
}

// ─── Technical Course Specific Sections ────────────────────────
function addLessons(doc: jsPDF, lessons: Lesson[], y: number, isPro: boolean): number {
  if (!lessons || lessons.length === 0) return y;
  
  y = secHead(doc, "LESSONS", y, GOLD);
  
  for (const lesson of lessons) {
    y = cpb(doc, y, 25);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 33, 62);
    const titleLines = doc.splitTextToSize(lesson.title, CW - 40);
    doc.text(titleLines[0], MG, y);
    doc.setFontSize(8);
    doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    doc.text(`${lesson.startTime} - ${lesson.endTime}`, PW - MG, y, { align: "right" });
    y += LH + 2;
    for (let i = 1; i < titleLines.length; i++) {
      y = cpb(doc, y, LH);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 33, 62);
      doc.text(titleLines[i], MG, y);
      y += LH;
    }
    
    if (lesson.concepts && lesson.concepts.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(80, 80, 80);
      const conceptText = `Concepts: ${lesson.concepts.join(", ")}`;
      const conceptLines = doc.splitTextToSize(conceptText, CW - 4);
      for (const line of conceptLines) {
        y = cpb(doc, y, LH);
        doc.text(line, MG, y);
        y += LH;
      }
      y += 2;
    }
    
    if (lesson.keyPoints && lesson.keyPoints.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 51, 51);
      for (const point of lesson.keyPoints) {
        const bulletLines = doc.splitTextToSize(`• ${point}`, CW - 8);
        for (const line of bulletLines) {
          y = cpb(doc, y, LH);
          doc.text(line, MG + 4, y);
          y += LH;
        }
      }
      y += 2;
    }
    
    // Pro-only inline sections
    if (isPro) {
      // Code examples
      if (lesson.codeExamples && lesson.codeExamples.length > 0) {
        y += 2;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(59, 130, 246);
        doc.text("Code Examples:", MG + 2, y);
        y += LH + 1;
        
        for (const code of lesson.codeExamples) {
          y = cpb(doc, y, LH * 2 + 4);
          
          if (code.language) {
            doc.setFillColor(240, 240, 240);
            doc.roundedRect(MG + 2, y - 3, 30, 5, 1, 1, "F");
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(100, 100, 100);
            doc.text(code.language, MG + 4, y);
            y += LH;
          }
          
          doc.setFillColor(245, 245, 245);
          const codeLines = doc.splitTextToSize(code.code, CW - 12);
          const codeHeight = Math.min(codeLines.length * 3.5 + 6, 60);
          y = cpb(doc, y, codeHeight);
          doc.roundedRect(MG + 2, y - 2, CW - 4, codeHeight, 2, 2, "F");
          
          doc.setFontSize(8);
          doc.setFont("courier", "normal");
          doc.setTextColor(60, 60, 60);
          let codeY = y + 2;
          const maxLines = Math.floor((codeHeight - 4) / 3.5);
          for (let i = 0; i < Math.min(codeLines.length, maxLines); i++) {
            doc.text(codeLines[i], MG + 4, codeY);
            codeY += 3.5;
          }
          y += codeHeight + 2;
          
          if (code.explanation) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(100, 100, 100);
            const explLines = doc.splitTextToSize(code.explanation, CW - 12);
            for (const line of explLines) {
              y = cpb(doc, y, LH);
              doc.text(line, MG + 4, y);
              y += LH;
            }
          }
          y += 2;
        }
      }
      
      // Pitfalls
      if (lesson.pitfalls && lesson.pitfalls.length > 0) {
        y += 2;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(153, 27, 27);
        doc.text("⚠ Common Pitfalls:", MG + 5, y);
        y += LH + 2;

        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(220, 38, 38);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);

        const allPitfallLines: string[] = [];
        for (const pitfall of lesson.pitfalls) {
          const lines = doc.splitTextToSize(`• ${pitfall}`, CW - 14);
          allPitfallLines.push(...lines);
        }
        const pitfallBoxH = allPitfallLines.length * LH + 6;
        y = cpb(doc, y, pitfallBoxH);
        doc.roundedRect(MG + 2, y - 3, CW - 4, pitfallBoxH, 2, 2, "FD");

        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        for (const line of allPitfallLines) {
          doc.text(line, MG + 5, y + 1);
          y += LH;
        }
        y += 4;
      }
      
      // Best practices
      if (lesson.bestPractices && lesson.bestPractices.length > 0) {
        y += 2;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(22, 101, 52);
        doc.text("✓ Best Practices:", MG + 5, y);
        y += LH + 2;

        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(22, 163, 74);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);

        const allBpLines: string[] = [];
        for (const bp of lesson.bestPractices) {
          const lines = doc.splitTextToSize(`• ${bp}`, CW - 14);
          allBpLines.push(...lines);
        }
        const bpBoxH = allBpLines.length * LH + 6;
        y = cpb(doc, y, bpBoxH);
        doc.roundedRect(MG + 2, y - 3, CW - 4, bpBoxH, 2, 2, "FD");

        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        for (const line of allBpLines) {
          doc.text(line, MG + 5, y + 1);
          y += LH;
        }
        y += 4;
      }
      
      // Exercise suggestions
      if (lesson.exerciseSuggestions && lesson.exerciseSuggestions.length > 0) {
        y += 2;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(146, 64, 14);
        doc.text("📝 Try It Yourself:", MG + 5, y);
        y += LH + 2;

        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(217, 119, 6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);

        const allExLines: string[] = [];
        for (const ex of lesson.exerciseSuggestions) {
          const lines = doc.splitTextToSize(`• ${ex}`, CW - 14);
          allExLines.push(...lines);
        }
        const exBoxH = allExLines.length * LH + 6;
        y = cpb(doc, y, exBoxH);
        doc.roundedRect(MG + 2, y - 3, CW - 4, exBoxH, 2, 2, "FD");

        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        for (const line of allExLines) {
          doc.text(line, MG + 5, y + 1);
          y += LH;
        }
        y += 4;
      }
    }
    
    y = sep(doc, y);
  }
  
  return y;
}

function addKeyConcepts(doc: jsPDF, concepts: KeyConcept[], y: number): number {
  if (!concepts || concepts.length === 0) return y;
  
  y = secHead(doc, "KEY CONCEPTS", y, GOLD);
  
  for (const concept of concepts) {
    y = cpb(doc, y, LH * 3 + 4);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    const termLines = doc.splitTextToSize(concept.term, CW - 4);
    for (const line of termLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 2, y);
      y += LH;
    }
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const processedText = processReferences(concept.definition);
    const defLines = doc.splitTextToSize(processedText, CW - 8);
    for (const line of defLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 4, y);
      y += LH;
    }
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    y = wrapText(doc, `Introduced in: ${concept.introducedIn}`, MG + 4, y, CW - 8, LHSM);
    y += 4;
  }
  
  return sep(doc, y);
}

function addPrerequisites(doc: jsPDF, prerequisites: string[], y: number): number {
  if (!prerequisites || prerequisites.length === 0) return y;
  
  y = secHead(doc, "PREREQUISITES", y, GOLD);
  
  const allPrereqLines: string[] = [];
  for (const prereq of prerequisites) {
    allPrereqLines.push(...doc.splitTextToSize(`• ${prereq}`, CW - 12));
  }
  const boxHeight = allPrereqLines.length * LH + 12;
  
  doc.setFillColor(254, 249, 231);
  doc.setDrawColor(217, 119, 6);
  y = cpb(doc, y, boxHeight);
  doc.roundedRect(MG, y - 4, CW, boxHeight, 3, 3, "FD");
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(146, 64, 14);
  doc.text("Before starting this course, you should know:", MG + 5, y + 2);
  y += LH + 3;
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  for (const line of allPrereqLines) {
    y = cpb(doc, y, LH);
    doc.text(line, MG + 5, y);
    y += LH;
  }
  
  return sep(doc, y);
}

function addImplementationSteps(doc: jsPDF, steps: string[], y: number): number {
  if (!steps || steps.length === 0) return y;
  
  y = secHead(doc, "IMPLEMENTATION STEPS", y, GOLD);
  
  for (let i = 0; i < steps.length; i++) {
    y = cpb(doc, y, LH + 2);
    
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(MG, y - 3, 16, 6, 2, 2, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text(`${i + 1}`, MG + 5, y + 1);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 51, 51);
    const stepLines = doc.splitTextToSize(steps[i], CW - 22);
    for (const line of stepLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 20, y);
      y += LH;
    }
    y += 3;
  }
  
  return sep(doc, y);
}

function addCommonPitfalls(doc: jsPDF, pitfalls: string[], y: number): number {
  if (!pitfalls || pitfalls.length === 0) return y;
  
  y = secHead(doc, "COMMON PITFALLS", y, GOLD);
  
  const allLines: string[] = [];
  for (const pitfall of pitfalls) {
    const lines = doc.splitTextToSize(`⚠ ${pitfall}`, CW - 12);
    allLines.push(...lines);
  }

  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(220, 38, 38);
  const boxHeight = allLines.length * LH + 10;
  y = cpb(doc, y, boxHeight);
  doc.roundedRect(MG, y - 4, CW, boxHeight, 3, 3, "FD");
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  let lineY = y + 2;
  for (const line of allLines) {
    doc.text(line, MG + 5, lineY);
    lineY += LH;
  }
  y = lineY + 4;
  
  return sep(doc, y);
}

function addToolsMentioned(doc: jsPDF, tools: string[], y: number): number {
  if (!tools || tools.length === 0) return y;
  
  y = secHead(doc, "TOOLS & TECHNOLOGIES", y, GOLD);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 51, 51);
  
  // Display as tags
  let currentX = MG;
  let currentY = y;
  const tagHeight = 6;
  const tagPadding = 4;
  
  for (const tool of tools) {
    const textWidth = doc.getTextWidth(tool);
    const tagWidth = textWidth + tagPadding * 2;
    
    if (currentX + tagWidth > PW - MG) {
      currentX = MG;
      currentY += tagHeight + 3;
      y = cpb(doc, currentY, tagHeight + 3);
      currentY = y;
    }
    
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(99, 102, 241);
    doc.roundedRect(currentX, currentY - 4, tagWidth, tagHeight, 2, 2, "FD");
    doc.setTextColor(99, 102, 241);
    doc.text(tool, currentX + tagPadding, currentY);
    
    currentX += tagWidth + 4;
  }
  
  y = currentY + tagHeight + 4;
  
  return sep(doc, y);
}

function addExerciseSuggestions(doc: jsPDF, exercises: string[], y: number): number {
  if (!exercises || exercises.length === 0) return y;
  
  y = secHead(doc, "EXERCISE SUGGESTIONS", y, GOLD);
  
  for (let i = 0; i < exercises.length; i++) {
    const exLines = doc.splitTextToSize(exercises[i], CW - 14);
    const boxH = exLines.length * LH + 4;
    y = cpb(doc, y, boxH);
    
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(217, 119, 6);
    doc.roundedRect(MG, y - 3, CW, boxH, 2, 2, "FD");
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(146, 64, 14);
    doc.text(`${i + 1}.`, MG + 3, y + 1);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    let lineY = y + 1;
    for (const line of exLines) {
      doc.text(line, MG + 12, lineY);
      lineY += LH;
    }
    y += boxH + 3;
  }
  
  return sep(doc, y);
}

function addBestPractices(doc: jsPDF, practices: string[], y: number): number {
  if (!practices || practices.length === 0) return y;
  
  y = secHead(doc, "BEST PRACTICES", y, GOLD);
  
  const allBpLines: string[] = [];
  for (const practice of practices) {
    allBpLines.push(...doc.splitTextToSize(`✓ ${practice}`, CW - 12));
  }
  const boxHeight = allBpLines.length * LH + 10;
  
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(22, 163, 74);
  y = cpb(doc, y, boxHeight);
  doc.roundedRect(MG, y - 4, CW, boxHeight, 3, 3, "FD");
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  for (const line of allBpLines) {
    y = cpb(doc, y, LH);
    doc.text(line, MG + 5, y);
    y += LH;
  }
  
  return sep(doc, y);
}

function addResources(doc: jsPDF, resources: string[], y: number): number {
  if (!resources || resources.length === 0) return y;
  
  y = secHead(doc, "RESOURCES", y, GOLD);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(59, 130, 246);
  
  for (const resource of resources) {
    const resLines = doc.splitTextToSize(resource, CW);
    for (const line of resLines) {
      y = cpb(doc, y, LH);
      doc.setTextColor(59, 130, 246);
      doc.textWithLink(line, MG, y, { url: resource });
      y += LH;
    }
    y += 2;
  }
  
  return sep(doc, y);
}

function addTargetAudience(doc: jsPDF, audience: string, y: number): number {
  if (!audience || audience.trim().length === 0) return y;
  
  y = secHead(doc, "TARGET AUDIENCE", y, GOLD);
  
  const audienceColors: Record<string, { bg: number[]; text: number[] }> = {
    beginner: { bg: [236, 253, 245], text: [22, 101, 52] },
    intermediate: { bg: [254, 249, 231], text: [146, 64, 14] },
    advanced: { bg: [254, 242, 242], text: [153, 27, 27] },
  };
  
  const color = audienceColors[audience.toLowerCase()] || { bg: [238, 242, 255], text: [99, 102, 241] };
  
  doc.setFillColor(color.bg[0], color.bg[1], color.bg[2]);
  doc.roundedRect(MG, y - 4, 60, 10, 3, 3, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(color.text[0], color.text[1], color.text[2]);
  doc.text(audience.charAt(0).toUpperCase() + audience.slice(1), MG + 5, y + 2);
  
  return sep(doc, y + 10);
}

// ─── Main Export ─────────────────────────────────────────────────
export async function generatePdf(
  summary: SummaryResult,
  mode: Mode,
  videoId: string,
  _transcript?: unknown,
): Promise<Buffer> {
  summary = normalizeSummaryResult(summary, mode);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let y = MG + 5;

  // Cover page
  y = addCoverPage(doc, summary.title, mode, videoId, y);

  // Dynamic section rendering based on mode and available content
  if (isNormalSummary(summary)) {
    // Normal mode - dynamic sections
    if (summary.overview) {
      y = addOverview(doc, summary.overview, y);
    }
    if (summary.summary) {
      y = addSummary(doc, summary.summary, y);
    }
    if (summary.timestamps && summary.timestamps.length > 0) {
      y = addTimestamps(doc, summary.timestamps, y);
    }
    if (summary.keyTakeaways && summary.keyTakeaways.length > 0) {
      y = addTakeaways(doc, summary.keyTakeaways, y);
    }
  } else if (isSystemDesignSummary(summary)) {
    // System Design mode - dynamic sections
    if (summary.overview) {
      y = addOverview(doc, summary.overview, y);
    }
    if (summary.summary) {
      y = addSummary(doc, summary.summary, y);
    }
    if (summary.diagrams && summary.diagrams.length > 0) {
      y = await addDiagrams(doc, summary.diagrams, y);
    }
    if (summary.tradeoffs && summary.tradeoffs.length > 0) {
      y = addTradeoffs(doc, summary.tradeoffs, y);
    }
    if (summary.timestamps && summary.timestamps.length > 0) {
      y = addTimestamps(doc, summary.timestamps, y);
    }
    if (summary.keyTakeaways && summary.keyTakeaways.length > 0) {
      y = addTakeaways(doc, summary.keyTakeaways, y);
    }
  } else if (isProSummary(summary)) {
    // Pro mode - dynamic sections
    if (summary.overview) {
      y = addOverview(doc, summary.overview, y);
    }
    if (summary.summary) {
      y = addSummary(doc, summary.summary, y);
    }
    if (summary.sections && summary.sections.length > 0) {
      const tocData = summary.sections.map(s => ({ title: s.heading, time: `${s.startTime} - ${s.endTime}` }));
      y = addTableOfContents(doc, tocData, y);
    }
    if (summary.sections && summary.sections.length > 0) {
      y = addProSections(doc, summary.sections, y);
    }
    if (summary.definitions && summary.definitions.length > 0) {
      y = addDefinitions(doc, summary.definitions, y);
    }
    if (summary.callouts && summary.callouts.length > 0) {
      y = addCallouts(doc, summary.callouts, y);
    }
    if (summary.qa && summary.qa.length > 0) {
      y = addQA(doc, summary.qa, y);
    }
    if (summary.keyTakeaways && summary.keyTakeaways.length > 0) {
      y = addTakeaways(doc, summary.keyTakeaways, y);
    }
  } else if (isSystemDesignProSummary(summary)) {
    // System Design Pro mode - dynamic sections in logical order
    if (summary.overview) {
      y = addOverview(doc, summary.overview, y);
    }
    if (summary.summary) {
      y = addSummary(doc, summary.summary, y);
    }
    
    // TOC
    if (summary.sections && summary.sections.length > 0) {
      const tocData = summary.sections.map(s => ({ title: s.heading, time: `${s.startTime} - ${s.endTime}` }));
      y = addTableOfContents(doc, tocData, y);
    }
    
    // Capacity estimates (high-level first)
    if (summary.capacityEstimates && summary.capacityEstimates.length > 0) {
      y = addCapacityEstimates(doc, summary.capacityEstimates, y);
    }
    
    // Data model (foundation)
    if (summary.dataModel && summary.dataModel.length > 0) {
      y = addDataModel(doc, summary.dataModel, y);
    }
    
    // Sections with inline analysis
    if (summary.sections && summary.sections.length > 0) {
      for (const section of summary.sections) {
        // Render section
        y = cpb(doc, y, 20);
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(22, 33, 62);
        const headingLines = doc.splitTextToSize(section.heading, CW - 40);
        doc.text(headingLines[0], MG, y);
        doc.setFontSize(8);
        doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
        doc.text(`${section.startTime} - ${section.endTime}`, PW - MG, y, { align: "right" });
        y += LH + 2;
        for (let hi = 1; hi < headingLines.length; hi++) {
          y = cpb(doc, y, LH);
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(22, 33, 62);
          doc.text(headingLines[hi], MG, y);
          y += LH;
        }
        
        if (section.sectionSummary) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(51, 51, 51);
          const processedText = processReferences(section.sectionSummary);
          y = addHighlightedText(doc, processedText, MG, y, CW);
          y += 3;
        }
        
        if (section.keyPoints) {
          for (const point of section.keyPoints) {
            const kpLines = doc.splitTextToSize(`• ${point}`, CW - 10);
            for (const line of kpLines) {
              y = cpb(doc, y, LH);
              doc.text(line, MG + 4, y);
              y += LH;
            }
          }
        }
        y += 4;
        
        // Inline API design for this section
        if (summary.apiDesign) {
          const sectionAPIs = summary.apiDesign.filter(api => 
            section.sectionSummary?.toLowerCase().includes(api.endpoint.toLowerCase())
          );
          if (sectionAPIs.length > 0) {
            y = addApiDesign(doc, sectionAPIs, y);
          }
        }
        
        // Inline diagrams for this section
        if (summary.diagrams) {
          const sectionDiagrams = summary.diagrams.filter(d => 
            d.relatedSection === section.heading
          );
          if (sectionDiagrams.length > 0) {
            y = await addDiagrams(doc, sectionDiagrams, y);
          }
        }
        
        // Inline tradeoffs for this section
        if (summary.tradeoffs) {
          const sectionTradeoffs = summary.tradeoffs.filter(t => 
            section.sectionSummary?.toLowerCase().includes(t.decision.toLowerCase())
          );
          if (sectionTradeoffs.length > 0) {
            y = addTradeoffs(doc, sectionTradeoffs, y);
          }
        }
        
        y = sep(doc, y);
      }
    }
    
    // Remaining sections in logical order
    if (summary.failureScenarios && summary.failureScenarios.length > 0) {
      y = addFailureScenarios(doc, summary.failureScenarios, y);
    }
    if (summary.nfrs && summary.nfrs.length > 0) {
      y = addNFRs(doc, summary.nfrs, y);
    }
    if (summary.definitions && summary.definitions.length > 0) {
      y = addDefinitions(doc, summary.definitions, y);
    }
    if (summary.callouts && summary.callouts.length > 0) {
      y = addCallouts(doc, summary.callouts, y);
    }
    if (summary.qa && summary.qa.length > 0) {
      y = addQA(doc, summary.qa, y);
    }
    if (summary.keyTakeaways && summary.keyTakeaways.length > 0) {
      y = addTakeaways(doc, summary.keyTakeaways, y);
    }
  } else if (isTechnicalCourseSummary(summary)) {
    // Technical Course mode
    if (summary.overview) {
      y = addOverview(doc, summary.overview, y);
    }
    if (summary.targetAudience) {
      y = addTargetAudience(doc, summary.targetAudience, y);
    }
    if (summary.lessons && summary.lessons.length > 0) {
      y = addLessons(doc, summary.lessons, y, false);
    }
    if (summary.keyConcepts && summary.keyConcepts.length > 0) {
      y = addKeyConcepts(doc, summary.keyConcepts, y);
    }
    if (summary.toolsMentioned && summary.toolsMentioned.length > 0) {
      y = addToolsMentioned(doc, summary.toolsMentioned, y);
    }
    if (summary.keyTakeaways && summary.keyTakeaways.length > 0) {
      y = addTakeaways(doc, summary.keyTakeaways, y);
    }
  } else if (isTechnicalCourseProSummary(summary)) {
    // Technical Course Pro mode
    if (summary.overview) {
      y = addOverview(doc, summary.overview, y);
    }
    if (summary.targetAudience) {
      y = addTargetAudience(doc, summary.targetAudience, y);
    }
    if (summary.prerequisites && summary.prerequisites.length > 0) {
      y = addPrerequisites(doc, summary.prerequisites, y);
    }
    if (summary.lessons && summary.lessons.length > 0) {
      const tocData = summary.lessons.map(l => ({ title: l.title, time: `${l.startTime} - ${l.endTime}` }));
      y = addTableOfContents(doc, tocData, y);
    }
    if (summary.lessons && summary.lessons.length > 0) {
      y = addLessons(doc, summary.lessons, y, true);
    }
    if (summary.keyConcepts && summary.keyConcepts.length > 0) {
      y = addKeyConcepts(doc, summary.keyConcepts, y);
    }
    if (summary.implementationSteps && summary.implementationSteps.length > 0) {
      y = addImplementationSteps(doc, summary.implementationSteps, y);
    }
    if (summary.commonPitfalls && summary.commonPitfalls.length > 0) {
      y = addCommonPitfalls(doc, summary.commonPitfalls, y);
    }
    if (summary.toolsMentioned && summary.toolsMentioned.length > 0) {
      y = addToolsMentioned(doc, summary.toolsMentioned, y);
    }
    if (summary.exerciseSuggestions && summary.exerciseSuggestions.length > 0) {
      y = addExerciseSuggestions(doc, summary.exerciseSuggestions, y);
    }
    if (summary.bestPractices && summary.bestPractices.length > 0) {
      y = addBestPractices(doc, summary.bestPractices, y);
    }
    if (summary.resources && summary.resources.length > 0) {
      y = addResources(doc, summary.resources, y);
    }
    if (summary.keyTakeaways && summary.keyTakeaways.length > 0) {
      y = addTakeaways(doc, summary.keyTakeaways, y);
    }
  }

  // Check page count and add overflow warning if needed
  const pageCount = doc.getNumberOfPages();
  const recommended = RECOMMENDED_PAGES[mode];
  
  if (pageCount > recommended + MAX_OVERFLOW) {
    // Add footer note on last page
    doc.setPage(pageCount);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text(`Extended content — ${pageCount} pages total (recommended: ${recommended})`, PW / 2, PH - 12, {
      align: "center",
    });
  }

  // Add page numbers to all pages
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(170, 170, 170);
    doc.text(`Page ${i} of ${pageCount}`, PW / 2, PH - 8, {
      align: "center",
    });
  }

  const pdfArrayBuffer = doc.output("arraybuffer");
  return Buffer.from(pdfArrayBuffer);
}
