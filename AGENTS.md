# AGENTS.md

> Operational guide for any AI agent (Claude included) working inside this repo.
>
> **Source of truth: [`Docs/PRD.md`](Docs/PRD.md).** AGENTS.md is a thin operational
> layer *over* the PRD — it summarises and links, it does not duplicate. If this file
> and the PRD disagree, **the PRD wins**; update AGENTS.md to match (per the
> continuous-update rule in §4).
>
> This file is auto-refreshed via the Stop + UserPromptSubmit hooks in
> [`.claude/settings.json`](.claude/settings.json) — those hooks just mark the file dirty
> and remind the next Claude session to refresh it. Do not hand-edit the **Context** or
> **Related projects** blocks (the hook regenerates them from the PRD + repo state).
> The **Requirements**, **Design**, and **Guidelines** blocks are hand-editable.

---

## 1. Context

**Osooly** (أصولي — "my assets") is an agentic personal-finance assistant. PC-first
dashboard of user-composed cards over a unified asset ledger, with LangGraph agents
recommending actions per asset class.

- **Stage:** v1 implementation in progress: S1 (scaffolding + visual shell), S2
  (NextAuth Google sign-in + the base D1 schema via Wrangler migrations), S3
  (card system primitives: CardDefinition contract, layoutSolver, dnd-kit grid,
  Customize sheet, layout persistence), S4 (market data infra: market_snapshot
  shared cache, the four adapter families, the cron Worker in `workers/cron/`),
  S5 (the four v1 market cards in `src/cards/`), S6 (agentic layer: the
  LangGraph supervisor + per-class sub-agents in `lib/agent/`, real agent tools
  in `src/agent/tools/`, Vectorize RAG in `lib/rag/`, recommendations rendered
  in-card), and S7 (price alerts + notifications: the `alerts` CRUD in
  `app/api/alerts/`, the `lib/alerts/` predicate model + D1 store, the
  `alerts-evaluator` in `workers/cron/` firing matches to a single n8n webhook,
  the per-card "Notify me when…" UI, and the committed `n8n/workflows/`
  fan-out), and S8 (Namtheg port: the FastAPI sidecar in `sidecar/` with
  D1-backed run storage + the NextAuth session bridge, the `/namtheg`
  upload→preview→running→result→inference flow behind the `/api/namtheg`
  proxy, and the cross-class `run_automl` agent tool), and S9 (secondary
  pages: the `/assets` flat ledger over the `assets` table with
  search/filter/add/edit/delete behind `app/api/assets/`, the `/account`
  profile + preferences page backed by `user_preferences` with Google
  sign-in/out actions, and the `/subscription` page showing the 1 SAR/month
  plan, an env-driven billing link, and the per-user monthly LLM token
  counter in `llm_token_usage`), and S10 (hardening + deploy: real
  AES-256-GCM column encryption in `lib/crypto/`, per-user monthly token-cap
  enforcement in `lib/limits/`, the `lib/i18n/` EN/AR bootstrap with the
  `<html dir>` RTL flip, App Router error boundaries, the `lib/observability/`
  structured logger, and the OpenNext + Wrangler deploy config) shipped. All
  ten v1 stages are landed; the live cloud deploy runs from the
  [README](README.md) runbook. See
  [`Docs/IMPLEMENTATION-STAGES.md`](Docs/IMPLEMENTATION-STAGES.md).
- **Repo layout (current):**
  - `Docs/PRD.md` — the source of truth (this file's parent doc)
  - `Docs/Liquid Glass-Portfolio Design System/` — visual source of truth
  - `Docs/IMPLEMENTATION-STAGES.md` — the 10-stage v1 slicing plan
  - `app/`, `components/`, `lib/`, `public/` — the Next.js app (S1 shell, S2 auth,
    S3 card system: `lib/cards/` + the dashboard grid / Customize sheet components)
  - `src/cards/` — card modules, one folder per card (S5: stock-market,
    real-estate-market, automobile-market, jewelry-market)
  - `src/adapters/` — data-source adapters (PRD §3.5a rule 4) + the polite fetcher
  - `src/agent/tools/`: the per-asset-class agent tools the cards list in
    `agentTools` (S6); `lib/agent/` + `lib/rag/` hold the LangGraph orchestrator
    and the Vectorize RAG layer
  - `lib/alerts/` + `app/api/alerts/`: the price-alert predicate model / D1
    store and the per-user CRUD behind the cards' "Notify me when…" UI (S7)
  - `workers/cron/`: the market-refresh + news-refresh Cron Worker plus the
    `alerts-evaluator` (runs after each refresh, POSTs matches to n8n, and
    exposes the `/alert-delivery` callback) (own wrangler.toml, same D1)
  - `n8n/workflows/`: version-controlled n8n workflow JSON (S7 alert fan-out)
  - `sidecar/`: the ported Namtheg AutoML pipeline as a FastAPI service (S8,
    PRD §3.7); run state/results in D1 (`storage_d1.py`), NextAuth session
    bridge (`auth_bridge.py`), in-process inference. Consumed through the
    `app/api/namtheg/` proxy by the `/namtheg` pages (`components/namtheg/`,
    `lib/namtheg/`) and by the `run_automl` tool in `src/agent/tools/automl/`
  - `lib/assets/` + `app/api/assets/`: the `assets`-ledger value model / D1
    store and the per-user holdings CRUD behind the `/assets` page's
    `components/asset-table.tsx` (S9)
  - `lib/account/` + `lib/auth-actions.ts`: the `user_preferences` model /
    store, the preferences server action, and the Google sign-in/out actions
    behind the `/account` page (S9)
  - `lib/limits/` (per-user monthly LLM token counter `llm_token_usage` +
    the S10 cap enforcement) + `lib/billing/` (env-driven checkout link) back
    the `/subscription` page (S9)
  - `lib/crypto/` (AES-256-GCM behind the `sealPII`/`openPII` seam),
    `lib/i18n/` (EN/AR dictionary + `<html dir>` RTL), and
    `lib/observability/` (structured event logger) are the S10 cross-cutting
    layers; error boundaries live in `app/error.tsx`, `app/global-error.tsx`,
    and `app/(app)/error.tsx`
  - `migrations/` + `wrangler.toml` + `open-next.config.ts` — D1 schema (applied
    via `wrangler d1 migrations apply osooly`) and the OpenNext + Wrangler
    deploy config; CI/deploy in `.github/workflows/` (S10)
  - `Namtheg/AutoML/` — the sibling project ported into Osooly in S8 (kept
    read-only as the upstream reference)
- **Canonical version of this block:** [PRD §3.1 Product overview](Docs/PRD.md#31-product-overview)

---

## 2. Requirements

A distillation of the PRD. **For anything load-bearing, read the PRD section linked
beside the bullet — that's the binding version.**

- **v1 must ship:** dashboard with paginated, auto-resizing card grid; four cards
  (stocks, real estate, autos, jewelry); empty-state placeholder; header (Dashboard,
  Namtheg, Assets, Customize, Account, Subscription); footer with two LinkedIn entries;
  Google auth; 1 SAR/month subscription; n8n price alerts.
  → [PRD §3.2 Goals & non-goals](Docs/PRD.md#32-goals--non-goals)
- **Out of scope for v1:** brokerage execution, mobile layout, tax reporting,
  multi-currency consolidation.
  → [PRD §3.2 Goals & non-goals](Docs/PRD.md#32-goals--non-goals)
- **NFRs:** dashboard TTI < 1.5s warm; WCAG AA contrast; respect
  `prefers-reduced-motion`; EN+AR with RTL; column-level encryption for identifying
  fields in D1; per-user monthly LLM token cap.
  → [PRD §3.9 Non-functional requirements](Docs/PRD.md#39-non-functional-requirements)
- **Tech stack:** Next.js 15 + TypeScript + Tailwind / NextAuth (Google) /
  Cloudflare D1 + Vectorize + Workers + Cron / LangChain + LangGraph /
  DeepSeek V4 Flash (OpenRouter, also the web-search fallback) + xAI Grok
  (live X.com news search) / FastAPI sidecar (Namtheg) / n8n (notifications).
  → [PRD §3.8 Tech stack](Docs/PRD.md#38-tech-stack-locked-for-v1)

---

## 3. Design

### Visual rules — never break

The **visual source of truth** is
[`Docs/Liquid Glass-Portfolio Design System/README.md`](Docs/Liquid Glass-Portfolio Design System/README.md).
The hard rules (per §8 of that doc):

1. Dark only — near-black background, off-white text. Never light-mode.
2. Surfaces are translucent **glass** (blur + hairline + inset bevel), never flat
   opaque blocks.
3. Accent = the **cyan→blue gradient**, used sparingly.
4. Keep the **ambient glow field** behind everything — glass needs it to refract.
5. **Bilingual identity:** Arabic name in Thmanyah display serif above the Latin
   name; the wordmark `أصولي` always in `font-display font-bold text-primary`.
6. Icons = **Font Awesome 6.5.1** via `<Icon>` + the one CV SVG. **No emoji**, no
   unicode-glyph icons.
7. Generous spacing, centered section titles, 16 px radius, subtle `translateY`
   hover lifts.
8. Respect `prefers-reduced-motion` — stop `animate-drift` and `animate-shimmer`.

### Card developer contract

To add a new card, drop a folder under `src/cards/<card-id>/` exporting a
`CardDefinition`:

```ts
export interface CardDefinition {
  id: string;
  title: string;
  icon: IconName;
  category: "market" | "portfolio" | "tools";
  defaultSize: { w: 1|2|3|4; h: 1|2|3 };
  minSize?: { w: number; h: number };
  Component: React.FC<CardProps>;
  fetcher?: () => Promise<unknown>;
  agentTools?: AgentTool[];
}
```

Cards are auto-discovered; the Customize sheet lists them by category. Smart layout +
pagination is handled by the platform — declare `defaultSize` and the solver does the
rest.

- **Canonical version:** [PRD §3.5 The card system](Docs/PRD.md#35-the-card-system--developer-contract--smart-layout)
- **Free-tier data rules every card must follow:** [PRD §3.5a](Docs/PRD.md#35a-free-tier-operational-constraints)

---

## 4. Guidelines — how to work in this repo

### PRD-first rule
**Before changing product scope, the card contract, the data-source list (PRD §3.5 /
§3.5a), the tech stack, or any architectural choice, update [`Docs/PRD.md`](Docs/PRD.md)
*first*, then mirror the change into this file.** Code follows the PRD, not the other
way around. If you find yourself writing code that contradicts the PRD, stop and either
(a) push back on the change and re-spec, or (b) update the PRD in the same PR.

### One-stage-per-PR rule (v1 implementation)
**v1 is sliced into 10 tightly-scoped stages in
[`Docs/IMPLEMENTATION-STAGES.md`](Docs/IMPLEMENTATION-STAGES.md). Work one stage per
PR. Never bundle stages.** Each stage groups only what must share context (e.g. auth
+ base D1 schemas land together because the `users` table is created by the auth
adapter). Independent work is its own stage. Pick a stage whose `Blocked by` list is
satisfied by `git log` and the repo state. PR title and commit subject should name
the stage (`S3: card system primitives`).

### Continuous-update rule
If you change product scope, design tokens, the card contract, or which sibling
projects exist, **update AGENTS.md in the same commit** as the change that triggered
it. The Stop hook will mark this file dirty if you forget; the UserPromptSubmit hook
on your next session will remind you.

### No-AI-attribution rule
**Never credit yourself in this repo.** No `Co-Authored-By: Claude …` /
`Co-Authored-By: Anthropic …`, no `Generated with Claude Code`, no `🤖` sign-offs in
commit messages, PR descriptions, code comments, or docs. Author identity stays the
human's; `git config user.name` / `user.email` are never touched. If the user
explicitly asks for a credit line, ask them to confirm the exact text in chat.

A `PreToolUse` hook in [`.claude/settings.json`](.claude/settings.json) runs
[`scripts/block-ai-attribution.ps1`](scripts/block-ai-attribution.ps1) and rejects any
`git commit` containing AI-attribution patterns — it's a safety net, not the primary
expectation. Don't write those strings in the first place.

### No em dashes
**The em dash character (`—`, U+2014) is banned from all repo content:** docs, code
comments, commit messages, PR descriptions, and generated output. Use semicolons,
commas, parentheses, colons, or separate sentences instead.
[PRD §3.8b](Docs/PRD.md#38b-writing-style-constraints)

### Working conventions
- **Where new cards go:** `src/cards/<card-id>/` — one folder per card, exporting a
  `CardDefinition` from `index.ts`. Auto-discovered, no registry edit needed.
- **Where new agent tools go:** `src/agent/tools/<asset-class>/`. Each tool is a
  LangChain `StructuredTool`; the card that owns the asset class lists it in its
  `agentTools` array.
- **Where new D1 migrations go:** `migrations/<NNNN>_<description>.sql`. Apply via
  `wrangler d1 migrations apply osooly`.
- **Where new data-source adapters go:** `src/adapters/<asset-class>/<provider>.ts`.
  One file per provider; cards depend on the adapter interface, not the concrete
  provider — see [PRD §3.5a rule 4](Docs/PRD.md#35a-free-tier-operational-constraints).
- **Where n8n workflows live:** `n8n/workflows/` as exported JSON, one file per
  workflow.
- **What never to touch without explicit user permission:**
  `Docs/Liquid Glass-Portfolio Design System/` (read-only reference) and
  `Namtheg/AutoML/` (sibling project; port work happens in the Osooly backend folders
  per [PRD §3.7](Docs/PRD.md#37-namtheg-tab--integration-approach)).
- **When to ask vs. when to proceed:** ask before changing the card contract, adding a
  new data provider, changing the tech stack, or touching anything in §8 of the design
  system. Proceed without asking for routine implementation work that fits the PRD.

---

## 5. Related projects

- **Namtheg AutoML** — sibling product, **ported** into Osooly in S8 per
  [PRD §3.7](Docs/PRD.md#37-namtheg-tab--integration-approach): pipeline in
  [`sidecar/`](sidecar/), surface at `/namtheg`. Upstream source (read-only
  reference): [`Namtheg/AutoML/`](Namtheg/AutoML/) ·
  GitHub: https://github.com/khaliddosari/AutoML · Live:
  https://namtheg.onrender.com
- **Liquid Glass design system** — visual source of truth.
  [`Docs/Liquid Glass-Portfolio Design System/`](Docs/Liquid Glass-Portfolio Design System/)
- **Khalid Al Dosari portfolio** — origin of the Liquid Glass design system; private
  repo at `github.com/khaliddosari/portfolio`.
