import { classifyMention } from "@/lib/sentiment";
import { buildBrandQueries, isBrandMentioned, isRelevantOpportunity, searchRedditWithSerpApi } from "@/lib/serpapi";
import { createMention, createScanRun, findMentionByUrl, getActiveBrands, MentionRecord } from "@/lib/store";

const MAX_QUERIES_PER_BRAND = 8;
const MAX_RESULTS_PER_QUERY = 5;
const MAX_NEW_MENTIONS_PER_BRAND = 30;

export type ScanSummary = {
  brandsScanned: number;
  queriesRun: number;
  newMentions: number;
  negativeMentions: number;
  urgentMentions: number;
  alertsSent: number;
  errors: string[];
};

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
    const brandAliases = [brand.name, brand.website, ...brand.brandAccounts].filter(Boolean);
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

          const brandMentioned = isBrandMentioned(result, brand.name, brandAliases);
          const relevantOpportunity = isRelevantOpportunity(result, relevanceTerms);

          if (!brandMentioned && !relevantOpportunity) {
            continue;
          }

          const existing = await findMentionByUrl(result.url);
          if (existing) {
            scanMentions.push(existing);
            continue;
          }

          if (brandNewMentions >= MAX_NEW_MENTIONS_PER_BRAND) {
            continue;
          }

          const classification = brandMentioned
            ? await classifyMention(result.title, result.snippet, brand.name)
            : {
                sentiment: "not-applicable" as const,
                confidence: 0,
                risk_score: 1,
                reason: "Brand is not mentioned in this Reddit result. Store as an opportunity only, not sentiment.",
                themes: ["visibility gap", "opportunity"],
                opportunity_type: "answer-opportunity" as const,
                recommended_action: "monitor" as const,
              };
          const mention = await createMention({
            brandId: brand.id,
            title: result.title.slice(0, 500),
            url: result.url,
            displayLink: result.displayLink,
            subreddit: result.subreddit,
            author: "",
            upvotes: null,
            commentCount: null,
            postDateLabel: "",
            snippet: result.snippet,
            sourceQuery: result.sourceQuery,
            sentiment: classification.sentiment,
            confidence: classification.confidence,
            riskScore: classification.risk_score,
            reason: classification.reason,
            themes: classification.themes,
            opportunityType: classification.opportunity_type,
            recommendedAction: classification.recommended_action,
            isBrandMentioned: brandMentioned,
            isUrgent: classification.sentiment === "negative" && classification.risk_score >= 8,
          });

          summary.newMentions += 1;
          brandNewMentions += 1;

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
