import { NextRequest, NextResponse } from "next/server";
import { generatePdf } from "@/lib/pdf-generator";
import { storePdf } from "@/lib/blob";
import { SummaryResult, Mode, TranscriptEntry } from "@/lib/types";

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

    if (!mode || (mode !== "normal" && mode !== "system-design" && mode !== "system-design-pro" && mode !== "pro")) {
      return NextResponse.json(
        { error: "Missing or invalid 'mode' field" },
        { status: 400 }
      );
    }

    if (!videoId || typeof videoId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'videoId' field" },
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
    const message =
      error instanceof Error ? error.message : "Failed to generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}