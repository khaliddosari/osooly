# Namtheg sidecar

The Namtheg AutoML pipeline (PRD 3.7), ported from `Namtheg/AutoML/Backend`
into an Osooly-native FastAPI service:

- **Storage:** run state + results live in Osooly's **D1** (tables from
  `migrations/0003_namtheg_runs.sql`), replacing Namtheg's file-based
  `storage.py`. Bulky binaries (dataset, engineered CSV, model bundle) stay
  on this service's scratch disk under `storage/`.
- **Auth:** the NextAuth **session bridge** (`app/auth_bridge.py`) validates
  the browser's session cookie against the shared D1 `sessions` table; no
  second login. Agents authenticate with `NAMTHEG_INTERNAL_TOKEN` +
  `X-Osooly-User-Id`.
- **Inference:** predictions are served in process from the trained bundle
  (`POST /runs/{id}/predict`); Namtheg's Modal deployment step was dropped.

## Run locally

```
cd sidecar
python -m venv .venv
.venv\Scripts\activate          # Windows (source .venv/bin/activate elsewhere)
pip install -r requirements.txt
copy .env.example .env           # then fill in what you need
uvicorn app.main:app --reload --port 8000
```

Prereqs: run `npx wrangler d1 migrations apply osooly --local` in the repo
root first (the sidecar auto-discovers wrangler's local SQLite file), and set
`NAMTHEG_SIDECAR_URL="http://localhost:8000"` in the root `.dev.vars` so the
Next.js proxy can find the service.

The Next.js app consumes this service through `app/api/namtheg/[...path]`;
nothing in the browser talks to port 8000 directly.
