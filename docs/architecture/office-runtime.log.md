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

### [office-runtime][2026-05-29][main]
source_spec: docs/specs/perf-metrics-chip.md, docs/specs/classifier-foundation.md, docs/specs/classifier-wiring.md, docs/specs/idle-gap-inference.md
source_sha: 0ea5bdfb82b5c7a7c0c1b1e6aa20c4e16966efcf (v1.1.0 wave merged)

- [DECISION] Behavior selection is owned by a single resolver `decideBehavior({task, role, status, workflow})` with strict priority `status > workflow > role > family-default`. Old explicit `STATUS_BEHAVIOR_MAP[u.status].behavior[u.task]` lookups are kept as Tier 0 overrides so Bash/Read/Grep/Glob remain byte-identical.
- [DECISION] Mood is a single read in PixelOffice (`useOfficeStore((s) => s.mood)`) and feeds `moodToWeather` via `classifyMood(mood).family`. The mood-to-weather mapping lives in `classify.js` not in the view layer so the contract is testable in isolation.
- [DECISION] `dailyDoneLedger` and `dailyBlockedLedger` reset atomically. `dayChanged` ORs each ledger's staleness check rather than reading only the done ledger — caught a latent drift bug where a manually-mutated blocked ledger could silently accumulate to a stale day.
- [DECISION] Idle-gap inference routes through the same `applyExternalStatus` as real hook events with `meta.source: 'idle-gap-infer'`. Reversibility is by construction — a real event simply overwrites the inferred status, no flag-tracking needed.
- [TRADEOFF] Inference thresholds (45s working → thinking, 90s blocked → awaiting-approval) are deliberately higher than Pixel Agents' equivalent heuristics. The cost is a 45s lag before the office reflects extended thinking; the benefit is no false-positive on a 30-60s `npm test`.
- [TRADEOFF] `pushEventBatch([])` is now a strict no-op (`if (added > 0)`). The two existing moodEngine tests that relied on the empty-batch recompute hack were updated; the new contract is defensive but breaks a debugging idiom.
- [CONSTRAINT] The classifier output shape `{tier, family, severity, visualLabel, a11yLabel, raw}` is part of the public contract. New tier values must not collide with the existing 0/3/4/5 numbering. New family values must extend `FAMILIES`, not invent strings.
- [CONSTRAINT] Production bundles must contain zero `@keyframes` strings in the JS bundle. The weather rules live in `src/index.css`; future animation work follows the same path.
