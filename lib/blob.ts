import { put, head } from "@vercel/blob";

const BLOB_TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN;

export async function storePdf(
  videoId: string,
  mode: string,
  pdfBuffer: Buffer
): Promise<string> {
  const token = BLOB_TOKEN();
  const pathname = `pdfs/${videoId}/${mode}.pdf`;

  if (token) {
    const blob = await put(pathname, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      token,
    });
    return blob.url;
  }

  throw new Error(
    "BLOB_READ_WRITE_TOKEN not set. PDF storage requires Vercel Blob."
  );
}

export async function getPdfUrl(
  videoId: string,
  mode: string
): Promise<string | null> {
  const token = BLOB_TOKEN();

  if (!token) return null;

  try {
    const pathname = `pdfs/${videoId}/${mode}.pdf`;
    const blob = await head(pathname, { token });
    return blob.url;
  } catch {
    return null;
  }
}