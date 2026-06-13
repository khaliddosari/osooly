import { describe, expect, it } from "vitest";
import { fetchLiveNews, newsSearchPrompt, parseNewsLines } from "./live-news";
import { chatCompletionText } from "./models/deepseek";
import { responsesOutputText } from "./models/xai";

describe("newsSearchPrompt", () => {
  it("targets X.com plus the web and names the asset-class market", () => {
    const prompt = newsSearchPrompt("stocks");
    expect(prompt).toContain("X.com");
    expect(prompt).toContain("Tadawul");
    expect(newsSearchPrompt("jewelry")).toContain("gold");
    expect(newsSearchPrompt("autos")).toContain("Haraj");
    expect(newsSearchPrompt("real_estate")).toContain("Riyadh");
  });
});

describe("parseNewsLines", () => {
  it("strips bullets, drops blanks, and caps the count", () => {
    const text = "- TASI closes up 1.2% (Argaam, Jun 12)\n\n* Gold steady\n• Third\nFourth\n- Fifth\n- Sixth\n- Seventh";
    const lines = parseNewsLines(text);
    expect(lines[0]).toBe("TASI closes up 1.2% (Argaam, Jun 12)");
    expect(lines[1]).toBe("Gold steady");
    expect(lines).toHaveLength(6);
  });

  it("truncates runaway lines", () => {
    const [line] = parseNewsLines(`- ${"x".repeat(500)}`);
    expect(line.length).toBeLessThanOrEqual(241);
  });
});

describe("fetchLiveNews (xAI X search first, DeepSeek web search fallback)", () => {
  it("returns xAI lines when the primary searcher answers", async () => {
    const lines = await fetchLiveNews("stocks", {}, {
      xSearch: async () => "- headline one\n- headline two",
      webSearch: async () => {
        throw new Error("should not be called");
      },
    });
    expect(lines).toEqual(["headline one", "headline two"]);
  });

  it("falls back to web search when xAI fails", async () => {
    const lines = await fetchLiveNews("stocks", {}, {
      xSearch: async () => {
        throw new Error("xai down");
      },
      webSearch: async () => "- web headline",
    });
    expect(lines).toEqual(["web headline"]);
  });

  it("falls back to web search when xAI answers with nothing usable", async () => {
    const lines = await fetchLiveNews("stocks", {}, {
      xSearch: async () => "   ",
      webSearch: async () => "- web headline",
    });
    expect(lines).toEqual(["web headline"]);
  });

  it("degrades to an empty list when both searchers fail", async () => {
    const lines = await fetchLiveNews("stocks", {}, {
      xSearch: async () => {
        throw new Error("down");
      },
      webSearch: async () => {
        throw new Error("down too");
      },
    });
    expect(lines).toEqual([]);
  });

  it("returns an empty list when no searcher is configured", async () => {
    expect(await fetchLiveNews("stocks", {})).toEqual([]);
  });
});

describe("responsesOutputText", () => {
  it("prefers the convenience output_text field", () => {
    expect(responsesOutputText({ output_text: "hello" })).toBe("hello");
  });

  it("reads the raw output array of message items", () => {
    const payload = {
      output: [
        { type: "x_search_call", id: "call_1" },
        {
          type: "message",
          content: [
            { type: "output_text", text: "- line one\n" },
            { type: "output_text", text: "- line two" },
          ],
        },
      ],
    };
    expect(responsesOutputText(payload)).toBe("- line one\n- line two");
  });

  it("returns empty for malformed payloads instead of throwing", () => {
    expect(responsesOutputText(null)).toBe("");
    expect(responsesOutputText({ output: "nope" })).toBe("");
  });
});

describe("chatCompletionText", () => {
  it("reads the first choice's message content", () => {
    expect(
      chatCompletionText({
        choices: [{ message: { role: "assistant", content: "- headline" } }],
      })
    ).toBe("- headline");
  });

  it("returns empty for malformed payloads instead of throwing", () => {
    expect(chatCompletionText(null)).toBe("");
    expect(chatCompletionText({ choices: [] })).toBe("");
    expect(chatCompletionText({ choices: [{ message: {} }] })).toBe("");
  });
});
