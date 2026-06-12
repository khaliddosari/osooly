// Relative import (not "@/…") so workers/cron can bundle this file with
// plain esbuild resolution — the alias only exists in the Next.js toolchain.
import type { SnapshotWrite } from "../../lib/market-snapshot";

/**
 * The adapter pattern (PRD §3.5a rule 4): every data source lives behind one
 * small module that turns provider responses into SnapshotWrite rows.
 * Swapping a provider later is one file change — cards and Cron Workers
 * only ever see SnapshotWrite.
 *
 * Adapters take `fetch` (and any keys) as arguments instead of touching
 * globals, so unit tests can inject fakes and the polite fetcher can wrap
 * scrapes.
 */

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

/** Thrown when a provider responds but the payload is unusable. */
export class AdapterError extends Error {
  constructor(
    public readonly adapterId: string,
    message: string
  ) {
    super(`[${adapterId}] ${message}`);
    this.name = "AdapterError";
  }
}

export type { SnapshotWrite };
