import { jsPDF } from "jspdf";
import {
  SummaryResult,
  isSystemDesignSummary,
  SystemDesignSummary,
  MermaidDiagram,
  Tradeoff,
} from "./types";
import { fetchDiagramImages } from "./mermaid";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const MAX_Y = PAGE_HEIGHT - MARGIN - 15;
const LINE_HEIGHT = 5;
const LINE_HEIGHT_SM = 4.5;
const PARAGRAPH_GAP = 6;
const SECTION_GAP = 10;

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > MAX_Y) {
    doc.addPage();
    return MARGIN + 5;
  }
  return y;
}

function drawSeparator(doc: jsPDF, y: number): number {
  y = checkPageBreak(doc, y, 12);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  return y + 8;
}

function addTitle(doc: jsPDF, title: string, mode: string, date: string, videoId: string): number {
  let y = 25;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 46);
  const titleLines = doc.splitTextToSize(title, CONTENT_WIDTH);
  for (const line of titleLines) {
    doc.text(line, MARGIN, y);
    y += 7.5;
  }
  y += 2;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${date}  |  Mode: ${mode}  |  Video ID: ${videoId}`, MARGIN, y);
  y += 4;

  return drawSeparator(doc, y);
}

function addSectionHeader(doc: jsPDF, text: string, y: number): number {
  y = checkPageBreak(doc, y, 20);
  y += 2;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 33, 62);
  doc.text(text, MARGIN, y);
  y += 3;
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, MARGIN + 30, y);
  y += 5;
  return y;
}

function addSummary(doc: jsPDF, summary: string, y: number): number {
  y = addSectionHeader(doc, "EXECUTIVE SUMMARY", y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 51, 51);
  const lines = doc.splitTextToSize(summary, CONTENT_WIDTH);
  for (const line of lines) {
    y = checkPageBreak(doc, y, LINE_HEIGHT + 1);
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT + 0.5;
  }
  y += PARAGRAPH_GAP;

  return drawSeparator(doc, y);
}

function addGist(doc: jsPDF, gist: string, y: number): number {
  y = addSectionHeader(doc, "GIST", y);

  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.5);

  doc.setFontSize(10.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(15, 52, 96);
  const gistLines = doc.splitTextToSize(`"${gist}"`, CONTENT_WIDTH - 16);
  const boxHeight = gistLines.length * (LINE_HEIGHT + 1) + 10;

  y = checkPageBreak(doc, y, boxHeight);
  doc.roundedRect(MARGIN, y - 4, CONTENT_WIDTH, boxHeight, 3, 3, "FD");
  for (const line of gistLines) {
    doc.text(line, MARGIN + 8, y + 2);
    y += LINE_HEIGHT + 1;
  }
  y += PARAGRAPH_GAP;

  return drawSeparator(doc, y);
}

function addTimestamps(
  doc: jsPDF,
  timestamps: { time: string; topic: string; description: string }[],
  y: number
): number {
  y = addSectionHeader(doc, "TIMELINE", y);

  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    y = checkPageBreak(doc, y, 16);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text(ts.time, MARGIN, y);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 46);
    doc.text(ts.topic, MARGIN + 18, y);
    y += LINE_HEIGHT_SM + 0.5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const descLines = doc.splitTextToSize(ts.description, CONTENT_WIDTH - 18);
    for (const line of descLines) {
      y = checkPageBreak(doc, y, LINE_HEIGHT_SM);
      doc.text(line, MARGIN + 18, y);
      y += LINE_HEIGHT_SM;
    }
    y += 3;

    if (i < timestamps.length - 1) {
      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.2);
      doc.line(MARGIN + 18, y, PAGE_WIDTH - MARGIN, y);
      y += 3;
    }
  }
  y += 3;

  return drawSeparator(doc, y);
}

function addDiagrams(
  doc: jsPDF,
  diagrams: MermaidDiagram[],
  y: number
): Promise<number> {
  return (async () => {
    y = addSectionHeader(doc, "ARCHITECTURE DIAGRAMS", y);

    const imageMap = await fetchDiagramImages(diagrams);

    for (let i = 0; i < diagrams.length; i++) {
      const diagram = diagrams[i];
      y = checkPageBreak(doc, y, 35);

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 33, 62);
      doc.text(`${i + 1}. ${diagram.title}`, MARGIN, y);
      y += 6;

      const imageData = imageMap.get(diagram.title);
      if (imageData) {
        const imgFormat = imageData.format.toUpperCase() as "JPEG" | "PNG";
        const imgData = `data:image/${imageData.format};base64,${imageData.buffer.toString("base64")}`;

        const pixelWidth = imageData.width;
        const pixelHeight = imageData.height;
        const aspectRatio = pixelHeight / pixelWidth;

        const maxImgWidth = CONTENT_WIDTH - 10;
        const maxImgHeight = 120;

        let imgWidth = maxImgWidth;
        let imgHeight = imgWidth * aspectRatio;

        if (imgHeight > maxImgHeight) {
          imgHeight = maxImgHeight;
          imgWidth = imgHeight / aspectRatio;
        }

        y = checkPageBreak(doc, y, imgHeight + 12);
        const xOffset = MARGIN + (CONTENT_WIDTH - imgWidth) / 2;
        doc.addImage(imgData, imgFormat, xOffset, y, imgWidth, imgHeight);
        y += imgHeight + 4;
      } else {
        doc.setFontSize(8);
        doc.setFont("courier", "normal");
        doc.setTextColor(100, 100, 100);
        const codeLines = doc.splitTextToSize(diagram.mermaidCode, CONTENT_WIDTH - 8);
        doc.setFillColor(245, 245, 245);
        const codeHeight = Math.min(codeLines.length * 3.5 + 8, 60);
        y = checkPageBreak(doc, y, codeHeight);
        doc.roundedRect(MARGIN, y - 3, CONTENT_WIDTH, codeHeight, 2, 2, "F");
        let codeY = y + 2;
        const maxLines = Math.floor((codeHeight - 4) / 3.5);
        for (let j = 0; j < Math.min(codeLines.length, maxLines); j++) {
          doc.text(codeLines[j], MARGIN + 4, codeY);
          codeY += 3.5;
        }
        if (codeLines.length > maxLines) {
          doc.text(`... (${codeLines.length - maxLines} more lines)`, MARGIN + 4, codeY);
        }
        y += codeHeight + 4;
      }

      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(102, 102, 102);
      const descLines = doc.splitTextToSize(diagram.description, CONTENT_WIDTH);
      for (const line of descLines) {
        y = checkPageBreak(doc, y, LINE_HEIGHT_SM);
        doc.text(line, MARGIN, y);
        y += LINE_HEIGHT_SM;
      }
      y += SECTION_GAP;
    }

    return drawSeparator(doc, y);
  })();
}

function addTradeoffs(
  doc: jsPDF,
  tradeoffs: Tradeoff[],
  y: number
): number {
  y = addSectionHeader(doc, "DESIGN TRADE-OFFS", y);

  for (const tradeoff of tradeoffs) {
    y = checkPageBreak(doc, y, 30);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 46);
    const titleLines = doc.splitTextToSize(tradeoff.decision, CONTENT_WIDTH);
    for (const line of titleLines) {
      y = checkPageBreak(doc, y, LINE_HEIGHT + 1);
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT + 1;
    }
    y += 3;

    const colWidth = (CONTENT_WIDTH - 8) / 2;

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(MARGIN, y - 3, colWidth + 4, 4, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52);
    doc.text("PROS", MARGIN + 2, y);

    doc.setFillColor(254, 242, 242);
    doc.roundedRect(MARGIN + colWidth + 4, y - 3, colWidth + 4, 4, 2, 2, "F");
    doc.setTextColor(153, 27, 27);
    doc.text("CONS", MARGIN + colWidth + 6, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const leftX = MARGIN + 2;
    const rightX = MARGIN + colWidth + 6;
    const maxItems = Math.max(tradeoff.pros.length, tradeoff.cons.length);
    for (let i = 0; i < maxItems; i++) {
      y = checkPageBreak(doc, y, LINE_HEIGHT_SM + 2);

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
      const rowHeight = rowLines * LINE_HEIGHT_SM + 2;

      y = checkPageBreak(doc, y, rowHeight);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      if (proText) {
        doc.setTextColor(34, 120, 74);
        let proY = y;
        for (const line of proLines) {
          doc.text(line, leftX, proY);
          proY += LINE_HEIGHT_SM;
        }
      }

      if (conText) {
        doc.setTextColor(190, 18, 60);
        let conY = y;
        for (const line of conLines) {
          doc.text(line, rightX, conY);
          conY += LINE_HEIGHT_SM;
        }
      }

      y += rowHeight;
    }
    y += 4;
  }

  return drawSeparator(doc, y);
}

function addTakeaways(doc: jsPDF, takeaways: string[], y: number): number {
  y = addSectionHeader(doc, "KEY TAKEAWAYS", y);

  for (let i = 0; i < takeaways.length; i++) {
    y = checkPageBreak(doc, y, LINE_HEIGHT + 3);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text(`${i + 1}.`, MARGIN, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 51, 51);
    const lines = doc.splitTextToSize(takeaways[i], CONTENT_WIDTH - 10);
    for (const line of lines) {
      y = checkPageBreak(doc, y, LINE_HEIGHT + 0.5);
      doc.text(line, MARGIN + 8, y);
      y += LINE_HEIGHT + 0.5;
    }
    y += 3;
  }

  return y;
}

export async function generatePdf(
  summary: SummaryResult,
  mode: "normal" | "system-design",
  videoId: string
): Promise<Buffer> {
  const isSystemDesign = isSystemDesignSummary(summary);
  const modeLabel = isSystemDesign ? "System Design" : "Normal";
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

  let y = addTitle(doc, summary.title, modeLabel, date, videoId);

  y = addSummary(doc, summary.summary, y);
  y = addGist(doc, summary.gist, y);
  y = addTimestamps(doc, summary.timestamps, y);

  if (isSystemDesign) {
    const sdSummary = summary as SystemDesignSummary;
    y = await addDiagrams(doc, sdSummary.diagrams, y);
    y = addTradeoffs(doc, sdSummary.tradeoffs, y);
  }

  addTakeaways(doc, summary.keyTakeaways, y);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(170, 170, 170);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, {
      align: "center",
    });
  }

  const pdfArrayBuffer = doc.output("arraybuffer");
  return Buffer.from(pdfArrayBuffer);
}