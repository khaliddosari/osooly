import { afterEach, describe, expect, it, vi } from "vitest";
import { logError, logEvent } from "./log";

afterEach(() => vi.restoreAllMocks());

describe("logEvent", () => {
  it("emits one line of JSON with the event, a timestamp, and fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logEvent("agent.run.completed", { userId: "u1", written: 3 });

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      event: "agent.run.completed",
      userId: "u1",
      written: 3,
    });
    expect(typeof parsed.ts).toBe("string");
  });
});

describe("logError", () => {
  it("normalises an Error to its message on stderr", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("agent.run.failed", new Error("boom"), { userId: "u1" });

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      event: "agent.run.failed",
      error: "boom",
      userId: "u1",
    });
  });

  it("stringifies a non-Error throwable", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("x", "plain string");
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.error).toBe("plain string");
  });
});
