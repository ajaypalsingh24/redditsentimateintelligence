from dataclasses import dataclass
from urllib.parse import urlparse

import requests


@dataclass
class SearchResult:
    title: str
    snippet: str
    url: str
    subreddit: str = ""


def extract_subreddit(url: str) -> str:
    path = urlparse(url).path.strip("/").split("/")
    if len(path) >= 2 and path[0].lower() == "r":
        return path[1]
    return ""


def search_reddit_mentions(api_key: str, query: str, country: str = "us") -> list[SearchResult]:
    if not api_key or api_key == "place_your_serper_api_key_here":
        raise ValueError("SERPER_API_KEY is missing. Add it to your .env file or Render environment variables.")

    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "q": f'site:reddit.com "{query}"',
        "gl": country,
        "hl": "en",
        "num": 20,
        "tbs": "qdr:d",
    }
    response = requests.post("https://google.serper.dev/search", headers=headers, json=payload, timeout=45)
    response.raise_for_status()
    data = response.json()

    results = []
    for item in data.get("organic", []):
        link = item.get("link", "")
        if "reddit.com" not in link:
            continue
        results.append(
            SearchResult(
                title=item.get("title", "Untitled Reddit result"),
                snippet=item.get("snippet", ""),
                url=link,
                subreddit=extract_subreddit(link),
            )
        )
    return results
