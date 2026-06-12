import { describe, expect, it } from "vitest";
import { DEFAULT_DEEPSEEK_MODEL } from "./deepseek";
import { DEFAULT_GROQ_MODEL } from "./groq";
import {
  ESCALATE_BELOW,
  modelStamp,
  pickModel,
  shouldEscalate,
} from "./router";

describe("pickModel (PRD 3.6 policy)", () => {
  it("routes classification and summarization to Groq", () => {
    expect(pickModel("classification")).toEqual({
      provider: "groq",
      model: DEFAULT_GROQ_MODEL,
    });
    expect(pickModel("summarization").provider).toBe("groq");
  });

  it("routes reasoning-heavy drafts to DeepSeek", () => {
    expect(pickModel("reasoning")).toEqual({
      provider: "deepseek",
      model: DEFAULT_DEEPSEEK_MODEL,
    });
  });

  it("honours env model overrides without changing the provider", () => {
    expect(pickModel("reasoning", { deepseekModel: "deepseek-x" })).toEqual({
      provider: "deepseek",
      model: "deepseek-x",
    });
    expect(pickModel("classification", { groqModel: "llama-y" }).model).toBe(
      "llama-y"
    );
  });
});

describe("shouldEscalate (cheap-first policy)", () => {
  it("keeps confident hold/watch triages on the cheap model", () => {
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
    expect(modelStamp({ provider: "groq", model: "llama-3.3-70b-versatile" })).toBe(
      "groq/llama-3.3-70b-versatile"
    );
  });
});
