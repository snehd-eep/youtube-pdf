import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const EXCHANGE_RATE_TTL = 60 * 60;

let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  redis = new Redis({ url, token });
  return redis;
}

async function fetchExchangeRate(): Promise<number> {
  try {
    const res = await fetch("https://api.exchangerate-api.com/v6/latest/USD");
    if (!res.ok) throw new Error("Exchange rate API failed");
    
    const data = await res.json() as { conversion_rates: { INR: number } };
    return data.conversion_rates.INR;
  } catch {
    return 83;
  }
}

export async function GET(request: NextRequest) {
  try {
    const client = getRedis();
    let rate: number | null = await client.get<number>("exchange_rate:inr");

    if (!rate) {
      rate = await fetchExchangeRate();
      await client.set("exchange_rate:inr", rate, { ex: EXCHANGE_RATE_TTL });
    }

    return NextResponse.json({
      rate,
      inrPerUsd: rate,
      updatedAt: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get exchange rate";
    console.error("Exchange rate error:", message);
    return NextResponse.json({ rate: 83, inrPerUsd: 83 }, { status: 200 });
  }
}