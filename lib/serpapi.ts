export type SerpMentionResult = {
  title: string;
  url: string;
  snippet: string;
  displayLink?: string;
  sourceQuery: string;
  subreddit: string;
};

type SerpApiOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
  displayed_link?: string;
};

const negativeQueryTerms = "scam OR fraud OR complaint OR bad OR fake OR poor OR worst OR avoid OR issue OR problem";
const reviewQueryTerms = "review OR reviews OR experience OR cost OR alternative OR recommendation";
const genericBrandTokens = new Set([
  "a",
  "an",
  "and",
  "app",
  "brand",
  "clinic",
  "coach",
  "company",
  "com",
  "consultant",
  "doctor",
  "for",
  "group",
  "inc",
  "india",
  "llc",
  "ltd",
  "net",
  "official",
  "org",
  "reddit",
  "review",
  "reviews",
  "service",
  "services",
  "the",
  "usa",
  "user",
  "www",
]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, " ")
    .replace(/www\./g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value: string) {
  return normalizeText(value).replace(/\s+/g, "");
}

function compactUrl(value: string) {
  try {
    const parsed = new URL(value);
    return compactText(`${parsed.hostname} ${parsed.pathname}`);
  } catch {
    return compactText(value);
  }
}

function wordSet(value: string) {
  return new Set(normalizeText(value).split(" ").filter(Boolean));
}

function containsPhrase(haystack: string, phrase: string) {
  return ` ${haystack} `.includes(` ${phrase} `);
}

function distinctiveTokens(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !genericBrandTokens.has(token));
}

function querySafeTerm(term: string) {
  return term
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/g, "")
    .trim();
}

function canonicalRedditUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function buildBrandQueries(brandName: string, keywords: string[]) {
  const uniqueTerms = Array.from(
    new Set([brandName, ...keywords].map((term) => querySafeTerm(term)).filter((term) => term.length >= 3)),
  );
  return uniqueTerms.flatMap((term) => [
    `site:reddit.com "${term}"`,
    `site:reddit.com "${term}" ${reviewQueryTerms}`,
    `site:reddit.com "${term}" ${negativeQueryTerms}`,
  ]);
}

export function extractSubreddit(url: string) {
  const match = url.match(/reddit\.com\/r\/([^/]+)/i);
  return match?.[1] ? `r/${decodeURIComponent(match[1])}` : "";
}

export function isBrandMentioned(result: SerpMentionResult, brandName: string, aliases: string[]) {
  const rawHaystack = `${result.title} ${result.snippet} ${result.url}`;
  const haystack = normalizeText(rawHaystack);
  const urlCompact = compactUrl(result.url);
  const words = wordSet(rawHaystack);
  const normalizedBrand = normalizeText(brandName);
  const compactBrand = compactText(brandName);
  const reversedBrand = normalizeText(brandName).split(" ").reverse().join(" ");

  if (!normalizedBrand) {
    return false;
  }

  if (
    containsPhrase(haystack, normalizedBrand) ||
    containsPhrase(haystack, reversedBrand) ||
    (compactBrand.length >= 6 && !normalizedBrand.includes(" ") && (words.has(compactBrand) || urlCompact.includes(compactBrand)))
  ) {
    return true;
  }

  const brandTokens = distinctiveTokens(brandName);
  if (brandTokens.length >= 2 && brandTokens.every((token) => words.has(token))) {
    return true;
  }

  return aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    const compactAlias = compactText(alias);
    const aliasTokens = distinctiveTokens(alias);

    if (aliasTokens.length >= 2 && normalizedAlias && containsPhrase(haystack, normalizedAlias)) {
      return true;
    }

    if (aliasTokens.length >= 2 && aliasTokens.every((token) => words.has(token))) {
      return true;
    }

    if (aliasTokens.length === 1 && aliasTokens[0].length >= 6) {
      return words.has(aliasTokens[0]) || urlCompact.includes(aliasTokens[0]);
    }

    return false;
  });
}

export function isRelevantOpportunity(result: SerpMentionResult, terms: string[]) {
  const rawHaystack = `${result.title} ${result.snippet} ${result.url}`;
  const haystack = normalizeText(rawHaystack);
  const urlCompact = compactUrl(result.url);
  const words = wordSet(rawHaystack);

  return terms.some((term) => {
    const normalizedTerm = normalizeText(term);
    const compactTerm = compactText(term);
    const termTokens = distinctiveTokens(term);

    if (!normalizedTerm || !termTokens.length) {
      return false;
    }

    if (
      containsPhrase(haystack, normalizedTerm) ||
      (compactTerm.length >= 6 && !normalizedTerm.includes(" ") && (words.has(compactTerm) || urlCompact.includes(compactTerm)))
    ) {
      return true;
    }

    if (termTokens.length >= 2 && termTokens.every((token) => words.has(token))) {
      return true;
    }

    return termTokens.length === 1 && termTokens[0].length >= 8 && (words.has(termTokens[0]) || urlCompact.includes(termTokens[0]));
  });
}

export async function searchRedditWithSerpApi(query: string): Promise<SerpMentionResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey || apiKey.includes("place_your")) {
    throw new Error("SERPAPI_API_KEY is missing.");
  }

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: apiKey,
    num: "5",
    hl: "en",
    gl: "us",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`SerpApi request failed with ${response.status}.`);
  }

  const data = await response.json();
  if (data.error) {
    if (String(data.error).toLowerCase().includes("hasn't returned any results")) {
      return [];
    }
    throw new Error(data.error);
  }

  return (data.organic_results || [])
    .map((item: SerpApiOrganicResult) => ({
      title: item.title || "Untitled Reddit result",
      url: canonicalRedditUrl(item.link || ""),
      snippet: item.snippet || "",
      displayLink: item.displayed_link,
      sourceQuery: query,
      subreddit: extractSubreddit(item.link || ""),
    }))
    .filter((item: SerpMentionResult) => /reddit\.com\/r\//i.test(item.url));
}
