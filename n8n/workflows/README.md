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
| `osooly-alert-fanout.json` | Webhook `/webhook/osooly-alert` from `alerts-evaluator` Cron Worker | Branches per channel (email / WhatsApp / Telegram / web-push), formats the message (EN/AR), applies user rate-limits, posts delivery confirmation back to Osooly. |

*(Folder is empty in v1 spec — workflows are authored during the v1 build phase, then
exported here.)*

## Secrets

n8n credentials (SMTP, Twilio, Telegram bot token, etc.) live in the n8n instance's
credential store — **not** in this repo. The workflow JSON references credentials by ID;
re-imports require re-attaching them on the target instance.
