import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEWS_FEEDS,
  feedsFromEnv,
  newsDocuments,
  parseRssItems,
  refreshNewsCorpus,
  type NewsFeed,
} from "./embed-news";
import type { RagDocument, RagStore } from "./vectorize";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Feed</title>
  <item>
    <title><![CDATA[Tadawul gains 1.2% as banks rally]]></title>
    <link>https://example.com/a?id=1&amp;x=2</link>
    <pubDate>Wed, 10 Jun 2026 06:00:00 GMT</pubDate>
    <description><![CDATA[Saudi stocks rose &amp; banks led.<br> More inside.]]></description>
  </item>
  <item>
    <title>Untitled but no link</title>
  </item>
  <item>
    <title>Gold steadies near record</title>
    <link>https://example.com/gold</link>
  </item>
</channel></rss>`;

describe("parseRssItems", () => {
  it("extracts title, link, pubDate, and description through CDATA and entities", () => {
    const items = parseRssItems(SAMPLE_RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Tadawul gains 1.2% as banks rally");
    expect(items[0].link).toBe("https://example.com/a?id=1&x=2");
    expect(items[0].publishedAt).toContain("2026");
    expect(items[0].description).toBe("Saudi stocks rose & banks led. More inside.");
  });

  it("drops items without a title + link and honours the limit", () => {
    expect(parseRssItems(SAMPLE_RSS, 1)).toHaveLength(1);
    const links = parseRssItems(SAMPLE_RSS).map((i) => i.link);
    expect(links).not.toContain(null);
  });
});

describe("newsDocuments", () => {
  const feed: NewsFeed = { assetClass: "stocks", url: "https://x" };

  it("derives stable ids from the article link", () => {
    const items = parseRssItems(SAMPLE_RSS);
    const [a] = newsDocuments(feed, items);
    const [b] = newsDocuments(feed, items);
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^news:[0-9a-f]{16}$/);
    expect(a.corpus).toBe("news");
    expect(a.assetClass).toBe("stocks");
    expect(a.userId).toBeUndefined();
  });
});

describe("feedsFromEnv", () => {
  it("falls back to the defaults when unset or unparseable", () => {
    expect(feedsFromEnv(undefined)).toEqual(DEFAULT_NEWS_FEEDS);
    expect(feedsFromEnv("   ")).toEqual(DEFAULT_NEWS_FEEDS);
    expect(feedsFromEnv("garbage,also-garbage")).toEqual(DEFAULT_NEWS_FEEDS);
  });

  it("parses assetClass=url pairs and drops unknown classes", () => {
    const feeds = feedsFromEnv(
      "stocks=https://a.example/rss, crypto=https://nope, jewelry=https://b.example/gold"
    );
    expect(feeds).toEqual([
      { assetClass: "stocks", url: "https://a.example/rss" },
      { assetClass: "jewelry", url: "https://b.example/gold" },
    ]);
  });
});

describe("refreshNewsCorpus", () => {
  it("upserts parsed feeds and reports failures without throwing", async () => {
    const upserted: RagDocument[] = [];
    const store: RagStore = {
      async upsert(docs) {
        upserted.push(...docs);
        return docs.length;
      },
      async query() {
        return [];
      },
    };
    const fetchImpl = async (url: string) =>
      url.includes("dead")
        ? new Response("nope", { status: 503 })
        : new Response(SAMPLE_RSS, { status: 200 });

    const report = await refreshNewsCorpus(
      store,
      fetchImpl,
      [
        { assetClass: "stocks", url: "https://ok.example/rss" },
        { assetClass: "autos", url: "https://dead.example/rss" },
      ],
      "test@example.com"
    );

    expect(report.upserted).toBe(2);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toContain("autos");
    expect(upserted.every((d) => d.corpus === "news")).toBe(true);
  });
});
