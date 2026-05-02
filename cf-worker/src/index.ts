const YOUTUBE_API_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "youtubei.googleapis.com",
];

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return jsonError("Missing ?url= parameter", 400);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return jsonError("Invalid URL", 400);
    }

    if (!YOUTUBE_API_HOSTS.includes(parsedUrl.hostname)) {
      return jsonError("Only YouTube domains are allowed", 403);
    }

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("origin");
    headers.delete("referer");
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ipcountry");
    headers.delete("cf-ray");
    headers.delete("cf-visitor");
    headers.delete("x-forwarded-for");
    headers.delete("x-forwarded-proto");
    headers.delete("x-real-ip");

    try {
      const response = await fetch(parsedUrl.toString(), {
        method: request.method,
        headers,
        body: request.method !== "GET" && request.method !== "HEAD"
          ? request.body
          : undefined,
        redirect: "follow",
      });

      const responseHeaders = new Headers(response.headers);
      for (const [key] of responseHeaders) {
        if (
          key.startsWith("access-control-") ||
          key === "vary" ||
          key === "cf-cache-status"
        ) {
          responseHeaders.delete(key);
        }
      }
      Object.entries(corsHeaders()).forEach(([k, v]) =>
        responseHeaders.set(k, v)
      );

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (e: any) {
      return jsonError(`Proxy error: ${e.message}`, 502);
    }
  },
} satisfies ExportedHandler;

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, User-Agent",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}