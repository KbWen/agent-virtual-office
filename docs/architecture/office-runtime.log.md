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

### [office-runtime][2026-06-08][feat/blocked-reason-tags]
source_spec: docs/specs/blocked-reason-tags.md
source_sha: d07cf37

- [DECISION] `reasonCode` is derived + stamped at the hook (single source of truth) gated on the explicit `is_error===true` boolean; `classifyBlockedReason` is a pure render-side table lookup. Rejected re-deriving on the render side from `ext.label` — a second classifier drifts.
- [DECISION] `classifyStatus` is untouched; reason is a NEW orthogonal axis. Keeps the 90+ existing classifier tests green and status/reason concerns separable.
- [CONSTRAINT] A specific reason renders ONLY for single-segment commands (no `&&`/`||`/`;`/`|`/newline/`&`) matching a tight `^`-anchored allowlist, with explicit `is_error===true`, AND no launch-failure first-line. Any other case → `blocked-unknown`. This is the honesty firewall against wrong-segment attribution AND launch-vs-run over-claim.
- [CONSTRAINT] Labels claim only what the signal proves ("blocked on the test run", not "test failed"); the `blocked-unknown` glyph is neutral uncertainty, never a red failure mark.
- [DECISION] The badge is a PER-AGENT over-head element overriding the BehaviorIndicator glyph while blocked; the singleton OfficePet (already hides on blockers) is a separate surface and is untouched.
- [CONSTRAINT] The `reasonCode` field MUST survive the full path — hook `newAgents` literal + hook merge-read carry-forward + transport `u` payload (sanitizeAgent + routeExternalAgents) + the POST `/api/status` ingest (`normalizePost.js` + `server.mjs` mirror) + store `ext` rebuild = FIVE whitelists. Review caught the POST hop (4th/5th) as a silent drop; any future agent-record normalizer MUST carry it or the feature renders nothing while unit tests pass trivially.
- [TRADEOFF] MVP under-specifies (the harness wraps `cd "<dir>" && <cmd>`; the glue-strip handles the common shape, but compound commands → `blocked-unknown`) in exchange for zero false-positive specific tags. permission/auth/rate-limit deferred to Phase-2 (need a structured errno/HTTP-status field; substring regex over free-text is fabrication). A false negative preserves honesty; a false positive breaks it.

### [office-runtime][2026-06-08][feat/recurring-failure-detection]
source_spec: docs/specs/recurring-failure-detection.md
source_sha: 47724e9

- [DECISION] Recurrence is keyed on the coarse reasonCode (the only honest observable unit); the sign claims the PATTERN ("same kind keeps failing"), never a specific bug. Rejected error-text/stack clustering — AVO-110 firewall forbids free-text fabrication.
- [CONSTRAINT] blocked-unknown is EXCLUDED from recurrence — recurring of an unknown cause is noise and over-claims. Only the 3 specific reasons accrue.
- [CONSTRAINT] Count distinct blocked EPISODES, never poll ticks. The blocked-family (blocked + idle-gap-derived awaiting-approval) is ONE continuous episode — a blocked<->awaiting-approval flap must NOT manufacture a false recurrence (review BLOCKER). Pure isNewBlockedEpisode owns the rule; mirrors desktopNotifier BLOCKED_DERIVED.
- [DECISION] State lives in the store, in-memory, not persisted (reload resets the window) — the reasonCode stream itself is non-persisted. Pure helpers in recurringFailure.js; store is the single recording point.
- [CONSTRAINT] Recurring sign is EPHEMERAL: only while currently blocked AND currently recurring; threshold >=3 within a 10-min window. A false-positive alarm is worse than silence.
- [TRADEOFF] reasonCode is coarse, so recurring means "this KIND of step keeps failing" (may bundle distinct root causes). Accepted: still a true actionable signal; honest wording prevents over-claiming. Finer signatures wait for a structured-error hook field (shared Phase-2 boundary with AVO-110).
