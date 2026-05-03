import { NextRequest, NextResponse } from "next/server";
import { generatePdf } from "@/lib/pdf-generator";
import { setCachedPdfUrl } from "@/lib/kv";
import { storePdf } from "@/lib/blob";
import { SummaryResult, Mode, TranscriptEntry } from "@/lib/types";

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

    const pdfBuffer = await generatePdf(
      summary as SummaryResult,
      mode as Mode,
      videoId,
      transcript as TranscriptEntry[] | undefined
    );

    try {
      const pdfUrl = await storePdf(videoId, mode, pdfBuffer);
      await setCachedPdfUrl(videoId, mode as Mode, pdfUrl);

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${title || videoId}-${mode}.pdf"`,
          "X-Pdf-Url": pdfUrl,
        },
      });
    } catch (blobError) {
      console.warn("Blob storage failed, returning PDF directly:", blobError);

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${title || videoId}-${mode}.pdf"`,
        },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}