import { Redis } from "@upstash/redis";
import { Mode } from "./types";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn(
      "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. Caching disabled."
    );
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

const TRANSCRIPT_TTL = 7 * 24 * 60 * 60;
const SUMMARY_TTL = 7 * 24 * 60 * 60;
const PDF_URL_TTL = 30 * 24 * 60 * 60;

export async function getCachedTranscript(
  videoId: string
): Promise<Record<string, unknown> | null> {
  const client = getRedis();
  if (!client) return null;

  const key = `transcript:${videoId}`;
  return client.get<Record<string, unknown>>(key);
}

export async function setCachedTranscript(
  videoId: string,
  data: Record<string, unknown>
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const key = `transcript:${videoId}`;
  await client.set(key, JSON.stringify(data), { ex: TRANSCRIPT_TTL });
}

export async function getCachedSummary(
  videoId: string,
  mode: Mode
): Promise<Record<string, unknown> | null> {
  const client = getRedis();
  if (!client) return null;

  const key = `summary:${videoId}:${mode}`;
  return client.get<Record<string, unknown>>(key);
}

export async function setCachedSummary(
  videoId: string,
  mode: Mode,
  data: Record<string, unknown>
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const key = `summary:${videoId}:${mode}`;
  await client.set(key, JSON.stringify(data), { ex: SUMMARY_TTL });
}

export async function getCachedPdfUrl(
  videoId: string,
  mode: Mode
): Promise<string | null> {
  const client = getRedis();
  if (!client) return null;

  const key = `pdf:${videoId}:${mode}`;
  const result = await client.get<{ pdfUrl: string }>(key);
  return result?.pdfUrl ?? null;
}

export async function setCachedPdfUrl(
  videoId: string,
  mode: Mode,
  pdfUrl: string
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const key = `pdf:${videoId}:${mode}`;
  await client.set(key, JSON.stringify({ pdfUrl }), { ex: PDF_URL_TTL });
}

export async function checkCacheStatus(
  videoId: string,
  mode: Mode
): Promise<{ transcript: boolean; summary: boolean; pdf: boolean; pdfUrl?: string }> {
  const client = getRedis();
  if (!client) {
    return { transcript: false, summary: false, pdf: false };
  }

  const [transcript, summary, pdfData] = await Promise.all([
    client.exists(`transcript:${videoId}`),
    client.exists(`summary:${videoId}:${mode}`),
    client.get<{ pdfUrl: string }>(`pdf:${videoId}:${mode}`),
  ]);

  return {
    transcript: transcript > 0,
    summary: summary > 0,
    pdf: pdfData !== null,
    pdfUrl: (pdfData as { pdfUrl: string } | null)?.pdfUrl,
  };
}