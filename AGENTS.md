<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: yt2pdf

## Architecture
- Next.js App Router with TypeScript
- Tailwind CSS v4 for styling
- jsPDF for PDF generation (server-side in API routes)
- youtube-transcript npm for caption extraction
- Google Gemini 2.0 Flash for AI summarization
- mermaid.ink for diagram rendering (external API)
- Upstash Redis for caching (optional)
- Vercel Blob for PDF storage (optional)

## Key Commands
- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm test` — Run Vitest unit tests

## Environment Variables
- `GEMINI_API_KEY` (required) — Google Gemini API key
- `UPSTASH_REDIS_REST_URL` (optional) — Redis URL for caching
- `UPSTASH_REDIS_REST_TOKEN` (optional) — Redis token
- `BLOB_READ_WRITE_TOKEN` (optional) — Vercel Blob token
- `NEXT_PUBLIC_APP_URL` (optional) — App URL

## Two Modes
1. **Normal** — summary, timestamps, takeaways, gist
2. **System Design** — all of above + Mermaid diagrams + trade-offs