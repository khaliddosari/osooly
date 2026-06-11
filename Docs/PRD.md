# Osooly — Product Requirements Document

**Status:** v1 spec, June 2026
**Owners:** Khalid Al Dosari, Ahmad Alasmari
**Source-of-truth doc:** this file. AGENTS.md, CLAUDE.md, and code comments link back here.

---

## 3.1 Product overview

**Osooly** (أصولي — "my assets") is an **agentic personal-finance assistant**. It tracks
everything a user owns across asset classes — equities, real estate, automobiles,
jewelry — keeps each class continuously enriched with relevant market data, and uses an
LLM agent (DeepSeek + Groq via LangChain / LangGraph, RAG over the user's portfolio plus
a market-news corpus) to recommend actions on those assets.

**Vision:** *a dashboard that thinks about your assets so you don't have to.*

**Bilingual brand line** (per Liquid Glass design rule §8.5 — Arabic above Latin):

> **أصولي**
> Osooly

**Primary persona:** an individual investor / asset-holder in MENA (initially KSA) who
manages multiple asset classes and wants one place to see them, with one brain that reasons
about them.

---

## 3.2 Goals & non-goals

### Goals (v1)
- A unified **asset ledger** the user can edit and the agent can read.
- Per-asset-class **market awareness** refreshed on a Cron cadence.
- **Explainable** LLM recommendations stored as structured rows (action + reasoning +
  confidence + model), surfaced inside their owning card.
- A **user-composable dashboard** of cards with smart auto-layout and pagination.
- Reuse of the existing **Liquid Glass** aesthetic (zero design redesign).
- **Price alerts** delivered through a flexible notification fabric (n8n).

### Non-goals (v1)
- Brokerage integration / order execution — Osooly recommends, the user transacts.
- Mobile-first layout — PC dashboard is v1; mobile is v2.
- Tax-jurisdiction-specific reporting.
- Multi-currency consolidation beyond the user's home currency.

---

## 3.3 Personas & primary jobs-to-be-done

- **First-time user** lands on an empty dashboard with one placeholder: *"Add your first
  card."* Onboarding = "pick the asset classes you care about" from the Customize sheet.
- **Returning user** opens the dashboard to a freshly-recomputed set of recommendations
  ("Tadawul opened up; your TASI exposure is …", "Used-car prices in your saved make/model
  dropped 4%, the Land Cruiser you've been watching is now under your target …").
- **Power user** rearranges the grid, pins critical cards to page 1, lets the rest
  paginate, and sets price alerts on individual positions.

---

## 3.4 Information architecture & navigation

### Header (PC, v1)

| Tab | Route | Purpose |
|---|---|---|
| Dashboard | `/dashboard` | The paginated card grid (the home of the app) |
| Namtheg | `/namtheg` | AutoML pipeline ported into Osooly — see §3.7 |
| Assets | `/assets` | Flat asset ledger — search/filter/edit raw holdings independent of cards |
| Customize | `/customize` | Add/remove cards, change layout, reorder pages |
| Account | `/account` | Profile, Google-linked identity, preferences |
| Subscription | `/subscription` | 1 SAR / month plan, billing, usage |

### Footer (PC, v1)
Liquid-glass strip with two LinkedIn entries (FA `fab fa-linkedin` icons per design-system
§4 — no emoji):

- **Khalid Al Dosari** — https://www.linkedin.com/in/khalid-al-dosari
- **Ahmad Alasmari** — https://www.linkedin.com/in/ahmed-alasmari-sa

### Empty-state rule
A fresh dashboard shows **exactly one card** — a centered glass card with a dashed border,
FA `fa-plus`, and copy "Add your first card." Clicking it opens the Customize sheet
pre-filtered to the card registry.

---

## 3.5 The card system — developer contract & "smart" layout

### Developer ergonomics
Adding a new card must be **one folder + one registry line.** Each card is a TypeScript
module exporting a `CardDefinition`:

```ts
export interface CardDefinition {
  id: string;                      // "stock-market"
  title: string;                   // "Stock Market"
  icon: IconName;                  // FA semantic name (see design-system §4)
  category: "market" | "portfolio" | "tools";
  defaultSize: { w: 1|2|3|4; h: 1|2|3 };   // grid units — see layout below
  minSize?: { w: number; h: number };
  Component: React.FC<CardProps>;  // the render
  fetcher?: () => Promise<unknown>;// optional server data hook
  agentTools?: AgentTool[];        // LangChain tools the asset-class agent registers when this card is mounted
}
```

Cards are auto-discovered from `src/cards/*/index.ts` and listed in the Customize sheet
by category. **Adding `real-estate-market` is: drop a folder, export the def, done.**

### Smart layout (auto-resize + auto-paginate)

- The grid is a fixed **4 columns × 3 rows per page** = 12 grid cells. Card sizes are
  declared in grid units.
- **One card on a page → it expands to fill all 12 cells.** Two cards → 2×3 each. Three →
  one stays large (2×3), two stack (2×1 each), etc. A `layoutSolver` (pure function,
  `(cards[], gridDims) → CSSGridRect[]`) computes positions based on declared
  `defaultSize` and remaining space.
- **Overflow → new page.** When a card cannot fit on the current page without violating
  its `minSize`, the solver opens page N+1. Pages are accessed via small numbered pills
  at the bottom-right of the dashboard (glass surface, cyan-active).
- **Reordering:** drag-and-drop powered by `@dnd-kit/core` (lighter than
  react-grid-layout and easier to skin in glass). Drag handles are the card's title bar;
  dropping over a page pill moves the card to that page.
- **Persistence:** layout state per user in D1 — `user_dashboard_layout` table
  (`user_id`, `page`, `card_id`, `x`, `y`, `w`, `h`).

### v1 card catalogue (must ship)

| Card id | Data sources (locked for v1) | Agent role |
|---|---|---|
| `stock-market` | **Twelve Data free tier** (TASI + global indices, 800 req/day, 8 req/min cap — see §3.5a) | Watches user's holdings, flags drift vs. target allocation |
| `real-estate-market` | **REGA / Ministry of Justice transaction index** (primary, official) + **Aqar.fm scrape** (live comparables) + user-entered properties | Estimates current value, flags neighborhood-level shifts |
| `automobile-market` | **Syarah + Haraj scrape** (nightly Cron Worker, per user-saved make/model) + user-entered vehicles | Tracks depreciation, suggests sell/hold windows |
| `jewelry-market` | **metals.live** (free gold spot) + **exchangerate.host** (SAR/gram) + user-entered pieces | Re-prices the user's gram-weighted inventory daily |

---

## 3.5a Free-tier operational constraints

v1 data sources are deliberately zero-cost, which forces four architectural rules:

1. **Shared cache, never per-user fetches.** A single `market_snapshot` table in D1
   holds the latest price for every symbol the platform tracks. Cron Workers write to
   it; every user's card reads from it. With Twelve Data's 800 req/day cap, per-user
   fanout would burn the budget after ~10 users — shared cache makes the limit
   user-count-independent.
2. **Graceful degradation.** `metals.live` has spotty uptime. The gold card must show
   the **last-known price** with a small *"stale (last updated Xh ago)"* badge rather
   than an error state. The agent treats stale data as low-confidence input.
3. **Scraping etiquette.** Syarah / Haraj / Aqar scrapers honour `robots.txt` where
   present, rate-limit to ≤1 req/sec/domain, identify themselves with a clear
   User-Agent (`Osooly/1.0 (+contact-email)`), and cache results aggressively. After N
   consecutive failures, the card surfaces *"market data unavailable, showing
   user-entered values"* instead of crashing.
4. **Adapter pattern for upgrade.** Each data source lives behind a small adapter
   (`adapters/stocks/twelveData.ts`, `adapters/gold/metalsLive.ts`, etc.). Swapping to
   a paid provider later is one file change — no card or agent rewrites.

---

## 3.6 Agentic backend

- **Orchestrator:** LangGraph state machine with one supervisor node and one sub-agent
  per asset class. Each sub-agent owns the tools that come from its card's `agentTools`.
- **Models:** **DeepSeek** (via DeepSeek direct API or OpenRouter) for reasoning-heavy
  recommendation drafts; **Groq** (Llama-3.1-70B or similar) for fast classification /
  summarization. Selection is policy-based (cheap-first, escalate on low confidence).
- **RAG corpus:** two collections in a Cloudflare Vectorize index —
  (a) the user's own asset ledger + transaction history (private per `user_id`),
  (b) a market-news corpus refreshed by a Cloudflare Cron Worker daily.
- **Refresh cadence:** background Cloudflare Workers Cron jobs per asset class — stocks
  every **1 min during market hours**; real-estate / autos / jewelry nightly.
- **Recommendation surface:** structured `Recommendation` rows in D1 — `asset_id`,
  `card_id`, `action: "buy" | "sell" | "hold" | "watch"`, `reasoning`, `confidence`,
  `model`, `created_at`. Cards render the latest N for their asset class.

---

## 3.7 Namtheg tab — integration approach

**Decision: port** (iframe / SSO shortcut explicitly rejected).

The Namtheg Python pipeline (`Namtheg/AutoML/Backend/app/pipeline/*`) is lifted into the
Osooly backend as a **FastAPI sidecar** (Cloudflare Workers can't run scikit-learn /
pandas at required scale). The sidecar:

- **Shares Osooly's D1** for runs/results storage — replaces Namtheg's local file-based
  `storage.py`.
- **Reads the same NextAuth-issued session** — no separate login, no separate OAuth
  client.
- **Exposes endpoints that a card's `agentTools` can call**, so an asset-class agent can
  trigger an AutoML run programmatically. Example: a real-estate card's agent calls
  `run_automl(dataset=user_real_estate_tx, target="sale_price")` to project property
  values, then surfaces the result in-card.
- The `/namtheg` route in Next.js consumes the sidecar over HTTPS and re-skins the
  *upload → preview → running → result → inference* flow in the Liquid Glass shell. The
  existing Namtheg Next.js components in `Namtheg/AutoML/Frontend/components/` are the
  starting point and are already on the same design system.

**Hosting:** sidecar deployed alongside Osooly Workers (Cloudflare Containers or a small
Render service — decided at build time based on cost). Same domain via Cloudflare reverse
proxy so cookies and CORS stay simple.

---

## 3.8 Tech stack (locked for v1)

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind — re-using the Liquid
  Glass `globals.css` + `tailwind.config.ts` lifted from the Namtheg Frontend folder.
  Cards = client components, layout shell = server component.
- **Auth:** NextAuth.js with Google provider; session stored in D1.
- **Database:** Cloudflare D1 (SQLite at the edge). Schemas: `users`, `assets`,
  `transactions`, `recommendations`, `alerts`, `user_dashboard_layout`,
  `card_registry_overrides`, `market_snapshot`.
- **Vector store:** Cloudflare Vectorize for the dual RAG corpora.
- **Agentic layer:** LangChain + LangGraph; runs in a Cloudflare Worker (or Node.js
  sidecar if Worker constraints bite). DeepSeek + Groq via their HTTPS APIs.
- **AutoML sidecar:** the ported Namtheg FastAPI service (§3.7) — shares D1, called by
  card agents and by the `/namtheg` route.
- **Scheduling:** Cloudflare Cron Triggers per refresh job.
- **Notifications & workflow automation:** **n8n** (self-hosted on a small VPS, or n8n
  Cloud — decided at deploy time). See §3.8a.
- **Hosting:** Cloudflare Pages (Next.js) + Workers; secrets via Wrangler.

---

## 3.8a Price alerts & notifications (n8n)

Users can set a **"Notify me when …"** rule on any tracked asset (per-asset, optionally
per-card). Examples:

- "Notify me when AAPL > $200"
- "Notify me when gold spot drops 5% from today"
- "Notify me when a 2020 Land Cruiser within 50 km lists under 350,000 SAR"

### Flow

1. User creates an alert in the card UI → row written to D1 `alerts` table:
   `user_id`, `card_id`, `asset_id`, `predicate` (JSON: `field` / `op` / `value` /
   `window`), `channels[]`, `enabled`, `created_at`, `last_fired_at`.
2. A Cloudflare Cron Worker (`alerts-evaluator`, runs on the same cadence as the
   relevant asset's market refresh) re-evaluates all enabled predicates against the
   latest prices.
3. When a predicate matches, the Worker **POSTs to a single n8n webhook endpoint**
   (`/webhook/osooly-alert`) with `{user, asset, predicate, value, triggered_at}`.
4. The n8n workflow does the fan-out — branches per channel (email via SMTP/SendGrid,
   WhatsApp via Twilio, Telegram, in-app web-push), applies user rate-limits, formats
   the message (Arabic/English templating), and logs delivery back to Osooly via a
   webhook the Worker exposes.

### Why n8n vs. handling it in-Worker
n8n absorbs the "ten thousand integrations" surface area so Osooly stays narrow. Adding
WhatsApp later doesn't touch Osooly code — just edit the n8n workflow. Workflows are
version-controlled as exported JSON in `n8n/workflows/` in this repo.

---

## 3.9 Non-functional requirements

- **Performance:** dashboard TTI < 1.5s on a warm cache; card data lazy-fetched per
  page.
- **Accessibility:** WCAG AA contrast (the design system already meets this on dark);
  respect `prefers-reduced-motion` (per design-system §3 Motion).
- **i18n:** EN / AR with RTL flip on `<html dir>`; Arabic uses Thmanyah display where
  the design system specifies. v1 ships EN; AR strings stubbed.
- **Privacy:** asset data is per-user; identifying fields encrypted at rest in D1 at the
  column level; agent prompts never leave the user's session boundary except to the LLM
  provider (PII-stripped where possible).
- **Cost controls:** per-user monthly LLM token cap surfaced on `/subscription`.

---

## 3.10 Resolved decisions (v1)

- **Pricing — single flat tier: 1 SAR / month.** Tiers will be revisited only when LLM
  token usage or alert volume per user starts hurting unit economics; until then,
  simplicity wins. The Subscription tab shows one plan and a "manage billing" link.
- **Namtheg SSO — N/A.** §3.7 (port) removes the second site, so there's no
  cross-domain handoff to solve.
- **Market data — all free tier for v1:**
  - Stocks → Twelve Data free (shared-cache architecture per §3.5a)
  - Gold / jewelry → metals.live free + exchangerate.host
  - Autos → Syarah + Haraj scrape (polite scraping per §3.5a)
  - Real estate → REGA govt index primary + Aqar scrape secondary
- All paid-upgrade decisions deferred until real usage data exists. The adapter pattern
  in §3.5a makes the swap a one-file change.

---

## Appendix — related projects

- **Namtheg AutoML** — sibling product, being ported into Osooly per §3.7.
  - Source: `Namtheg/AutoML/` in this repo
  - GitHub: https://github.com/khaliddosari/AutoML
  - Live: https://namtheg.onrender.com
- **Liquid Glass design system** — `Docs/Liquid Glass-Portfolio Design System/`
  (visual source of truth for Osooly).
- **Khalid Al Dosari portfolio** — origin of the Liquid Glass design system.
