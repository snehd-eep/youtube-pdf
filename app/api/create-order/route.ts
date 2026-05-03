import { NextRequest, NextResponse } from "next/server";
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

    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_Skyk6nmjDPZZa0";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "9cMrKgkz4zDKP6Kk5oaW7gwu";

    let Razorpay: any;
    try {
      Razorpay = (await import("razorpay")).default;
    } catch {
      const razorpayModule = require("razorpay");
      Razorpay = razorpayModule.default || razorpayModule;
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const receipt = `yt2pdf_${mode}_${videoId.slice(0, 20)}_${Date.now()}`;

    const order = await razorpay.orders.create({
      amount: pricing.amountPaise!,
      currency: "INR",
      receipt,
    });

    return NextResponse.json({
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      keyId: keyId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create order";
    console.error("Create order error:", message, error);

    if (message.includes("RAZORPAY") || message.includes("key_id") || message.includes("key_secret")) {
      return NextResponse.json(
        { error: "Payment service not configured. Please try again later." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: `Failed to create order: ${message}` }, { status: 500 });
  }
}