"use client";

import { FormEvent, useState } from "react";

type ScrapeItem = {
  title?: string;
  url?: string;
  subreddit?: string;
  author?: string;
  text?: string;
  score?: string | number;
  commentsCount?: string | number;
  createdAt?: string | number;
};

function cell(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

export function RedditScraperPanel() {
  const [redditUrl, setRedditUrl] = useState("");
  const [items, setItems] = useState<ScrapeItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function runScrape(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setItems([]);

    try {
      const response = await fetch("/api/reddit-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redditUrl }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Reddit scrape failed.");
      }

      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reddit scrape failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-red-700">Apify Reddit Scraper</p>
          <h2 className="mt-1 text-xl font-bold">Scrape a Reddit URL</h2>
          <p className="mt-1 text-sm text-slate-500">Runs `trudax/reddit-scraper` securely through the backend.</p>
        </div>
        <form onSubmit={runScrape} className="flex w-full flex-col gap-2 md:max-w-2xl md:flex-row">
          <input
            value={redditUrl}
            onChange={(event) => setRedditUrl(event.target.value)}
            placeholder="https://www.reddit.com/r/example/comments/..."
            className="field min-w-0 flex-1"
            required
          />
          <button className="primary-button rounded-md px-4 py-2 text-sm font-bold text-white" disabled={loading}>
            {loading ? "Scraping..." : "Run Scrape"}
          </button>
        </form>
      </div>

      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

      {loading ? <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">Running Apify actor. This can take a little time.</p> : null}

      {items.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                {["Title", "URL", "Subreddit", "Author", "Text / Body", "Score", "Comments", "Created"].map((heading) => (
                  <th key={heading} className="border-b border-slate-200 px-3 py-2">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.url || item.title || index}`} className="align-top">
                  <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-900">{cell(item.title)}</td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    {item.url ? (
                      <a href={String(item.url)} target="_blank" rel="noreferrer" className="break-all text-teal-700 hover:text-teal-900">
                        {String(item.url)}
                      </a>
                    ) : "-"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">{cell(item.subreddit)}</td>
                  <td className="border-b border-slate-100 px-3 py-3">{cell(item.author)}</td>
                  <td className="max-w-md border-b border-slate-100 px-3 py-3 leading-6 text-slate-600">{cell(item.text).slice(0, 700)}</td>
                  <td className="border-b border-slate-100 px-3 py-3">{cell(item.score)}</td>
                  <td className="border-b border-slate-100 px-3 py-3">{cell(item.commentsCount)}</td>
                  <td className="border-b border-slate-100 px-3 py-3">{cell(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
