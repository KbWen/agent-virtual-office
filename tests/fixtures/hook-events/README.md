# tests/fixtures/hook-events

Captured: 2026-06-10  |  Source: Claude Code hook (real session, this repo)

## Provenance

Fixtures captured from a live Claude Code session using the opt-in capture mode
(AVO-153 AC-1). The hook runs from the working tree, so every tool call during
the implementing session generates real events.

## Re-capture procedure

1. Enable marker: `touch ~/.claude/office-hook-capture`  (or PowerShell: `New-Item ~/.claude/office-hook-capture`)
2. Use Claude Code normally in this repo for a session.
3. Run: `node scripts/sanitize-hook-capture.mjs`
4. Review generated fixtures for residual sensitive strings (PRIVACY gate).
5. If clean, commit `tests/fixtures/hook-events/*.json` and `README.md`.
6. Remove marker: `rm ~/.claude/office-hook-capture`
7. Raw capture (`~/.claude/office-hook-capture.jsonl`) stays in `~/.claude` — NEVER commit it.

## Shapes captured

- `PostToolUse-Bash.json`
- `PreToolUse-Bash.json`
- `PreToolUse-Glob.json`
- `PostToolUse-Glob.json`
- `PreToolUse-Grep.json`
- `PostToolUse-Grep.json`
- `PreToolUse-Read.json`
- `PostToolUse-Read.json`
- `PreToolUse-mcp-tool.json`
- `PostToolUse-mcp-tool.json`
- `PreToolUse-Write.json`
- `PostToolUse-Write.json`
- `PreToolUse-Edit.json`
- `PostToolUse-Edit.json`

## Not yet captured (event types absent from corpus)

- `UserPromptSubmit`
- `Stop`
- `SubagentStart`
- `SubagentStop`
- `PermissionDenied`
- `StopFailure`
