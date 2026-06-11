# scripts/git-hooks

Tracked git hooks for this repo. They run when git's `core.hooksPath` is pointed here.

## One-time setup (per clone)

```bash
git config core.hooksPath scripts/git-hooks
```

That command is per-repo and lives in `.git/config`, which is **not** tracked — so every
collaborator must run it once after cloning. This is intentional: a tracked hook directory
that git silently auto-activates would be a supply-chain risk.

## Hooks

| Hook | Purpose |
|---|---|
| `commit-msg` | Refuses any commit whose message contains AI-attribution patterns (`Co-Authored-By: Claude`, `Generated with Claude Code`, 🤖 sign-offs, etc.). Mirrors [`scripts/block-ai-attribution.ps1`](../block-ai-attribution.ps1), which enforces the same rule at the Claude Code PreToolUse layer. See [CLAUDE.md](../../CLAUDE.md) "No AI attribution — anywhere, ever" and [AGENTS.md](../../AGENTS.md) §4. |

## Windows note

Git for Windows ships its own bash; bash hooks (`#!/usr/bin/env bash`) work natively
without any PowerShell shim. Don't add `.ps1` variants here — git only invokes the
exact hook name (`commit-msg`, `pre-commit`, etc.) and won't pick up a `.ps1`.

## Why two layers (Claude PreToolUse + this git hook)?

- **`.claude/settings.json` → `scripts/block-ai-attribution.ps1`** catches AI attribution
  *before* `git commit` is invoked, when the actor is Claude Code. Fast feedback for the
  agent; nothing reaches git.
- **`scripts/git-hooks/commit-msg`** catches AI attribution *during* `git commit`,
  regardless of who or what invoked it (Claude, another agent, a human paste, an IDE
  template). Last line of defense.

Either layer alone would close the common path; together they cover both the agent
case and the universal case.
