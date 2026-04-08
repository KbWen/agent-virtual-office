# Office Runtime Decision Log

### [office-runtime][2026-04-08][main]
source_spec: docs/specs/codex-status-parity-and-done-count.md
source_sha: 21ab91955c1d10f8e82d3cd514c4878af7523f07

- [DECISION] Codex integration must reuse the existing normalized `office-status` contract so UI rendering remains source-agnostic.
- [DECISION] Claude's file-hook route remains the reference behavior; Codex parity work extends that model instead of replacing it.
- [DECISION] `today done` must come from a durable same-day counter or equivalent normalized-event-derived source, not solely from the capped recent activity feed.
- [TRADEOFF] Passive heuristics like title watching may remain as fallback signals, but they are not trusted as the primary Codex integration path because they are too lossy.
- [CONSTRAINT] Existing Claude and manual `POST /api/status` flows must keep working through the migration.
- [CONSTRAINT] Codex App parity can only be claimed with real evidence from the running platform or an explicit documented limitation.
