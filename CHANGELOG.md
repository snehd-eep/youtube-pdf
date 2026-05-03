# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-05-03

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