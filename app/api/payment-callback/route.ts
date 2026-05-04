import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { setPaymentVerified } from "@/lib/kv";
import { Mode } from "@/lib/types";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "9cMrKgkz4zDKP6Kk5oaW7gwu";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    let razorpay_payment_id: string | null = null;
    let razorpay_order_id: string | null = null;
    let razorpay_signature: string | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      razorpay_payment_id = params.get("razorpay_payment_id");
      razorpay_order_id = params.get("razorpay_order_id");
      razorpay_signature = params.get("razorpay_signature");
    } else {
      const body = await request.json();
      razorpay_payment_id = body.razorpay_payment_id;
      razorpay_order_id = body.razorpay_order_id;
      razorpay_signature = body.razorpay_signature;
    }

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.redirect(`${APP_URL}/payment-failed?error=missing_params`);
    }

    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      console.error("Payment callback: invalid signature", { razorpay_order_id, razorpay_payment_id });
      return NextResponse.redirect(`${APP_URL}/payment-failed?error=invalid_signature`);
    }

    const orderId = razorpay_order_id;
    const paymentId = razorpay_payment_id;

    const redisData = await getRedisOrderData(orderId);
    const mode = redisData?.mode || "pro";
    const videoId = redisData?.videoId || "";

    await setPaymentVerified(orderId, paymentId, mode as Mode, videoId);

    console.log(`Payment callback verified: ${orderId}:${videoId}:${mode}`);

    return NextResponse.redirect(
      `${APP_URL}/payment-success?orderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(paymentId)}&videoId=${encodeURIComponent(videoId)}&mode=${encodeURIComponent(mode)}`
    );
  } catch (error) {
    console.error("Payment callback error:", error);
    return NextResponse.redirect(`${APP_URL}/payment-failed?error=server_error`);
  }
}

async function getRedisOrderData(orderId: string): Promise<{ mode: string; videoId: string } | null> {
  try {
    const { Redis } = await import("@upstash/redis");
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;

    const redis = new Redis({ url, token });
    const key = `order:${orderId}`;
    const data = await redis.get<{ mode: string; videoId: string }>(key);
    return data;
  } catch {
    return null;
  }
}