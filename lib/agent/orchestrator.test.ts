import { describe, expect, it } from "vitest";
import type {
  RagDocument,
  RagQuery,
  RagStore,
} from "@/lib/rag/vectorize";
import { fakeDb, hoursAgoUtc } from "@/src/cards/testing";
import type { BoundModel } from "./models/router";
import { runAgentForUser, type AgentModels } from "./orchestrator";

/**
 * The S6 acceptance test (Docs/IMPLEMENTATION-STAGES.md): running the
 * orchestrator on a seeded portfolio produces a Recommendation row per
 * asset with reasoning, confidence, and model set; offline via fake chat
 * models, so it proves the graph + tools + persistence, not the providers.
 */

const USER = "user-1";

function seededDb() {
  return fakeDb({
    snapshots: [
      { assetClass: "stocks", symbol: "TASI", price: 12_000, payload: { percentChange: 0.4 } },
      { assetClass: "stocks", symbol: "2222", price: 27.5, payload: { percentChange: -1.2 } },
      { assetClass: "jewelry", symbol: "XAU", price: 451.2, payload: { usdPerOunce: 3300, usdToSar: 3.75 } },
      { assetClass: "autos", symbol: "toyota-land-cruiser", price: 320_000 },
      { assetClass: "autos", symbol: "toyota-land-cruiser:haraj", price: 290_000 },
      { assetClass: "real_estate", symbol: "riyadh", price: 103.4 },
      { assetClass: "real_estate", symbol: "riyadh:aqar", price: 5_400, fetchedAt: hoursAgoUtc(60) }, // stale
    ],
    assets: [
      { id: "s1", user_id: USER, asset_class: "stocks", name: "Aramco", symbol: "2222", quantity: 100, purchase_price: 30 },
      { id: "j1", user_id: USER, asset_class: "jewelry", name: "Gold bracelet", quantity: 50, purchase_price: 9_000, details: '{"karat":21}' },
      { id: "a1", user_id: USER, asset_class: "autos", name: "Family car", purchase_price: 350_000, details: '{"make":"Toyota","model":"Land Cruiser","year":2020}' },
      { id: "r1", user_id: USER, asset_class: "real_estate", name: "Riyadh villa", purchase_price: 1_500_000, details: '{"city":"Riyadh"}' },
    ],
    transactions: [
      { user_id: USER, asset_id: "s1", kind: "buy", quantity: 100, price: 30, occurred_at: "2025-04-01 09:00:00" },
    ],
  });
}

/** Triage says sell for the car (escalates), confident hold otherwise. */
function scriptedModels(): AgentModels & {
  reasoningCalls: string[];
} {
  const reasoningCalls: string[] = [];
  const triage: BoundModel = {
    choice: { provider: "groq", model: "groq-test" },
    chat: {
      async invoke(messages) {
        const prompt = messages.map(([, text]) => text).join("\n");
        return prompt.includes("Family car")
          ? { content: '{"action":"sell","confidence":0.8,"reasoning":"Market estimate sits well under the purchase price."}' }
          : { content: '{"action":"hold","confidence":0.9,"reasoning":"Position tracks the market with no drift."}' };
      },
    },
  };
  const reasoning: BoundModel = {
    choice: { provider: "deepseek", model: "deepseek-test" },
    chat: {
      async invoke(messages) {
        reasoningCalls.push(messages.map(([, text]) => text).join("\n"));
        return { content: '{"action":"sell","confidence":0.75,"reasoning":"The 320k dealer and 290k private medians put the car 13% under its 350k cost; depreciation is outpacing the segment."}' };
      },
    },
  };
  return { triage, reasoning, reasoningCalls };
}

class RecordingRagStore implements RagStore {
  upserted: RagDocument[] = [];
  queries: RagQuery[] = [];
  async upsert(docs: RagDocument[]): Promise<number> {
    this.upserted.push(...docs);
    return docs.length;
  }
  async query(_text: string, query: RagQuery): Promise<string[]> {
    this.queries.push(query);
    return query.corpus === "news" ? ["Headline: market steady."] : [];
  }
}

describe("runAgentForUser", () => {
  it("writes one recommendation per asset across all four classes", async () => {
    const db = seededDb();
    const models = scriptedModels();

    const result = await runAgentForUser({ db, userId: USER, models });

    expect(result.written).toBe(4);
    expect(result.classes.sort()).toEqual([
      "autos",
      "jewelry",
      "real_estate",
      "stocks",
    ]);
    expect(db.recommendations).toHaveLength(4);

    const byAsset = new Map(db.recommendations.map((r) => [r.asset_id, r]));
    expect(byAsset.get("s1")?.card_id).toBe("stock-market");
    expect(byAsset.get("j1")?.card_id).toBe("jewelry-market");
    expect(byAsset.get("a1")?.card_id).toBe("automobile-market");
    expect(byAsset.get("r1")?.card_id).toBe("real-estate-market");

    for (const row of db.recommendations) {
      expect(row.user_id).toBe(USER);
      expect(row.reasoning.length).toBeGreaterThan(10);
      expect(row.confidence).toBeGreaterThanOrEqual(0);
      expect(row.confidence).toBeLessThanOrEqual(1);
      expect(row.model).toMatch(/^(groq|deepseek)\//);
    }
  });

  it("stamps the cheap model on calm holdings and the reasoning model on escalations", async () => {
    const db = seededDb();
    const models = scriptedModels();

    await runAgentForUser({ db, userId: USER, models });

    const byAsset = new Map(db.recommendations.map((r) => [r.asset_id, r]));
    // The car triaged "sell", which always escalates to DeepSeek.
    expect(byAsset.get("a1")?.model).toBe("deepseek/deepseek-test");
    expect(byAsset.get("a1")?.action).toBe("sell");
    expect(models.reasoningCalls.length).toBeGreaterThanOrEqual(1);
    // The stock triaged a confident hold and stayed on Groq.
    expect(byAsset.get("s1")?.model).toBe("groq/groq-test");
  });

  it("caps confidence for assets whose evidence includes stale readings", async () => {
    const db = seededDb();
    // The villa's Aqar comparable is 60h old (stale); triage claims 0.9.
    await runAgentForUser({ db, userId: USER, models: scriptedModels() });

    const villa = db.recommendations.find((r) => r.asset_id === "r1");
    expect(villa?.confidence).toBeLessThanOrEqual(0.5);
  });

  it("syncs the portfolio corpus and queries both corpora through the RAG store", async () => {
    const db = seededDb();
    const rag = new RecordingRagStore();

    await runAgentForUser({ db, userId: USER, models: scriptedModels(), rag });

    expect(rag.upserted.some((d) => d.corpus === "portfolio" && d.userId === USER)).toBe(true);
    expect(rag.queries.some((q) => q.corpus === "news")).toBe(true);
    expect(rag.queries.some((q) => q.corpus === "portfolio" && q.userId === USER)).toBe(true);
  });

  it("writes nothing for an empty ledger and still completes", async () => {
    const db = fakeDb({});
    const result = await runAgentForUser({
      db,
      userId: USER,
      models: scriptedModels(),
    });
    expect(result).toEqual({ written: 0, classes: [] });
    expect(db.recommendations).toHaveLength(0);
  });
});
