# yt2pdf — YouTube Videos to PDFs

Transform YouTube videos into beautifully formatted PDFs with summaries, timestamps, and architecture diagrams. Built for readers who prefer text over video.

## Features

- **Normal Mode** — Summary, timestamped topics, key takeaways, and gist
- **System Design Mode** — All of the above + Mermaid architecture diagrams, design trade-offs
- **Smart Caching** — Cache with Upstash Redis, PDF storage with Vercel Blob
- **Free AI** — Powered by Google Gemini's free tier
- **Auto-generated captions** — Works with YouTube's auto-generated subtitles

## Quick Start

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **Google Gemini API Key** — free at [ai.google.dev](https://ai.google.dev)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/youtube-pdf.git
cd youtube-pdf

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local

# 4. Edit .env.local — at minimum, add your Gemini API key
# GEMINI_API_KEY=your_key_here
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key (free at [ai.google.dev](https://ai.google.dev)) |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL for caching ( Enables caching ) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token ( Enables caching ) |
| `BLOB_READ_WRITE_TOKEN` | No | Vercel Blob token ( Enables PDF storage ) |

> **Without caching variables**, the app still works — it just re-processes videos each time.

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Production Build

```bash
npm run build
npm start
```

## Architecture

```
User pastes YouTube URL + selects mode
           |
           v
    POST /api/extract
    -> youtube-transcript fetches captions
    -> Returns { videoId, title, transcript[] }
           |
           v
    POST /api/summarize
    -> Sends transcript to Gemini AI
    -> Returns structured JSON (summary, timestamps, diagrams)
           |
           v
    POST /api/generate-pdf
    -> Builds PDF with jsPDF ( + Mermaid diagrams for system design )
    -> Returns PDF buffer
```

### Two Modes

**Normal Mode:**
- Executive Summary
- Gist (one-liner)
- Timestamped topic breakdown
- Key Takeaways

**System Design Mode (all of above +):**
- Mermaid architecture diagrams (rendered as PNG images)
- Design Trade-offs (pros/cons analysis)
- System-specific insights

### Caching Flow

```
First request: Extract -> Summarize -> Generate PDF -> Cache result
Second request (same video): Return cached PDF instantly
```

- **Transcript cache**: 7 days (Upstash Redis)
- **Summary cache**: 7 days (Upstash Redis)
- **PDF storage**: 30 days (Vercel Blob)

## Project Structure

```
youtube-pdf/
├── app/
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Main page (URL input + mode + results)
│   ├── globals.css                   # Tailwind styles
│   └── api/
│       ├── extract/route.ts          # Extract transcript from YouTube
│       ├── summarize/route.ts        # Gemini AI processing
│       ├── generate-pdf/route.ts     # PDF generation
│       └── cache/[videoId]/route.ts   # Check cache status
├── lib/
│   ├── types.ts                      # Shared TypeScript types
│   ├── youtube.ts                    # YouTube transcript extraction
│   ├── gemini.ts                     # Gemini AI client + prompts
│   ├── mermaid.ts                    # Mermaid.ink image renderer
│   ├── pdf-generator.ts              # jsPDF PDF builder
│   ├── kv.ts                         # Upstash Redis caching
│   └── blob.ts                       # Vercel Blob PDF storage
├── components/
│   ├── Header.tsx                    # App header
│   ├── UrlInput.tsx                  # YouTube URL input
│   ├── ModeSelector.tsx             # Normal vs System Design toggle
│   ├── ProcessingStatus.tsx         # Step-by-step progress
│   └── PdfPreview.tsx               # Download + summary preview
├── __tests__/
│   ├── unit/                         # Vitest unit tests
│   └── integration/                 # API route integration tests
└── package.json
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variables
vercel env add GEMINI_API_KEY
# Optional:
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add BLOB_READ_WRITE_TOKEN

# Deploy with env vars
vercel --prod
```

### Setting Up Upstash Redis (Optional — for caching)

1. Go to [upstash.com](https://upstash.com) and create a free account
2. Create a Redis database
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the dashboard
4. Add them to your `.env.local` or Vercel environment variables

### Setting Up Vercel Blob (Optional — for PDF storage)

1. Go to your Vercel project dashboard
2. Navigate to Storage > Blob
3. Create a Blob store
4. The `BLOB_READ_WRITE_TOKEN` is automatically set when deployed on Vercel

## Gemini Free Tier Limits

| Metric | Limit |
|--------|-------|
| Requests per minute | 15 |
| Tokens per minute | 1,000,000 |
| Requests per day | 1,500 |

For MVP usage, these limits are generous. Each video conversion makes 1-2 Gemini calls.

## Troubleshooting

| Issue | Solution |
|-------|---------|
| `GEMINI_API_KEY` error | Add your key to `.env.local` |
| YouTube transcript fails | Some videos have captions disabled — try another video |
| 429 rate limit from Gemini | Wait 60 seconds, free tier is 15 RPM |
| PDF generation fails | Check console for errors, ensure jsPDF loaded correctly |
| Caching not working | Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set |
| Mermaid diagrams show code instead of images | mermaid.ink may be rate limited — try again later |
| Long videos fail | Videos >2hrs may exceed Gemini context window |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Styling | Tailwind CSS |
| Transcript | youtube-transcript |
| AI | Google Gemini 2.0 Flash |
| PDF | jsPDF |
| Diagrams | Mermaid.js via mermaid.ink |
| Caching | Upstash Redis |
| PDF Storage | Vercel Blob |
| Testing | Vitest |

## License

MIT