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

Prerequisites: Node 22+ and npm (wrangler, miniflare, and `@cloudflare/kv-asset-handler`
all require it). Deploying also needs Docker running locally, to build the Namtheg
sidecar's container image.

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

**Status: live.** Osooly v1 is deployed and verified working end-to-end (D1, Vectorize,
the Namtheg sidecar, the cron Worker, and the app Worker all reachable; the automated
`deploy.yml` pipeline deploys all three Workers cleanly). The steps below are the
from-scratch runbook for standing up a new deployment (a second environment, a fork, a
new Cloudflare account).

The Next.js app deploys to Cloudflare Workers via the OpenNext adapter; config
lives in [`wrangler.toml`](wrangler.toml) and [`open-next.config.ts`](open-next.config.ts).
One-time setup:

```bash
npx wrangler d1 create osooly                     # paste the printed id into all three wrangler.toml files
npx wrangler d1 migrations apply osooly --remote
npx wrangler vectorize create osooly-rag --dimensions 1024 --metric cosine
# then uncomment the [ai] + [[vectorize]] blocks in wrangler.toml and workers/cron/wrangler.toml
npx wrangler secret put AUTH_SECRET               # and the rest listed in wrangler.toml
```

Every release:

```bash
npx wrangler d1 migrations apply osooly --remote  # apply new migrations first
npm run deploy                                    # OpenNext build + wrangler deploy (app Worker)
npx wrangler deploy --config workers/cron/wrangler.toml            # cron/alerts Worker
npx wrangler deploy --config workers/namtheg-sidecar/wrangler.toml # Namtheg sidecar Container Worker
```

CI runs the tests + build on every push/PR
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)); production deploys are a
manual `workflow_dispatch` ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))
so a merge never ships on its own. It needs two repo secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` scoped to **Workers Scripts: Edit**, **D1: Edit**,
  **Vectorize: Edit**, and **Cloudflare Containers: Edit** (easy to miss the last one;
  the sidecar deploy step fails with a 403 without it).

Both hosting decisions the PRD once deferred to deploy time are now resolved:

- **Namtheg sidecar** (PRD §3.7): **Cloudflare Containers**, not Render. The FastAPI
  service in [`sidecar/`](sidecar/) (needs scikit-learn / pandas, can't run on Workers)
  is fronted by [`workers/namtheg-sidecar/`](workers/namtheg-sidecar/), a Container-backed
  Worker. This requires the Cloudflare account to be on the **Workers Paid plan**
  ($5/mo base), since Containers isn't available on the free tier. `NAMTHEG_SIDECAR_URL`
  on the main app points at that Worker's deployed URL.
- **n8n** (PRD §3.8a): **n8n Cloud**, not self-hosted. Import
  [`n8n/workflows/`](n8n/workflows/) into your workspace, attach real credentials to the
  channels you want (email SMTP, Twilio for WhatsApp, a Telegram bot token), publish the
  workflow, and point the cron Worker's `ALERTS_WEBHOOK_URL` secret at its production
  webhook URL. n8n Cloud doesn't expose `$env` to workflows the way self-hosted does, so
  the **Confirm Delivery** node's URL and `Authorization` header need to be set directly
  in the node rather than via environment variables.

## Team

- **Khalid Al Dosari** — https://www.linkedin.com/in/khalid-al-dosari
- **Ahmad Alasmari** — https://www.linkedin.com/in/ahmed-alasmari-sa
