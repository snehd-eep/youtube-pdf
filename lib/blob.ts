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

const PDF_TTL = 7 * 24 * 60 * 60;

export async function storePdf(
  videoId: string,
  mode: string,
  pdfBuffer: Buffer
): Promise<string> {
  const client = getRedis();

  if (client) {
    const key = `pdf_blob:${videoId}:${mode}`;
    const base64 = pdfBuffer.toString("base64");
    await client.set(key, base64, { ex: PDF_TTL });
    return `redis://${key}`;
  }

  return "memory";
}

export async function getPdfBuffer(
  videoId: string,
  mode: string
): Promise<Buffer | null> {
  const client = getRedis();

  if (!client) return null;

  const key = `pdf_blob:${videoId}:${mode}`;
  const data = await client.get<string>(key);

  if (!data) return null;

  return Buffer.from(data, "base64");
}

export async function getPdfUrl(
  videoId: string,
  mode: string
): Promise<string | null> {
  return null;
}