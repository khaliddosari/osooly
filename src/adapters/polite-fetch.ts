import type { FetchLike } from "./types";

/**
 * Scraping etiquette (PRD §3.5a rule 3), enforced in one place so no
 * scraper can forget it:
 *
 *  - honour robots.txt where present (Disallow rules for `*`),
 *  - rate-limit to ≤1 request/second/domain,
 *  - identify as `Osooly/1.0 (+contact)`.
 *
 * The clock and fetch are injectable so the rate limiter is testable
 * without real time or network.
 */

export interface PoliteFetcherOptions {
  /** Contact surfaced in the User-Agent, e.g. an email or URL. */
  contact: string;
  fetchImpl?: FetchLike;
  /** Minimum gap between requests to the same domain (ms). */
  minDelayMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows fetching ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

export class PoliteFetcher {
  private readonly fetchImpl: FetchLike;
  private readonly minDelayMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly userAgent: string;

  /** Last-request timestamp per domain — the ≤1 req/s/domain ledger. */
  private readonly lastRequestAt = new Map<string, number>();
  /** Per-domain promise chain so concurrent callers queue, not race. */
  private readonly queues = new Map<string, Promise<unknown>>();
  /** robots.txt Disallow prefixes per domain (null = no robots.txt). */
  private readonly robotsCache = new Map<string, string[] | null>();

  constructor(options: PoliteFetcherOptions) {
    // Wrapped, not referenced: workerd's fetch throws "Illegal invocation"
    // when called with a `this` other than the global scope.
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.minDelayMs = options.minDelayMs ?? 1000;
    this.now = options.now ?? Date.now;
    this.sleep =
      options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.userAgent = `Osooly/1.0 (+${options.contact})`;
  }

  async fetch(url: string, init?: RequestInit): Promise<Response> {
    const { hostname, pathname, search } = new URL(url);

    const run = async (): Promise<Response> => {
      const disallowed = await this.disallowedPrefixes(hostname, url);
      const path = pathname + search;
      if (disallowed?.some((prefix) => prefix !== "" && path.startsWith(prefix))) {
        throw new RobotsDisallowedError(url);
      }
      await this.throttle(hostname);
      return this.fetchImpl(url, {
        ...init,
        headers: { "User-Agent": this.userAgent, ...init?.headers },
      });
    };

    // Chain onto the domain's queue so requests stay sequential per domain.
    const tail = this.queues.get(hostname) ?? Promise.resolve();
    const next = tail.then(run, run);
    this.queues.set(
      hostname,
      next.catch(() => undefined)
    );
    return next;
  }

  private async throttle(hostname: string): Promise<void> {
    const last = this.lastRequestAt.get(hostname);
    if (last !== undefined) {
      const wait = last + this.minDelayMs - this.now();
      if (wait > 0) await this.sleep(wait);
    }
    this.lastRequestAt.set(hostname, this.now());
  }

  private async disallowedPrefixes(
    hostname: string,
    forUrl: string
  ): Promise<string[] | null> {
    if (this.robotsCache.has(hostname)) {
      return this.robotsCache.get(hostname) ?? null;
    }
    let rules: string[] | null = null;
    try {
      await this.throttle(hostname);
      const res = await this.fetchImpl(new URL("/robots.txt", forUrl).href, {
        headers: { "User-Agent": this.userAgent },
      });
      if (res.ok) rules = parseRobots(await res.text());
    } catch {
      // Unreachable robots.txt is treated as absent — PRD asks us to honour
      // it "where present", not to refuse to run without it.
    }
    this.robotsCache.set(hostname, rules);
    return rules;
  }
}

/** Disallow prefixes that apply to `User-agent: *` (we match no UA group). */
export function parseRobots(text: string): string[] {
  const disallows: string[] = [];
  let appliesToUs = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      appliesToUs = value === "*" || value.toLowerCase().includes("osooly");
    } else if (key === "disallow" && appliesToUs && value) {
      disallows.push(value);
    }
  }
  return disallows;
}
