import { classifyMention } from "@/lib/sentiment";
import { buildBrandQueries, isBrandMentioned, isRelevantOpportunity, searchRedditWithSerpApi, SerpMentionResult } from "@/lib/serpapi";
import { BrandRecord, createMention, createScanRun, findMentionByUrl, getActiveBrands, MentionRecord, updateMention } from "@/lib/store";

const MAX_QUERIES_PER_BRAND = 8;
const MAX_RESULTS_PER_QUERY = 5;
const MAX_NEW_MENTIONS_PER_BRAND = 30;

function aliasVariants(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const variants = new Set([trimmed]);

  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, "");
    variants.add(host);
    variants.add(host.replace(/\.(com|in|co|net|org|io|ai|app)$/i, ""));

    const redditUser = parsed.pathname.match(/\/user\/([^/]+)/i)?.[1];
    if (redditUser) {
      variants.add(redditUser);
      variants.add(`u/${redditUser}`);
    }
  } catch {
    variants.add(trimmed.replace(/^www\./i, "").replace(/\.(com|in|co|net|org|io|ai|app)$/i, ""));
  }

  return Array.from(variants).filter((item) => item.length >= 3);
}

function normalizedWords(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, " ")
    .replace(/www\./g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactWords(value: string) {
  return normalizedWords(value).replace(/\s+/g, "");
}

function compactUrl(value: string) {
  try {
    const parsed = new URL(value);
    return compactWords(`${parsed.hostname} ${parsed.pathname}`);
  } catch {
    return "";
  }
}

function contextualProductTerms(brand: BrandRecord) {
  const configuredTerms = brand.services
    .join(" ")
    .split(/[\s,./&-]+/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 5);

  return Array.from(
    new Set([
      ...configuredTerms,
      "airfryer",
      "fryer",
      "appliance",
      "appliances",
      "blender",
      "kitchen",
      "maker",
      "ice",
      "cream",
    ]),
  );
}

function hasContextualProductBrandMention(brand: BrandRecord, result: SerpMentionResult) {
  const brandTokens = normalizedWords(brand.name)
    .split(" ")
    .filter((token) => token.length >= 5);

  if (!brandTokens.length) return false;

  const text = normalizedWords(`${result.title} ${result.snippet}`);
  const words = new Set(text.split(" ").filter(Boolean));
  const hasBrandToken = brandTokens.some((token) => words.has(token));
  const hasProductContext = contextualProductTerms(brand).some((term) => words.has(term));

  return hasBrandToken && hasProductContext;
}

function hasCategoryOpportunityContext(brand: BrandRecord, result: SerpMentionResult) {
  const text = normalizedWords(`${result.title} ${result.snippet} ${result.url}`);
  const words = new Set(text.split(" ").filter(Boolean));
  const hasProductContext = contextualProductTerms(brand).some((term) => words.has(term));
  const hasCompetitorContext = brand.competitors.some((competitor) => {
    const normalizedCompetitor = normalizedWords(competitor);
    return normalizedCompetitor && ` ${text} `.includes(` ${normalizedCompetitor} `);
  });
  const isKnownThread = brand.knownThreads.some((url) => url && result.url.startsWith(url.replace(/\/$/, "")));

  return hasProductContext || hasCompetitorContext || isKnownThread;
}

function requiresProductContext(brand: BrandRecord) {
  const tokens = normalizedWords(brand.name)
    .split(" ")
    .filter(Boolean);

  return tokens.length === 2 && tokens[0] === "my" && tokens[1].length <= 6;
}

function hasWebsiteOrAccountMention(brand: BrandRecord, result: SerpMentionResult) {
  const words = new Set(normalizedWords(`${result.title} ${result.snippet}`).split(" ").filter(Boolean));
  const url = compactUrl(result.url);
  const aliases = [brand.website, ...brand.brandAccounts].flatMap(aliasVariants);

  return aliases.some((alias) => {
    const normalized = normalizedWords(alias);
    const aliasCompact = compactWords(alias);
    return (
      (normalized.length >= 6 && words.has(normalized)) ||
      (aliasCompact.length >= 6 && url.includes(aliasCompact))
    );
  });
}

function isReliableBrandMention(brand: BrandRecord, result: SerpMentionResult, aliases: string[]) {
  const directMention = isBrandMentioned(result, brand.name, aliases);
  const contextualMention = hasContextualProductBrandMention(brand, result);

  if (!directMention && !contextualMention) {
    return false;
  }

  if (requiresProductContext(brand) && !contextualMention && !hasWebsiteOrAccountMention(brand, result)) {
    return false;
  }

  return true;
}

function brandAliasesForScan(brand: BrandRecord) {
  return Array.from(
    new Set([brand.name, brand.website, ...brand.brandAccounts].flatMap(aliasVariants).filter(Boolean)),
  );
}

export type ScanSummary = {
  brandsScanned: number;
  queriesRun: number;
  newMentions: number;
  negativeMentions: number;
  urgentMentions: number;
  alertsSent: number;
  errors: string[];
};

async function buildMentionData(
  brand: BrandRecord,
  result: SerpMentionResult,
  brandMentioned: boolean,
  brandAliases: string[],
) {
  let enrichedTitle = result.title;
  let enrichedSnippet = result.snippet;
  let enrichedSubreddit = result.subreddit;
  let enrichedAuthor = "";
  let enrichedUpvotes: number | null = null;
  let enrichedCommentCount: number | null = null;
  let enrichedPostDateLabel = "";

  const enrichedResult = {
    ...result,
    title: enrichedTitle,
    snippet: enrichedSnippet,
    subreddit: enrichedSubreddit,
  };

  const enrichedBrandMentioned = isReliableBrandMention(brand, enrichedResult, brandAliases);
  const finalBrandMentioned = brandMentioned || enrichedBrandMentioned;

  const classification = finalBrandMentioned
    ? await classifyMention(enrichedTitle, enrichedSnippet, brand.name)
    : {
        sentiment: "not-applicable" as const,
        confidence: 0,
        risk_score: 1,
        reason: "Brand is not mentioned in this Reddit result. Store as an opportunity only, not sentiment.",
        themes: ["visibility gap", "opportunity"],
        opportunity_type: "answer-opportunity" as const,
        recommended_action: "monitor" as const,
      };

  return {
    title: enrichedTitle.slice(0, 500),
    url: result.url,
    displayLink: result.displayLink,
    subreddit: enrichedSubreddit,
    author: enrichedAuthor,
    upvotes: enrichedUpvotes,
    commentCount: enrichedCommentCount,
    postDateLabel: enrichedPostDateLabel,
    snippet: enrichedSnippet,
    sourceQuery: result.sourceQuery,
    sentiment: classification.sentiment,
    confidence: classification.confidence,
    riskScore: classification.risk_score,
    reason: classification.reason,
    themes: classification.themes,
    opportunityType: classification.opportunity_type,
    recommendedAction: classification.recommended_action,
    isBrandMentioned: finalBrandMentioned,
    isUrgent: classification.sentiment === "negative" && classification.risk_score >= 8,
  };
}

export async function scanBrands(brandId?: string): Promise<ScanSummary> {
  const summary: ScanSummary = {
    brandsScanned: 0,
    queriesRun: 0,
    newMentions: 0,
    negativeMentions: 0,
    urgentMentions: 0,
    alertsSent: 0,
    errors: [],
  };

  const brands = await getActiveBrands(brandId);

  summary.brandsScanned = brands.length;

  for (const brand of brands) {
    const searchTerms = [
      ...brand.keywords,
      ...brand.brandAccounts,
      brand.website,
      ...brand.competitors.map((competitor) => `${brand.name} vs ${competitor}`),
    ];
    const relevanceTerms = [
      ...brand.keywords,
      ...brand.brandAccounts,
      brand.website,
      ...brand.services,
      ...brand.competitors,
    ];
    const brandAliases = brandAliasesForScan(brand);
    const queries = buildBrandQueries(brand.name, searchTerms).slice(0, MAX_QUERIES_PER_BRAND);
    const seenUrls = new Set<string>();
    const scanMentions: MentionRecord[] = [];
    const scanErrors: string[] = [];
    let brandQueriesRun = 0;
    let brandNewMentions = 0;

    for (const query of queries) {
      summary.queriesRun += 1;
      brandQueriesRun += 1;

      try {
        const results = await searchRedditWithSerpApi(query);

        for (const result of results.slice(0, MAX_RESULTS_PER_QUERY)) {
          if (brandNewMentions >= MAX_NEW_MENTIONS_PER_BRAND) {
            break;
          }

          if (seenUrls.has(result.url)) {
            continue;
          }
          seenUrls.add(result.url);

          const brandMentioned = isReliableBrandMention(brand, result, brandAliases);
          const relevantOpportunity = isRelevantOpportunity(result, relevanceTerms) && hasCategoryOpportunityContext(brand, result);

          if (!brandMentioned && !relevantOpportunity) {
            continue;
          }

          const existing = await findMentionByUrl(result.url, brand.id);
          const mentionData = await buildMentionData(brand, result, brandMentioned, brandAliases);
          const mention = existing
            ? await updateMention({
                ...existing,
                ...mentionData,
                brandId: existing.brandId,
                url: existing.url,
                detectedAt: existing.detectedAt,
                createdAt: existing.createdAt,
                updatedAt: existing.updatedAt,
              })
            : await createMention({
                brandId: brand.id,
                ...mentionData,
              });

          if (!existing) {
            summary.newMentions += 1;
            brandNewMentions += 1;
          }

          if (mention.isBrandMentioned && mention.sentiment === "negative") {
            summary.negativeMentions += 1;
            if (mention.isUrgent) {
              summary.urgentMentions += 1;
            }
          }

          scanMentions.push(mention);
        }
      } catch (error) {
        const message = `${brand.name}: ${query}: ${error instanceof Error ? error.message : "Unknown error"}`;
        summary.errors.push(message);
        scanErrors.push(message);
      }
    }

    const uniqueScanMentions = Array.from(new Map(scanMentions.map((mention) => [mention.id, mention])).values());
    await createScanRun({
      brandId: brand.id,
      mentionIds: uniqueScanMentions.map((mention) => mention.id),
      queriesRun: brandQueriesRun,
      newMentions: brandNewMentions,
      sentimentMentions: uniqueScanMentions.filter((mention) => mention.isBrandMentioned !== false).length,
      opportunityMentions: uniqueScanMentions.filter((mention) => mention.isBrandMentioned === false).length,
      negativeMentions: uniqueScanMentions.filter((mention) => mention.isBrandMentioned && mention.sentiment === "negative").length,
      urgentMentions: uniqueScanMentions.filter((mention) => mention.isUrgent).length,
      errors: scanErrors,
    });
  }

  return summary;
}
