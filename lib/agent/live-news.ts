import type { AssetClass } from "@/lib/market-snapshot";
import type { AgentEnv } from "./env";
import { deepseekWebSearch } from "./models/deepseek";
import { xaiSearch } from "./models/xai";

/**
 * Live market-news search (PRD §3.6): one search per asset class per run.
 * xAI Grok handles the X.com search exclusively; DeepSeek V4 Flash with
 * OpenRouter's web-search server tool is the fallback. The result is a
 * handful of headline lines merged into each draft brief alongside the RAG
 * snippets. Failure posture matches the rest of the platform: any error
 * degrades to an empty list, never to a failed run.
 */

const CLASS_TOPICS: Record<AssetClass, string> = {
  stocks: "the Saudi stock market (Tadawul / TASI) and major global equities",
  real_estate: "the Saudi Arabia real-estate market and Riyadh property prices",
  autos: "the used-car market in Saudi Arabia (Syarah, Haraj) and global auto prices",
  jewelry: "gold spot prices and the precious-metals / jewelry market",
};

export function newsSearchPrompt(assetClass: AssetClass): string {
  return `Search X.com and the web for the latest news from the past 48 hours about ${CLASS_TOPICS[assetClass]}. Reply with up to 5 one-line headlines, each on its own line starting with "- ", including the source and date. No introduction, no commentary.`;
}

/** Cap how much searched text reaches the draft brief, per line and overall. */
const MAX_LINES = 6;
const MAX_LINE_LENGTH = 240;

export function parseNewsLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_LINES)
    .map((line) =>
      line.length > MAX_LINE_LENGTH ? `${line.slice(0, MAX_LINE_LENGTH)}…` : line
    );
}

/** Test seam: both searchers take a prompt and return raw model text. */
export interface NewsSearchers {
  xSearch?: (prompt: string) => Promise<string>;
  webSearch?: (prompt: string) => Promise<string>;
}

function defaultSearchers(env: AgentEnv): NewsSearchers {
  return {
    xSearch: env.xaiApiKey ? (prompt) => xaiSearch(prompt, env) : undefined,
    webSearch: env.deepseekApiKey
      ? (prompt) => deepseekWebSearch(prompt, env)
      : undefined,
  };
}

export async function fetchLiveNews(
  assetClass: AssetClass,
  env: AgentEnv,
  searchers: NewsSearchers = defaultSearchers(env)
): Promise<string[]> {
  if (!searchers.xSearch && !searchers.webSearch) return [];
  const prompt = newsSearchPrompt(assetClass);

  if (searchers.xSearch) {
    try {
      const lines = parseNewsLines(await searchers.xSearch(prompt));
      if (lines.length > 0) return lines;
    } catch (error) {
      console.error(`[agent] xAI news search failed for ${assetClass}:`, error);
    }
  }

  if (searchers.webSearch) {
    try {
      return parseNewsLines(await searchers.webSearch(prompt));
    } catch (error) {
      console.error(
        `[agent] DeepSeek web search failed for ${assetClass}:`,
        error
      );
    }
  }

  return [];
}
