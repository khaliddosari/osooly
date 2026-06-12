import { describe, expect, it } from "vitest";
import {
  PoliteFetcher,
  RobotsDisallowedError,
  parseRobots,
} from "./polite-fetch";

/**
 * Harness with a virtual clock: `sleep` advances time instantly, so the
 * test asserts *scheduled* spacing without waiting real seconds.
 */
function makeHarness({ robots = "" }: { robots?: string } = {}) {
  let clock = 0;
  const requests: { url: string; at: number; userAgent: string | undefined }[] = [];

  const fetchImpl = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    requests.push({ url, at: clock, userAgent: headers.get("User-Agent") ?? undefined });
    if (url.endsWith("/robots.txt")) {
      return new Response(robots, { status: robots ? 200 : 404 });
    }
    return new Response("ok", { status: 200 });
  };

  const fetcher = new PoliteFetcher({
    contact: "team@osooly.example",
    fetchImpl,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
  });

  return { fetcher, requests };
}

describe("PoliteFetcher", () => {
  it("spaces consecutive requests to one domain by ≥1s (smoke test)", async () => {
    const { fetcher, requests } = makeHarness();
    await fetcher.fetch("https://haraj.example/search?q=land-cruiser");
    await fetcher.fetch("https://haraj.example/search?q=patrol");
    await fetcher.fetch("https://haraj.example/search?q=camry");

    // First hit is robots.txt, then the three real requests — every
    // consecutive pair on the domain must be ≥1000ms apart.
    expect(requests.length).toBe(4);
    for (let i = 1; i < requests.length; i++) {
      expect(requests[i].at - requests[i - 1].at).toBeGreaterThanOrEqual(1000);
    }
  });

  it("does not throttle across different domains", async () => {
    const { fetcher, requests } = makeHarness();
    await fetcher.fetch("https://syarah.example/api/listings");
    await fetcher.fetch("https://aqar.example/riyadh");
    const syarah = requests.filter((r) => r.url.includes("syarah"));
    const aqar = requests.filter((r) => r.url.includes("aqar"));
    // Each domain pays its own robots.txt + request; domains don't wait on
    // each other (the second domain's first hit isn't pushed past the
    // first domain's schedule).
    expect(syarah.length).toBe(2);
    expect(aqar.length).toBe(2);
  });

  it("identifies itself with the Osooly User-Agent on every request", async () => {
    const { fetcher, requests } = makeHarness();
    await fetcher.fetch("https://haraj.example/search");
    for (const request of requests) {
      expect(request.userAgent).toBe("Osooly/1.0 (+team@osooly.example)");
    }
  });

  it("honours robots.txt Disallow rules", async () => {
    const { fetcher, requests } = makeHarness({
      robots: "User-agent: *\nDisallow: /private",
    });
    await expect(
      fetcher.fetch("https://haraj.example/private/listings")
    ).rejects.toThrow(RobotsDisallowedError);
    // Only robots.txt was fetched; the disallowed path never was.
    expect(requests.map((r) => r.url)).toEqual([
      "https://haraj.example/robots.txt",
    ]);
    // Allowed paths still go through.
    await fetcher.fetch("https://haraj.example/search");
    expect(requests.at(-1)?.url).toBe("https://haraj.example/search");
  });
});

describe("parseRobots", () => {
  it("collects Disallow prefixes for User-agent: *", () => {
    expect(
      parseRobots(
        "User-agent: googlebot\nDisallow: /g-only\n\nUser-agent: *\nDisallow: /api\nDisallow: /admin # comment"
      )
    ).toEqual(["/api", "/admin"]);
  });

  it("returns no rules for an empty file", () => {
    expect(parseRobots("")).toEqual([]);
  });
});
