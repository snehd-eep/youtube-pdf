import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/razorpay";
import { PRICING } from "@/lib/pricing";
import { Mode } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, videoId } = body;

    if (!mode || (mode !== "system-design-pro" && mode !== "pro")) {
      return NextResponse.json(
        { error: "Invalid mode. Payment is only required for system-design-pro and pro modes." },
        { status: 400 }
      );
    }

    if (!videoId || typeof videoId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid videoId" },
        { status: 400 }
      );
    }

    const pricing = PRICING[mode as Mode];
    if (pricing.isFree) {
      return NextResponse.json(
        { error: "This mode is free, no payment required." },
        { status: 400 }
      );
    }

    const receipt = `yt2pdf_${mode}_${videoId.slice(0, 20)}_${Date.now()}`;

    const order = await createOrder(pricing.amountPaise!, receipt);

    return NextResponse.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create order";
    console.error("Create order error:", message);

    if (message.includes("RAZORPAY")) {
      return NextResponse.json(
        { error: "Payment service not configured. Please try again later." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}