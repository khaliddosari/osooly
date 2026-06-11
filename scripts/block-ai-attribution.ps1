<#
.SYNOPSIS
  PreToolUse hook — refuses any `git commit` containing AI-attribution patterns.

.DESCRIPTION
  Wired in .claude/settings.json under hooks.PreToolUse for the Bash tool.

  Receives the standard Claude Code hook payload on stdin:
    { "tool_name": "Bash", "tool_input": { "command": "...", ... }, ... }

  If the command is a `git commit` whose message contains any of the patterns below,
  the hook emits a "deny" decision so the commit never runs. All other Bash commands
  pass through silently (exit 0, no output).

  Patterns blocked (case-insensitive):
    - Co-Authored-By: Claude / Anthropic
    - Generated with Claude Code
    - "🤖 Generated"
    - noreply@anthropic.com
    - "made with Claude" / "powered by Claude" / "authored by Claude"

  This is a safety net. The primary rule is in CLAUDE.md / AGENTS.md: never write
  AI-attribution lines in the first place.
#>

$ErrorActionPreference = 'Stop'

# Read the entire hook payload from stdin.
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }

try {
  $payload = $raw | ConvertFrom-Json
} catch {
  # Malformed payload — don't block, just exit cleanly.
  exit 0
}

if ($payload.tool_name -ne 'Bash') { exit 0 }

$command = [string]$payload.tool_input.command
if (-not $command) { exit 0 }

# Only inspect git commit invocations.
if ($command -notmatch '(?im)\bgit\s+(?:-[^ ]+\s+)*commit\b') { exit 0 }

# Patterns that constitute AI attribution.
$patterns = @(
  'co-authored-by:\s*claude',
  'co-authored-by:\s*anthropic',
  'generated\s+with\s+claude\s*code',
  'noreply@anthropic\.com',
  '🤖\s*generated',
  'made\s+with\s+claude',
  'powered\s+by\s+claude',
  'authored\s+by\s+claude',
  'claude\s+<noreply'
)

$hit = $null
foreach ($p in $patterns) {
  if ($command -imatch $p) { $hit = $p; break }
}

if ($null -eq $hit) { exit 0 }

$reason = @"
Refused: the git commit message contains an AI-attribution pattern (matched: '$hit').

This repo's policy (see CLAUDE.md "No AI attribution — anywhere, ever" and AGENTS.md §4):
never add Co-Authored-By: Claude, "Generated with Claude Code", 🤖 sign-offs, or any
equivalent line to commits, PRs, code, or docs. Rewrite the commit message without
attribution and try again.
"@

$response = @{
  hookSpecificOutput = @{
    hookEventName            = 'PreToolUse'
    permissionDecision       = 'deny'
    permissionDecisionReason = $reason
  }
} | ConvertTo-Json -Depth 5 -Compress

Write-Output $response
exit 0
