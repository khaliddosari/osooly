# CLAUDE.md

Working notes for Claude (and any AI agent) inside the Osooly repo. This file is the
**playbook**; [`AGENTS.md`](AGENTS.md) is the in-repo map; [`Docs/PRD.md`](Docs/PRD.md)
is the **source of truth**.

---

## Order of priority

1. **`Docs/PRD.md`** — the binding spec. Code, AGENTS.md, and this file all defer to it.
2. **`AGENTS.md`** — the operational summary. If it disagrees with the PRD, the PRD
   wins; fix AGENTS.md.
3. **`Docs/Liquid Glass-Portfolio Design System/`** — visual source of truth. The hard
   rules in §8 of its README are non-negotiable unless a PRD change explicitly
   overrides them.
4. This file — process notes about how to *use* the above.

---

## Keeping AGENTS.md current

A `Stop` hook in [`.claude/settings.json`](.claude/settings.json) marks AGENTS.md as
potentially stale at the end of every session by writing a marker file at
`.claude/agents-md-dirty`. A `UserPromptSubmit` hook at the start of the next session
checks for that marker and, if present, injects a system reminder telling Claude to run
this playbook:

### Refresh playbook
When the dirty marker is present **or** when you've made a substantive product /
design / contract change in the current session:

1. **Re-derive the Context block** of AGENTS.md from:
   - the latest commit message (`git log -1 --pretty=%B`)
   - the current `Docs/PRD.md` §3.1 (Product overview)
   - any new top-level folder added since the previous AGENTS.md commit
2. **Re-derive the Related projects block** from the actual state of sibling folders
   (does `Namtheg/AutoML/` still exist? Did a new sibling appear?) plus the
   `https://...` URLs already canonicalised in PRD §3.7 and PRD's Appendix.
3. **Leave Requirements / Design / Guidelines alone** unless the change you just made
   actually invalidates them. Drift in those blocks is the most common source of churn
   — if the bullets still match the PRD sections they link to, don't touch them.
4. **Stage the AGENTS.md edit in the same commit** as the change that triggered it.
5. **Delete the marker** so the reminder doesn't re-fire next session:
   `Remove-Item .claude\agents-md-dirty -ErrorAction SilentlyContinue`

### When *not* to refresh
- The dirty marker was created by a session that only ran read-only operations. Check
  `git diff HEAD` first — if nothing changed, just delete the marker and move on.
- The session touched only docs (typos, link fixes) that don't affect what AGENTS.md
  claims about the repo. Delete the marker.

---

## PRD-first rule (mirrors AGENTS.md §4)

**Before you change any of:**

- product scope (what Osooly does / for whom)
- the card developer contract or layout solver
- the data-source list (PRD §3.5 / §3.5a)
- the tech stack (PRD §3.8)
- the notification flow (PRD §3.8a)
- the Namtheg integration approach (PRD §3.7)

**…update `Docs/PRD.md` first.** Then write the code to match. If the user asks for a
change that contradicts the PRD, ask whether the PRD should be updated — don't silently
diverge.

---

## What's intentionally absent

- **No CLAUDE.md "do this when you start a session" preamble.** Read AGENTS.md and the
  PRD; that's enough.
- **No restated design rules.** They live in the Liquid Glass README. Linking is
  better than mirroring — mirrors drift.
- **No CI/test instructions yet.** v1 code doesn't exist; this file will grow a
  "Running / testing" section the first time we ship runnable code.
