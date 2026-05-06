# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-05-07

### Fixed
- **Transcript extraction failing on Vercel** — Direct YouTube API calls always fail from serverless IPs; now skips direct strategies on Vercel and goes straight to Cloudflare Worker proxy, saving 16+ seconds of wasted timeouts
- **Caption XML fetch unreliable** — When preferred caption track's XML fails, now tries all unique tracks before giving up instead of moving to next strategy
- **Caption fetch order wrong on serverless** — Proxy-first on Vercel (direct as fallback), direct-first on local
- **Repeated extraction on same video** — Extract route now checks Redis cache before attempting extraction, avoiding redundant YouTube API calls
- **Direct fetch timeout too long on serverless** — Reduced from 8s to 5s for fallback direct fetches on Vercel

## [2.0.0] - 2026-05-07

### Added
- **Technical Course mode** (Free) — Course summary with lessons, key concepts, and tools
- **Technical Course Pro mode** (~₹12) — Complete course with code examples, exercises, best practices, prerequisites, implementation steps, common pitfalls, and resources
- **Dynamic sections for all modes** — Only sections present in the video appear in the PDF; no forced/empty sections
- **Yellow marker highlighting** — Important keywords marked with `{critical}term{/critical}` get yellow background highlight in PDF
- **Cross-references** — AI generates `[REF:section-title]` markers rendered as "(See Section Title)" in PDF
- **Capacity estimates** (System Design Pro) — Back-of-envelope calculations with realistic numbers and disclaimer
- **Data model** (System Design Pro) — Entities, attributes, and relationships
- **API design** (System Design Pro) — OpenAPI-style endpoint descriptions (conditional, only if video discusses APIs)
- **Failure scenarios** (System Design Pro) — Failure modes with impact and mitigation strategies
- **NFRs** (System Design Pro) — Non-functional requirements categorized by scalability, reliability, performance, security
- **Code examples** (Technical Course Pro) — Extracted code snippets with language, explanation, and timestamp
- **Exercise suggestions** (Technical Course Pro) — AI-generated practice exercises per lesson
- **Mode mismatch blocking** — System Design Pro blocks non-system-design videos; Technical Course Pro blocks non-course videos; shows suggestion to switch modes
- **Minimum content validation** — Videos with fewer than 3 applicable sections show "Not enough content" error
- **Section confidence threshold** — AI assesses >70% confidence before including a section
- **Soft page limits** — Recommended pages per mode with +3 overflow allowed; footer warning on extended PDFs
- **Logical section ordering** — Sections ordered logically (not chronologically) except Technical Course lessons which follow video order
- **Inline analysis** — Diagrams, trade-offs, and API design placed inline with relevant sections in System Design Pro
- **Diagram-section linking** — Diagrams have `relatedSection` field and are rendered alongside their section
- **Better transcript error message** — Clear explanation when video lacks captions, with tip about YouTube CC button

### Changed
- **Removed `gist` field** from all modes (was redundant with Overview)
- **No transcript fallback** — Sections show "[Section content not available]" instead of raw transcript when summary is missing
- **Fixed pricing discrepancy** — Removed hardcoded ₹5 in pricing.ts; now dynamically calculates from USD × exchange rate (~₹8 for $0.10 modes, ~₹12 for $0.15)
- **Technical Course Pro pricing** — $0.15/USD (~₹12) reflecting code extraction complexity
- **Removed redundant timestamps** from System Design Pro and Pro modes (already shown in section headers and TOC)
- **AI prompts completely rewritten** — All 6 prompts now support dynamic section analysis, confidence thresholds, and `{critical}` markers
- **PDF generator rewritten** — ~1600 lines with dynamic section rendering, highlighting, cross-references, and all 6 modes
- **ModeSelector redesigned** — 3-column layout with Normal, System Design (Basic/Pro), Technical Course (Basic/Pro), and full-width Pro mode
- **PaymentModal** — Supports all 3 paid modes (Pro, System Design Pro, Technical Course Pro)
- **PaymentProvider** — Updated `PaidMode` type to include `"technical-course-pro"`
- **Type system overhauled** — `BaseSummary` with `sectionsIncluded`, `sectionsSkipped`, `sectionMetadata`; mode-specific interfaces with `mode` discriminator field; type guards updated
- **LLM failover** — All providers now support Technical Course and Technical Course Pro modes
- **Content flattening** — `flattenContent()` in gemini.ts extracts nested `content` object to top level for type compatibility

### Fixed
- Pricing mismatch between displayed ₹5 and checkout ₹8 — now dynamically calculated from exchange rate
- Empty sections appearing in PDF — dynamic sections skip silently when no content
- Raw transcript appearing in Pro mode sections — replaced with placeholder text

## [1.2.0] - 2026-05-04

### Added
- **Multi-provider LLM failover** — Gemini → Groq → Cerebras → Mistral → OpenRouter
  - `lib/llm.ts` — Central failover router with mode-aware provider selection
  - `lib/cerebras.ts` — Cerebras provider (llama3.1-8b / llama-3.3-70b)
  - `lib/mistral.ts` — Mistral provider (mistral-small-latest / mistral-medium-latest)
  - `lib/openrouter.ts` — OpenRouter provider (openrouter/free auto-routing)
  - `lib/groq.ts` — Groq provider (llama-3.1-8b-instant / llama-3.3-70b-versatile)
- **Smart model selection by transcript size** — Each provider picks a faster/smaller model
  for short transcripts and simpler modes, falling back to larger models as needed
- **Razorpay callback URL integration** — Server-side payment confirmation
  - `POST /api/payment-callback` — Verifies signature, stores payment in Redis, redirects to success/failure pages
  - `POST /api/create-order` — Now stores `{mode, videoId}` in Redis for callback retrieval
  - `/payment-success` — Reads query params, stores payment in localStorage, auto-redirects home
  - `/payment-failed` — Error display with retry link
  - PaymentModal uses `handler` (full UPI/card/wallet support) + `callback_url` (WebView fallback)
- **International pricing** — Dual INR/USD display with live exchange rate from exchangerate-api.com
  - `GET /api/exchange-rate` — Cached in Redis for 1 hour, fallback ₹83/USD
- **Redis-based PDF caching** — PDFs stored as base64 in Redis (7-day TTL), replacing Vercel Blob dependency
- **Video duration limit** — 4-hour max (240K transcript chars). Clear error message on extract/summarize APIs
- **Pro mode section summaries** — LLM generates `sectionSummary` (3-5 sentences) per section instead of dumping raw transcript into PDF
- **Cerebras & Mistral API keys** — Added to `.env.local` for multi-provider failover
- **Perf test infrastructure** — `perf-test.js` + `perf-test-videos.json` for concurrent load testing with PDF output

### Changed
- **PDF generation** — `addProSections()` renders `sectionSummary` text instead of raw transcript;
  falls back to 500-char transcript excerpt only if LLM didn't return summary
- **PDF generation** — All summary fields (`sections`, `diagrams`, `definitions`, etc.) now null-safe with `|| []` defaults
- **Groq provider** — Changed from `llama-3.1-8b-instant` (normal-only) to multi-model with `llama-3.3-70b-versatile`
  for all modes
- **Mistral provider** — Uses `max_tokens` instead of `max_completion_tokens` (Mistral API difference)
- **Failover error handling** — 413/404/422/"failed after" errors now trigger failover to next provider
- **`lib/kv.ts`** — Removed `getCachedPdfUrl`/`setCachedPdfUrl`; `checkCacheStatus` now checks Redis `pdf_blob:*` keys
- **`lib/blob.ts`** — Replaced Vercel Blob with Redis base64 storage (`storePdf`, `getPdfBuffer`)
- **`app/api/generate-pdf/route.ts`** — Simplified: no more Blob URL header, just stores PDF in Redis and returns buffer
- **`app/api/extract/route.ts`** — Added 240K char transcript limit check
- **`app/api/summarize/route.ts`** — Added 240K char transcript limit check
- **PaymentModal** — Re-added `handler` callback for in-page verification (full payment method support),
  plus `callback_url` as WebView fallback. Removed `redirect: true`
- **ModeSelector** — Shows dual pricing `₹5 / $0.10` with live exchange rate
- **PDF filename** — Sanitized to ASCII-only characters to prevent ByteString errors

### Fixed
- ByteString error in PDF Content-Disposition header for titles with non-ASCII characters
- Mistral 422 errors — `max_completion_tokens` → `max_tokens` parameter name
- PDF generation crash when LLM returns undefined `diagrams`/`sections`/`definitions` arrays
- PDF generation crash on `addProSections` when `section.keyPoints` was undefined
- Groq 413 TPM errors — Now uses context-appropriate model sizes with fallback chains

### Added
- **Razorpay payment integration** — Modal overlay checkout for paid modes (System Design Pro & Pro)
  - `POST /api/create-order` — Creates Razorpay order server-side
  - `POST /api/verify-payment` — Verifies Razorpay payment signature server-side
  - `lib/razorpay.ts` — Server helper: `createOrder()`, `verifyPayment()`
  - Payment flows on **download**, not on generate (no refund complexity)
  - Free preview (title, gist, takeaways) always visible; payment gates PDF download
  - localStorage stores verified payment for same session re-downloads (24hr TTL)
- **Translated captions fallback** (`&tlang=en`) — When non-English captions are the only
  available track, YouTube is asked to translate them to English. Retries via direct
  fetch then Cloudflare Worker proxy.
- **Better "no captions" error UI** — Amber warning box specifically for caption-less
  videos, distinct from generic red error box

### Changed
- `PaymentModal.tsx` — Completely rewritten: no more mock card form. Opens Razorpay
  checkout modal overlay. Handles creating order, checkout, verification, success/error.
- `PaymentProvider.tsx` — Simplified: `openPayment()`, `closePayment()`, `isPaid()` only.
  No mock payment logic.
- `PdfPreview.tsx` — New props: `mode`, `paymentVerified`, `onPayAndDownload`. Shows
  "Download Full PDF — ₹5" (amber, with lock icon) for unpaid paid modes, normal
  "Download PDF" (indigo) for free/paid modes.
- `page.tsx` — Payment no longer blocks generation. Paid modes generate for free,
  payment is prompted on download. Removed `"payment"` from AppState.
- `lib/pricing.ts` — `PricingInfo` moved from `types.ts` to `pricing.ts`, added
  `amountPaise` field (500 for ₹5 modes).
- `lib/youtube.ts` — `fetchCaptionXml()` now tries `&tlang=en` translation fallback
  for non-English caption tracks before giving up.

### Removed
- Mock payment card form (replaced by Razorpay checkout)
- `PaymentState` type from `types.ts` (no longer needed)

## [1.1.0] - 2025-05-03

### Added
- **System Design Pro mode** — Paid mode (₹5/PDF) with multi-type Mermaid diagrams
  (flowchart, sequence, class, ER, state, mindmap), video type auto-detection,
  Pro-level content (sections, definitions, callouts, Q&A), and design trade-offs
- **Mock payment flow** — PaymentModal component with card form, processing animation,
  and success state. Stores mock payment in localStorage (1hr expiry). No real charges.
- **PaymentProvider context** — React context managing payment state, with `isPaid()`
  check to skip payment for already-paid videos in the same session
- **Pricing module** (`lib/pricing.ts`) — Centralized pricing config for all modes
- **3-card + sub-toggle ModeSelector** — Normal, System Design (Basic/Detailed toggle), Pro
- **Diagram type detection** in `lib/mermaid.ts` — Detects flowchart, sequence, class,
  ER, state, mindmap from mermaid code prefix; theme injection only for flowcharts
- **System Design Pro PDF layout** — Cover page, TOC with diagram titles, SD detection
  banner, overview, sections, inline diagrams, definitions, callouts, Q&A, trade-offs
- `isSystemDesignProSummary()` type guard in `lib/types.ts`
- `normalizeSystemDesignProSummary()` normalizer in `lib/gemini.ts`
- `SystemDesignProSummary` type with `isSystemDesign`, `videoType`, `diagrams`, `tradeoffs`
- `DiagramType` type and `diagramType` field on `MermaidDiagram`
- `PaymentState` and `PricingInfo` types
- Info banners for all 4 modes (Normal, SD Basic, SD Pro, Pro)

### Changed
- `Mode` type now includes `"system-design-pro"`
- `summarizeTranscript()` routes to `SYSTEM_DESIGN_PRO_PROMPT` for `system-design-pro`
- `generatePdf()` handles `system-design-pro` layout with full Pro content + diagrams
- API routes accept `"system-design-pro"` as valid mode
- `injectTheme()` in mermaid.ts only adds forest theme for flowcharts (skips for other types)
- `cleanMermaidCode()` is now type-aware with per-diagram-type cleanup rules
- `simplifyMermaidCode()` only applies node reduction for flowcharts
- System Design card now has Basic (Free) / Detailed (₹5) sub-toggle
- Pro card now shows ₹5 badge instead of text "PRO"
- Payment modal appears before generation for paid modes
- `app/page.tsx` now wrapped in `<PaymentProvider>`

### Fixed
- (none)

## [1.0.0] - 2025-05-01

### Added
- Normal mode — summary, timestamps, takeaways, gist
- System Design mode — flowchart diagrams, trade-offs
- Pro mode — full video content as structured PDF (sections, definitions, callouts, Q&A)
- YouTube transcript extraction via InnerTube + Cloudflare Worker proxy
- Gemini 2.5 Flash AI summarization
- Mermaid diagram rendering via mermaid.ink
- jsPDF server-side PDF generation
- Vercel deployment with 30s/60s function timeouts
- Upstash Redis caching, Vercel Blob PDF storage