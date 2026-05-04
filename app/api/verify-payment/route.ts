import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { setPaymentVerified } from "@/lib/kv";
import { Mode } from "@/lib/types";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "9cMrKgkz4zDKP6Kk5oaW7gwu";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, videoId, mode } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment verification fields" },
        { status: 400 }
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return NextResponse.json(
        { error: "Payment verification failed", verified: false },
        { status: 400 }
      );
    }

    if (videoId && mode) {
      try {
        await setPaymentVerified(
          razorpay_order_id,
          razorpay_payment_id,
          mode as Mode,
          videoId
        );
        console.log(`Payment verified and stored: ${razorpay_order_id}:${videoId}:${mode}`);
      } catch (redisError) {
        console.warn("Failed to store payment in Redis:", redisError);
      }
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    console.error("Verify payment error:", message);
    return NextResponse.json({ error: message, verified: false }, { status: 500 });
  }
}