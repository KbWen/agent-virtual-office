---
status: shipped
title: Codex Status Parity And Done Count
source: internal
created: 2026-04-08
primary_domain: office-runtime
secondary_domains:
  - ui-rendering
  - hook-integration
---

# Codex Status Parity And Done Count

## Goal

Make Agent Virtual Office treat Codex as a first-class real-time runtime, while also making Inspector's `today done` metric reflect durable same-day progress instead of a best-effort recent-activity estimate.

## Acceptance Criteria

- AC1: Inspector `today done` is derived from a same-day completion source that remains accurate even when the transient activity feed is capped or the browser session is refreshed.
- AC2: The app preserves existing Claude CLI / Claude Desktop real-time updates without regression.
- AC3: Codex CLI has a documented and working real-time status producer path that feeds the same normalized `office-status` contract consumed by the app.
- AC4: Codex App has a documented and working real-time status producer path or bridge that feeds the same normalized `office-status` contract consumed by the app.
- AC5: The runtime can distinguish which external source is driving updates, and stale Codex updates expire or clear using the same safety rules as existing external status updates.
- AC6: Live verification evidence exists for:
  - Claude path still updating correctly
  - Codex CLI path updating correctly
  - Codex App path updating correctly or a clearly documented environment limitation if the platform cannot emit the needed events
- AC7: Inspector still renders status badge, behavior, task label, and recent activity without layout regressions after the count source changes.

## Non-goals

- Do not redesign the entire office rendering or role animation system.
- Do not replace the normalized `office-status` message format with a new incompatible protocol.
- Do not remove the existing Claude hook flow.
- Do not turn the app into a persistent backend service just to support Codex.

## Constraints

- The changed design must remain compatible with the existing `/api/status`, `/api/event`, `postMessage`, and `BroadcastChannel` inputs.
- The solution must be small and reversible at each step; if a Codex route fails, Claude/Gemini integrations must still work.
- If Codex App cannot expose live tool events from its runtime, the repo must document the limitation explicitly and provide the strongest supported bridge instead of pretending parity exists.
- The implementation must produce user-visible evidence, not only unit tests.

## API / Data Contract

- Canonical runtime payload remains:
  - `type: 'office-status'`
  - `agents[]`
  - `workflow`
  - optional `mood`
  - freshness metadata such as `_seq`
- A durable same-day completion source may be added to client state, but it must remain derivable from normalized status events and not require a new external API.
- Any new Codex bridge must emit normalized status messages rather than invent a parallel Codex-only schema.

## File Relationship

EXTENDS `docs/specs/agent-inspector-info-enhancement.md`

## Domain Decisions

- [DECISION] Codex integration must reuse the existing normalized `office-status` contract so UI rendering remains source-agnostic.
- [DECISION] Claude's file-hook route remains the reference behavior; Codex parity work extends that model instead of replacing it.
- [DECISION] `today done` must come from a durable same-day counter or equivalent normalized-event-derived source, not solely from the capped recent activity feed.
- [TRADEOFF] Passive heuristics like title watching may remain as fallback signals, but they are not trusted as the primary Codex integration path because they are too lossy.
- [CONSTRAINT] Existing Claude and manual `POST /api/status` flows must keep working through the migration.
- [CONSTRAINT] Codex App parity can only be claimed with real evidence from the running platform or an explicit documented limitation.
