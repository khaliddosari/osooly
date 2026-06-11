-- Migration 0001 — base v1 schema (S2).
-- The seven v1 tables from PRD §3.8 (users, assets, transactions,
-- recommendations, user_dashboard_layout, alerts, market_snapshot) plus the
-- NextAuth side tables (accounts, sessions, verification_tokens) that the
-- @auth/d1-adapter reads and writes. `card_registry_overrides` lands with the
-- card system in S3.
--
-- PII note (PRD §3.9): columns marked [PII] hold identifying data and are
-- written/read exclusively through sealPII()/openPII() in lib/db.ts — a
-- pass-through stub in v1 until real column-level encryption keys land in S10.

-- ── NextAuth (Auth.js) ──────────────────────────────────────────────────────
-- Column names and types must match @auth/d1-adapter's queries exactly
-- (camelCase and all); don't rename them.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT NOT NULL DEFAULT '',
  name          TEXT,             -- [PII]
  email         TEXT,             -- [PII]
  emailVerified DATETIME,
  image         TEXT,             -- [PII]
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS accounts (
  id                 TEXT NOT NULL,
  userId             TEXT NOT NULL,
  type               TEXT NOT NULL,
  provider           TEXT NOT NULL,
  providerAccountId  TEXT NOT NULL,
  refresh_token      TEXT,
  access_token       TEXT,
  expires_at         NUMBER,
  token_type         TEXT,
  scope              TEXT,
  id_token           TEXT,
  session_state      TEXT,
  oauth_token_secret TEXT,
  oauth_token        TEXT,
  PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_provider
  ON accounts (provider, providerAccountId);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts (userId);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT NOT NULL,
  sessionToken TEXT NOT NULL,
  userId       TEXT NOT NULL,
  expires      DATETIME NOT NULL,
  PRIMARY KEY (sessionToken)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (userId);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires    DATETIME NOT NULL,
  PRIMARY KEY (token)
);

-- ── Osooly domain ───────────────────────────────────────────────────────────

-- The unified asset ledger (PRD §3.2). One row per holding; class-specific
-- fields (VIN, deed number, hallmark, …) live in the `details` JSON.
CREATE TABLE IF NOT EXISTS assets (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  asset_class       TEXT NOT NULL CHECK (asset_class IN ('stocks', 'real_estate', 'autos', 'jewelry')),
  name              TEXT NOT NULL,
  symbol            TEXT,             -- market symbol where one exists (e.g. TASI ticker); NULL for physical assets
  quantity          REAL NOT NULL DEFAULT 1,
  unit              TEXT,             -- shares, grams, sqm, …
  purchase_price    REAL,
  purchase_currency TEXT NOT NULL DEFAULT 'SAR',
  purchased_at      DATETIME,
  details           TEXT,             -- [PII] JSON, class-specific identifying fields
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_assets_user ON assets (user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_class ON assets (user_id, asset_class);

-- Ledger movements per asset; the agent reads these for cost-basis reasoning.
CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  asset_id    TEXT NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('buy', 'sell', 'adjust')),
  quantity    REAL NOT NULL,
  price       REAL,
  currency    TEXT NOT NULL DEFAULT 'SAR',
  occurred_at DATETIME NOT NULL,
  note        TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_asset ON transactions (asset_id);

-- Structured agent output (PRD §3.6); cards render the latest N per class.
CREATE TABLE IF NOT EXISTS recommendations (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  asset_id   TEXT REFERENCES assets (id) ON DELETE CASCADE,
  card_id    TEXT NOT NULL,
  action     TEXT NOT NULL CHECK (action IN ('buy', 'sell', 'hold', 'watch')),
  reasoning  TEXT NOT NULL,
  confidence REAL NOT NULL,
  model      TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_card
  ON recommendations (user_id, card_id, created_at DESC);

-- Per-user card grid state (PRD §3.5): position + size in grid units, per page.
CREATE TABLE IF NOT EXISTS user_dashboard_layout (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  page    INTEGER NOT NULL DEFAULT 1,
  x       INTEGER NOT NULL,
  y       INTEGER NOT NULL,
  w       INTEGER NOT NULL,
  h       INTEGER NOT NULL,
  PRIMARY KEY (user_id, card_id)
);

-- "Notify me when …" rules (PRD §3.8a). The alerts-evaluator Cron Worker (S7)
-- re-evaluates enabled predicates against market_snapshot.
CREATE TABLE IF NOT EXISTS alerts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  card_id       TEXT NOT NULL,
  asset_id      TEXT REFERENCES assets (id) ON DELETE CASCADE,
  predicate     TEXT NOT NULL,             -- JSON: { field, op, value, window }
  channels      TEXT NOT NULL DEFAULT '[]', -- JSON array of channel ids
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_fired_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_enabled ON alerts (enabled);

-- Shared market cache (PRD §3.5a rule 1): one row per tracked symbol, written
-- by the Cron Workers (S4), read by every user's cards. Staleness is derived
-- from fetched_at at read time — no flag column.
CREATE TABLE IF NOT EXISTS market_snapshot (
  asset_class TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  price       REAL,
  currency    TEXT NOT NULL DEFAULT 'SAR',
  payload     TEXT,            -- JSON: provider-specific extras (ohlc, listing counts, …)
  source      TEXT NOT NULL,   -- adapter id, e.g. 'twelve-data', 'metals-live'
  fetched_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (asset_class, symbol)
);
