NEGATIVE_WORDS = {
    "avoid",
    "bad",
    "broken",
    "complaint",
    "disappointed",
    "fake",
    "fraud",
    "issue",
    "lawsuit",
    "poor",
    "problem",
    "refund",
    "ripoff",
    "scam",
    "terrible",
    "unhappy",
    "worst",
}

POSITIVE_WORDS = {
    "amazing",
    "best",
    "excellent",
    "good",
    "great",
    "happy",
    "helpful",
    "love",
    "recommended",
}


def score_sentiment(text: str) -> tuple[str, int]:
    normalized = text.lower()
    negative_hits = [word for word in NEGATIVE_WORDS if word in normalized]
    positive_hits = [word for word in POSITIVE_WORDS if word in normalized]

    if negative_hits:
        severity = min(100, 35 + (len(negative_hits) * 15))
        return "negative", severity
    if positive_hits:
        return "positive", 0
    return "neutral", 0
