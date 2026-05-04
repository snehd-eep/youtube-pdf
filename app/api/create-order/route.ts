import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { PRICING } from "@/lib/pricing";
import { Mode } from "@/lib/types";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_Skyk6nmjDPZZa0";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "9cMrKgkz4zDKP6Kk5oaW7gwu";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function getRedis(): Promise<Redis> {
  const url = process.env.UPSTASH_REDIS_REST_URL || "https://included-dinosaur-80824.upstash.io";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "gQAAAAAAATu4AAIgcDE1OTkzMjFiZjE3NmM0ZTdlOGVlZWJlODgyNjczNjg5Ng";
  return new Redis({ url, token });
}

async function getExchangeRate(): Promise<number> {
  try {
    const res = await fetch("https://api.exchangerate-api.com/v6/latest/USD", { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error("Exchange rate API failed");
    const data = await res.json() as { conversion_rates: { INR: number } };
    return data.conversion_rates.INR;
  } catch {
    return 83;
  }
}

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

    const exchangeRate = await getExchangeRate();
    const inrAmount = Math.round(pricing.priceUsd * exchangeRate * 100);
    const inrLabel = `₹${Math.round(pricing.priceUsd * exchangeRate)}`;
    const usdLabel = `$${pricing.priceUsd}`;

    const receipt = `yt2pdf_${Date.now()}`;

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: inrAmount,
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

    const redis = await getRedis();
    await redis.set(`order:${order.id}`, JSON.stringify({ mode, videoId }), { ex: 24 * 60 * 60 });

    return NextResponse.json({
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
      priceLabel: `${inrLabel} (${usdLabel})`,
      exchangeRate,
      callbackUrl: `${APP_URL}/api/payment-callback`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create order";
    console.error("Create order error:", message, error);
    return NextResponse.json({ error: `Failed to create order: ${message}` }, { status: 500 });
  }
}