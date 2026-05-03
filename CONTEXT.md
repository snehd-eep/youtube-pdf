# yt2pdf — Project Context Cache

> **Last updated**: v1.1.0
> **Purpose**: Single-file reference for the entire project state. Update when making significant changes.

---

## Architecture Overview

```
User → page.tsx (state machine, wrapped in PaymentProvider)
  ├── /api/extract      → lib/youtube.ts   → transcript
  ├── /api/summarize    → lib/gemini.ts     → summary (normal | system-design | system-design-pro | pro)
  └── /api/generate-pdf → lib/pdf-generator.ts → PDF buffer

Payment flow: PaymentModal → PaymentProvider context → localStorage mock
Caching: lib/kv.ts (Upstash Redis) stores transcript, summary, PDF URL
Storage:  lib/blob.ts (Vercel Blob) stores generated PDFs
Proxy:    cf-worker/ (Cloudflare Worker) proxies YouTube API calls for Vercel
```

---

## File Map

### App Routes (`app/`)
| File | Lines | Purpose |
|------|-------|---------|
| `page.tsx` | ~514 | Main page — state machine: idle→payment→processing→done/error, PaymentProvider wrapper |
| `api/extract/route.ts` | ~55 | POST /api/extract — extracts transcript from YouTube URL |
| `api/summarize/route.ts` | ~86 | POST /api/summarize — calls Gemini with transcript, caches result |
| `api/generate-pdf/route.ts` | ~68 | POST /api/generate-pdf — generates PDF, stores in Blob, returns buffer |
| `api/cache/[videoId]/route.ts` | — | GET cache endpoint |

### Libraries (`lib/`)
| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | ~150 | Type definitions: Mode (4 modes), DiagramType, SystemDesignProSummary, PaymentState, PricingInfo |
| `pricing.ts` | ~15 | Centralized pricing — PRICING config, isPaidMode() helper |
| `youtube.ts` | ~370 | YouTube transcript extraction — InnerTube → scrape → CF Worker proxy fallback |
| `gemini.ts` | ~430 | Gemini 2.5 Flash — NORMAL_PROMPT, SYSTEM_DESIGN_PROMPT, SYSTEM_DESIGN_PRO_PROMPT, PRO_PROMPT |
| `pdf-generator.ts` | ~1046 | jsPDF generation — Normal, System Design, System Design Pro, Pro layouts |
| `mermaid.ts` | ~280 | Mermaid rendering — multi-type detection, forest theme for flowcharts, type-aware cleanup |
| `kv.ts` | ~80 | Upstash Redis caching |
| `blob.ts` | ~30 | Vercel Blob storage |

### Components (`components/`)
| File | Lines | Purpose |
|------|-------|---------|
| `Header.tsx` | ~31 | Sticky header with "yt2pdf" branding |
| `UrlInput.tsx` | ~96 | YouTube URL input form with validation |
| `ModeSelector.tsx` | ~190 | 3-card layout: Normal, System Design (Basic/Detailed toggle), Pro (₹5 badge) |
| `ProcessingStatus.tsx` | ~95 | Step-by-step progress (extract/summarize/generate) |
| `PdfPreview.tsx` | ~96 | Result display — title, gist, takeaways, download/regenerate buttons |
| `PaymentModal.tsx` | ~220 | Mock payment modal — card form, processing, success/error states |
| `PaymentProvider.tsx` | ~75 | React context — payment state, isPaid(), startPayment(), localStorage mock |

### Cloudflare Worker (`cf-worker/`)
| File | Purpose |
|------|---------|
| `src/index.ts` | CORS proxy for YouTube API calls |
| `wrangler.toml` | Deployed to `https://yt-proxy.snehd-yt-proxy.workers.dev` |

---

## Data Structures

### Mode (v1.1.0)
```typescript
type Mode = "normal" | "system-design" | "system-design-pro" | "pro";
type DiagramType = "flowchart" | "sequence" | "class" | "er" | "state" | "mindmap";
```

### Pricing
| Mode | Price | Free? |
|------|-------|-------|
| normal | ₹0 | Yes |
| system-design | ₹0 | Yes |
| system-design-pro | ₹5 | No |
| pro | ₹5 | No |

### Prompts (v1.1.0)
**NORMAL_PROMPT**: title, summary, timestamps (8-15), keyTakeaways (5-8), gist

**SYSTEM_DESIGN_PROMPT** (free): Same as Normal + diagrams (3 flowcharts only, max 6-8 nodes), tradeoffs (3-6)

**SYSTEM_DESIGN_PRO_PROMPT** (paid): Full Pro content + Phase 1 (video type detection: isSystemDesign, videoType) + Phase 2 (sections, definitions, callouts, Q&A, timestamps 15-25, takeaways 8-12) + Phase 3 (if SD: 3-7+ multi-type diagrams with diagramType field + 4-6 tradeoffs; if not SD: no diagrams, general pros/cons)

**PRO_PROMPT** (paid): title, summary (4-5 paragraphs), timestamps (15-25), sections (5-10), overview, focusAreas, definitions, callouts, qa, keyTakeaways (8-12), gist

---

## PDF Layouts (v1.1.0)

### Normal mode:
Title → Executive Summary → Gist (blue box) → Timeline → Key Takeaways

### System Design mode (free):
Title → Executive Summary → Gist → Timeline → Architecture Diagrams (3 flowcharts) → Design Trade-offs → Key Takeaways

### System Design Pro mode (paid):
Cover Page (gold "SYSTEM DESIGN PRO") → TOC (sections + focus areas + diagram titles) → SD Detection Banner → Overview → Gist (gold box) → Executive Summary (4-5 paragraphs) → Sections (with transcript text + key points) → Architecture Diagrams (multi-type: flowchart, sequence, class, ER, state, mindmap) → Key Definitions → Insights & Tips (callouts) → Trade-offs → Q&A → Timeline → Key Takeaways

If `isSystemDesign === false`: SD Detection Banner shows "Video classified as [type]. Diagrams not generated." and no diagrams section rendered.

### Pro mode (paid):
Cover Page (gold "PRO") → TOC → Overview → Gist → Executive Summary → Sections (with transcript) → Definitions → Callouts → Q&A → Timeline → Key Takeaways

---

## Payment Flow (Mock)

1. User clicks "Generate PDF" with paid mode (system-design-pro or pro)
2. `isPaidMode(mode)` returns true
3. `isPaid(mode, videoId)` checks localStorage for `mockPayment_{mode}_{videoId}`
4. If not paid: PaymentModal opens with card form (4242 4242 4242 4242 prefilled)
5. On submit: 2-second simulated delay, stores payment in localStorage (1hr TTL)
6. On success: modal closes, generation proceeds
7. Same video in same session: skips payment (localStorage check)

**Not yet implemented**: Real Razorpay integration, authentication, receipt generation, refund flow

---

## Mermaid Multi-type Support (v1.1.0)

- `detectDiagramType(code)`: Returns type based on code prefix
  - `sequenceDiagram` → sequence, `classDiagram` → class, `erDiagram` → er, `stateDiagram-v2` → state, `mindmap` → mindmap, default → flowchart
- `injectTheme()`: Only adds `%%{init: {'theme': 'forest'}}%%` for flowcharts (breaks other types)
- `cleanMermaidCode()`: Type-aware cleanup
  - sequence/class/er/state: Strip `%%` comments, preserve syntax
  - mindmap: Preserve indentation
  - flowchart: Full cleanup (smart quotes, special chars)
- `simplifyMermaidCode()`: Only applies node reduction (max 8) for flowcharts

---

## External Services

| Service | Purpose | Config |
|---------|---------|--------|
| **Google Gemini 2.5 Flash** | AI summarization | `GEMINI_API_KEY` in .env.local |
| **Cloudflare Worker** | YouTube API proxy for Vercel | `https://yt-proxy.snehd-yt-proxy.workers.dev` |
| **Upstash Redis** | Caching (transcript 7d, summary 7d, PDF URL 30d) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Vercel Blob** | PDF storage | `BLOB_READ_WRITE_TOKEN` |
| **mermaid.ink** | Mermaid diagram rendering | Free API, returns JPEG, forest theme for flowcharts |

---

## Key Decisions & History

| Date | Decision | Reason |
|------|----------|--------|
| Initial | Next.js + TypeScript + Tailwind | Full-stack MVP |
| Initial | jsPDF over pdfmake | pdfmake TS issues in serverless |
| Initial | Gemini 2.5 Flash over 2.0 Flash | 2.0 has 0 free quota |
| v0.1 | mermaid.ink JPEG with base64url encoding | PNG endpoint returns 404 |
| v0.1 | mermaid forest theme + cleanMermaidCode() | Better visuals, handles complex syntax |
| v1.0 | Pro mode added | Full video content as structured PDF document |
| v1.1 | System Design Pro mode | Multi-type diagrams (flowchart, sequence, class, ER, state, mindmap) |
| v1.1 | Mock payment flow | PaymentModal with localStorage, no real Razorpay yet |
| v1.1 | 4-mode pricing | Normal (Free), SD Basic (Free), SD Pro (₹5), Pro (₹5) |
| v1.1 | Diagram type detection | mermaid.ts detects type from code prefix, theme only for flowcharts |

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