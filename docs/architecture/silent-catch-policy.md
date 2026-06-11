---
status: living
title: Silent Catch Policy
created: 2026-06-11
source_issue: 124
---

# Silent Catch Policy

Silent catches are allowed only when failure is expected, non-actionable, and preserving the office is more important than surfacing noise. Anything that can hide data loss, API failure, or a user-visible broken flow must be observable.

## Classification

| Class | Meaning | Action |
|---|---|---|
| `expected-no-op` | Optional capability or cleanup failed; no user action needed | Keep silent, preferably with a short comment |
| `best-effort-dev-observable` | Failure may help debugging but should not bother users | Log only in dev or through an existing diagnostic counter |
| `production-observable` | API, persistence, or rendering failure that changes user-visible behavior | Return an error response, `console.error`, or an existing status/health signal without leaking payloads |

## Current Inventory

| Area | Class | Rationale |
|---|---|---|
| `public/hooks/office-status-hook.js` lock cleanup, tmp unlink, sibling read failures | `expected-no-op` | Hook must be crash-proof; stale files self-heal through TTL/lock recovery |
| `public/hooks/office-status-hook.js` final outer failures | `best-effort-dev-observable` | Hook already emits bounded stderr via top-level handlers when a real processing error is actionable |
| `public/hooks/office-status-codex.js` atomic write fallback cleanup | `expected-no-op` | Fallback write path preserves the status payload; cleanup failure is non-actionable |
| `public/hooks/generic-llm-bridge.js` watcher/POST failures | `best-effort-dev-observable` | The bridge may run while the office server is absent; failure should not crash the watched tool |
| `server.mjs` malformed JSON handling | `production-observable` | Already returns 400 JSON instead of swallowing |
| `server.mjs` status file read/write failures | `production-observable` | Already returns 500 or safe null where the API cannot fulfill the request |
| `server.mjs` SSE client write/end cleanup | `expected-no-op` | Broken clients are removed; no user-facing work is lost |
| `src/systems/store.js` localStorage reads/writes | `expected-no-op` | Browser privacy/quota failures should not break the office; defaults preserve usability |
| `src/inference/*` optional browser APIs (`Notification`, `BroadcastChannel`, `window.focus`) | `expected-no-op` | These APIs are capability-dependent and already degrade gracefully |
| `src/components/AgentCharacter.jsx` scheduler catch | `production-observable` | Component-level scheduler errors must keep using `console.error` so rendering bugs are visible |
| `src/server/scanSessions.mjs` unreadable/foreign files | `expected-no-op` | Scanning must tolerate unrelated files and permissions while filtering by `_cwd` |

## New Catch Checklist

- Can this catch hide a failed API request? If yes, it is `production-observable`.
- Can this catch hide loss of the only copy of a status/event payload? If yes, it is `production-observable`.
- Is this cleanup after a successful primary path? If yes, it may be `expected-no-op`.
- Is this an optional browser/platform capability? If yes, it may be `expected-no-op`.
- Does logging risk leaking prompts, commands, paths, tokens, or status payloads? If yes, log only sanitized metadata.

## Review Gate

Any PR adding a new bare `catch {}` must either add a nearby comment naming the class above or link to a test that proves the failure path is harmless.
