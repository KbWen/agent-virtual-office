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

### [office-runtime][2026-06-11][main]
source_review: docs/reviews/2026-06-11-tech-debt-audit.md
cross_ref: docs/architecture/monolith-extraction-map.md, docs/architecture/silent-catch-policy.md

- [DECISION] High-line-count runtime/rendering files are NOT refactor targets by themselves. Use `docs/architecture/monolith-extraction-map.md` before extracting any seam, and start with pure helpers plus existing tests.
- [CONSTRAINT] First extraction PR for any seam must be behavior-preserving and reversible as one commit; no visual/layout behavior changes are allowed in the extraction-only step.
- [CONSTRAINT] Silent catches must be classified as `expected-no-op`, `best-effort-dev-observable`, or `production-observable`. New bare `catch {}` additions must include a nearby comment naming the class or a test proving harmless degradation.
- [DECISION] The user-reported full-office crop regression exposed a render-smoke blind spot: descendant count is not enough. `scripts/render-smoke.mjs` now checks a viewport matrix and visible top/bottom scene anchors.

### [office-runtime][2026-07-31][codex/chore-upgrade-agentic-os-v1.8.17]
source_spec: docs/specs/avo-187-temporal-doorway-claim.md
source_sha: 018ef1ef2225c4ebb53cf9aee05c3eae1bb5e1b2

- [DECISION] Use physical-door IDs, not direction or side, because both directions share one opening.
- [DECISION] Atomically reserve every door in the complete route before movement; all-or-none removes partial ownership and multi-door deadlock without a traffic graph.
- [DECISION] Preserve FIFO position across retries and fence ownership by `journeyId`, so contention is deterministic and stale callbacks cannot release a newer journey.
- [CONSTRAINT] Timeout recovery must abort the owner at rendered truth before release; clock expiry alone can never transfer a live claim.
- [CONSTRAINT] StrictMode/live teardown is not removal and cannot release door ownership.
- [TRADEOFF] Full-route claims reduce throughput versus next-door claims; accept this bounded cost for the first version and reopen only with measured wait or owner game-feel evidence.

### [office-runtime][2026-09-19][fix/review-2026-09-19]
cross-ref: See [ui-rendering][2026-09-19][fix/review-2026-09-19] in docs/architecture/ui-rendering.log.md

### [office-runtime][2026-09-27][fix/client-runtime-hygiene]
source_spec: docs/specs/client-runtime-hygiene.md
source_sha: 18943427e31be39bba1e24c5ac6350ec8a5b7c47

- [DECISION] Refresh the client's existing 120s staleness timer on a confirmed-unchanged (304) poll response, rather than raising `STALENESS_TIMEOUT` itself — channels with no heartbeat backstop (hash-bridge, postMessage-only) keep their original fast-clear behavior; only channels that can actively confirm liveness get the extension.
- [DECISION] Gate SSE-sourced failure probes behind the GET-polling channel's own last-known health (`pollProbeOk`), rather than resetting the poller to base cadence at retry-start — isolates the fix to the health SIGNAL and avoids perturbing the poller's own adaptive-backoff state, which the fast-poll-continuity fix (R1) already depends on staying untouched across a retry attempt.
- [TRADEOFF] Did not unify the 3 dynamic-agent-eviction call sites (`applyExternalStatus`, `abortAgentMovement`, `clearExternalStatus`) into one shared prune helper beyond the local `pruneEvictedId` added for AC6 — smaller, safer diff now; leaves latent duplication risk if a 4th removal path is added later without copying the same three cleanup calls.
- [CONSTRAINT] Every fix must be independently `git revert`-able — no schema/migration change, no new persisted-data shape, no new external API surface.

### [office-runtime][2026-09-27][fix/honest-office-events]
source_spec: docs/specs/honest-office-events.md
source_sha: 8a9ab5d46615270dcafda3d759aedd8298e26182

- [DECISION] `hasRequiredActors()` is a symmetric pre-fire refusal alongside the existing empty-cast
  refusal (AVO-191) rather than a change to `pickParticipants` itself — it targets exactly the
  "non-empty but missing a specific actor" gap without touching the participant-selection logic
  Protected Surfaces guard.
- [DECISION] `idleGapInfer.js` carries the agent's own prior `externalStatus` fields forward via a
  new `inferredUpdate()` helper rather than changing `buildExtEntry`'s general carry-field loop —
  the corruption is specific to the caller sending a partial payload, not to `buildExtEntry`'s
  contract.
- [DECISION] `store.js`'s `applyExternalStatus` releases `inGroupEvent`/`groupTarget` on ANY real
  busy status (working/blocked/awaiting-approval/thinking), not only the exact status the
  participant was picked for — becoming busy in a DIFFERENT way is just as dishonest to keep
  grouped.
- [TRADEOFF] Deferred handler steps that establish a first-time lock re-verify `isAgentAvailable`
  synchronously against the CURRENT store state when the deferred `setTimeout` fires, rather than
  re-running the original cast-selection algorithm — cheaper and sufficient, since the only failure
  mode is "went busy since being cast," not "should now be re-shuffled." Similarly, the mid-event
  abandonment auto-clear (round 2, finding #4) lives in `startOfficeLife`'s existing
  `store.subscribe` callback (co-located with the other reactive/seeded checks) rather than as a
  new dedicated subscription, gated on the round-3 epoch state
  (`liveEventEpoch`/`liveEventHadParticipant`) to avoid a false-positive clear during a staggered
  handler's pre-first-lock window.
- [DECISION] evaluated tightening `deploy-success`/`ops-dev-deploy-check` eligibility to require live
  `status === 'done'`; declined — `done` is a 10s-transient status by design, so the change would
  make the gate almost never open, and conflicts with a currently-shipped test contract. See
  Non-goals for the residual window and the `doneAt` follow-up candidate.
- [TRADEOFF] `fireInteractionReaction`'s fix (finding #5) prefers silence over building a new
  machine-side BUSY badge — the badge is a UI feature addition (Design Gate), out of this
  state-honesty fix's scope. See Non-goals.
- [DECISION] (round 3, N1/N2) a shared, module-level monotonic epoch counter — not a per-event
  object clone or a WeakMap keyed on the catalog object — because `triggerInteractiveEvent` and
  `fireWithCast` are independent entry points that must agree on ONE "what's live right now"
  answer, and the catalog objects (`EVENT_BY_ID`) are intentionally reused across fires. A stale
  epoch makes `endEventEpochIfLive`/every deferred step a FULL no-op — it does not even release its
  own captured `participants` — because an agent released early from event A may since have been
  picked up by event B, and touching it would clobber B. (Round 5, G1) `fireWithCast` itself — not
  the epoch counter/state, which stays module-private — is now exported so the mutex is directly
  unit-testable rather than only provable by tracing every call site — matching the existing
  "exported for tests" precedent already set by `isAgentAvailable`/`eventEligible`/`floorTickAllowed`.
- [DECISION] (round 4, F1) the event mutex lives as a single fresh `store.getState().activeEvent`
  check inside `fireWithCast` itself, not as an extra check at each of its ~6 call sites — every
  call site already believed it had this guarantee (the module's own prior comments assumed it),
  so the bug was that the guarantee didn't actually exist yet, not that call sites were missing a
  check they should each own individually.
- [DECISION] (round 5, G2) Friday 15:00 hands its slot to `group-meeting` instead of firing both
  or dropping either — the orchestrator's call, not re-litigated here. Implemented as a mutually
  exclusive day-branch rather than a priority/ordering tweak inside one shared `if`, so the two
  events' conditions are independently readable and the exclusivity is structural, not incidental
  ordering that a future edit could quietly undo.
- [TRADEOFF] (round 5, F3) the crew-reaction bubble-clear check keeps comparing TEXT and adds a
  per-paint token alongside it, rather than switching to token-only or embedding a hidden marker
  in the rendered string — the text check is the only part of this mechanism with visibility into
  a fully external bubble overwrite (a real hook event, or a different call path), which a
  local-only token map cannot see; an embedded marker risks the bubble-width-fitting measurement
  code (canvas `measureText`) that a prior session hardened for exactly this class of string.
- [DECISION] (ship-time correction) `primary_domain` in `docs/specs/honest-office-events.md` was
  `frontend` at creation (inherited from parent `living-office-events.md`); corrected to
  `office-runtime` before this consolidation — orchestrator-confirmed, matching every comparable
  prior spec touching these same files (`client-runtime-hygiene`, `avo-187-temporal-doorway-claim`,
  `blocked-reason-tags`, `standing-overlap-deconfliction`).
