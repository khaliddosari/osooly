# n8n workflows

Version-controlled n8n workflows for Osooly. Each `.json` file in this folder is an
**exported workflow** from an n8n instance (Self-hosted or n8n Cloud).

See [PRD §3.8a — Price alerts & notifications](../../Docs/PRD.md#38a-price-alerts--notifications-n8n)
for the architecture.

---

## Folder convention

- One workflow per file, kebab-case: `osooly-alert-fanout.json`.
- Workflows are exported from n8n via **Workflow → Download** and committed as-is.
- Re-importing: **Workflows → Import from File** in the n8n UI.

## Expected workflows (v1)

| File | Triggered by | What it does |
|---|---|---|
| `osooly-alert-fanout.json` | Webhook `/webhook/osooly-alert` from the `alerts-evaluator` Cron Worker | Branches per channel (email / WhatsApp / Telegram; web-push is a placeholder), formats the message (EN/AR), and POSTs a delivery confirmation back to Osooly. |

## Contract with the Worker

The evaluator (`workers/cron/alerts-evaluator.ts`) POSTs one match per fire to
`/webhook/osooly-alert` with `Authorization: Bearer <ALERTS_WEBHOOK_TOKEN>` and a body of
`{ alertId, user, asset, predicate, channels, summary, value, currency, triggered_at }`.

After fanning out, the workflow's **Confirm Delivery** node POSTs back to the Worker's
`/alert-delivery` endpoint so Osooly records `last_fired_at`. That node reads two n8n
**environment variables** (set on the n8n instance, not in this repo):

- `OSOOLY_CALLBACK_URL` — the Worker's `…/alert-delivery` URL.
- `OSOOLY_CALLBACK_TOKEN` — must equal the Worker's `ALERTS_WEBHOOK_TOKEN`; sent as the
  callback's `Authorization: Bearer` header.

## Secrets

n8n credentials (SMTP, Twilio, Telegram bot token, etc.) live in the n8n instance's
credential store, **not** in this repo. The committed workflow references them by
placeholder ID (`REPLACE_*_CREDENTIAL_ID`); re-imports require attaching real credentials
on the target instance.
