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

### [office-runtime][2026-06-05][main (merged via PR #44)]
source_spec: docs/specs/living-office-events.md, docs/specs/ux-vibe-rebalance.md, docs/specs/subagent-helper-huddle.md
cross_ref: docs/architecture/ui-rendering.log.md, docs/architecture/hook-integration.log.md, .agentcortex/context/current_state.md (Ship History feat-ux-vibe-rebalance-2026-06-03..06-05)
note: Routed from Ship History per audit routing_actions (docs/reviews/2026-06-05-audit.md). These decisions are MERGED to main via squash PR #44 (012d0f2, "UX Vibe Rebalance wave (v1.2.0)") — git-verified: main↔feat src/ byte-identical, main 3 commits ahead. See [MERGE STATE] below.

- [CONSTRAINT] **Honesty rule (R1)** — the office reflects REAL work; it never fakes status. A tracked agent (one with a live external status) is never modulated by derived theater: `teamPulse` (room "leans in" with real-signal density) and `focusAnchor` (idle agents orient toward the live desk via `setAgentFacing`) are UNTRACKED-only, derived in `moodEngine.updateStoreMood`.
- [CONSTRAINT] **Honesty gating (R2)** — work-claim events (deploy-success / ops-dev-deploy-check / dev-arch-disagree / eureka / review-debate) fire ONLY when a matching real signal occurred within `WORK_CLAIM_SIGNAL_WINDOW` (90s). Random floor cadence is scaled-not-muted when live (`floorTickAllowed`). New set-pieces that imply real work MUST register a real-signal gate.
- [DECISION] The reluctant-participant tell (`store.reluctant`) is a PURE OVERLAY: it never touches status / behavior / bubble / position, and a real bubble preempts it. This is the canonical pattern for any "sub-dominant" tell — keep set-piece decoration off the live channels (cross-ref ui-rendering AC-3).
- [DECISION] **Causal real→event link** — a real-signal EDGE (mood→smooth/frustrated, Ops→done, SubagentStart) immediately fires the matching honesty-gated event, mutex'd with a 120s per-event cooldown. This closes the owner critique "沒有驅動任何一件事情" — events are caused by real work, not just permitted by it.
- [CONSTRAINT] **Side-effects gate on change, not on poll** — the bug CLASS behind "every character suddenly speaks / refresh feeling / false rushing": speech-bubble, activity-feed push, and the moodEngine feed (`changedUpdates`) now all fire only on a real status/task signature change, never per poll tick. Any new per-agent reactive side effect MUST gate on a real change.
- [DECISION] **Group-event deconfliction at the store chokepoint** — `setMultipleAgentGroupEvents` / `setAgentGroupEvent` run every `groupTarget` through `clampToFloor` + `avoidOverlap` (push ≥ `MIN_AGENT_DIST`). Root cause of the "4 piled, one disappeared" bug: gather targets wrote the SAME cell with no inter-agent separation, so the y-ordered opaque SVG sprite on top fully occluded the others. One fix covers ALL group events; never bypass it by writing `groupTarget`/`position` directly elsewhere. Guarded by `tests/agentSeparationInvariants.test.js`.
- [TRADEOFF] Agent-vs-agent separation is enforced for GATHER targets but NOT yet for sustained free movement (in-transit agents still pass through each other — AVO-144, deferred). The visible pile-up/disappear is fixed; transient pass-through is lower-severity.
- [CONSTRAINT] **Test reality** — every prior movement test checked agent-vs-MAP only; none checked agent-vs-AGENT, which is why the suite stayed green while sprites stacked. New movement/gather work MUST add agent-vs-agent invariants. Behavioral correctness is test-authoritative; pixel dominance is owner-confirm only.
- [MERGE STATE] All decisions in this entry are MERGED to `main` via squash PR #44 (`012d0f2`, "UX Vibe Rebalance wave (v1.2.0)"). Git-verified: `main`↔`feat/ux-vibe-rebalance` `src/` is byte-identical, and `main` is 3 commits AHEAD (also carries PR #53 README/hero refresh + #54 hook fix). The `feat/ux-vibe-rebalance` branch is superseded un-squashed dev history (60 commits, zero `src/` divergence) and has already been DELETED from origin (as of 2026-06-05 the remote has only `main`; stale local remote-tracking refs were pruned). It was never unmerged product state. `main` is the canonical, current baseline. (The "not merged" framing in the kept SSoT Ship History `feat-ux-vibe-rebalance-*` cycles predates PR #44 and is stale — see the SSoT reconciliation note.)
