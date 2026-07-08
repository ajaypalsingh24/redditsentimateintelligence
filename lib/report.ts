type BrandReportInput = {
  name: string;
  website: string;
  businessSummary: string;
  targetAudience: string;
  targetMarkets?: string[] | null;
  services?: string[] | null;
  competitors?: string[] | null;
  seedSubreddits?: string[] | null;
  knownThreads?: string[] | null;
  keywords?: string[] | null;
  brandAccounts?: string[] | null;
};

type MentionReportInput = {
  title: string;
  url: string;
  subreddit: string;
  snippet: string;
  sourceQuery: string;
  sentiment: string;
  confidence: number;
  riskScore: number;
  reason: string;
  themes: string[];
  recommendedAction: string;
  isBrandMentioned?: boolean;
  detectedAt: Date;
};

export function percentage(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

export function sentimentBreakdown(mentions: MentionReportInput[]) {
  const sentimentMentions = mentions.filter(
    (mention) => mention.isBrandMentioned !== false && ["positive", "neutral", "negative"].includes(mention.sentiment),
  );
  const total = sentimentMentions.length;
  const positive = sentimentMentions.filter((mention) => mention.sentiment === "positive").length;
  const neutral = sentimentMentions.filter((mention) => mention.sentiment === "neutral").length;
  const negative = sentimentMentions.filter((mention) => mention.sentiment === "negative").length;
  const sentimentScore = total ? Math.round((positive * 100 + neutral * 50) / total) : 0;

  return {
    total,
    positive,
    neutral,
    negative,
    positivePct: percentage(positive, total),
    neutralPct: percentage(neutral, total),
    negativePct: percentage(negative, total),
    sentimentScore,
  };
}

export function joinList(values: string[] | null | undefined, fallback = "Not provided") {
  const safeValues = values || [];
  return safeValues.length ? safeValues.join(", ") : fallback;
}

function list(values: string[] | null | undefined) {
  return values || [];
}

function cleanQuery(value: string) {
  return value
    .replace(/^site:reddit\.com\s+/i, "")
    .replace(/\s+(scam|fraud|complaint|bad|fake|poor|worst|avoid|issue|problem|review|reviews|experience|cost|alternative|recommendation|OR)\b.*$/i, "")
    .replace(/^"|"$/g, "")
    .trim();
}

function mentionText(mention: MentionReportInput) {
  return `${mention.title} ${mention.snippet} ${mention.reason}`.toLowerCase();
}

export function getBrandAliases(brand: BrandReportInput) {
  const accountAliases = list(brand.brandAccounts)
    .map((account) => account.replace(/^https?:\/\/(www\.)?reddit\.com\/user\//i, "").replace(/\/$/g, ""))
    .map((account) => account.replace(/^u\//i, ""))
    .filter(Boolean);

  return Array.from(new Set([brand.name, ...list(brand.keywords), ...accountAliases].filter(Boolean)));
}

export function overallInsight(brand: BrandReportInput, mentions: MentionReportInput[]) {
  const stats = sentimentBreakdown(mentions);
  const market = joinList(list(brand.targetMarkets), "the selected market");
  const category = list(brand.services)[0] || brand.businessSummary || "this category";

  if (!stats.total) {
    return `${brand.name} currently has no verified Reddit threads stored in this dashboard. That does not mean Reddit has no value; it means the first priority is discovery. Use branded aliases, account usernames, competitors, service terms, and seed subreddits to build a clean baseline before making any SEO or reputation decision.`;
  }

  if (stats.negativePct >= 40) {
    return `${brand.name} has a risky Reddit footprint: ${stats.negativePct}% of verified threads are negative. The SEO concern is not just sentiment; it is whether these threads rank for branded queries in ${market}. Review each negative URL, separate factual issues from noise, and prepare transparent responses or owned-content fixes around ${category}.`;
  }

  if (stats.positivePct >= 60) {
    return `${brand.name} has a mostly positive Reddit footprint: ${stats.positivePct}% positive, ${stats.neutralPct}% neutral, and ${stats.negativePct}% negative. The SEO opportunity is to preserve positive proof points, monitor comparison threads, and turn recurring Reddit questions into helpful pages and FAQs.`;
  }

  return `${brand.name} has a mixed or early-stage Reddit footprint. The current data should be treated as a monitoring baseline, with focus on neutral research threads, comparison keywords, and subreddit communities where ${category} is discussed naturally.`;
}

export function threadPriority(mention: MentionReportInput) {
  if (mention.isBrandMentioned === false) {
    return "Opportunity";
  }
  if (mention.sentiment === "negative" && mention.riskScore >= 7) {
    return "High";
  }
  if (mention.sentiment === "negative" || mention.recommendedAction === "reply") {
    return "Medium";
  }
  if (mention.sentiment === "positive") {
    return "Proof";
  }
  return "Watch";
}

export function actionRequired(mention: MentionReportInput) {
  if (mention.isBrandMentioned === false) {
    return "Do not count this as sentiment. Review it as a visibility-gap opportunity where the brand can participate only if it can add useful context.";
  }
  if (mention.sentiment === "negative" && mention.riskScore >= 7) {
    return "Manually review context, document the issue, and prepare a factual response if the thread is accurate and active.";
  }
  if (mention.sentiment === "negative") {
    return "Monitor and verify whether the complaint is real, repeated, or ranking for branded searches.";
  }
  if (mention.sentiment === "positive") {
    return "Track as a positive Reddit proof asset and check whether it appears for branded review keywords.";
  }
  return "Watch for follow-up comments and use the question/theme to improve FAQs or comparison content.";
}

export function topThemes(mentions: MentionReportInput[]) {
  return Object.entries(
    mentions.reduce<Record<string, number>>((acc, mention) => {
      for (const theme of mention.themes) {
        const key = theme.trim().toLowerCase();
        if (key) {
          acc[key] = (acc[key] || 0) + 1;
        }
      }
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

export function sourceKeyword(mention: MentionReportInput) {
  return cleanQuery(mention.sourceQuery) || "Branded Reddit search";
}

export function competitorsFound(brand: BrandReportInput, mention: MentionReportInput) {
  const text = mentionText(mention);
  return list(brand.competitors).filter((competitor) => text.includes(competitor.toLowerCase()));
}

export function visibilityGapSummary(brand: BrandReportInput, mentions: MentionReportInput[]) {
  const competitorCounts = new Map<string, number>();

  for (const mention of mentions) {
    for (const competitor of competitorsFound(brand, mention)) {
      competitorCounts.set(competitor, (competitorCounts.get(competitor) || 0) + 1);
    }
  }

  const rankedCompetitors = Array.from(competitorCounts.entries()).sort((a, b) => b[1] - a[1]);
  const stats = sentimentBreakdown(mentions);

  if (!stats.total) {
    return "No Reddit thread has been verified yet. First scan exact branded and category keywords, then identify Google-visible Reddit discussions where people are asking for recommendations.";
  }

  if (rankedCompetitors.length) {
    const competitorText = rankedCompetitors
      .slice(0, 4)
      .map(([name, count]) => `${name} (${count})`)
      .join(", ");
    return `Competitors are visible in the collected Reddit results: ${competitorText}. This indicates a Reddit visibility gap for ${brand.name}. Prioritize neutral recommendation threads where users compare tools and the brand can be introduced only with useful, transparent context.`;
  }

  if (stats.neutralPct >= 50) {
    return `Most collected Reddit threads are neutral or research-led. That is an opportunity signal: users are asking questions, comparing options, or looking for recommendations, even when ${brand.name} is not being discussed strongly yet.`;
  }

  return `The current Reddit set is sentiment-led rather than competitor-led. Focus first on high-risk negative URLs, then expand discovery around category and comparison keywords to find more visibility opportunities.`;
}

function competitorText(brand: BrandReportInput, mentions: MentionReportInput[]) {
  const counts = new Map<string, number>();

  for (const mention of mentions) {
    for (const competitor of competitorsFound(brand, mention)) {
      counts.set(competitor, (counts.get(competitor) || 0) + 1);
    }
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (ranked.length) {
    return ranked
      .slice(0, 4)
      .map(([name]) => name)
      .join(", ");
  }

  return joinList(list(brand.competitors), "competitors");
}

function categoryText(brand: BrandReportInput) {
  return joinList(list(brand.services), brand.businessSummary || "the category");
}

export function strategicActionOverview(brand: BrandReportInput, mentions: MentionReportInput[]) {
  const stats = sentimentBreakdown(mentions);
  const competitors = competitorText(brand, mentions);
  const category = categoryText(brand);
  const subredditNames = subredditTargets(brand, mentions)
    .slice(0, 3)
    .map((item) => item.subreddit)
    .join(", ");

  if (!stats.total) {
    return {
      overview: `${brand.name} does not yet have verified Reddit data in this dashboard. The first priority is discovery: scan branded, competitor, and category keywords to find Reddit conversations where users are asking for recommendations around ${category}.`,
      currentPosition: `${brand.name} has no measured Reddit footprint yet. This should be treated as an unknown visibility position, not proof of positive or negative sentiment.`,
      sentimentSummary:
        "No sentiment summary is available until Reddit URLs are collected and classified. Start with exact brand aliases, product names, competitor names, and high-intent category keywords.",
      pathForward:
        "Build a clean baseline first. Add competitors, target subreddits, known Reddit URLs, and category keywords, then run a scan. After that, review neutral recommendation threads and negative branded threads separately.",
      coreActions: [
        "Add exact brand aliases, website, product names, competitor names, and category keywords.",
        "Scan Reddit through SerpApi and verify that collected URLs are relevant before acting on the data.",
      ],
    };
  }

  const neutralLead = stats.neutralPct >= stats.negativePct && stats.neutralPct >= stats.positivePct;
  const visibilityGap = list(brand.competitors).length > 0 || neutralLead;

  return {
    overview: `Reddit conversations around ${category} are ${
      neutralLead ? "mostly neutral and recommendation-driven" : "mixed across positive, neutral, and negative signals"
    }. Users are asking questions, comparing options, and sharing experiences. ${
      competitors !== "competitors"
        ? `Competitors such as ${competitors} appear in the collected conversation set, showing stronger visibility within relevant Reddit discussions.`
        : "This creates an opportunity to understand which Reddit discussions influence user research."
    }`,
    currentPosition: visibilityGap
      ? `${brand.name} is not yet strongly present in the natural Reddit recommendation cycle. The issue appears to be visibility and awareness, not necessarily negative perception. Relevant communities${
          subredditNames ? ` such as ${subredditNames}` : ""
        } should be monitored for recommendation, comparison, and workflow discussions.`
      : `${brand.name} already has some direct Reddit footprint. The priority is to separate positive proof, neutral research threads, and negative risk threads so each gets the right response.`,
    sentimentSummary: `Current verified Reddit sentiment is ${stats.positivePct}% positive, ${stats.neutralPct}% neutral, and ${stats.negativePct}% negative across ${stats.total} thread${
      stats.total === 1 ? "" : "s"
    }. ${
      neutralLead
        ? `The main pattern is neutral research intent: users are looking for tools, advice, alternatives, or workflows. For ${brand.name}, this means the biggest opportunity is awareness-building through helpful participation.`
        : stats.negativePct >= 40
          ? `Negative sentiment is material. Prioritize high-risk threads before doing visibility-building work.`
          : `The sentiment mix is not dominated by risk, so the brand can combine monitoring with visibility-building.`
    }`,
    pathForward: `The strategy should focus on community participation rather than direct promotion. ${brand.name} should engage only where it can add practical advice around ${category}. Responses should answer the user's problem first, mention the brand transparently only when relevant, and avoid repetitive promotional posting. Over time, this can help the brand become part of Reddit recommendation and comparison discussions.`,
    coreActions: [
      "Establish a credible Reddit brand presence with a transparent profile, helpful comment history, and non-promotional participation.",
      "Drive visibility through community engagement in relevant threads where users discuss recommendations, competitors, pain points, alternatives, and workflows.",
      "Prioritize neutral recommendation threads first, because they are often the best opportunity for organic visibility without reputation risk.",
      "Review negative threads separately and respond only when the brand can provide factual, useful clarification.",
    ],
  };
}

export function opportunityInference(brand: BrandReportInput, mention: MentionReportInput) {
  const competitors = competitorsFound(brand, mention);
  const keyword = sourceKeyword(mention);
  const subreddit = mention.subreddit || "Reddit";

  if (mention.isBrandMentioned === false) {
    return `For “${keyword}”, this ${subreddit} thread is relevant but does not mention ${brand.name}. Do not count it as neutral sentiment; treat it as a visibility-gap opportunity for monitoring, competitor tracking, or careful organic participation.`;
  }

  if (mention.sentiment === "negative") {
    return `For “${keyword}”, this ${subreddit} thread is a reputation-risk result. Review the complaint context, check whether it ranks for branded searches, and decide whether a factual response or owned-content fix is required.`;
  }

  if (competitors.length) {
    return `For “${keyword}”, this ${subreddit} thread shows competitor visibility (${competitors.slice(0, 3).join(", ")}). If ${brand.name} is absent or weakly represented, this is a visibility-gap opportunity: monitor the thread and look for a natural, policy-safe way to add helpful brand context.`;
  }

  if (mention.sentiment === "neutral") {
    return `For “${keyword}”, this ${subreddit} thread is informational/recommendation-led. It can be used as a Reddit opportunity target because users are researching options, asking questions, or comparing solutions.`;
  }

  return `For “${keyword}”, this ${subreddit} thread can be tracked as positive proof. Check whether it appears for branded Google searches and preserve the URL as a credibility asset.`;
}

export function subredditTargets(brand: BrandReportInput, mentions: MentionReportInput[]) {
  const fromMentions = Object.entries(
    mentions.reduce<Record<string, number>>((acc, mention) => {
      const subreddit = mention.subreddit || "";
      if (subreddit) {
        acc[subreddit] = (acc[subreddit] || 0) + 1;
      }
      return acc;
    }, {}),
  ).map(([subreddit, count]) => ({
    subreddit,
    relevance: `${count} existing verified mention${count === 1 ? "" : "s"} found.`,
    approach: "Monitor first, then answer only when the brand can add factual help.",
  }));

  const fromSeeds = list(brand.seedSubreddits).map((subreddit) => ({
    subreddit: subreddit.startsWith("r/") ? subreddit : `r/${subreddit}`,
    relevance: "Added manually as a target community for this brand/category.",
    approach: "Review rules, common post formats, and moderation strictness before participating.",
  }));

  const categoryFallbacks = [
    {
      subreddit: "r/smallbusiness",
      relevance: "Useful for general service, coaching, and buying-decision discussions.",
      approach: "Use for market listening and question discovery.",
    },
    {
      subreddit: "r/Entrepreneur",
      relevance: "Relevant when the offer targets founders, professionals, or business growth.",
      approach: "Only answer high-intent questions with transparent context.",
    },
    {
      subreddit: "r/Productivity",
      relevance: "Useful for coaching, training, workflow, and professional-development topics.",
      approach: "Mine recurring pain points for content and positioning.",
    },
  ];

  const merged = [...fromMentions, ...fromSeeds, ...categoryFallbacks];
  const seen = new Set<string>();
  return merged.filter((item) => {
    const key = item.subreddit.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function initialThreadsToTarget(brand: BrandReportInput, mentions: MentionReportInput[]) {
  const stored = mentions
    .slice()
    .sort((a, b) => b.riskScore - a.riskScore || b.detectedAt.getTime() - a.detectedAt.getTime())
    .slice(0, 12)
    .map((mention) => ({
      title: mention.title,
      url: mention.url,
      reason: actionRequired(mention),
      priority: threadPriority(mention),
    }));

  const known = list(brand.knownThreads).map((url) => ({
    title: "Known Reddit thread added manually",
    url,
    reason: "Review this manually and classify it during the next report update.",
    priority: "Manual",
  }));

  return [...stored, ...known];
}

export function sampleRedditThreads(brand: BrandReportInput) {
  const service = list(brand.services)[0] || "this service";
  const audience = brand.targetAudience || "people researching this option";
  const competitor = list(brand.competitors)[0] || "other options";
  const brandName = brand.name;

  return [
    {
      type: "Branded question",
      title: `Has anyone used ${brandName}? Looking for honest feedback`,
      body: `I am researching ${service} and came across ${brandName}. Most of what I found is on their own site, so I am trying to understand real user experiences before making a decision. What should I check before trusting a provider in this space?`,
    },
    {
      type: "Comparison",
      title: `${brandName} vs ${competitor}: what should I compare before choosing?`,
      body: `I am comparing ${brandName} with ${competitor} for ${service}. Pricing is one thing, but I am more interested in support quality, transparency, results, and whether the service is a good fit for ${audience}. What questions would you ask before signing up?`,
    },
    {
      type: "Non-branded pain point",
      title: `How do you choose a reliable ${service} provider without relying only on testimonials?`,
      body: `Trying to avoid making a decision based only on polished case studies. For anyone who has bought ${service}, what signals helped you separate a genuinely helpful provider from one that just markets well?`,
    },
  ];
}

export function actionPlan(brand: BrandReportInput, mentions: MentionReportInput[]) {
  const stats = sentimentBreakdown(mentions);
  const hasAccount = list(brand.brandAccounts).length > 0;

  return [
    {
      step: "Clean the data baseline",
      action:
        "Keep only Reddit URLs that directly mention the brand, account, website, a strong alias, or a relevant competitor/category opportunity. Do not use unrelated SerpApi matches for sentiment scoring.",
    },
    {
      step: "Review thread-level risk",
      action:
        stats.negative > 0
          ? "Open each negative thread manually, identify the exact complaint, and decide whether to respond, monitor, or fix owned content."
          : "No verified negative Reddit thread is stored yet. Continue discovery around branded reviews, complaints, alternatives, and competitor comparisons.",
    },
    {
      step: "Use the brand account carefully",
      action: hasAccount
        ? "Audit account age, karma, recent replies, and tone. Use the account for transparent support-style replies, not promotional posting."
        : "Add official Reddit account URLs if the brand participates on Reddit.",
    },
    {
      step: "Build SEO content from Reddit questions",
      action:
        "Turn repeated Reddit concerns into review pages, FAQs, comparison pages, pricing explainers, and trust pages that can rank for branded search.",
    },
    {
      step: "Monitor monthly",
      action:
        "Run a monthly scan, compare sentiment percentage changes, and flag new threads that start ranking for branded or competitor terms.",
    },
  ];
}
