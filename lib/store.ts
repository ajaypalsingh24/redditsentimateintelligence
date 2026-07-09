import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureSchema, hasDatabaseUrl, sql } from "@/lib/db";

export type BrandRecord = {
  id: string;
  name: string;
  clientEmail: string;
  website: string;
  businessSummary: string;
  targetAudience: string;
  targetMarkets: string[];
  services: string[];
  competitors: string[];
  seedSubreddits: string[];
  knownThreads: string[];
  keywords: string[];
  brandAccounts: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  mentions?: MentionRecord[];
  scanRuns?: ScanRunRecord[];
};

export type MentionRecord = {
  id: string;
  brandId: string;
  title: string;
  url: string;
  displayLink?: string;
  subreddit: string;
  author: string;
  upvotes?: number | null;
  commentCount?: number | null;
  postDateLabel: string;
  snippet: string;
  sourceQuery: string;
  sentiment: string;
  confidence: number;
  riskScore: number;
  reason: string;
  themes: string[];
  opportunityType: string;
  recommendedAction: string;
  isBrandMentioned: boolean;
  isUrgent: boolean;
  detectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ScanRunRecord = {
  id: string;
  brandId: string;
  scannedAt: Date;
  mentionIds: string[];
  queriesRun: number;
  newMentions: number;
  sentimentMentions: number;
  opportunityMentions: number;
  negativeMentions: number;
  urgentMentions: number;
  errors: string[];
  createdAt: Date;
};

type StoreData = {
  brands: BrandRecord[];
  mentions: MentionRecord[];
  scanRuns?: ScanRunRecord[];
};

type BrandRow = {
  id: string;
  name: string;
  client_email: string;
  website: string;
  business_summary: string;
  target_audience: string;
  target_markets: unknown;
  services: unknown;
  competitors: unknown;
  seed_subreddits: unknown;
  known_threads: unknown;
  keywords: unknown;
  brand_accounts: unknown;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

type MentionRow = {
  id: string;
  brand_id: string;
  title: string;
  url: string;
  display_link?: string | null;
  subreddit: string;
  author: string;
  upvotes?: number | null;
  comment_count?: number | null;
  post_date_label: string;
  snippet: string;
  source_query: string;
  sentiment: string;
  confidence: number;
  risk_score: number;
  reason: string;
  themes: unknown;
  opportunity_type: string;
  recommended_action: string;
  is_brand_mentioned?: boolean;
  is_urgent: boolean;
  detected_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
};

type ScanRunRow = {
  id: string;
  brand_id: string;
  scanned_at: string | Date;
  mention_ids: unknown;
  queries_run: number;
  new_mentions: number;
  sentiment_mentions: number;
  opportunity_mentions: number;
  negative_mentions: number;
  urgent_mentions: number;
  errors: unknown;
  created_at: string | Date;
};

const dataPath = path.join(process.cwd(), "data", "dashboard.json");

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function jsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function reviveBrand(brand: BrandRecord): BrandRecord {
  return {
    ...brand,
    clientEmail: brand.clientEmail || "",
    targetMarkets: brand.targetMarkets || [],
    services: brand.services || [],
    competitors: brand.competitors || [],
    seedSubreddits: brand.seedSubreddits || [],
    knownThreads: brand.knownThreads || [],
    keywords: brand.keywords || [],
    brandAccounts: brand.brandAccounts || [],
    createdAt: new Date(brand.createdAt),
    updatedAt: new Date(brand.updatedAt),
  };
}

function reviveMention(mention: MentionRecord): MentionRecord {
  return {
    ...mention,
    themes: mention.themes || [],
    isBrandMentioned: mention.isBrandMentioned ?? true,
    detectedAt: new Date(mention.detectedAt),
    createdAt: new Date(mention.createdAt),
    updatedAt: new Date(mention.updatedAt),
  };
}

function reviveScanRun(scanRun: ScanRunRecord): ScanRunRecord {
  return {
    ...scanRun,
    mentionIds: scanRun.mentionIds || [],
    errors: scanRun.errors || [],
    scannedAt: new Date(scanRun.scannedAt),
    createdAt: new Date(scanRun.createdAt),
  };
}

function mapBrand(row: BrandRow): BrandRecord {
  return {
    id: row.id,
    name: row.name,
    clientEmail: row.client_email || "",
    website: row.website,
    businessSummary: row.business_summary,
    targetAudience: row.target_audience,
    targetMarkets: jsonArray(row.target_markets),
    services: jsonArray(row.services),
    competitors: jsonArray(row.competitors),
    seedSubreddits: jsonArray(row.seed_subreddits),
    knownThreads: jsonArray(row.known_threads),
    keywords: jsonArray(row.keywords),
    brandAccounts: jsonArray(row.brand_accounts),
    isActive: row.is_active,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapMention(row: MentionRow): MentionRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    title: row.title,
    url: row.url,
    displayLink: row.display_link || undefined,
    subreddit: row.subreddit,
    author: row.author,
    upvotes: row.upvotes,
    commentCount: row.comment_count,
    postDateLabel: row.post_date_label,
    snippet: row.snippet,
    sourceQuery: row.source_query,
    sentiment: row.sentiment,
    confidence: row.confidence,
    riskScore: row.risk_score,
    reason: row.reason,
    themes: jsonArray(row.themes),
    opportunityType: row.opportunity_type,
    recommendedAction: row.recommended_action,
    isBrandMentioned: row.is_brand_mentioned ?? true,
    isUrgent: row.is_urgent,
    detectedAt: toDate(row.detected_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapScanRun(row: ScanRunRow): ScanRunRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    scannedAt: toDate(row.scanned_at),
    mentionIds: jsonArray(row.mention_ids),
    queriesRun: row.queries_run,
    newMentions: row.new_mentions,
    sentimentMentions: row.sentiment_mentions,
    opportunityMentions: row.opportunity_mentions,
    negativeMentions: row.negative_mentions,
    urgentMentions: row.urgent_mentions,
    errors: jsonArray(row.errors),
    createdAt: toDate(row.created_at),
  };
}

async function readJsonStore(): Promise<StoreData> {
  try {
    const raw = await readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw) as StoreData;
    return {
      brands: (parsed.brands || []).map(reviveBrand),
      mentions: (parsed.mentions || []).map(reviveMention),
      scanRuns: (parsed.scanRuns || []).map(reviveScanRun),
    };
  } catch {
    return { brands: [], mentions: [], scanRuns: [] };
  }
}

async function writeJsonStore(data: StoreData) {
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, JSON.stringify(data, null, 2), "utf8");
}

function newestFirst<T extends { createdAt: Date }>(items: T[]) {
  return items.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function fallbackScanRuns(brandId: string, mentions: MentionRecord[]) {
  const grouped = new Map<string, MentionRecord[]>();

  for (const mention of mentions) {
    const key = mention.detectedAt.toISOString().slice(0, 10);
    grouped.set(key, [...(grouped.get(key) || []), mention]);
  }

  return Array.from(grouped.entries())
    .map(([dateKey, items]) => {
      const scannedAt = items.reduce((latest, mention) => (mention.detectedAt > latest ? mention.detectedAt : latest), items[0].detectedAt);
      return {
        id: `legacy-${brandId}-${dateKey}`,
        brandId,
        scannedAt,
        mentionIds: items.map((mention) => mention.id),
        queriesRun: 0,
        newMentions: items.length,
        sentimentMentions: items.filter((mention) => mention.isBrandMentioned !== false).length,
        opportunityMentions: items.filter((mention) => mention.isBrandMentioned === false).length,
        negativeMentions: items.filter((mention) => mention.isBrandMentioned && mention.sentiment === "negative").length,
        urgentMentions: items.filter((mention) => mention.isUrgent).length,
        errors: [],
        createdAt: scannedAt,
      };
    })
    .sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime());
}

async function useDatabase() {
  if (!hasDatabaseUrl() || !sql) {
    return false;
  }

  await ensureSchema();
  return true;
}

export async function getBrandsWithMentions() {
  if (await useDatabase()) {
    const brandRows = (await sql!`SELECT * FROM sentiment_brands ORDER BY created_at DESC`) as BrandRow[];
    const mentionRows = (await sql!`SELECT * FROM sentiment_mentions ORDER BY detected_at DESC`) as MentionRow[];
    const scanRunRows = (await sql!`SELECT * FROM sentiment_scan_runs ORDER BY scanned_at DESC`) as ScanRunRow[];
    const mentions = mentionRows.map(mapMention);
    const scanRuns = scanRunRows.map(mapScanRun);

    return brandRows.map((row) => {
      const brand = mapBrand(row);
      const brandMentions = mentions.filter((mention) => mention.brandId === brand.id).slice(0, 100);
      const brandScanRuns = scanRuns.filter((scanRun) => scanRun.brandId === brand.id).slice(0, 50);
      return {
        ...brand,
        mentions: brandMentions,
        scanRuns: brandScanRuns.length ? brandScanRuns : fallbackScanRuns(brand.id, brandMentions),
      };
    });
  }

  const data = await readJsonStore();
  return newestFirst(data.brands).map((brand) => ({
    ...brand,
    mentions: data.mentions
      .filter((mention) => mention.brandId === brand.id)
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
      .slice(0, 100),
  })).map((brand) => {
    const scanRuns = (data.scanRuns || [])
      .filter((scanRun) => scanRun.brandId === brand.id)
      .sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime())
      .slice(0, 50);

    return {
      ...brand,
      scanRuns: scanRuns.length ? scanRuns : fallbackScanRuns(brand.id, brand.mentions || []),
    };
  });
}

export async function getActiveBrands(brandId?: string) {
  if (await useDatabase()) {
    const rows = brandId
      ? ((await sql!`SELECT * FROM sentiment_brands WHERE is_active = true AND id = ${brandId} ORDER BY created_at ASC`) as BrandRow[])
      : ((await sql!`SELECT * FROM sentiment_brands WHERE is_active = true ORDER BY created_at ASC`) as BrandRow[]);

    return rows.map(mapBrand);
  }

  const data = await readJsonStore();
  return data.brands
    .filter((brand) => brand.isActive)
    .filter((brand) => (brandId ? brand.id === brandId : true))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function createBrand(data: Omit<BrandRecord, "id" | "createdAt" | "updatedAt">) {
  const now = new Date();
  const brand = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  if (await useDatabase()) {
    await insertBrand(brand);
    return brand;
  }

  const store = await readJsonStore();
  store.brands.push(brand);
  await writeJsonStore(store);
  return brand;
}

export async function updateBrand(id: string, update: Omit<BrandRecord, "id" | "createdAt" | "updatedAt">) {
  if (await useDatabase()) {
    await sql!`
      UPDATE sentiment_brands SET
        name = ${update.name},
        client_email = ${update.clientEmail},
        website = ${update.website},
        business_summary = ${update.businessSummary},
        target_audience = ${update.targetAudience},
        target_markets = ${JSON.stringify(update.targetMarkets)}::jsonb,
        services = ${JSON.stringify(update.services)}::jsonb,
        competitors = ${JSON.stringify(update.competitors)}::jsonb,
        seed_subreddits = ${JSON.stringify(update.seedSubreddits)}::jsonb,
        known_threads = ${JSON.stringify(update.knownThreads)}::jsonb,
        keywords = ${JSON.stringify(update.keywords)}::jsonb,
        brand_accounts = ${JSON.stringify(update.brandAccounts)}::jsonb,
        is_active = ${update.isActive},
        updated_at = now()
      WHERE id = ${id}
    `;
    return;
  }

  const store = await readJsonStore();
  store.brands = store.brands.map((brand) =>
    brand.id === id
      ? {
          ...brand,
          ...update,
          updatedAt: new Date(),
        }
      : brand,
  );
  await writeJsonStore(store);
}

export async function deleteBrand(id: string) {
  if (await useDatabase()) {
    await sql!`DELETE FROM sentiment_brands WHERE id = ${id}`;
    return;
  }

  const store = await readJsonStore();
  store.brands = store.brands.filter((brand) => brand.id !== id);
  store.mentions = store.mentions.filter((mention) => mention.brandId !== id);
  await writeJsonStore(store);
}

export async function findMentionByUrl(url: string, brandId?: string) {
  if (await useDatabase()) {
    const rows = brandId
      ? ((await sql!`SELECT * FROM sentiment_mentions WHERE url = ${url} AND brand_id = ${brandId} LIMIT 1`) as MentionRow[])
      : ((await sql!`SELECT * FROM sentiment_mentions WHERE url = ${url} LIMIT 1`) as MentionRow[]);
    return rows[0] ? mapMention(rows[0]) : null;
  }

  const store = await readJsonStore();
  return store.mentions.find((mention) => mention.url === url && (!brandId || mention.brandId === brandId)) || null;
}

export async function updateMention(data: MentionRecord) {
  const mention: MentionRecord = {
    ...data,
    updatedAt: new Date(),
  };

  if (await useDatabase()) {
    await sql!`
      UPDATE sentiment_mentions SET
        title = ${mention.title},
        display_link = ${mention.displayLink || null},
        subreddit = ${mention.subreddit},
        author = ${mention.author},
        upvotes = ${mention.upvotes ?? null},
        comment_count = ${mention.commentCount ?? null},
        post_date_label = ${mention.postDateLabel},
        snippet = ${mention.snippet},
        source_query = ${mention.sourceQuery},
        sentiment = ${mention.sentiment},
        confidence = ${mention.confidence},
        risk_score = ${mention.riskScore},
        reason = ${mention.reason},
        themes = ${JSON.stringify(mention.themes)}::jsonb,
        opportunity_type = ${mention.opportunityType},
        recommended_action = ${mention.recommendedAction},
        is_brand_mentioned = ${mention.isBrandMentioned},
        is_urgent = ${mention.isUrgent},
        updated_at = ${mention.updatedAt.toISOString()}
      WHERE id = ${mention.id}
    `;
    return mention;
  }

  const store = await readJsonStore();
  store.mentions = store.mentions.map((item) => (item.id === mention.id ? mention : item));
  await writeJsonStore(store);
  return mention;
}

export async function createMention(data: Omit<MentionRecord, "id" | "createdAt" | "updatedAt" | "detectedAt">) {
  const now = new Date();
  const mention: MentionRecord = {
    ...data,
    id: crypto.randomUUID(),
    detectedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  if (await useDatabase()) {
    await insertMention(mention);
    return mention;
  }

  const store = await readJsonStore();
  store.mentions.push(mention);
  await writeJsonStore(store);
  return mention;
}

export async function createScanRun(data: Omit<ScanRunRecord, "id" | "createdAt" | "scannedAt">) {
  const now = new Date();
  const scanRun: ScanRunRecord = {
    ...data,
    id: crypto.randomUUID(),
    scannedAt: now,
    createdAt: now,
  };

  if (await useDatabase()) {
    await insertScanRun(scanRun);
    return scanRun;
  }

  const store = await readJsonStore();
  store.scanRuns = store.scanRuns || [];
  store.scanRuns.push(scanRun);
  await writeJsonStore(store);
  return scanRun;
}

export async function migrateJsonToDatabase() {
  if (!(await useDatabase())) {
    return { migrated: false, brands: 0, mentions: 0 };
  }

  const data = await readJsonStore();

  for (const brand of data.brands) {
    await insertBrand(brand);
  }

  for (const mention of data.mentions) {
    await insertMention(mention);
  }

  for (const scanRun of data.scanRuns || []) {
    await insertScanRun(scanRun);
  }

  return { migrated: true, brands: data.brands.length, mentions: data.mentions.length };
}

async function insertBrand(brand: BrandRecord) {
  await sql!`
    INSERT INTO sentiment_brands (
      id, name, client_email, website, business_summary, target_audience, target_markets, services, competitors,
      seed_subreddits, known_threads, keywords, brand_accounts, is_active, created_at, updated_at
    ) VALUES (
      ${brand.id}, ${brand.name}, ${brand.clientEmail}, ${brand.website}, ${brand.businessSummary}, ${brand.targetAudience},
      ${JSON.stringify(brand.targetMarkets)}::jsonb, ${JSON.stringify(brand.services)}::jsonb,
      ${JSON.stringify(brand.competitors)}::jsonb, ${JSON.stringify(brand.seedSubreddits)}::jsonb,
      ${JSON.stringify(brand.knownThreads)}::jsonb, ${JSON.stringify(brand.keywords)}::jsonb,
      ${JSON.stringify(brand.brandAccounts)}::jsonb, ${brand.isActive}, ${brand.createdAt.toISOString()},
      ${brand.updatedAt.toISOString()}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      client_email = EXCLUDED.client_email,
      website = EXCLUDED.website,
      business_summary = EXCLUDED.business_summary,
      target_audience = EXCLUDED.target_audience,
      target_markets = EXCLUDED.target_markets,
      services = EXCLUDED.services,
      competitors = EXCLUDED.competitors,
      seed_subreddits = EXCLUDED.seed_subreddits,
      known_threads = EXCLUDED.known_threads,
      keywords = EXCLUDED.keywords,
      brand_accounts = EXCLUDED.brand_accounts,
      is_active = EXCLUDED.is_active,
      updated_at = EXCLUDED.updated_at
  `;
}

async function insertMention(mention: MentionRecord) {
  await sql!`
    INSERT INTO sentiment_mentions (
      id, brand_id, title, url, display_link, subreddit, author, upvotes, comment_count, post_date_label,
      snippet, source_query, sentiment, confidence, risk_score, reason, themes, opportunity_type,
      recommended_action, is_brand_mentioned, is_urgent, detected_at, created_at, updated_at
    ) VALUES (
      ${mention.id}, ${mention.brandId}, ${mention.title}, ${mention.url}, ${mention.displayLink || null},
      ${mention.subreddit}, ${mention.author}, ${mention.upvotes ?? null}, ${mention.commentCount ?? null},
      ${mention.postDateLabel}, ${mention.snippet}, ${mention.sourceQuery}, ${mention.sentiment},
      ${mention.confidence}, ${mention.riskScore}, ${mention.reason}, ${JSON.stringify(mention.themes)}::jsonb,
      ${mention.opportunityType}, ${mention.recommendedAction}, ${mention.isBrandMentioned}, ${mention.isUrgent},
      ${mention.detectedAt.toISOString()}, ${mention.createdAt.toISOString()}, ${mention.updatedAt.toISOString()}
    )
    ON CONFLICT (brand_id, url) DO NOTHING
  `;
}

async function insertScanRun(scanRun: ScanRunRecord) {
  await sql!`
    INSERT INTO sentiment_scan_runs (
      id, brand_id, scanned_at, mention_ids, queries_run, new_mentions, sentiment_mentions,
      opportunity_mentions, negative_mentions, urgent_mentions, errors, created_at
    ) VALUES (
      ${scanRun.id}, ${scanRun.brandId}, ${scanRun.scannedAt.toISOString()},
      ${JSON.stringify(scanRun.mentionIds)}::jsonb, ${scanRun.queriesRun}, ${scanRun.newMentions},
      ${scanRun.sentimentMentions}, ${scanRun.opportunityMentions}, ${scanRun.negativeMentions},
      ${scanRun.urgentMentions}, ${JSON.stringify(scanRun.errors)}::jsonb, ${scanRun.createdAt.toISOString()}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}
