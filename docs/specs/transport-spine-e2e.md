---
status: draft
title: AVO-150 — Transport-spine e2e (real server, real wire)
created: 2026-06-10
last_updated: 2026-06-10
---

# AVO-150 — Transport-Spine E2E

## Problem

The API spine (server.mjs: POST `/api/status` → normalizePost.mjs → status file → GET
`/api/status` merge; POST `/api/event`) is covered only by unit tests against the modules —
no gate boots the REAL server process and drives the REAL wire. The H2 `.mjs` runtime copy and
the `_seq` single-clock fix both live exactly on that path; a server-only regression (wrong
import, route wiring, JSON shape) would pass every unit test. Complements AVO-145 (render) +
AVO-151 (package) with the third leg: the API.

## Acceptance Criteria

- **AC-1 Real-process harness** `tests/serverTransportE2E.test.js` (vitest, part of `npm test`):
  spawns `node server.mjs --port=<free> --no-open` against a TEMP status file
  (`OFFICE_STATUS_FILE` env — verify server.mjs/scanSessions honor it; if the server derives its
  status path differently, use whatever isolation mechanism it actually supports and document;
  NEVER write the developer's real `~/.claude/office-status*.json`), waits on `/api/health`,
  runs the suite, kills the process in afterAll (tree-safe).
- **AC-2 Field survival on the wire**: for EVERY field in `AGENT_CARRY_FIELDS` (imported from
  the canonical module — loop, not hand-list): POST a full-format payload carrying a synthetic
  value → GET `/api/status` → assert the value survives. Plus `reasonCode` with each of the 3
  H5 tokens (enum-validated end-to-end).
- **AC-3 Behavioral spine checks**: shorthand POST works; invalid role dropped; invalid status
  coerced to idle (#52 — on the REAL server path this time); `_seq` strictly increases across
  alternating POST `/api/status` and POST `/api/event` calls (the H2 single-clock fix, proven on
  the wire); GET after multiple POSTs returns the merged latest.
- **AC-4 Failure honesty**: malformed JSON body → 4xx (not 500/crash); the server stays alive
  (subsequent GET still 200).
- **AC-5** Runs in the existing CI test job (no new job needed — it's a vitest file); full suite
  green; total added wall-time ≤ ~15s.

## Non-Goals

- Browser/polling layer (covered by render-smoke + unit tests).
- Multi-session scanAndMerge worktree simulation (scanSessions has its own unit suite).

## Risks & Rollback

- Port/process flake on CI → free-port allocation + readiness poll + generous single timeout
  (the render-smoke pattern). Rollback: delete one test file.
