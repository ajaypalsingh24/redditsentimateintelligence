export type RedditScrapeItem = {
  title: string;
  url: string;
  subreddit: string;
  author: string;
  text: string;
  score: number | null;
  commentsCount: number | null;
  createdAt: string;
};

export type RedditScrapeResult = {
  items: RedditScrapeItem[];
  rawItems: Array<Record<string, unknown>>;
};

function stringValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeItem(item: Record<string, unknown>): RedditScrapeItem {
  return {
    title: stringValue(item.title || item.postTitle || item.name),
    url: stringValue(item.url || item.postUrl || item.permalink || item.link),
    subreddit: stringValue(item.subreddit || item.communityName || item.subredditName),
    author: stringValue(item.author || item.username || item.userName),
    text: stringValue(item.text || item.body || item.selftext || item.description),
    score: numberValue(item.score ?? item.upvotes ?? item.ups),
    commentsCount: numberValue(item.commentsCount ?? item.numComments ?? item.commentCount ?? item.comments),
    createdAt: stringValue(item.createdAt || item.created_at || item.createdUtc || item.created || item.date),
  };
}

export function isRedditUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "reddit.com" || parsed.hostname.endsWith(".reddit.com");
  } catch {
    return false;
  }
}

export async function scrapeRedditUrlWithApify(redditUrl: string): Promise<RedditScrapeResult> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN is missing. Add it to environment variables.");
  }

  if (!isRedditUrl(redditUrl)) {
    throw new Error("Please enter a valid reddit.com URL.");
  }

  const actorInput = {
    startUrls: [{ url: redditUrl }],
    sort: "new",
    maxItems: 10,
    maxPostCount: 10,
    maxComments: 10,
    maxCommunitiesCount: 2,
    maxUserCount: 2,
    scrollTimeout: 40,
    maxRequestRetries: 6,
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"],
    },
  };

  let response: Response;

  try {
    response = await fetch("https://api.apify.com/v2/acts/trudax~reddit-scraper/run-sync-get-dataset-items", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(actorInput),
    });
  } catch (error) {
    throw new Error(error instanceof Error ? `Apify request failed: ${error.message}` : "Apify request failed.");
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Apify actor failed with ${response.status}. ${errorText.slice(0, 600)}`);
  }

  const data = (await response.json().catch(() => [])) as unknown;
  const rawItems = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];

  return {
    items: rawItems.map(normalizeItem),
    rawItems,
  };
}

export function buildScrapedContext(items: RedditScrapeItem[]) {
  const firstPost = items[0];
  const commentTexts = items
    .slice(1)
    .map((item) => item.text)
    .filter(Boolean)
    .slice(0, 12);

  return {
    title: firstPost?.title || "",
    subreddit: firstPost?.subreddit || "",
    author: firstPost?.author || "",
    score: firstPost?.score ?? null,
    commentsCount: firstPost?.commentsCount ?? null,
    createdAt: firstPost?.createdAt || "",
    body: firstPost?.text || "",
    comments: commentTexts,
    text: [firstPost?.text, ...commentTexts].filter(Boolean).join("\n\n").slice(0, 7000),
  };
}
