# Reddit Sentiment Dashboard

Client-facing Reddit sentiment dashboard using:

- Google SerpApi
- OpenAI API
- Apify Reddit Scraper for manual Reddit URL scraping
- Neon PostgreSQL
- Optional Resend or SMTP for direct PDF emails

No Reddit API is required. The app finds public Reddit URLs from Google, stores projects/scans in Neon, and separates true brand sentiment from brand-absent opportunity threads.

## What It Does

- Finds Reddit URLs from Google with SerpApi
- Uses strict brand relevance filtering before saving results
- Uses OpenAI to classify sentiment when quota is available
- Falls back to simple rules if OpenAI is unavailable
- Saves client projects and scan snapshots in Neon
- Shows positive, neutral, and negative percentages
- Shows verified Reddit threads with summary and action required
- Keeps Reddit account URLs as manual references only
- Shows opportunity-only threads separately when the brand is not mentioned
- Exports client-ready PDFs and can email generated PDF reports
- Scrapes a specific Reddit URL through a backend-only Apify route when deeper post/comment data is needed

## Required Environment Variables

```env
DATABASE_URL=
SERPAPI_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
APIFY_API_TOKEN=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
DASHBOARD_PASSWORD=
EMAIL_FROM="Reddify Reports <reports@yourdomain.com>"
```

## Optional Direct PDF Email

Use either Resend:

```env
RESEND_API_KEY=
EMAIL_FROM="Reddify Reports <reports@yourdomain.com>"
```

Or SMTP:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="Reddify Reports <reports@yourdomain.com>"
```

## How It Works

1. Add a brand name, website, aliases, known Reddit URLs, and target subreddits.
2. Click `Scan Reddit`.
3. SerpApi searches Google for Reddit URLs.
4. If the brand is mentioned, OpenAI classifies sentiment and the URL counts in the sentiment score.
5. If the brand is not mentioned but the topic/competitor context is relevant, the URL is stored only as an opportunity.
6. The dashboard reports sentiment, opportunity gaps, scan snapshots, and actions.
7. Use the `Apify Scraper` tab to scrape one Reddit URL through `/api/reddit-scrape`; the Apify token stays on the backend.

## What This Version Does Not Do

Because there is no Reddit API connected, it does not fetch:

- Reddit account age
- Karma
- Full Reddit comments
- Upvote count
- Comment count
- Recent account activity

The Brand Account section is only a manual profile reference.

## Local Commands

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Verification:

```bash
npm run typecheck
npm run build
```
