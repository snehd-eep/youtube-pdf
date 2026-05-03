import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment verification fields" },
        { status: 400 }
      );
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET || "9cMrKgkz4zDKP6Kk5oaW7gwu";

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return NextResponse.json(
        { error: "Payment verification failed", verified: false },
        { status: 400 }
      );
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    console.error("Verify payment error:", message);
    return NextResponse.json({ error: message, verified: false }, { status: 500 });
  }
}