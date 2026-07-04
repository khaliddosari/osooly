-- Migration 0004 - secondary-page state (S9, PRD 3.4 / 3.9 / 3.10).
-- Two small tables the Assets / Account / Subscription pages read and write.
-- The ledger (`assets`, `transactions`) and everything the /assets page edits
-- already exist from 0001; these two are the only new schemas S9 needs.
--
-- PII note (PRD 3.9): none of these columns hold identifying data, so no
-- sealPII/openPII wrapping is required. The /assets page still writes the
-- [PII] `assets.details` column through those seams (see lib/assets/store.ts).

-- Per-user UI preferences (PRD 3.9): interface locale and the ISO code money
-- is displayed in. Dark-only and RTL-on-<html dir> are design-system rules,
-- not user toggles, so they are intentionally absent. One row per user,
-- created lazily on first save; readers fall back to defaults when absent.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id          TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  locale           TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar')),
  display_currency TEXT NOT NULL DEFAULT 'SAR',
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Per-user monthly LLM token counter (PRD 3.9 cost controls, surfaced on
-- /subscription). One row per (user, calendar month, 'YYYY-MM'); the
-- Subscription page reads the current month against MONTHLY_TOKEN_CAP. S9 owns
-- the read + display side; S10 wires recordTokenUsage() into the agent run
-- path and enforces the cap (see app/api/agent/run/route.ts).
CREATE TABLE IF NOT EXISTS llm_token_usage (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  period     TEXT NOT NULL,              -- calendar month, 'YYYY-MM' (UTC)
  tokens     INTEGER NOT NULL DEFAULT 0, -- prompt + completion tokens this period
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, period)
);
