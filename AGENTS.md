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

- **Stage:** v1 implementation in progress — S1 (scaffolding + visual shell), S2
  (NextAuth Google sign-in + the base D1 schema via Wrangler migrations), S3
  (card system primitives: CardDefinition contract, layoutSolver, dnd-kit grid,
  Customize sheet, layout persistence), and S4 (market data infra: market_snapshot
  shared cache, the four adapter families, the cron Worker in `workers/cron/`)
  shipped. S5+ (the four cards, agents) pending —
  see [`Docs/IMPLEMENTATION-STAGES.md`](Docs/IMPLEMENTATION-STAGES.md).
- **Repo layout (current):**
  - `Docs/PRD.md` — the source of truth (this file's parent doc)
  - `Docs/Liquid Glass-Portfolio Design System/` — visual source of truth
  - `Docs/IMPLEMENTATION-STAGES.md` — the 10-stage v1 slicing plan
  - `app/`, `components/`, `lib/`, `public/` — the Next.js app (S1 shell, S2 auth,
    S3 card system: `lib/cards/` + the dashboard grid / Customize sheet components)
  - `src/cards/` — card modules (one folder per card; empty until S5)
  - `src/adapters/` — data-source adapters (PRD §3.5a rule 4) + the polite fetcher
  - `workers/cron/` — the market-refresh Cron Worker (own wrangler.toml, same D1)
  - `migrations/` + `wrangler.toml` — D1 schema, applied via
    `wrangler d1 migrations apply osooly`
  - `Namtheg/AutoML/` — the sibling project being ported into Osooly (read-only)
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
  Cloudflare D1 + Vectorize + Workers + Cron / LangChain + LangGraph / DeepSeek + Groq /
  FastAPI sidecar (Namtheg) / n8n (notifications).
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

- **Namtheg AutoML** — sibling product, being **ported** into Osooly per
  [PRD §3.7](Docs/PRD.md#37-namtheg-tab--integration-approach). Surface at
  `/namtheg`. Source: [`Namtheg/AutoML/`](Namtheg/AutoML/) ·
  GitHub: https://github.com/khaliddosari/AutoML · Live:
  https://namtheg.onrender.com
- **Liquid Glass design system** — visual source of truth.
  [`Docs/Liquid Glass-Portfolio Design System/`](Docs/Liquid Glass-Portfolio Design System/)
- **Khalid Al Dosari portfolio** — origin of the Liquid Glass design system; private
  repo at `github.com/khaliddosari/portfolio`.
