import { NextRequest, NextResponse } from "next/server";
import { isRedditUrl, scrapeRedditUrlWithApify } from "@/lib/apify";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const redditUrl = String(body.redditUrl || "").trim();

  if (!redditUrl) {
    return NextResponse.json({ error: "redditUrl is required." }, { status: 400 });
  }

  if (!isRedditUrl(redditUrl)) {
    return NextResponse.json({ error: "Please enter a valid reddit.com URL." }, { status: 400 });
  }

  try {
    const result = await scrapeRedditUrlWithApify(redditUrl);
    return NextResponse.json({
      ok: true,
      count: result.items.length,
      items: result.items,
      rawItems: result.rawItems,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Apify request failed." },
      { status: error instanceof Error && error.message.includes("APIFY_API_TOKEN") ? 500 : 502 },
    );
  }
}
