---
status: shipped
title: AVO-151 — npm-pack install smoke (protect the npx-published artifact)
created: 2026-06-10
last_updated: 2026-06-10
---

# AVO-151 — npm-pack Install Smoke

## Problem

Users consume this project as `npx agent-virtual-office` from the npm tarball — a DIFFERENT
artifact than the git checkout CI tests: the `files` whitelist decides what ships (no `dist/`,
no `tests/`, no `scripts/`), `bin/cli.js` is the entrypoint, and the hook must run standalone
from inside `node_modules`. None of that is exercised by any gate today; a `files` omission or a
cli.js path bug ships silently (the project's own Global Lesson: a launcher dep-check bug
caused re-install on every launch).

## Acceptance Criteria

- **AC-1 Tracked harness** `scripts/pack-smoke.mjs`: `npm pack` the repo → create a temp dir →
  `npm init -y` + `npm install <tarball>` → then assert, all inside the temp dir:
  1. `npx agent-virtual-office setup` exits 0 AND `.claude/settings.json` registers the hook for
     ALL 8 events (PreToolUse, PostToolUse, SubagentStart, SubagentStop, UserPromptSubmit, Stop →
     verify the actual list in cli.js incl. H5's PermissionDenied + StopFailure) with a hook path
     that EXISTS on disk.
  2. Setup is idempotent: running it twice yields no duplicate entries.
  3. The installed hook runs standalone: pipe a no-op JSON event to
     `node node_modules/agent-virtual-office/public/hooks/office-status-hook.js` → exit 0,
     no stderr (zero-dep claim verified in the installed context).
  4. The Quick-Start boot path works: spawn the default dev-mode start
     (`npx agent-virtual-office --port=<free>`), poll `/api/health` until ok (≤90s budget —
     first run may npm-install dev deps per the launcher design), then GET `/` → 200 + HTML
     containing the app root. Kill the child (and any spawned subprocess tree) in finally.
  5. Exit non-zero with diagnostics on ANY failure; clean up temp dir + tarball.
- **AC-2 CI job** `pack-smoke` in ci.yml (ubuntu, Node 22): `npm ci` → `node scripts/pack-smoke.mjs`.
- **AC-3 Local** `npm run smoke:pack` works on Windows (this machine) — path/quoting safe.
- **AC-4 Test-the-test**: prove the gate catches a real packaging break — temporarily remove a
  `files` entry (e.g. `public/`) via a scratch package.json edit INSIDE the harness-run (or
  demonstrate manually once), assert the harness exits non-zero; restore. Recorded evidence.
- **AC-5 Scope**: no `src/` changes; `package.json` adds only the `smoke:pack` script.

## Non-Goals

- Publishing/registry interaction (pack only, no npm publish).
- Windows CI runner (local Windows + ubuntu CI is the coverage).

## Risks & Rollback

- Slow job (~2-4 min: tarball install + dev-deps bootstrap) — acceptable; runs in parallel with
  other jobs. Rollback: delete job + script.
