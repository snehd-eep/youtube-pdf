import { NextRequest, NextResponse } from "next/server";
import { checkCacheStatus } from "@/lib/kv";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const mode = request.nextUrl.searchParams.get("mode") || "normal";

    if (!videoId) {
      return NextResponse.json(
        { error: "Missing videoId" },
        { status: 400 }
      );
    }

    if (mode !== "normal" && mode !== "system-design") {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'normal' or 'system-design'" },
        { status: 400 }
      );
    }

    const cacheStatus = await checkCacheStatus(videoId, mode as "normal" | "system-design");

    return NextResponse.json(cacheStatus);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to check cache";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}