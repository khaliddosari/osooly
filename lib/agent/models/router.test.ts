import { describe, expect, it } from "vitest";
import { DEFAULT_DEEPSEEK_MODEL } from "./deepseek";
import { DEFAULT_XAI_MODEL } from "./xai";
import {
  ESCALATE_BELOW,
  modelStamp,
  pickModel,
  pickNewsSearcher,
  shouldEscalate,
} from "./router";

describe("pickModel (PRD 3.6 policy)", () => {
  it("routes every task to DeepSeek V4 Flash", () => {
    for (const task of ["classification", "summarization", "reasoning"] as const) {
      expect(pickModel(task)).toEqual({
        provider: "deepseek",
        model: DEFAULT_DEEPSEEK_MODEL,
      });
    }
  });

  it("honours the env model override without changing the provider", () => {
    expect(pickModel("reasoning", { deepseekModel: "deepseek-x" })).toEqual({
      provider: "deepseek",
      model: "deepseek-x",
    });
    expect(pickModel("classification", { deepseekModel: "deepseek-x" }).model).toBe(
      "deepseek-x"
    );
  });
});

describe("pickNewsSearcher (PRD 3.6 live news)", () => {
  it("prefers xAI Grok (X.com search) when its key is configured", () => {
    expect(
      pickNewsSearcher({ xaiApiKey: "k", deepseekApiKey: "k" })
    ).toEqual({ provider: "xai", model: DEFAULT_XAI_MODEL });
  });

  it("falls back to DeepSeek web search when only the DeepSeek key exists", () => {
    expect(pickNewsSearcher({ deepseekApiKey: "k" })).toEqual({
      provider: "deepseek",
      model: DEFAULT_DEEPSEEK_MODEL,
    });
  });

  it("returns null when no key is configured", () => {
    expect(pickNewsSearcher()).toBeNull();
  });

  it("honours env model overrides", () => {
    expect(pickNewsSearcher({ xaiApiKey: "k", xaiModel: "grok-z" })?.model).toBe(
      "grok-z"
    );
    expect(
      pickNewsSearcher({ deepseekApiKey: "k", deepseekModel: "deepseek-x" })?.model
    ).toBe("deepseek-x");
  });
});

describe("shouldEscalate (cheap-first policy)", () => {
  it("keeps confident hold/watch triages on the short call", () => {
    expect(shouldEscalate({ action: "hold", confidence: 0.9 })).toBe(false);
    expect(
      shouldEscalate({ action: "watch", confidence: ESCALATE_BELOW })
    ).toBe(false);
  });

  it("escalates low-confidence triages", () => {
    expect(shouldEscalate({ action: "hold", confidence: 0.3 })).toBe(true);
    expect(shouldEscalate({ action: "watch", confidence: 0.59 })).toBe(true);
  });

  it("always escalates buy/sell, whatever the stated confidence", () => {
    expect(shouldEscalate({ action: "buy", confidence: 0.99 })).toBe(true);
    expect(shouldEscalate({ action: "sell", confidence: 1 })).toBe(true);
  });
});

describe("modelStamp", () => {
  it("writes the provider-qualified id the Recommendation row stores", () => {
    expect(modelStamp({ provider: "xai", model: "grok-4.3" })).toBe(
      "xai/grok-4.3"
    );
  });

  it("does not double the prefix on provider-qualified slugs", () => {
    expect(
      modelStamp({ provider: "deepseek", model: "deepseek/deepseek-v4-flash" })
    ).toBe("deepseek/deepseek-v4-flash");
  });
});
