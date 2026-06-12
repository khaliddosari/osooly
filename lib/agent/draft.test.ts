import { describe, expect, it } from "vitest";
import {
  capForStaleness,
  draftRecommendation,
  parseDraft,
  STALE_CONFIDENCE_CAP,
  type AssetBrief,
} from "./draft";
import type { BoundModel } from "./models/router";

const BRIEF: AssetBrief = {
  assetClass: "stocks",
  assetName: "Aramco",
  evidence: '{"holding":{"quantity":100}}',
  ragContext: [],
  freshness: ["fresh"],
};

function fakeModel(
  provider: "groq" | "deepseek",
  replies: string[]
): BoundModel & { calls: number } {
  const bound = {
    choice: { provider, model: `${provider}-test` },
    calls: 0,
    chat: {
      async invoke() {
        const reply = replies[Math.min(bound.calls, replies.length - 1)];
        bound.calls += 1;
        return { content: reply };
      },
    },
  };
  return bound;
}

describe("parseDraft", () => {
  it("reads a plain JSON reply", () => {
    expect(
      parseDraft('{"action":"hold","confidence":0.8,"reasoning":"Flat."}')
    ).toEqual({ action: "hold", confidence: 0.8, reasoning: "Flat." });
  });

  it("tolerates code fences and surrounding prose", () => {
    const draft = parseDraft(
      'Sure!\n```json\n{"action":"watch","confidence":0.4,"reasoning":"Thin data."}\n```'
    );
    expect(draft.action).toBe("watch");
  });

  it("clamps confidence into [0, 1]", () => {
    expect(
      parseDraft('{"action":"buy","confidence":7,"reasoning":"x"}').confidence
    ).toBe(1);
    expect(
      parseDraft('{"action":"buy","confidence":-2,"reasoning":"x"}').confidence
    ).toBe(0);
  });

  it("rejects unknown actions and empty reasoning", () => {
    expect(() =>
      parseDraft('{"action":"yolo","confidence":1,"reasoning":"x"}')
    ).toThrow(/invalid action/);
    expect(() =>
      parseDraft('{"action":"buy","confidence":1,"reasoning":""}')
    ).toThrow(/empty reasoning/);
    expect(() => parseDraft("no json here")).toThrow(/no JSON/);
  });
});

describe("capForStaleness (PRD 3.5a rule 2)", () => {
  it("leaves all-fresh evidence alone", () => {
    expect(capForStaleness(0.9, ["fresh", "fresh"])).toBe(0.9);
  });

  it("caps confidence when any reading is stale or unavailable", () => {
    expect(capForStaleness(0.9, ["fresh", "stale"])).toBe(STALE_CONFIDENCE_CAP);
    expect(capForStaleness(0.9, ["unavailable"])).toBe(STALE_CONFIDENCE_CAP);
    expect(capForStaleness(0.3, ["stale"])).toBe(0.3);
  });
});

describe("draftRecommendation (cheap-first, escalate on low confidence)", () => {
  it("lets a confident hold triage stand without escalating", async () => {
    const triage = fakeModel("groq", [
      '{"action":"hold","confidence":0.85,"reasoning":"Tracking the index."}',
    ]);
    const reasoning = fakeModel("deepseek", ["unused"]);

    const outcome = await draftRecommendation(BRIEF, { triage, reasoning });
    expect(outcome.escalated).toBe(false);
    expect(outcome.action).toBe("hold");
    expect(outcome.modelChoice.provider).toBe("groq");
    expect(reasoning.calls).toBe(0);
  });

  it("escalates buy/sell triages to the reasoning model", async () => {
    const triage = fakeModel("groq", [
      '{"action":"sell","confidence":0.9,"reasoning":"Down 20%."}',
    ]);
    const reasoning = fakeModel("deepseek", [
      '{"action":"sell","confidence":0.7,"reasoning":"Cost basis is underwater and the trend is negative."}',
    ]);

    const outcome = await draftRecommendation(BRIEF, { triage, reasoning });
    expect(outcome.escalated).toBe(true);
    expect(outcome.modelChoice.provider).toBe("deepseek");
    expect(reasoning.calls).toBe(1);
  });

  it("escalates when the cheap reply is unparseable", async () => {
    const triage = fakeModel("groq", ["sorry, as a language model..."]);
    const reasoning = fakeModel("deepseek", [
      '{"action":"watch","confidence":0.5,"reasoning":"Mixed signals."}',
    ]);

    const outcome = await draftRecommendation(BRIEF, { triage, reasoning });
    expect(outcome.escalated).toBe(true);
    expect(outcome.action).toBe("watch");
  });

  it("degrades to a labelled low-confidence watch when both models fail", async () => {
    const triage = fakeModel("groq", ["garbage"]);
    const reasoning = fakeModel("deepseek", ["also garbage"]);

    const outcome = await draftRecommendation(BRIEF, { triage, reasoning });
    expect(outcome.action).toBe("watch");
    expect(outcome.confidence).toBeLessThanOrEqual(0.2);
    expect(outcome.reasoning).toMatch(/did not return a usable draft/);
  });

  it("applies the staleness cap to whichever model answered", async () => {
    const triage = fakeModel("groq", [
      '{"action":"hold","confidence":0.95,"reasoning":"Looks fine."}',
    ]);
    const reasoning = fakeModel("deepseek", ["unused"]);

    const outcome = await draftRecommendation(
      { ...BRIEF, freshness: ["stale"] },
      { triage, reasoning }
    );
    expect(outcome.confidence).toBe(STALE_CONFIDENCE_CAP);
  });
});
