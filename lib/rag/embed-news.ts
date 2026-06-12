import type { AssetClass } from "../market-snapshot";
import { stableId, type RagDocument, type RagStore } from "./vectorize";

/**
 * Market-news corpus (PRD §3.6 collection b): keyless Google News RSS
 * queries per asset class (PRD §3.10), refreshed daily by
 * workers/cron/news-refresh.ts. Document ids hash the article link, so a
 * story seen on consecutive days re-upserts instead of duplicating.
 */

export interface NewsFeed {
  assetClass: AssetClass;
  url: string;
}

const GNEWS = "https://news.google.com/rss/search?hl=en&gl=SA&ceid=SA:en&q=";

export const DEFAULT_NEWS_FEEDS: NewsFeed[] = [
  { assetClass: "stocks", url: `${GNEWS}${encodeURIComponent('Tadawul OR "Saudi stock market"')}` },
  { assetClass: "real_estate", url: `${GNEWS}${encodeURIComponent('"Saudi real estate" OR "Saudi property market"')}` },
  { assetClass: "autos", url: `${GNEWS}${encodeURIComponent('"Saudi used car" OR "Saudi car market"')}` },
  { assetClass: "jewelry", url: `${GNEWS}${encodeURIComponent('"gold price" outlook')}` },
];

/**
 * `NEWS_FEEDS` override: comma-separated `assetClass=url` pairs, e.g.
 * `stocks=https://example.com/rss,jewelry=https://example.com/gold.rss`.
 * Unknown classes and malformed pairs are dropped, not fatal.
 */
export function feedsFromEnv(value: string | undefined): NewsFeed[] {
  if (!value?.trim()) return DEFAULT_NEWS_FEEDS;
  const classes: readonly string[] = ["stocks", "real_estate", "autos", "jewelry"];
  const feeds = value
    .split(",")
    .map((pair) => pair.trim())
    .flatMap((pair) => {
      const eq = pair.indexOf("=");
      if (eq === -1) return [];
      const assetClass = pair.slice(0, eq).trim();
      const url = pair.slice(eq + 1).trim();
      if (!classes.includes(assetClass) || !url.startsWith("http")) return [];
      return [{ assetClass: assetClass as AssetClass, url }];
    });
  return feeds.length > 0 ? feeds : DEFAULT_NEWS_FEEDS;
}

export interface NewsItem {
  title: string;
  link: string;
  publishedAt: string | null;
  description: string | null;
}

/**
 * Tolerant RSS item reader. Workers have no XML DOM, and RSS in the wild is
 * too messy for a strict parser to survive anyway: this extracts the four
 * fields the corpus needs and drops anything that lacks a title + link.
 */
export function parseRssItems(xml: string, limit = 8): NewsItem[] {
  const items: NewsItem[] = [];
  for (const match of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
    const block = match[0];
    const title = textOf(block, "title");
    const link = textOf(block, "link");
    if (!title || !link) continue;
    items.push({
      title,
      link,
      publishedAt: textOf(block, "pubDate"),
      description: textOf(block, "description"),
    });
    if (items.length >= limit) break;
  }
  return items;
}

function textOf(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(block);
  if (!match) return null;
  const raw = match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return raw || null;
}

export function newsDocuments(feed: NewsFeed, items: NewsItem[]): RagDocument[] {
  return items.map((item) => ({
    id: stableId("news", item.link),
    text: item.description ? `${item.title}. ${item.description}` : item.title,
    corpus: "news" as const,
    assetClass: feed.assetClass,
    title: item.title,
    url: item.link,
    ...(item.publishedAt && { publishedAt: item.publishedAt }),
  }));
}

export interface NewsRefreshReport {
  feeds: number;
  upserted: number;
  failures: string[];
}

/**
 * One pass over every feed; a dead feed degrades that class's corpus, not
 * the run (same posture as the market crons, PRD §3.5a rule 2).
 */
export async function refreshNewsCorpus(
  store: RagStore,
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
  feeds: NewsFeed[],
  contact: string
): Promise<NewsRefreshReport> {
  const report: NewsRefreshReport = {
    feeds: feeds.length,
    upserted: 0,
    failures: [],
  };
  for (const feed of feeds) {
    try {
      const response = await fetchImpl(feed.url, {
        headers: { "User-Agent": `Osooly/1.0 (+${contact})` },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const items = parseRssItems(await response.text());
      report.upserted += await store.upsert(newsDocuments(feed, items));
    } catch (error) {
      report.failures.push(
        `${feed.assetClass}: ${error instanceof Error ? error.message : error}`
      );
    }
  }
  return report;
}
