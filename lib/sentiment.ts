export type Classification = {
  sentiment: "positive" | "neutral" | "negative";
  confidence: number;
  risk_score: number;
  reason: string;
  themes: string[];
  opportunity_type: "positive-proof" | "risk-watch" | "answer-opportunity" | "monitor";
  recommended_action: "ignore" | "monitor" | "reply" | "escalate";
};

const negativeWords = [
  "scam",
  "fraud",
  "fake",
  "bad",
  "poor",
  "worst",
  "complaint",
  "avoid",
  "issue",
  "problem",
  "not recommended",
  "refund",
  "broken",
  "terrible",
  "lawsuit",
];

const positiveWords = ["great", "good", "excellent", "love", "best", "helpful", "recommended", "happy"];
const comparisonWords = ["vs", "alternative", "compare", "which", "better", "recommend", "review"];
let openAiUnavailable = false;

function clampRisk(score: number) {
  return Math.max(1, Math.min(10, Math.round(score)));
}

export function ruleBasedClassify(title: string, snippet: string): Classification {
  const text = `${title} ${snippet}`.toLowerCase();
  const negativeHits = negativeWords.filter((word) => text.includes(word));
  const positiveHits = positiveWords.filter((word) => text.includes(word));

  if (negativeHits.length > 0) {
    const risk = clampRisk(5 + negativeHits.length + (text.includes("scam") || text.includes("fraud") ? 2 : 0));
    return {
      sentiment: "negative",
      confidence: 80,
      risk_score: risk,
      reason: `Matched negative terms: ${negativeHits.slice(0, 4).join(", ")}.`,
      themes: negativeHits.slice(0, 4),
      opportunity_type: "risk-watch",
      recommended_action: risk >= 8 ? "escalate" : "reply",
    };
  }

  if (positiveHits.length > 0) {
    return {
      sentiment: "positive",
      confidence: 78,
      risk_score: 1,
      reason: `Matched positive terms: ${positiveHits.slice(0, 3).join(", ")}.`,
      themes: positiveHits.slice(0, 4),
      opportunity_type: "positive-proof",
      recommended_action: "ignore",
    };
  }

  const comparisonHits = comparisonWords.filter((word) => text.includes(word));
  if (comparisonHits.length > 0) {
    return {
      sentiment: "neutral",
      confidence: 68,
      risk_score: 3,
      reason: `Looks like a research or comparison thread: ${comparisonHits.slice(0, 3).join(", ")}.`,
      themes: ["comparison", "research"],
      opportunity_type: "answer-opportunity",
      recommended_action: "monitor",
    };
  }

  return {
    sentiment: "neutral",
    confidence: 62,
    risk_score: 2,
    reason: "No strong positive or negative language detected.",
    themes: ["general discussion"],
    opportunity_type: "monitor",
    recommended_action: "monitor",
  };
}

function normalizeClassification(value: Partial<Classification>, fallback: Classification): Classification {
  const sentiment = ["positive", "neutral", "negative"].includes(value.sentiment ?? "")
    ? (value.sentiment as Classification["sentiment"])
    : fallback.sentiment;
  const action = ["ignore", "monitor", "reply", "escalate"].includes(value.recommended_action ?? "")
    ? (value.recommended_action as Classification["recommended_action"])
    : fallback.recommended_action;

  return {
    sentiment,
    confidence: Math.max(1, Math.min(100, Math.round(Number(value.confidence ?? fallback.confidence)))),
    risk_score: clampRisk(Number(value.risk_score ?? fallback.risk_score)),
    reason: String(value.reason || fallback.reason).slice(0, 280),
    themes: Array.isArray(value.themes)
      ? value.themes.map((theme) => String(theme).trim()).filter(Boolean).slice(0, 6)
      : fallback.themes,
    opportunity_type: ["positive-proof", "risk-watch", "answer-opportunity", "monitor"].includes(
      String(value.opportunity_type || ""),
    )
      ? (value.opportunity_type as Classification["opportunity_type"])
      : fallback.opportunity_type,
    recommended_action: action,
  };
}

const sentimentSchema = {
  type: "object",
  properties: {
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    confidence: { type: "number", minimum: 1, maximum: 100 },
    risk_score: { type: "number", minimum: 1, maximum: 10 },
    reason: { type: "string" },
    themes: {
      type: "array",
      items: { type: "string" },
      maxItems: 6,
    },
    opportunity_type: { type: "string", enum: ["positive-proof", "risk-watch", "answer-opportunity", "monitor"] },
    recommended_action: { type: "string", enum: ["ignore", "monitor", "reply", "escalate"] },
  },
  required: ["sentiment", "confidence", "risk_score", "reason", "themes", "opportunity_type", "recommended_action"],
  additionalProperties: false,
};

function outputText(data: unknown) {
  const response = data as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (response.output_text) {
    return response.output_text;
  }

  return response.output
    ?.flatMap((item) => item.content || [])
    .find((content) => content.type === "output_text" || content.text)?.text;
}

export async function classifyMention(title: string, snippet: string, brandName = "the brand"): Promise<Classification> {
  const fallback = ruleBasedClassify(title, snippet);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.includes("place_your") || openAiUnavailable) {
    return fallback;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You classify Reddit sentiment for a brand reputation dashboard. Use only the Reddit title, body, comments, and context provided. Classify sentiment toward the brand, not general mood. If the context is a question or has no clear opinion about the brand, choose neutral. Keep reason and themes short.",
          },
          {
            role: "user",
            content: `Brand: ${brandName}\nReddit title: ${title}\nReddit context: ${snippet}`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "reddit_sentiment_classification",
            schema: sentimentSchema,
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      if ([401, 403, 429].includes(response.status)) {
        openAiUnavailable = true;
      }
      return fallback;
    }

    const data = await response.json();
    const content = outputText(data);
    if (!content) {
      return fallback;
    }

    return normalizeClassification(JSON.parse(content), fallback);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
