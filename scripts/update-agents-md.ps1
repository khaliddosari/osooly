<#
.SYNOPSIS
  Marker-file plumbing for keeping AGENTS.md current.

.DESCRIPTION
  Two modes:

    mark-dirty        Called from the Stop hook. Writes .claude/agents-md-dirty with
                      the current commit SHA and a timestamp. Cheap — no LLM, no I/O
                      beyond a single file write. The next Claude session reads it.

    check-and-remind  Called from the UserPromptSubmit hook. If the dirty marker
                      exists, emits a JSON object that injects a system reminder
                      telling Claude to run the refresh playbook in CLAUDE.md, then
                      delete the marker.

  This script never edits AGENTS.md itself — the actual refresh is done by Claude
  in-session, where it has full context.

.PARAMETER Mode
  mark-dirty | check-and-remind

.NOTES
  Designed to be safe to run from any cwd: it resolves the repo root via `git rev-parse
  --show-toplevel` and falls back to the script's parent-parent directory.
#>

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('mark-dirty', 'check-and-remind')]
  [string]$Mode
)

$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  try {
    $root = (& git rev-parse --show-toplevel 2>$null).Trim()
    if ($LASTEXITCODE -eq 0 -and $root) { return $root }
  } catch { }
  return (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
}

$repoRoot   = Get-RepoRoot
$claudeDir  = Join-Path $repoRoot '.claude'
$markerPath = Join-Path $claudeDir 'agents-md-dirty'

switch ($Mode) {
  'mark-dirty' {
    if (-not (Test-Path $claudeDir)) {
      New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
    }

    $sha = ''
    try {
      $sha = (& git -C $repoRoot rev-parse --short HEAD 2>$null).Trim()
    } catch { }
    if (-not $sha) { $sha = 'unknown' }

    $payload = @{
      sha       = $sha
      timestamp = (Get-Date -Format 'o')
    } | ConvertTo-Json -Compress

    Set-Content -Path $markerPath -Value $payload -Encoding UTF8 -NoNewline
    exit 0
  }

  'check-and-remind' {
    if (-not (Test-Path $markerPath)) {
      exit 0
    }

    $marker = ''
    try { $marker = Get-Content -Path $markerPath -Raw -ErrorAction Stop } catch { }

    $reminder = @"
AGENTS.md may be stale — a previous session ended with the dirty marker at .claude/agents-md-dirty (contents: $marker).

Run the refresh playbook in CLAUDE.md:
  1. Re-derive the Context block of AGENTS.md from latest commit + Docs/PRD.md §3.1 + current top-level folders.
  2. Re-derive the Related projects block from the actual state of sibling folders + canonical URLs in PRD §3.7 / Appendix.
  3. Leave Requirements / Design / Guidelines alone unless the change you just made invalidates them.
  4. Stage AGENTS.md alongside the change that triggered it.
  5. Delete the marker so this reminder doesn't re-fire:
     Remove-Item .claude\agents-md-dirty -ErrorAction SilentlyContinue

If the marker was created by a read-only session (git diff HEAD is empty), just delete the marker and move on.
"@

    $output = @{
      hookSpecificOutput = @{
        hookEventName     = 'UserPromptSubmit'
        additionalContext = $reminder
      }
    } | ConvertTo-Json -Depth 5 -Compress

    Write-Output $output
    exit 0
  }
}
