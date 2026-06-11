-- Migration 0002 — card_registry_overrides (S3).
-- Completes the PRD §3.8 schema list. Per-user tweaks layered over the code
-- registry (lib/cards/registry.ts): hide a card from the Customize sheet or
-- stash card-level settings without touching the card's code. The card
-- system reads it lazily — v1 ships no writer UI, but the table exists so
-- S5+ cards can persist per-user settings without a schema change.

CREATE TABLE IF NOT EXISTS card_registry_overrides (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  card_id    TEXT NOT NULL,
  hidden     INTEGER NOT NULL DEFAULT 0,
  settings   TEXT,                                      -- JSON, card-defined
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, card_id)
);
