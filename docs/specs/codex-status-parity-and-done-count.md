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

## Addendum: 2026-09-26 — Codex filename namespace isolation

A post-ship audit found that `office-status-codex.js` and `office-status-hook.js` wrote the
SAME filename scheme (`office-status-<slug>.json`) with no provenance tag: a Codex write could
silently clobber the Claude hook's read-modify-write state, and the Claude hook's own branch-hop
`cleanupGhostAliases` sweep could delete a live Codex file sharing the same cwd-hash suffix and
`_cwd`. Fixed without changing the API/Data Contract above:

- Codex now writes `~/.claude/office-status-codex-<slug>.json` — its own namespace.
  `scanSessions.mjs`'s `STATUS_FILE_RE = /^office-status(-[^.]+)?\.json$/` already matches any
  suffix, so no server-side change was required (verified by reading the regex and the
  equivalent patterns in `bin/cli.js`'s uninstall sweep and `scripts/proximity-audit.mjs` /
  `scripts/zone-audit.mjs`).
- `cleanupGhostAliases` (in `office-status-hook.js`) additionally requires `source ===
  'claude-cli'` before deleting a sibling — belt-and-suspenders alongside the rename, since a
  cwd-hash collision was always theoretically possible.
- The two files' session-slug slice/strip order is now identical (slice(0,28) before stripping
  leading/trailing dashes) — they previously disagreed at the 28-char boundary.
- Old-name Codex files written before this fix age out via `scanSessions.mjs`'s existing 5-minute
  staleness window; no migration step needed.

See `docs/specs/hook-runtime-contract.md` Addendum and `.agentcortex/context/work/
fix-codex-hook-isolation.md` for the full remediation record and test evidence.
