import { readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

async function readEnvValue(key) {
  if (process.env[key]) {
    return process.env[key];
  }

  try {
    const raw = await readFile(path.join(process.cwd(), ".env"), "utf8");
    const line = raw
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${key}=`));

    return line?.slice(key.length + 1).replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const databaseUrl = await readEnvValue("DATABASE_URL");

if (!databaseUrl) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const sql = neon(databaseUrl);
const dataPath = path.join(process.cwd(), "data", "dashboard.json");

async function ensureSchema() {
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
      url TEXT NOT NULL,
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
  await sql`ALTER TABLE sentiment_mentions DROP CONSTRAINT IF EXISTS sentiment_mentions_url_key`;
  await sql`DROP INDEX IF EXISTS mentions_url_unique_idx`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mentions_brand_url_unique_idx ON sentiment_mentions(brand_id, url)`;
  await sql`CREATE INDEX IF NOT EXISTS brands_created_at_idx ON sentiment_brands(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS mentions_detected_at_idx ON sentiment_mentions(detected_at)`;
}

function asDate(value) {
  return new Date(value || Date.now()).toISOString();
}

async function insertBrand(brand) {
  await sql`
    INSERT INTO sentiment_brands (
      id, name, client_email, website, business_summary, target_audience, target_markets, services, competitors,
      seed_subreddits, known_threads, keywords, brand_accounts, is_active, created_at, updated_at
    ) VALUES (
      ${brand.id}, ${brand.name || ""}, ${brand.clientEmail || ""}, ${brand.website || ""}, ${brand.businessSummary || ""},
      ${brand.targetAudience || ""}, ${JSON.stringify(brand.targetMarkets || [])}::jsonb,
      ${JSON.stringify(brand.services || [])}::jsonb, ${JSON.stringify(brand.competitors || [])}::jsonb,
      ${JSON.stringify(brand.seedSubreddits || [])}::jsonb, ${JSON.stringify(brand.knownThreads || [])}::jsonb,
      ${JSON.stringify(brand.keywords || [])}::jsonb, ${JSON.stringify(brand.brandAccounts || [])}::jsonb,
      ${Boolean(brand.isActive)}, ${asDate(brand.createdAt)}, ${asDate(brand.updatedAt)}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

async function insertMention(mention) {
  await sql`
    INSERT INTO sentiment_mentions (
      id, brand_id, title, url, display_link, subreddit, author, upvotes, comment_count, post_date_label,
      snippet, source_query, sentiment, confidence, risk_score, reason, themes, opportunity_type,
      recommended_action, is_brand_mentioned, is_urgent, detected_at, created_at, updated_at
    ) VALUES (
      ${mention.id}, ${mention.brandId}, ${mention.title || ""}, ${mention.url}, ${mention.displayLink || null},
      ${mention.subreddit || ""}, ${mention.author || ""}, ${mention.upvotes ?? null}, ${mention.commentCount ?? null},
      ${mention.postDateLabel || ""}, ${mention.snippet || ""}, ${mention.sourceQuery || ""},
      ${mention.sentiment || "neutral"}, ${Number(mention.confidence || 0)}, ${Number(mention.riskScore || 1)},
      ${mention.reason || ""}, ${JSON.stringify(mention.themes || [])}::jsonb, ${mention.opportunityType || "monitor"},
      ${mention.recommendedAction || "monitor"}, ${mention.isBrandMentioned ?? true}, ${Boolean(mention.isUrgent)}, ${asDate(mention.detectedAt)},
      ${asDate(mention.createdAt)}, ${asDate(mention.updatedAt)}
    )
    ON CONFLICT (url) DO NOTHING
  `;
}

await ensureSchema();

const raw = await readFile(dataPath, "utf8");
const data = JSON.parse(raw);
const brands = data.brands || [];
const mentions = data.mentions || [];

for (const brand of brands) {
  await insertBrand(brand);
}

for (const mention of mentions) {
  await insertMention(mention);
}

const brandCount = await sql`SELECT count(*)::int AS count FROM sentiment_brands`;
const mentionCount = await sql`SELECT count(*)::int AS count FROM sentiment_mentions`;

console.log(
  JSON.stringify(
    {
      migratedBrands: brands.length,
      migratedMentions: mentions.length,
      databaseBrands: brandCount[0]?.count || 0,
      databaseMentions: mentionCount[0]?.count || 0,
    },
    null,
    2,
  ),
);
