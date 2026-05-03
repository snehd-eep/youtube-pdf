import { jsPDF } from "jspdf";
import {
  SummaryResult, isSystemDesignSummary, isProSummary, isSystemDesignProSummary,
  SystemDesignSummary, ProSummary, SystemDesignProSummary,
  MermaidDiagram, Tradeoff, ProSection, Definition, Callout, QA,
  TranscriptEntry,
} from "./types";
import { fetchDiagramImages } from "./mermaid";

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

// ─── Helpers ─────────────────────────────────────────────────────
function cpb(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > MY) {
    doc.addPage();
    return MG + 5;
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

function secHead(
  doc: jsPDF,
  text: string,
  y: number,
  clr?: { r: number; g: number; b: number },
): number {
  y = cpb(doc, y, 20);
  y += 2;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 33, 62);
  doc.text(text, MG, y);
  y += 3;
  const c = clr || { r: 99, g: 102, b: 241 };
  doc.setDrawColor(c.r, c.g, c.b);
  doc.setLineWidth(0.8);
  doc.line(MG, y, MG + 30, y);
  y += 5;
  return y;
}

function parseTimeToMs(time: string): number {
  const parts = time.split(":");
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return (minutes * 60 + seconds) * 1000;
  }
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }
  return 0;
}

// ─── Normal / System-Design Mode ─────────────────────────────────
function addTitle(
  doc: jsPDF,
  title: string,
  mode: string,
  date: string,
  videoId: string,
): number {
  let y = 25;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 46);
  const titleLines = doc.splitTextToSize(title, CW);
  for (const line of titleLines) {
    doc.text(line, MG, y);
    y += 7.5;
  }
  y += 2;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${date}  |  Mode: ${mode}  |  Video ID: ${videoId}`, MG, y);
  y += 4;

  return sep(doc, y);
}

function addSummary(doc: jsPDF, summary: string, y: number): number {
  y = secHead(doc, "EXECUTIVE SUMMARY", y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 51, 51);
  const lines = doc.splitTextToSize(summary, CW);
  for (const line of lines) {
    y = cpb(doc, y, LH + 1);
    doc.text(line, MG, y);
    y += LH + 0.5;
  }
  y += PGAP;

  return sep(doc, y);
}

function addGist(doc: jsPDF, gist: string, y: number, gold?: boolean): number {
  y = secHead(doc, "GIST", y, gold ? GOLD : undefined);

  if (gold) {
    doc.setFillColor(255, 248, 225);
    doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  } else {
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(99, 102, 241);
  }
  doc.setLineWidth(0.5);

  doc.setFontSize(10.5);
  doc.setFont("helvetica", "italic");
  if (gold) {
    doc.setTextColor(102, 66, 0);
  } else {
    doc.setTextColor(15, 52, 96);
  }
  const gistLines = doc.splitTextToSize(`"${gist}"`, CW - 16);
  const boxHeight = gistLines.length * (LH + 1) + 10;

  y = cpb(doc, y, boxHeight);
  doc.roundedRect(MG, y - 4, CW, boxHeight, 3, 3, "FD");
  for (const line of gistLines) {
    doc.text(line, MG + 8, y + 2);
    y += LH + 1;
  }
  y += PGAP;

  return sep(doc, y);
}

function addTimestamps(
  doc: jsPDF,
  timestamps: { time: string; topic: string; description: string }[],
  y: number,
): number {
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
    doc.text(ts.topic, MG + 18, y);
    y += LHSM + 0.5;

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
  y += 3;

  return sep(doc, y);
}

function addDiagrams(
  doc: jsPDF,
  diagrams: MermaidDiagram[],
  y: number,
): Promise<number> {
  return (async () => {
    y = secHead(doc, "ARCHITECTURE DIAGRAMS", y);

    const imageMap = await fetchDiagramImages(diagrams);

    for (let i = 0; i < diagrams.length; i++) {
      const diagram = diagrams[i];
      y = cpb(doc, y, 35);

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 33, 62);
      doc.text(`${i + 1}. ${diagram.title}`, MG, y);
      y += 6;

      const imageData = imageMap.get(diagram.title);
      if (imageData) {
        const imgFormat = imageData.format.toUpperCase() as "JPEG" | "PNG";
        const imgData = `data:image/${imageData.format};base64,${imageData.buffer.toString("base64")}`;

        const pixelWidth = imageData.width;
        const pixelHeight = imageData.height;
        const aspectRatio = pixelHeight / pixelWidth;

        const maxImgWidth = CW - 10;
        const maxImgHeight = 120;

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
        const codeHeight = Math.min(codeLines.length * 3.5 + 8, 60);
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
  })();
}

function addTradeoffs(
  doc: jsPDF,
  tradeoffs: Tradeoff[],
  y: number,
): number {
  y = secHead(doc, "DESIGN TRADE-OFFS", y);

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

      const proLines = proText
        ? doc.splitTextToSize(proText, colWidth - 8)
        : [""];
      const conLines = conText
        ? doc.splitTextToSize(conText, colWidth - 8)
        : [""];

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

function addTakeaways(doc: jsPDF, takeaways: string[], y: number): number {
  y = secHead(doc, "KEY TAKEAWAYS", y);

  for (let i = 0; i < takeaways.length; i++) {
    y = cpb(doc, y, LH + 3);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text(`${i + 1}.`, MG, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 51, 51);
    const lines = doc.splitTextToSize(takeaways[i], CW - 10);
    for (const line of lines) {
      y = cpb(doc, y, LH + 0.5);
      doc.text(line, MG + 8, y);
      y += LH + 0.5;
    }
    y += 3;
  }

  return y;
}

// ─── Pro Mode ────────────────────────────────────────────────────
function addProCoverPage(
  doc: jsPDF,
  title: string,
  date: string,
  vid: string,
): number {
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
  doc.text("PRO", PW / 2, 80, { align: "center" });

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 46);
  const titleLines = doc.splitTextToSize(title, CW);
  let y = 95;
  for (const line of titleLines) {
    doc.text(line, PW / 2, y, { align: "center" });
    y += 9;
  }
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`${date}  |  Video ID: ${vid}`, PW / 2, y, { align: "center" });
  y += 8;

  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(1);
  doc.line(PW / 2 - 40, y, PW / 2 + 40, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Full video content structured as a comprehensive document",
    PW / 2,
    y,
    { align: "center" },
  );

  doc.addPage();
  return MG + 5;
}

function addTableOfContents(
  doc: jsPDF,
  sections: ProSection[],
  focusAreas: string[],
  y: number,
): number {
  y = secHead(doc, "TABLE OF CONTENTS", y, GOLD);

  for (let i = 0; i < sections.length; i++) {
    y = cpb(doc, y, LH + 2);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 51, 51);
    doc.text(`${i + 1}. ${sections[i].heading}`, MG + 2, y);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${sections[i].startTime} - ${sections[i].endTime}`,
      PW - MG,
      y,
      { align: "right" },
    );
    y += LH + 2;
  }

  y += 4;

  if (focusAreas.length > 0) {
    y = cpb(doc, y, LH + 4);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    doc.text("Focus Areas", MG, y);
    y += LH + 2;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (const area of focusAreas) {
      y = cpb(doc, y, LH);
      doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
      doc.text("\u2022", MG + 2, y);
      doc.setTextColor(51, 51, 51);
      doc.text(area, MG + 8, y);
      y += LH;
    }
  }

  return sep(doc, y);
}

function addOverview(doc: jsPDF, overview: string, y: number): number {
  y = secHead(doc, "OVERVIEW", y, GOLD);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 51, 51);
  const lines = doc.splitTextToSize(overview, CW);
  for (const line of lines) {
    y = cpb(doc, y, LH + 1);
    doc.text(line, MG, y);
    y += LH + 0.5;
  }
  y += 4;

  return sep(doc, y);
}

function addProSections(
  doc: jsPDF,
  sections: ProSection[],
  transcript: TranscriptEntry[],
  y: number,
): number {
  y = secHead(doc, "SECTIONS", y, GOLD);

  for (const section of sections) {
    y = cpb(doc, y, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 33, 62);
    doc.text(section.heading, MG, y);
    doc.setFontSize(8);
    doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    doc.text(
      `${section.startTime} - ${section.endTime}`,
      PW - MG,
      y,
      { align: "right" },
    );
    y += LH + 2;

    const startMs = parseTimeToMs(section.startTime);
    const endMs = parseTimeToMs(section.endTime);
    const matchingEntries = transcript.filter(
      (e) => e.offset >= startMs && e.offset < endMs,
    );

    if (matchingEntries.length > 0) {
      const fullText = matchingEntries.map((e) => e.text).join(" ");
      const allLines = doc.splitTextToSize(fullText, CW - 6);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 51, 51);

      const groupSize = 6;
      for (let i = 0; i < allLines.length; i += groupSize) {
        const paraLines = allLines.slice(i, i + groupSize);
        for (const line of paraLines) {
          y = cpb(doc, y, LH + 1);
          doc.text(line, MG, y);
          y += LH;
        }
        if (i + groupSize < allLines.length) {
          y += 3;
        }
      }
      y += 3;
    }

    if (section.keyPoints && section.keyPoints.length > 0) {
      const kpLines: string[] = [];
      for (const kp of section.keyPoints) {
        kpLines.push(...doc.splitTextToSize(`\u2022 ${kp}`, CW - 14));
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

function addDefinitions(
  doc: jsPDF,
  definitions: Definition[],
  y: number,
): number {
  if (definitions.length === 0) return y;

  y = secHead(doc, "KEY DEFINITIONS", y, GOLD);

  for (const def of definitions) {
    y = cpb(doc, y, LH * 2 + 4);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    doc.text(def.term, MG + 2, y);
    y += LH;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const explLines = doc.splitTextToSize(def.explanation, CW - 8);
    for (const line of explLines) {
      y = cpb(doc, y, LH);
      doc.text(line, MG + 6, y);
      y += LH;
    }
    y += 4;
  }

  return sep(doc, y);
}

function addCallouts(doc: jsPDF, callouts: Callout[], y: number): number {
  if (callouts.length === 0) return y;

  y = secHead(doc, "INSIGHTS & TIPS", y, GOLD);

  const STYLES: Record<
    string,
    { bg: number[]; border: number[]; text: number[]; label: string }
  > = {
    insight: {
      bg: [232, 240, 254],
      border: [59, 130, 246],
      text: [30, 64, 175],
      label: "Insight",
    },
    warning: {
      bg: [255, 243, 224],
      border: [217, 119, 6],
      text: [146, 64, 14],
      label: "Warning",
    },
    tip: {
      bg: [236, 253, 245],
      border: [22, 163, 74],
      text: [22, 101, 52],
      label: "Tip",
    },
  };

  for (const callout of callouts) {
    const style = STYLES[callout.type] || STYLES.insight;

    const contentLines = doc.splitTextToSize(callout.content, CW - 16);
    const titleH = callout.title ? LH + 2 : 0;
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
      doc.text(`${style.label}: ${callout.title}`, MG + 6, lineY);
      lineY += titleH;
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
  if (qa.length === 0) return y;

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

// ─── System Design Pro Mode ────────────────────────────────────────
function addSDProCoverPage(
  doc: jsPDF,
  title: string,
  date: string,
  vid: string,
): number {
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
  doc.text("SYSTEM DESIGN PRO", PW / 2, 75, { align: "center" });

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 46);
  const titleLines = doc.splitTextToSize(title, CW);
  let y = 92;
  for (const line of titleLines) {
    doc.text(line, PW / 2, y, { align: "center" });
    y += 8;
  }
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`${date}  |  Video ID: ${vid}`, PW / 2, y, { align: "center" });
  y += 8;

  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(1);
  doc.line(PW / 2 - 40, y, PW / 2 + 40, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Architecture diagrams, trade-offs & full structured content",
    PW / 2,
    y,
    { align: "center" },
  );

  doc.addPage();
  return MG + 5;
}

function addSDDetectionBanner(
  doc: jsPDF,
  isSystemDesign: boolean,
  videoType: string,
  y: number,
): number {
  y = cpb(doc, y, 28);

  if (isSystemDesign) {
    doc.setFillColor(219, 234, 254);
    doc.setDrawColor(59, 130, 246);
  } else {
    doc.setFillColor(254, 243, 224);
    doc.setDrawColor(217, 119, 6);
  }
  doc.setLineWidth(0.5);
  doc.roundedRect(MG, y, CW, 22, 3, 3, "FD");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  if (isSystemDesign) {
    doc.setTextColor(30, 64, 175);
    doc.text("System Design Video Detected", MG + 6, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    doc.text("Generating architecture diagrams, sequence flows, and trade-off analysis.", MG + 6, y + 13);
  } else {
    doc.setTextColor(146, 64, 14);
    const displayType = videoType === "tutorial" ? "Tutorial" : videoType === "talk" ? "Talk/Presentation" : videoType === "interview" ? "Interview" : "Other";
    doc.text(`Video classified as: ${displayType}`, MG + 6, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    doc.text("System design diagrams are not generated for this content type. Full content analysis provided.", MG + 6, y + 13);
  }
  y += 28;
  return y;
}

function addTableOfContentsWithDiagrams(
  doc: jsPDF,
  sections: ProSection[],
  focusAreas: string[],
  diagramTitles: string[],
  y: number,
): number {
  y = secHead(doc, "TABLE OF CONTENTS", y, GOLD);

  for (let i = 0; i < sections.length; i++) {
    y = cpb(doc, y, LH + 2);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 51, 51);
    doc.text(`${i + 1}. ${sections[i].heading}`, MG + 2, y);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${sections[i].startTime} - ${sections[i].endTime}`,
      PW - MG,
      y,
      { align: "right" },
    );
    y += LH + 2;
  }

  if (diagramTitles.length > 0) {
    y += 4;
    y = cpb(doc, y, LH + 4);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(59, 130, 246);
    doc.text("Diagrams", MG, y);
    y += LH + 2;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (let i = 0; i < diagramTitles.length; i++) {
      y = cpb(doc, y, LH);
      doc.setTextColor(59, 130, 246);
      doc.text("\u2022", MG + 2, y);
      doc.setTextColor(51, 51, 51);
      doc.text(diagramTitles[i], MG + 8, y);
      y += LH;
    }
  }

  y += 4;

  if (focusAreas.length > 0) {
    y = cpb(doc, y, LH + 4);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    doc.text("Focus Areas", MG, y);
    y += LH + 2;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (const area of focusAreas) {
      y = cpb(doc, y, LH);
      doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
      doc.text("\u2022", MG + 2, y);
      doc.setTextColor(51, 51, 51);
      doc.text(area, MG + 8, y);
      y += LH;
    }
  }

  return sep(doc, y);
}

function addDiagramInline(
  doc: jsPDF,
  diagram: MermaidDiagram,
  imageData: { buffer: Buffer; format: "jpeg" | "png"; width: number; height: number } | undefined,
  y: number,
): number {
  y = cpb(doc, y, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(59, 130, 246);
  doc.text(diagram.title, MG, y);
  y += 6;

  if (imageData) {
    const imgFormat = imageData.format.toUpperCase() as "JPEG" | "PNG";
    const imgData = `data:image/${imageData.format};base64,${imageData.buffer.toString("base64")}`;
    const pixelWidth = imageData.width;
    const pixelHeight = imageData.height;
    const aspectRatio = pixelHeight / pixelWidth;
    const maxImgWidth = CW - 10;
    const maxImgHeight = 100;
    let imgWidth = maxImgWidth;
    let imgHeight = imgWidth * aspectRatio;
    if (imgHeight > maxImgHeight) {
      imgHeight = maxImgHeight;
      imgWidth = imgHeight / aspectRatio;
    }
    y = cpb(doc, y, imgHeight + 8);
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

  if (diagram.description) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(102, 102, 102);
    const descLines = doc.splitTextToSize(diagram.description, CW);
    for (const line of descLines) {
      y = cpb(doc, y, LHSM);
      doc.text(line, MG, y);
      y += LHSM;
    }
  }

  y += SGAP;
  return y;
}

// ─── Main Export ─────────────────────────────────────────────────
export async function generatePdf(
  summary: SummaryResult,
  mode: "normal" | "system-design" | "system-design-pro" | "pro",
  videoId: string,
  transcript?: TranscriptEntry[],
): Promise<Buffer> {
  const modeLabel =
    mode === "pro" ? "Pro" : mode === "system-design-pro" ? "System Design Pro" : mode === "system-design" ? "System Design" : "Normal";
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let y: number;

  if (mode === "system-design-pro" && isSystemDesignProSummary(summary)) {
    const sdpro = summary as SystemDesignProSummary;

    const diagramTitles = sdpro.diagrams.map((d) => d.title);
    const imageMap = sdpro.diagrams.length > 0 ? await fetchDiagramImages(sdpro.diagrams) : new Map();

    y = addSDProCoverPage(doc, sdpro.title, date, videoId);
    y = addTableOfContentsWithDiagrams(doc, sdpro.sections, sdpro.focusAreas, diagramTitles, y);
    y = addSDDetectionBanner(doc, sdpro.isSystemDesign, sdpro.videoType, y);
    y = addOverview(doc, sdpro.overview, y);
    y = addGist(doc, sdpro.gist, y, true);
    y = addSummary(doc, sdpro.summary, y);

    y = addProSections(doc, sdpro.sections, transcript || [], y);

    if (sdpro.diagrams.length > 0 && sdpro.isSystemDesign) {
      y = secHead(doc, "ARCHITECTURE DIAGRAMS", y);
      for (let i = 0; i < sdpro.diagrams.length; i++) {
        const diagram = sdpro.diagrams[i];
        const imgData = imageMap.get(diagram.title) || undefined;
        if (imgData) {
          imageMap.set(diagram.title, imgData);
        }
        y = addDiagramInline(doc, diagram, imageMap.get(diagram.title) as { buffer: Buffer; format: "jpeg" | "png"; width: number; height: number } | undefined, y);
      }
    }

    y = addDefinitions(doc, sdpro.definitions, y);
    y = addCallouts(doc, sdpro.callouts, y);

    if (sdpro.tradeoffs.length > 0) {
      y = addTradeoffs(doc, sdpro.tradeoffs, y);
    }

    y = addQA(doc, sdpro.qa, y);
    y = addTimestamps(doc, sdpro.timestamps, y);
    addTakeaways(doc, sdpro.keyTakeaways, y);
  } else if (mode === "pro" && isProSummary(summary)) {
    const pro = summary as ProSummary;

    y = addProCoverPage(doc, pro.title, date, videoId);
    y = addTableOfContents(doc, pro.sections, pro.focusAreas, y);
    y = addOverview(doc, pro.overview, y);
    y = addGist(doc, pro.gist, y, true);
    y = addSummary(doc, pro.summary, y);
    y = addProSections(doc, pro.sections, transcript || [], y);
    y = addDefinitions(doc, pro.definitions, y);
    y = addCallouts(doc, pro.callouts, y);
    y = addQA(doc, pro.qa, y);
    y = addTimestamps(doc, pro.timestamps, y);
    addTakeaways(doc, pro.keyTakeaways, y);
  } else if (mode === "system-design" && isSystemDesignSummary(summary)) {
    const sd = summary as SystemDesignSummary;

    y = addTitle(doc, sd.title, modeLabel, date, videoId);
    y = addSummary(doc, sd.summary, y);
    y = addGist(doc, sd.gist, y);
    y = addTimestamps(doc, sd.timestamps, y);
    y = await addDiagrams(doc, sd.diagrams, y);
    y = addTradeoffs(doc, sd.tradeoffs, y);
    addTakeaways(doc, sd.keyTakeaways, y);
  } else {
    y = addTitle(doc, summary.title, modeLabel, date, videoId);
    y = addSummary(doc, summary.summary, y);
    y = addGist(doc, summary.gist, y);
    y = addTimestamps(doc, summary.timestamps, y);
    addTakeaways(doc, summary.keyTakeaways, y);
  }

  const pageCount = doc.getNumberOfPages();
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