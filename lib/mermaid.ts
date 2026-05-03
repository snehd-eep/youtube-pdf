import { MermaidDiagram, DiagramType } from "./types";

const MERMAID_INK_BASE_URL = "https://mermaid.ink/img";

export function detectDiagramType(code: string): DiagramType {
  const trimmed = code.trim();
  if (trimmed.startsWith("sequenceDiagram")) return "sequence";
  if (trimmed.startsWith("classDiagram")) return "class";
  if (trimmed.startsWith("erDiagram")) return "er";
  if (trimmed.startsWith("stateDiagram-v2") || trimmed.startsWith("stateDiagram")) return "state";
  if (trimmed.startsWith("mindmap")) return "mindmap";
  return "flowchart";
}

export function encodeMermaidCode(mermaidCode: string): string {
  const diagramType = detectDiagramType(mermaidCode);
  const withTheme = injectTheme(mermaidCode, diagramType);
  const trimmed = withTheme.trim();
  const encoded = Buffer.from(trimmed, "utf-8").toString("base64url");
  return encoded;
}

function injectTheme(code: string, diagramType: DiagramType): string {
  if (diagramType !== "flowchart") return code.trim();
  const trimmed = code.trim();
  if (trimmed.startsWith("%%{init:")) {
    return trimmed.replace(
      /%%{init:\s*{/,
      `%%{init: {'theme': 'forest', `
    );
  }
  return `%%{init: {'theme': 'forest'}}%%\n${trimmed}`;
}

export function getMermaidImageUrl(mermaidCode: string): string {
  const encoded = encodeMermaidCode(mermaidCode);
  return `${MERMAID_INK_BASE_URL}/${encoded}`;
}

export async function fetchDiagramImages(
  diagrams: MermaidDiagram[]
): Promise<Map<string, { buffer: Buffer; format: "jpeg" | "png"; width: number; height: number }>> {
  const imageMap = new Map<string, { buffer: Buffer; format: "jpeg" | "png"; width: number; height: number }>();

  for (const diagram of diagrams) {
    try {
      const result = await fetchMermaidImage(diagram.mermaidCode, diagram.title);
      if (result) {
        imageMap.set(diagram.title, { buffer: result.buffer, format: result.format, width: result.width, height: result.height });
      }
    } catch (error) {
      console.error(`Failed to fetch diagram "${diagram.title}":`, error);
    }
  }

  return imageMap;
}

function getImageDimensions(buffer: Buffer): { width: number; height: number } {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xFF) break;
      const marker = buffer[offset + 1];
      if (marker === 0xC0 || marker === 0xC2) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
  }

  return { width: 1200, height: 800 };
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "YouTubePdf/1.0",
        "Accept": "image/*",
      },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function fetchMermaidImage(
  mermaidCode: string,
  title: string
): Promise<{ buffer: Buffer; format: "jpeg" | "png"; width: number; height: number } | null> {
  const cleanedCodes = generateCleanVariants(mermaidCode);

  for (let variantIndex = 0; variantIndex < cleanedCodes.length; variantIndex++) {
    const cleanedCode = cleanedCodes[variantIndex];
    const url = getMermaidImageUrl(cleanedCode);

    console.log(`Fetching diagram "${title}" (variant ${variantIndex + 1}/${cleanedCodes.length}, ${cleanedCode.split("\n").length} lines)...`);

    const maxRetries = 1;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetchWithTimeout(url, 30000);

        if (!response.ok) {
          console.error(
            `Mermaid.ink returned ${response.status} for "${title}" (attempt ${attempt + 1})`
          );
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          break;
        }

        const contentType = response.headers.get("content-type") || "";
        const format = contentType.includes("png") ? "png" : "jpeg";

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length < 500) {
          console.error(`Mermaid.ink returned tiny image (${buffer.length} bytes) for "${title}"`);
          break;
        }

        const dims = getImageDimensions(buffer);
        console.log(`Mermaid diagram "${title}" fetched as ${format} (${buffer.length} bytes, ${dims.width}x${dims.height}px)`);
        return { buffer, format, width: dims.width, height: dims.height };
      } catch (error) {
        const isTimeout = error instanceof Error && (error.name === "AbortError" || error.message.includes("abort") || error.message.includes("timeout"));
        if (isTimeout) {
          console.error(`Timeout fetching diagram "${title}" (variant ${variantIndex + 1})`);
        } else {
          console.error(`Error fetching diagram "${title}":`, error instanceof Error ? error.message : error);
        }
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
  }

  console.warn(`All variants failed for diagram "${title}", using text fallback`);
  return null;
}

function generateCleanVariants(code: string): string[] {
  const variants: string[] = [];
  const cleaned = cleanMermaidCode(code);

  variants.push(cleaned);

  const simplified = simplifyMermaidCode(cleaned);
  if (simplified !== cleaned) {
    variants.push(simplified);
  }

  return variants;
}

function simplifyMermaidCode(code: string): string {
  const diagramType = detectDiagramType(code);
  if (diagramType !== "flowchart") return code;

  let simplified = code;

  const lines = simplified.split("\n");
  const keptLines: string[] = [];
  const maxNodes = 8;
  let nodeCount = 0;
  const seenNodes = new Set<string>();

  for (const line of lines) {
    if (line.startsWith("%%{init:")) {
      keptLines.push(line);
      continue;
    }

    if (line.trim() === "" || line.startsWith("%%")) {
      continue;
    }

    if (line.startsWith("graph ") || line.startsWith("flowchart ")) {
      keptLines.push(line);
      continue;
    }

    const nodeMatch = line.match(/^[a-zA-Z](?:\[|"|'|\(|"?\{)/);
    const arrowMatch = line.match(/^([a-zA-Z])\s*[=-]+>>?\s*([a-zA-Z])/);

    if (arrowMatch) {
      const from = arrowMatch[1];
      const to = arrowMatch[2];
      if (!seenNodes.has(from)) {
        seenNodes.add(from);
        nodeCount++;
      }
      if (!seenNodes.has(to)) {
        seenNodes.add(to);
        nodeCount++;
      }
      if (nodeCount <= maxNodes) {
        keptLines.push(line);
      }
    } else if (nodeMatch) {
      const nodeId = line.match(/^([a-zA-Z])/)?.[1];
      if (nodeId && !seenNodes.has(nodeId)) {
        seenNodes.add(nodeId);
        nodeCount++;
        if (nodeCount <= maxNodes) {
          keptLines.push(line);
        }
      } else {
        keptLines.push(line);
      }
    } else {
      keptLines.push(line);
    }
  }

  simplified = keptLines.join("\n");

  simplified = simplified
    .replace(/classDef\s+.*$/gm, "")
    .replace(/class\s+.*$/gm, "")
    .replace(/click\s+.*$/gm, "")
    .replace(/style\s+.*$/gm, "")
    .replace(/subgraph\s+.*$/gm, "")
    .replace(/end\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!simplified.includes("graph ") && !simplified.includes("flowchart ")) {
    return code;
  }

  return simplified;
}

export function cleanMermaidCode(code: string): string {
  let cleaned = code.trim();

  cleaned = cleaned.replace(/^```mermaid\s*/i, "").replace(/\s*```$/m, "");

  const diagramType = detectDiagramType(cleaned);

  const lines = cleaned.split("\n");
  const cleanedLines = lines
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line, index, arr) => {
      if (line === "" && index > 0 && arr[index - 1] === "") return false;
      return true;
    });
  cleaned = cleanedLines.join("\n");

  cleaned = cleaned.replace(/\\n/g, "\n");

  cleaned = cleaned.replace(/[\u201C\u201D]/g, '"');
  cleaned = cleaned.replace(/[\u2018\u2019]/g, "'");

  if (diagramType === "sequence") {
    cleaned = cleaned.replace(/%%.*$/gm, "");
  } else if (diagramType === "class") {
    cleaned = cleaned.replace(/%%.*$/gm, "");
  } else if (diagramType === "er") {
    cleaned = cleaned.replace(/%%.*$/gm, "");
  } else if (diagramType === "state") {
    cleaned = cleaned.replace(/%%.*$/gm, "");
  } else if (diagramType === "mindmap") {
    // mindmap needs proper indentation, don't strip special chars aggressively
  } else {
    cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t]/g, "");
  }

  return cleaned;
}