# Implementation stages — Osooly v1

> v1 is sliced into 10 tightly-scoped stages. **Rule: one stage per PR. Never bundle
> stages.** Each stage groups only what *must* share context (e.g. NextAuth + base D1
> schemas, because the `users` table is created by the auth adapter). Anything that can
> ship in its own PR is its own stage.
>
> **Source of truth for what to build:** [`Docs/PRD.md`](PRD.md). This file says only
> *how to slice the work*; the PRD says *what the work is*.
>
> **Picking a stage:** check the `Blocked by` list against `git log` and the repo state.
> Trust the repo, not this file's order — if a later stage's prerequisites are already
> done, you can pick it up.

---

## Dependency graph

```
S1 scaffolding/shell
   │
   ├── S2 auth + base D1
   │      │
   │      ├── S3 card primitives ──┐
   │      │                         │
   │      └── S4 market data infra ─┤
   │                                │
   │                                ├── S5 the 4 cards
   │                                │      │
   │                                │      ├── S6 agentic layer + RAG
   │                                │      ├── S7 alerts + n8n
   │                                │      └── S8 Namtheg port
   │                                │
   │                                └── S9 secondary pages (Assets/Account/Subscription)
   │
   └── (any)
              │
              └── S10 hardening + deploy   ← always last
```

---

## S1 — Project scaffolding & visual shell

- **Goal:** Next.js 15 + TypeScript + Tailwind initialized; Liquid Glass `globals.css`
  + `tailwind.config.ts` imported from `Namtheg/AutoML/Frontend/`; layout shell
  (header / footer / ambient-glow / empty-state placeholder card) rendered. No data,
  no auth, no cards yet.
- **Why coupled:** the shell can't be styled without the design tokens, and the
  empty-state placeholder is meaningless without the shell. All pure frontend.
- **Blocked by:** none.
- **Files touched (proposed):** `package.json`, `next.config.ts`, `tsconfig.json`,
  `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`,
  `components/layout-shell.tsx`, `components/header.tsx`, `components/footer.tsx`,
  `components/empty-state-card.tsx`, `components/ambient-field.tsx`.
- **Acceptance:** `npm run dev` shows the dashboard route with header (6 tabs),
  footer (2 LinkedIn entries), ambient glow visible, single "Add your first card"
  placeholder centered. No Lighthouse a11y errors.

---

## S2 — Auth + base D1 schema

- **Goal:** NextAuth.js with Google provider; D1 binding wired through Wrangler; the
  six v1 schemas created via migrations (`users`, `assets`, `transactions`,
  `recommendations`, `user_dashboard_layout`, `alerts`, `market_snapshot`).
  Column-level encryption on identifying fields is stubbed (real keys come in S10).
- **Why coupled:** NextAuth's D1 adapter *creates* the `users` table; you can't
  separate the auth flow from the schema that backs it. Foreign keys in every other
  table reference `users.id` so all schemas land together.
- **Blocked by:** S1.
- **Files touched (proposed):** `app/api/auth/[...nextauth]/route.ts`, `lib/auth.ts`,
  `lib/db.ts`, `wrangler.toml`, `migrations/0001_init.sql`, `.dev.vars.example`.
- **Acceptance:** Google sign-in round-trips to a session in D1; `wrangler d1
  migrations apply osooly` runs clean; `wrangler d1 execute --command "SELECT name
  FROM sqlite_master WHERE type='table'"` returns all 7 tables.

---

## S3 — Card system primitives (no cards yet)

- **Goal:** the `CardDefinition` TypeScript interface; the pure-function
  `layoutSolver` (4×3 grid, auto-resize, overflow→new page); `@dnd-kit/core`
  reorder; numbered page pills; Customize sheet; persistence of layout state to
  `user_dashboard_layout`. Cards folder exists but is empty — system validates
  end-to-end on zero cards (renders the empty-state) and on a mocked card injected
  in a test.
- **Why coupled:** the contract, the solver, the persistence, and the Customize
  sheet are useless without each other. Together they form the platform; cards in
  S5 are *content* for it.
- **Blocked by:** S1, S2.
- **Files touched (proposed):** `lib/cards/types.ts`, `lib/cards/registry.ts`,
  `lib/cards/layout-solver.ts`, `lib/cards/layout-solver.test.ts`,
  `components/dashboard-grid.tsx`, `components/customize-sheet.tsx`,
  `components/page-pills.tsx`, `app/(app)/dashboard/page.tsx`,
  `app/(app)/customize/page.tsx`, `src/cards/.keep`.
- **Acceptance:** unit tests on `layoutSolver` cover 1→12-card cases + overflow;
  drag-drop persists to D1; reload restores layout; empty user still sees the
  placeholder.

---

## S4 — Market data infrastructure

- **Goal:** the `market_snapshot` shared-cache pattern; the four adapter modules
  (Twelve Data, gold-api.com + open.er-api.com, Syarah+Haraj scraper, REGA+Aqar
  scraper); Cloudflare Cron Workers per asset class with the cadences in PRD §3.6;
  graceful-degradation handling (last-known + stale badge) and polite-scraping
  rules per PRD §3.5a.
- **Why coupled:** the shared-cache rule and the adapter pattern only work if
  every adapter agrees on the interface; the Cron Workers all share the same
  bindings and degradation behavior.
- **Blocked by:** S2.
- **Files touched (proposed):** `workers/cron/stocks.ts`, `workers/cron/gold.ts`,
  `workers/cron/autos.ts`, `workers/cron/realestate.ts`,
  `lib/adapters/stocks/twelveData.ts`, `lib/adapters/gold/goldApi.ts`,
  `lib/adapters/gold/exchangerate.ts`, `lib/adapters/autos/syarah.ts`,
  `lib/adapters/autos/haraj.ts`, `lib/adapters/realestate/rega.ts`,
  `lib/adapters/realestate/aqar.ts`, `lib/market-snapshot.ts`,
  `migrations/0002_market_snapshot.sql` (if not in S2),
  `wrangler.toml` (cron triggers).
- **Acceptance:** all four Cron Workers run via `wrangler dev` and write rows to
  `market_snapshot`; injected failures surface "stale" badges, not exceptions;
  scrapers respect rate limits in a smoke test.

---

## S5 — The four v1 cards (4 sub-PRs)

- **Goal:** stock-market, real-estate-market, automobile-market, jewelry-market —
  each a folder under `src/cards/` exporting a `CardDefinition` with `Component`,
  `fetcher` (reads from `market_snapshot`), and `agentTools` stubs (real
  implementations land in S6).
- **Why coupled at the card level (each PR), decoupled across cards:** within one
  card the component / fetcher / agentTools share user-facing copy, units, and
  edge cases. Across cards the only shared surface is the `CardDefinition`
  contract from S3.
- **Sub-stages (one PR each):** S5a stock-market, S5b jewelry-market (simplest —
  one symbol), S5c automobile-market, S5d real-estate-market.
- **Blocked by:** S3, S4. Each sub-PR is independent once those land.
- **Files touched per sub-PR:** `src/cards/<card-id>/index.ts`,
  `src/cards/<card-id>/component.tsx`, `src/cards/<card-id>/fetcher.ts`,
  `src/cards/<card-id>/tools.ts`, plus card-specific helpers.
- **Acceptance:** card appears in the Customize sheet, can be added to the
  dashboard, renders live data from `market_snapshot`, survives the degraded-data
  test (stale badge appears when the adapter fails).

---

## S6 — Agentic layer + RAG

- **Goal:** LangGraph orchestrator with one supervisor + four sub-agents (one per
  card's asset class); DeepSeek V4 Flash client with cheap-first / escalate routing
  and an xAI Grok live X.com news search (DeepSeek web search as fallback);
  Cloudflare Vectorize RAG over user portfolio + market-news corpora;
  `Recommendation` rows written to D1 and consumed by the cards' components.
- **Why coupled:** the orchestrator, RAG retrieval, model routing, and the
  recommendation persistence are mutually dependent — you can't test any one of
  them without the others in place. Splitting would force throwaway stubs.
- **Blocked by:** S5 (agents need cards to register tools against; cards need
  recommendations to render).
- **Files touched (proposed):** `lib/agent/orchestrator.ts`,
  `lib/agent/supervisor.ts`, `lib/agent/sub-agents/<asset-class>.ts`,
  `lib/agent/models/deepseek.ts`, `lib/agent/models/xai.ts`,
  `lib/agent/models/router.ts`, `lib/agent/live-news.ts`, `lib/rag/vectorize.ts`,
  `lib/rag/embed-portfolio.ts`, `lib/rag/embed-news.ts`,
  `workers/cron/news-refresh.ts`, `migrations/0003_recommendations.sql` (if not
  in S2).
- **Acceptance:** running the orchestrator on a seeded portfolio produces a
  `Recommendation` row per asset with `reasoning`, `confidence`, and `model`
  set; the model router runs every task on DeepSeek V4 Flash (short triage,
  escalate to the full draft) and routes live news to xAI Grok with DeepSeek
  web search as fallback; cards display the latest N recommendations.

---

## S7 — Alerts + n8n

- **Goal:** `alerts` table CRUD; the `alerts-evaluator` Cron Worker; the
  `/webhook/osooly-alert` contract; the n8n workflow JSON committed to
  `n8n/workflows/`; per-card "Notify me when…" UI; delivery callback so Osooly
  records `last_fired_at`.
- **Why coupled:** the predicate evaluator, webhook payload, and n8n workflow are
  one contract — change one without the others and alerts break silently. The UI
  has to write rows the evaluator understands.
- **Blocked by:** S4 (alerts read `market_snapshot`); S5 (alert UI lives inside
  cards). Independent of S6.
- **Files touched (proposed):** `workers/cron/alerts-evaluator.ts`,
  `lib/alerts/predicates.ts`, `app/api/alerts/route.ts`,
  `components/alert-rule-form.tsx`, `n8n/workflows/osooly-alert-fanout.json`,
  `migrations/0004_alerts.sql` (if not in S2).
- **Acceptance:** create an alert in the UI, force a `market_snapshot` row that
  satisfies the predicate, the n8n workflow fires and Osooly records the
  delivery within one Cron cycle.

---

## S8 — Namtheg port

- **Goal:** FastAPI sidecar with the Namtheg pipeline lifted from
  `Namtheg/AutoML/Backend/app/pipeline/*`; D1 replaces the local file-based
  `storage.py`; NextAuth session bridge so the sidecar reads the same user;
  `/namtheg` Next.js route re-skinning the upload→preview→running→result→inference
  flow in the Liquid Glass shell; `run_automl()` agentTool callable from any
  card's agent (per PRD §3.7).
- **Why coupled:** the sidecar, the auth bridge, the D1 storage migration, the
  Next.js route, and the agentTool are mutually dependent — none works alone
  end-to-end.
- **Blocked by:** S6 (the agentTool integrates with the LangGraph agents).
- **Files touched (proposed):** `sidecar/app/main.py`, `sidecar/app/pipeline/*`,
  `sidecar/app/storage_d1.py`, `sidecar/app/auth_bridge.py`,
  `sidecar/Dockerfile` (or Cloudflare Containers config),
  `app/(app)/namtheg/**/page.tsx`, `lib/agent/tools/run-automl.ts`,
  `wrangler.toml` (sidecar binding/route).
- **Acceptance:** upload a CSV via `/namtheg`, the pipeline runs in the sidecar,
  results land in D1, the result page renders with the Liquid Glass shell; a
  card's agent can call `run_automl()` and surface the result in-card.

---

## S9 — Secondary pages

- **Goal:** `/assets` flat ledger (search / filter / edit / add holdings),
  `/account` profile + preferences, `/subscription` page with the 1 SAR/mo plan
  + billing-provider link + per-user LLM token usage display.
- **Why coupled:** all three are small CRUD-ish pages over schemas that already
  exist after S2. Bundling avoids three near-trivial PRs.
- **Blocked by:** S2.
- **Files touched (proposed):** `app/(app)/assets/page.tsx`,
  `app/(app)/account/page.tsx`, `app/(app)/subscription/page.tsx`,
  `components/asset-table.tsx`, `lib/billing/<provider>.ts`.
- **Acceptance:** each page renders and writes its respective tables; billing
  link reaches a real (test-mode) checkout; token-usage number reflects D1
  counters.

---

## S10 — Hardening + deploy

- **Goal:** real column-level encryption keys for PII fields; per-user LLM token
  cap enforcement (refusing further agent runs over quota); i18n bootstrap (EN
  full, AR stubbed, RTL flip on `<html dir>`); error boundaries; observability
  (request logs, Cron run logs, alert delivery logs); Cloudflare Pages + Workers
  deployment via Wrangler; sidecar hosting (Containers vs. Render decision);
  n8n hosting (self-hosted vs. n8n Cloud decision); README dev-setup section.
- **Why coupled:** every item here is a cross-cutting v1-blocker — none of them
  alone justifies a stage, but skipping any blocks shipping. Done together,
  reviewed together.
- **Blocked by:** everything else. **Always last.**
- **Files touched (proposed):** `lib/crypto/*`, `lib/limits/token-budget.ts`,
  `lib/i18n/*`, `app/error.tsx`, `app/(app)/*/error.tsx`,
  `lib/observability/*`, `wrangler.toml` (prod), `.github/workflows/deploy.yml`
  (if CI), `README.md` (dev setup section).
- **Acceptance:** prod deploy works end-to-end; encrypted columns are
  round-trippable; a user past quota sees a clear refusal not a crash; AR pages
  render right-to-left; the README's "Run locally" section actually works on a
  fresh clone.

---

## Anti-bundling guidance

- **Don't ship two stages in one PR**, even if they look small. The point is to
  keep each PR review-able in one sitting and each implementation pass within
  one Claude context window.
- **Don't invent stages.** If you find work that doesn't fit, that means either
  (a) the PRD needs updating before you write code, or (b) you're scope-creeping
  the current stage.
- **Don't change the dependency graph silently.** If you genuinely need a stage
  earlier than its `Blocked by` says, update this file *first* and explain the
  reorder.
- **One stage = one PR title** that names the stage: e.g. `S3: card system
  primitives`. Reviewers, the PR description, and the commit messages should all
  use the stage ID.
