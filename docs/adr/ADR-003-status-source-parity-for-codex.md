# ADR-003 — Status Source Parity for Codex

**Status:** Accepted
**Date:** 2026-04-08
**Branch:** `main`

---

## Context

Agent Virtual Office already has a complete real-time status path for Claude Code: the hook writes branch-scoped files under `~/.claude/office-status-{slug}.json`, and the app polls `/api/status` to merge and render those updates.

Codex surfaces are only partially integrated today:

- `codex-app` is detected as a platform in the UI layer
- `codex-cli` is mentioned in the README as a `curl POST /api/status` route
- there is no first-class Codex event producer in the repository that mirrors the Claude hook behavior

As a result, Claude CLI / Desktop update character state live, while Codex App appears idle unless status is injected manually.

At the same time, Inspector's `today done` value currently depends on a capped, transient activity log, so it can drift from the user's real same-day completion count.

---

## Decision

### 1. Unify runtime status inputs behind one canonical contract

All platforms must feed the same normalized `office-status` contract that `inferStatus` already understands:

- `agents[]`
- `workflow`
- optional `mood`
- sequencing / freshness metadata

No platform-specific rendering path will be introduced in the UI.

### 2. Keep Claude's file-hook path as the reference implementation

The existing Claude hook + `/api/status` polling flow remains the baseline source path. Codex support must achieve parity with this path rather than replacing it.

### 3. Add first-class Codex input routes instead of relying on passive platform detection

Platform detection alone is not sufficient. Codex integration must provide explicit event emission paths:

- **Codex CLI**: a supported producer that writes or POSTs normalized status updates during task execution
- **Codex App**: a supported bridge that emits normalized status updates from the embedded/runtime environment when tool activity changes

Passive heuristics such as title watching or URL hashes may remain as fallback signals, but they are not considered sufficient for primary Codex integration.

### 4. Track durable same-day completion counts separately from the capped activity feed

`today done` must not be derived solely from the 50-entry transient `activityLog`. A dedicated same-day completion counter or equivalent durable client-visible source is required so Inspector reflects the user's actual workday progress.

### 5. Preserve backward compatibility for existing Claude / Gemini flows

Any Codex parity work must keep these existing integration paths working:

- Claude hook file writes
- manual `POST /api/status`
- one-shot `POST /api/event`
- browser `postMessage` / `BroadcastChannel`

---

## Alternatives Considered

| Option | Rejected reason |
|--------|-----------------|
| Leave Codex on passive heuristics only | Too unreliable; explains current "idle" behavior and gives poor parity with Claude |
| Fork separate Codex-specific UI state | Increases maintenance cost and diverges from the existing normalized contract |
| Fix only Inspector counting and defer Codex integration | Does not address the user-reported product failure that Codex appears inactive |
| Replace Claude file hooks with a new universal backend | Overly invasive for the current scope and unnecessary because the existing status contract already works |

---

## Consequences

- **Pro:** Codex App / CLI can become first-class real-time sources instead of second-class detected platforms.
- **Pro:** Inspector metrics become trustworthy enough to act as a progress surface, not just a visual hint.
- **Pro:** Existing UI logic can stay mostly unchanged because the normalized status contract remains the same.
- **Con:** Integration work will touch multiple modules and may require platform-specific bridge glue outside the current inspector scope.
- **Con:** We need explicit evidence for both Codex App and Codex CLI paths, not just unit tests.
