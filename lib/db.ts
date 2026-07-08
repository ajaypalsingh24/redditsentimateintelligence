import { neon } from "@neondatabase/serverless";

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("place_your"));
}

export const sql = hasDatabaseUrl() ? neon(process.env.DATABASE_URL!) : null;
let schemaPromise: Promise<void> | null = null;

export async function ensureSchema() {
  if (!sql) {
    return;
  }

  schemaPromise ??= createSchema();
  await schemaPromise;
}

async function createSchema() {
  if (!sql) {
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS sentiment_brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client_email TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      business_summary TEXT NOT NULL DEFAULT '',
      target_audience TEXT NOT NULL DEFAULT '',
      target_markets JSONB NOT NULL DEFAULT '[]'::jsonb,
      services JSONB NOT NULL DEFAULT '[]'::jsonb,
      competitors JSONB NOT NULL DEFAULT '[]'::jsonb,
      seed_subreddits JSONB NOT NULL DEFAULT '[]'::jsonb,
      known_threads JSONB NOT NULL DEFAULT '[]'::jsonb,
      keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
      brand_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sentiment_mentions (
      id TEXT PRIMARY KEY,
      brand_id TEXT NOT NULL REFERENCES sentiment_brands(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      display_link TEXT,
      subreddit TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      upvotes INTEGER,
      comment_count INTEGER,
      post_date_label TEXT NOT NULL DEFAULT '',
      snippet TEXT NOT NULL DEFAULT '',
      source_query TEXT NOT NULL DEFAULT '',
      sentiment TEXT NOT NULL DEFAULT 'neutral',
      confidence INTEGER NOT NULL DEFAULT 0,
      risk_score INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL DEFAULT '',
      themes JSONB NOT NULL DEFAULT '[]'::jsonb,
      opportunity_type TEXT NOT NULL DEFAULT 'monitor',
      recommended_action TEXT NOT NULL DEFAULT 'monitor',
      is_brand_mentioned BOOLEAN NOT NULL DEFAULT true,
      is_urgent BOOLEAN NOT NULL DEFAULT false,
      detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sentiment_scan_runs (
      id TEXT PRIMARY KEY,
      brand_id TEXT NOT NULL REFERENCES sentiment_brands(id) ON DELETE CASCADE,
      scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      mention_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      queries_run INTEGER NOT NULL DEFAULT 0,
      new_mentions INTEGER NOT NULL DEFAULT 0,
      sentiment_mentions INTEGER NOT NULL DEFAULT 0,
      opportunity_mentions INTEGER NOT NULL DEFAULT 0,
      negative_mentions INTEGER NOT NULL DEFAULT 0,
      urgent_mentions INTEGER NOT NULL DEFAULT 0,
      errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS client_email TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS business_summary TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS target_audience TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS target_markets JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS services JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS competitors JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS seed_subreddits JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS known_threads JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS keywords JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS brand_accounts JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
  await sql`ALTER TABLE sentiment_brands ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`;

  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS brand_id TEXT`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS url TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS display_link TEXT`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS subreddit TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS upvotes INTEGER`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS comment_count INTEGER`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS post_date_label TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS snippet TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS source_query TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS sentiment TEXT NOT NULL DEFAULT 'neutral'`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS confidence INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS risk_score INTEGER NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS themes JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS opportunity_type TEXT NOT NULL DEFAULT 'monitor'`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS recommended_action TEXT NOT NULL DEFAULT 'monitor'`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS is_brand_mentioned BOOLEAN NOT NULL DEFAULT true`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
  await sql`ALTER TABLE sentiment_mentions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`;

  await sql`CREATE INDEX IF NOT EXISTS mentions_brand_id_idx ON sentiment_mentions(brand_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mentions_url_unique_idx ON sentiment_mentions(url)`;
  await sql`CREATE INDEX IF NOT EXISTS brands_created_at_idx ON sentiment_brands(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS mentions_detected_at_idx ON sentiment_mentions(detected_at)`;
  await sql`CREATE INDEX IF NOT EXISTS scan_runs_brand_id_idx ON sentiment_scan_runs(brand_id)`;
  await sql`CREATE INDEX IF NOT EXISTS scan_runs_scanned_at_idx ON sentiment_scan_runs(scanned_at)`;
}
