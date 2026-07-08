import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeItem(item: Record<string, unknown>) {
  return {
    title: item.title || item.postTitle || item.name || "",
    url: item.url || item.postUrl || item.permalink || item.link || "",
    subreddit: item.subreddit || item.communityName || item.subredditName || "",
    author: item.author || item.username || item.userName || "",
    text: item.text || item.body || item.selftext || item.description || "",
    score: item.score ?? item.upvotes ?? item.ups ?? "",
    commentsCount: item.commentsCount ?? item.numComments ?? item.commentCount ?? item.comments ?? "",
    createdAt: item.createdAt || item.created_at || item.createdUtc || item.created || item.date || "",
  };
}

function isRedditUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "reddit.com" || parsed.hostname.endsWith(".reddit.com");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "APIFY_API_TOKEN is missing. Add it to environment variables." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const redditUrl = String(body.redditUrl || "").trim();

  if (!redditUrl) {
    return NextResponse.json({ error: "redditUrl is required." }, { status: 400 });
  }

  if (!isRedditUrl(redditUrl)) {
    return NextResponse.json({ error: "Please enter a valid reddit.com URL." }, { status: 400 });
  }

  const actorInput = {
    startUrls: [{ url: redditUrl }],
    skipComments: false,
    skipUserPosts: true,
    skipCommunity: true,
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
    return NextResponse.json(
      { error: "Apify request failed.", details: error instanceof Error ? error.message : "Unknown network error." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return NextResponse.json(
      { error: `Apify actor failed with ${response.status}.`, details: errorText.slice(0, 600) },
      { status: response.status },
    );
  }

  const items = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;

  return NextResponse.json({
    ok: true,
    count: Array.isArray(items) ? items.length : 0,
    items: Array.isArray(items) ? items.map(normalizeItem) : [],
    rawItems: Array.isArray(items) ? items : [],
  });
}
