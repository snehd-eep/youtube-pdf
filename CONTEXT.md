# yt2pdf — Project Context Cache

> **Last updated**: v1.0.0 kickoff
> **Purpose**: Single-file reference for the entire project state. Update when making significant changes.

---

## Architecture Overview

```
User → page.tsx (state machine)
  ├── /api/extract      → lib/youtube.ts   → transcript
  ├── /api/summarize    → lib/gemini.ts     → summary (normal | system-design | pro)
  └── /api/generate-pdf → lib/pdf-generator.ts → PDF buffer

Caching: lib/kv.ts (Upstash Redis) stores transcript, summary, PDF URL
Storage:  lib/blob.ts (Vercel Blob) stores generated PDFs
Proxy:    cf-worker/ (Cloudflare Worker) proxies YouTube API calls for Vercel
```

---

## File Map

### App Routes (`app/`)
| File | Lines | Purpose |
|------|-------|---------|
| `page.tsx` | ~413 | Main page — state machine: idle→processing→done/error |
| `api/extract/route.ts` | ~55 | POST /api/extract — extracts transcript from YouTube URL |
| `api/summarize/route.ts` | ~86 | POST /api/summarize — calls Gemini with transcript, caches result |
| `api/generate-pdf/route.ts` | ~67 | POST /api/generate-pdf — generates PDF, stores in Blob, returns buffer |
| `api/cache/[videoId]/route.ts` | — | GET cache endpoint |

### Libraries (`lib/`)
| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | ~90 | Type definitions: Mode, TranscriptEntry, SummaryResult, etc. |
| `youtube.ts` | ~370 | YouTube transcript extraction — InnerTube API → web scrape → CF Worker proxy fallback |
| `gemini.ts` | ~191 | Gemini 2.5 Flash AI client — NORMAL_PROMPT, SYSTEM_DESIGN_PROMPT, summarizeTranscript() |
| `pdf-generator.ts` | ~402 | jsPDF PDF generation — title, summary, gist, timestamps, diagrams, trade-offs, takeaways |
| `mermaid.ts` | ~150 | Mermaid diagram rendering via mermaid.ink API (forest theme, base64url encoding) |
| `kv.ts` | ~80 | Upstash Redis caching — getCached*/setCached* for transcript, summary, PDF URL |
| `blob.ts` | ~30 | Vercel Blob storage — storePdf(), getPdfUrl() |

### Components (`components/`)
| File | Lines | Purpose |
|------|-------|---------|
| `Header.tsx` | ~31 | Sticky header with "yt2pdf" branding |
| `UrlInput.tsx` | ~96 | YouTube URL input form with validation |
| `ModeSelector.tsx` | ~81 | Two-button toggle: Normal / System Design |
| `ProcessingStatus.tsx` | ~95 | Step-by-step progress (extract/summarize/generate) |
| `PdfPreview.tsx` | ~96 | Result display — title, gist, takeaways, download/regenerate buttons |

### Cloudflare Worker (`cf-worker/`)
| File | Purpose |
|------|---------|
| `src/index.ts` | CORS proxy for YouTube API calls — only allows youtube.com / youtubei.googleapis.com |
| `wrangler.toml` | Deployed to `https://yt-proxy.snehd-yt-proxy.workers.dev` |

---

## Data Structures

### Mode
```typescript
type Mode = "normal" | "system-design" | "pro";
```

### Current Prompts (as of v0.1.0)
**NORMAL_PROMPT**: Requests JSON with:
- `title`, `summary` (2-3 paragraphs), `timestamps` (8-15 entries with time/topic/description)
- `keyTakeaways` (5-8 items), `gist` (one-liner)

**SYSTEM_DESIGN_PROMPT**: All of NORMAL plus:
- `diagrams` (3 Mermaid diagrams: high-level, data flow, component interaction — max 6-8 nodes, <10 lines, `graph TD`/`flowchart TD`)
- `tradeoffs` (3-6 entries with decision/pros/cons)

---

## PDF Layout (Current — v0.1.0)

- **A4 portrait**, margins 20mm, jsPDF
- **Page width**: 170mm usable
- **Fonts**: Helvetica (normal/bold/italic)
- **Line height**: 5mm

### Sections (Normal mode):
1. Title — video title, date, mode label, video ID
2. Executive Summary — multi-paragraph summary text
3. Gist — one-liner in rounded blue box
4. Timeline — timestamp entries (time + topic + description), light separator per entry
5. Key Takeaways — numbered list

### Sections (System Design mode):
All of Normal plus:
6. Architecture Diagrams — mermaid.ink images (max 120mm height, centered), fallback raw code blocks
7. Design Trade-offs — two-column PROS/CONS layout, green/red coloring

### Common:
- Page footer: "Page X of Y" centered
- Page breaks before major sections
- SECTION_GAP: 8mm between sections
- LINE_HEIGHT: 5mm

---

## External Services

| Service | Purpose | Config |
|---------|---------|--------|
| **Google Gemini 2.5 Flash** | AI summarization | `GEMINI_API_KEY` in .env.local |
| **Cloudflare Worker** | YouTube API proxy for Vercel | `https://yt-proxy.snehd-yt-proxy.workers.dev` |
| **Upstash Redis** | Caching (transcript 7d, summary 7d, PDF URL 30d) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Vercel Blob** | PDF storage | `BLOB_READ_WRITE_TOKEN` |
| **mermaid.ink** | Mermaid diagram rendering | Free API, returns JPEG, forest theme |

---

## Transcript Extraction Strategy (`lib/youtube.ts`)

Order of strategies:
1. **Direct InnerTube API** (ANDROID client v20.10.38) — works locally
2. **Direct web page scrape** — works locally
3. **CF Worker proxy → InnerTube API** — works on Vercel (cloud IPs get LOGIN_REQUIRED)
4. **CF Worker proxy → web page scrape** — fallback

Caption XML fetch:
1. **Direct fetch** (with User-Agent) — works locally
2. **CF Worker proxy fetch** — works on Vercel

`YT_PROXY_URL` env var defaults to `https://yt-proxy.snehd-yt-proxy.workers.dev`

---

## Deployment

- **Vercel**: `https://youtube-pdf.vercel.app/`
- **GitHub**: `https://github.com/snehd-eep/youtube-pdf.git`
- **CF Worker**: `https://yt-proxy.snehd-yt-proxy.workers.dev`
- **vercel.json**: maxDuration 30s (extract), 60s (summarize, generate-pdf)

---

## Key Decisions & History

| Date | Decision | Reason |
|------|----------|--------|
| Initial | Next.js + TypeScript + Tailwind | Full-stack MVP |
| Initial | jsPDF over pdfmake | pdfmake TS issues in serverless |
| Initial | Gemini 2.5 Flash over 2.0 Flash | 2.0 has 0 free quota |
| v0.1 | mermaid.ink JPEG with base64url encoding | PNG endpoint returns 404, base64 has +/= issues |
| v0.1 | mermaid forest theme + cleanMermaidCode() | Better visuals, handles complex syntax |
| v0.1 | @upstash/redis over @vercel/kv | Vercel KV deprecated |
| v0.1 | youtube-transcript npm removed | Fails on Vercel (cloud IPs) |
| v0.1 | InnerTube API + web scrape + CF Worker proxy | YouTube blocks cloud IPs; CF Worker routes through Cloudflare edge |
| v0.1 | AbortSignal.timeout on all HTTP calls | Prevented Vercel function timeouts |
| v0.1 | corsproxy.io as caption fallback | Returned 429 on YouTube pages, abandoned |
| v1.0 | Pro mode added | Full video content as structured PDF document |

---

## Environment Variables

```env
GEMINI_API_KEY=          # Required — Google AI Studio key
UPSTASH_REDIS_REST_URL=  # Optional — Redis caching
UPSTASH_REDIS_REST_TOKEN= # Optional — Redis auth
BLOB_READ_WRITE_TOKEN=   # Optional — Vercel Blob
NEXT_PUBLIC_APP_URL=     # Optional — app URL
YT_PROXY_URL=            # Optional — defaults to CF Worker URL
```

---

## Test Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run test:watch   # Vitest watch mode
```

---

## Cloudflare Worker Deploy

```bash
cd cf-worker
npm install
npx wrangler deploy   # Deploys to yt-proxy.snehd-yt-proxy.workers.dev
```