import Razorpay from "razorpay";

let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID!;
    const keySecret = process.env.RAZORPAY_KEY_SECRET!;
    razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpayInstance;
}

export interface CreateOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export async function createOrder(
  amount: number,
  receipt: string
): Promise<CreateOrderResult> {
  const razorpay = getRazorpay();

  const order = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt,
  });

  return {
    orderId: order.id,
    amount: Number(order.amount),
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID!,
  };
}

export function verifyPayment(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;

  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return expectedSignature === signature;
}