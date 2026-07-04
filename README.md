# Osooly — أصولي

An agentic personal-finance assistant. Osooly keeps a unified ledger of everything you
own (stocks, real estate, automobiles, jewelry), continuously enriches each asset class
with live market data, and uses an LLM agent (DeepSeek V4 Flash via LangChain /
LangGraph, xAI Grok live X.com news search with a DeepSeek web-search fallback, RAG over
your portfolio + a market-news corpus) to recommend actions on your assets.

The product is a PC-first dashboard of user-composable cards over the
[Liquid Glass](Docs/Liquid%20Glass-Portfolio%20Design%20System/README.md) dark / frosted
aesthetic.

## Where to start

- **Product spec (source of truth):** [`Docs/PRD.md`](Docs/PRD.md)
- **Agent operational guide:** [`AGENTS.md`](AGENTS.md)
- **Working playbook for Claude:** [`CLAUDE.md`](CLAUDE.md)
- **Visual design system:** [`Docs/Liquid Glass-Portfolio Design System/`](Docs/Liquid%20Glass-Portfolio%20Design%20System/)
- **Sibling project being ported in:** [`Namtheg/AutoML/`](Namtheg/AutoML/) · [github](https://github.com/khaliddosari/AutoML) · [live](https://namtheg.onrender.com)

## Running locally

Prerequisites: Node 20+ and npm.

```bash
npm install
npx wrangler d1 migrations apply osooly --local   # create/refresh the local D1 schema
npm run dev      # http://localhost:3000 -> redirects to /dashboard
npm test         # Vitest unit tests; keep green before any commit
npm run build    # production build; must stay clean before any commit
```

Secrets live in `.dev.vars` (gitignored). Copy `.dev.vars.example` to `.dev.vars`
and fill in `AUTH_SECRET` plus the Google OAuth client pair (Google sign-in needs
them; everything else runs without). `next dev` picks up the D1 binding and
`.dev.vars` automatically via `initOpenNextCloudflareForDev()` in `next.config.ts`.
Optional local extras: `DEEPSEEK_API_KEY` (agent runs), `PII_ENCRYPTION_KEY`
(column encryption; unset leaves the seam a pass-through),
`SUBSCRIPTION_CHECKOUT_URL` (enables the billing button).

The market-refresh + alerts cron Worker is a separate Wrangler project sharing the
same D1; run it per the header comment in
[`workers/cron/wrangler.toml`](workers/cron/wrangler.toml).

## Deploying

The Next.js app deploys to Cloudflare Workers via the OpenNext adapter; config
lives in [`wrangler.toml`](wrangler.toml) and [`open-next.config.ts`](open-next.config.ts).
One-time setup:

```bash
npx wrangler d1 create osooly                     # paste the printed id into both wrangler.toml files
npx wrangler vectorize create osooly-rag --dimensions 1024 --metric cosine
# then uncomment the [ai] + [[vectorize]] blocks in wrangler.toml
npx wrangler secret put AUTH_SECRET               # and the rest listed in wrangler.toml
```

Every release:

```bash
npx wrangler d1 migrations apply osooly --remote  # apply new migrations first
npm run deploy                                    # OpenNext build + wrangler deploy (app Worker)
npx wrangler deploy --config workers/cron/wrangler.toml   # cron/alerts Worker
```

CI runs the tests + build on every push/PR
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)); production deploys are a
manual `workflow_dispatch` ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))
so a merge never ships on its own. It needs the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repo secrets.

Two hosting choices the PRD defers to deploy time:

- **Namtheg sidecar** (PRD §3.7): the FastAPI service in [`sidecar/`](sidecar/) runs
  outside Workers (it needs scikit-learn / pandas). Default recommendation is
  Cloudflare Containers (one platform, same-domain reverse proxy); a small Render
  service is the cost-driven alternative. Point `NAMTHEG_SIDECAR_URL` at it.
- **n8n** (PRD §3.8a): default to n8n Cloud to skip ops, or self-host on a small VPS.
  Point the cron Worker's `ALERTS_WEBHOOK_URL` at the deployed
  `/webhook/osooly-alert` and import [`n8n/workflows/`](n8n/workflows/).

## Team

- **Khalid Al Dosari** — https://www.linkedin.com/in/khalid-al-dosari
- **Ahmad Alasmari** — https://www.linkedin.com/in/ahmed-alasmari-sa
