import { NextRequest, NextResponse } from "next/server";
import { PRICING } from "@/lib/pricing";
import { Mode } from "@/lib/types";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_Skyk6nmjDPZZa0";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "9cMrKgkz4zDKP6Kk5oaW7gwu";

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

    const receipt = `yt2pdf_${Date.now()}`;

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: pricing.amountPaise,
        currency: "INR",
        receipt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Razorpay API error:", response.status, errorData);
      return NextResponse.json(
        { error: `Payment service error: ${response.status}` },
        { status: 503 }
      );
    }

    const order = await response.json();

    return NextResponse.json({
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create order";
    console.error("Create order error:", message, error);
    return NextResponse.json({ error: `Failed to create order: ${message}` }, { status: 500 });
  }
}