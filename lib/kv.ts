import { Redis } from "@upstash/redis";
import { Mode } from "./types";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn("UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. Caching disabled.");
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

const TRANSCRIPT_TTL = 7 * 24 * 60 * 60;
const SUMMARY_TTL = 7 * 24 * 60 * 60;
const PAYMENT_TTL = 24 * 60 * 60;

export async function getCachedTranscript(videoId: string): Promise<Record<string, unknown> | null> {
  const client = getRedis();
  if (!client) return null;
  return client.get<Record<string, unknown>>(`transcript:${videoId}`);
}

export async function setCachedTranscript(videoId: string, data: Record<string, unknown>): Promise<void> {
  const client = getRedis();
  if (!client) return;
  await client.set(`transcript:${videoId}`, JSON.stringify(data), { ex: TRANSCRIPT_TTL });
}

export async function getCachedSummary(videoId: string, mode: Mode): Promise<Record<string, unknown> | null> {
  const client = getRedis();
  if (!client) return null;
  return client.get<Record<string, unknown>>(`summary:${videoId}:${mode}`);
}

export async function setCachedSummary(videoId: string, mode: Mode, data: Record<string, unknown>): Promise<void> {
  const client = getRedis();
  if (!client) return;
  await client.set(`summary:${videoId}:${mode}`, JSON.stringify(data), { ex: SUMMARY_TTL });
}

export async function checkCacheStatus(videoId: string, mode: Mode): Promise<{ transcript: boolean; summary: boolean; pdf: boolean }> {
  const client = getRedis();
  if (!client) return { transcript: false, summary: false, pdf: false };

  const [transcript, summary, pdf] = await Promise.all([
    client.exists(`transcript:${videoId}`),
    client.exists(`summary:${videoId}:${mode}`),
    client.exists(`pdf_blob:${videoId}:${mode}`),
  ]);

  return {
    transcript: transcript > 0,
    summary: summary > 0,
    pdf: pdf > 0,
  };
}

export async function setPaymentVerified(razorpayOrderId: string, razorpayPaymentId: string, mode: Mode, videoId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  const key = `payment:${razorpayOrderId}:${videoId}:${mode}`;
  await client.set(key, JSON.stringify({ razorpayPaymentId, verifiedAt: Date.now() }), { ex: PAYMENT_TTL });
}

export async function checkPaymentVerified(razorpayOrderId: string, videoId: string, mode: Mode): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  const data = await client.get<{ razorpayPaymentId: string; verifiedAt: number }>(`payment:${razorpayOrderId}:${videoId}:${mode}`);
  return data !== null;
}