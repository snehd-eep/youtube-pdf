import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { razorpayOrderId, videoId, mode } = body;

    if (!razorpayOrderId || !videoId || !mode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const client = getRedis();
    if (!client) {
      return NextResponse.json({ error: "Redis not configured" }, { status: 503 });
    }

    const key = `payment:${razorpayOrderId}:${videoId}:${mode}`;
    await client.del(key);

    console.log(`Payment deleted from Redis: ${key}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete payment";
    console.error("Delete payment error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}