import { NextRequest, NextResponse } from "next/server";
import { generatePdf } from "@/lib/pdf-generator";
import { storePdf } from "@/lib/blob";
import { SummaryResult, Mode, TranscriptEntry } from "@/lib/types";

// All valid modes
const VALID_MODES: Mode[] = ["normal", "system-design", "system-design-pro", "pro", "technical-course", "technical-course-pro"];

function sanitizeFilename(name: string): string {
  return name.replace(/[^\x20-\x7E]/g, "").replace(/[/\\?%*:|"<>]/g, "-").substring(0, 100) || "output";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { summary, mode, videoId, title, transcript } = body;

    if (!summary) {
      return NextResponse.json(
        { error: "Missing 'summary' field" },
        { status: 400 }
      );
    }

    if (!mode || !VALID_MODES.includes(mode)) {
      return NextResponse.json(
        { error: `Missing or invalid 'mode' field. Valid modes: ${VALID_MODES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!videoId || typeof videoId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'videoId' field" },
        { status: 400 }
      );
    }

    // Validate minimum sections for paid modes
    if (mode !== "normal" && mode !== "system-design" && mode !== "technical-course") {
      const sectionsIncluded = summary.sectionsIncluded || [];
      if (sectionsIncluded.length < 3) {
        const modeLabel = mode === "system-design-pro" ? "System Design Pro"
          : mode === "technical-course-pro" ? "Technical Course Pro"
            : mode === "pro" ? "Pro" : mode;
        const suggestion = mode === "system-design-pro"
          ? "Try Normal or Pro mode instead — they work with any video type."
          : mode === "technical-course-pro"
            ? "Try Normal or Pro mode instead — they work with any video type."
            : "";
        return NextResponse.json(
          { 
            error: `INSUFFICIENT_CONTENT:Only ${sectionsIncluded.length} sections could be identified for ${modeLabel} mode. ${suggestion}`.trim(),
          },
          { status: 400 }
        );
      }
    }

    // Handle mode mismatch errors
    if (summary.insufficientContent) {
      const reason = summary.reason || "This video doesn't have enough content for the selected mode.";
      return NextResponse.json(
        {
          error: `INSUFFICIENT_CONTENT:${reason}`,
        },
        { status: 400 }
      );
    }

    const safeName = sanitizeFilename(title || videoId);
    const filename = `${safeName}-${mode}.pdf`;

    const pdfBuffer = await generatePdf(
      summary as SummaryResult,
      mode as Mode,
      videoId,
      transcript as TranscriptEntry[] | undefined
    );

    try {
      await storePdf(videoId, mode, pdfBuffer);
    } catch (cacheError) {
      console.warn("Failed to cache PDF in Redis:", cacheError);
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate PDF";
    
    // Handle specific error types
    if (message.includes("SD_PRO_MISMATCH")) {
      return NextResponse.json(
        {
          error: "Mode mismatch",
          message: "This video doesn't appear to be a system design video.",
          type: "SD_PRO_MISMATCH",
          suggestion: "Try Pro mode or Technical Course mode instead."
        },
        { status: 400 }
      );
    }
    
    if (message.includes("TC_PRO_MISMATCH")) {
      return NextResponse.json(
        {
          error: "Mode mismatch",
          message: "This video doesn't appear to be a technical course or tutorial.",
          type: "TC_PRO_MISMATCH",
          suggestion: "Try Pro mode or System Design mode instead."
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
