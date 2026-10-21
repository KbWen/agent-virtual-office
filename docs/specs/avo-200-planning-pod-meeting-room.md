---
title: "AVO-200 — Signal-Driven Single Planning Seat"
status: frozen
approved: 2026-10-19
created: 2026-10-19
primary_domain: office-runtime
secondary_domains: [ui-rendering]
classification: architecture-change
planning_state: implementation-ready
implementation_state: not-started
---

# AVO-200 — Signal-Driven Single Planning Seat

## Goal
Let one genuinely planning PM/Architect use an existing meeting-room seat. Make planning legible through actual walking and the existing planning glyph, without summoning colleagues or reinstating random solo meetings.

[FROM-SOURCE] Single planning agent, legal pathing, no teleport or forced group cast. [INFERRED] Existing chair (700,205) is the visual anchor, subject to the current floor/obstacle/occupancy checks. The whiteboard at (535,300) is outside the meeting room; do not move it or pretend it is in the room.

## Scope and Non-goals
Owns one global transient planning-seat lease, actual-signal eligibility, journey lifecycle and safe release. No group event, dialogue/prompt mining, fabricated relationships, new meeting furniture, generic traffic-manager refactor, per-frame separation, changes to collision dimensions or reopening random solo meeting pools. Other agents retain their behavior and position.

File Relationship: INDEPENDENT. ADR-004/005/007/008/010 remain binding. Accepted ../adr/ADR-011-signal-driven-planning-location.md defines the narrow real-signal location exception. This is architecture-change, superseding the rough quick-win estimate: it crosses source truth, global reservation and component-local rendered movement.

## Design
DSoT: ../design/office-experience-followups.md, P1-P6. Keep existing planning ring/name/gantt-chart; no new label, pulsing beacon or peer invitations. Planning glyph/location pose appears at destination only; real status remains visible during travel/wait. Owner approved the DSoT baseline and accepted ADR-011 on 2026-10-19; actual motion/captures still require visual acceptance.

## Source and Eligibility
- Only a fresh, non-inferred external entry with status exactly planning and base role pm/arch qualifies; source health must be online, not file-watcher/fallback. Resolve namespaced IDs by the existing role logic, not new string guessing.
- Manual/demo/organic/unknown/expired states, active group events, hidden/paused scene, reduced-motion and disabled flag yield no new trip. A slash command, thought text, tool name or elapsed silence is not planning evidence.
- [INFERRED] Planning must persist for 5s before requesting; ending it within 5s causes no walk. One trip per continuous planning episode; polling cannot re-arm it. After one unsuccessful journey/20s queue wait, stay at origin for that episode; no retry loop.
- Defer a request while the candidate is already moving; capture a safe stationary returnAnchor. Static roles use their existing claim-aware home; a namespaced agent uses its own stationary pre-departure slot. Never send a dynamic PM to the base PM's desk.
- Keep current owner while eligible. Otherwise choose oldest eligible planning changedAt, tie-break by agent ID. Losing candidates keep planning at their current location, not a queue at the doorway.

## Lease and Journey Contract
One store field planningPod={ownerId,episodeId,epoch,phase,returnAnchor,target,journeyId}; initial null/none, not persisted. One coordinator in src/systems/planningPod.js computes intents; store applies compare-and-set ownership atomically. Epoch/episode tokens fence all callbacks, including timers, arrivals and effect teardown.

1. None -> reserved only if the existing meeting chair and full approach are unoccupied/unclaimed and no conflicting group event is active. Reserve the seat atomically before requesting a door route; never teleport another occupant or pick a jittered substitute inside furniture.
2. AgentCharacter consumes the intent through existing calculateJourney/beginJourney, FIFO atomic full-route door claims and visualPosRef. Queued agents stay at their safe origin, isMoving=false; do not publish position/targetPosition directly.
3. Claim granted -> walking -> at-seat. Apply the planning pose only on the matching final arrival, preserving true status/ring throughout. Group-event flags/targets are not used as a shortcut. Do not add ambient meeting to behaviorEngine.
4. Planning changes: apply the new real state immediately. Cancel pending intents and abort a live journey at the rendered position using existing fenced abort semantics. Idle/working may request an ordinary claimed return to the captured safe anchor; blocked/awaiting-approval/done stay visibly in place until normal state policy permits a return. No decorative walk delays a real blocker.
5. A lease remains unavailable while its former occupant physically occupies the seat/approach. No timeout steals a live seat or door claim. Once physically clear, release only matching epoch and journey, then consider another candidate. If the owner is blocked at the seat, others continue planning at their desks.
6. Group-event takeover, source expiry, eviction, true removal, pause/visibility change and watchdog recovery all cancel or reconcile the same intent. For a new legitimate group event requiring that space, cancel the solo intent and return through ordinary routing when safe; never recruit working agents. Transient StrictMode teardown must not release live door ownership; true removal follows ADR-010.
7. Rollout flag planningPodEnabled defaults false. Feature disabled cancels pending requests, stops movement at rendered position, clears feature intent and uses ordinary safe return only when allowed. It never resets coordinates or steals doors.

## Migration and Architectural Boundary
No persisted schema or transport change. Add only transient lease/intents, with null initialization and no rehydration. Existing status ingestion still owns truth; organic behavior still owns untracked variety. The exception relocates only its own fresh planning representative; R1 remains unchanged for every other status, actor and ambient event. ADR-011 is accepted; no broad R1 relaxation. Owner also authorized limited implementation-time unfreeze of ux-vibe-rebalance.md and subagent-helper-huddle.md for shared-file alignment only, preserving existing controls/helpers and re-freezing after alignment. Those frozen files are unchanged here.

## Acceptance Criteria
| AC | Verifiable requirement |
|---|---|
| AC-1 | Only fresh real PM/arch planning qualifies after 5s; idle/tool/command/inferred/foreign roles never enter, and duplicate polls cannot re-arm. |
| AC-2 | Two planners, same-role namespaces and group/collision contention admit at most one owner with deterministic arbitration; losers remain at origin. |
| AC-3 | Movement uses existing full-route claims, legal paths and rendered positions; forced opposite-direction/two-door contention has no teleport, live-claim theft or standing doorway overlap. |
| AC-4 | Matching arrival applies planning pose; stale epoch callbacks, repeated effect setup and transient teardown cannot change a newer owner/journey. |
| AC-5 | Every status change, expiry, pause/visibility, group takeover, disable, eviction, true removal and watchdog path cancels/reconciles ownership; blocked attention appears immediately. |
| AC-6 | Return uses each actor's captured safe anchor, avoids occupied slots and preserves namespaced identity; physical seat occupancy prevents premature reassignment. |
| AC-7 | No other actor/status/group cast/bubble/workflow/ledger changes; organic solo meeting remains absent and no new furniture/per-frame separation exists. |
| AC-8 | P1-P6 and blocked interruption render correctly in full/panel/roster/narrow and accessibility modes; owner approves actual movement/frame captures. |
| AC-9 | Focused/full regression, door suites, one-minute soak and targeted adversarial contention probes pass; removing epoch or route claim protection makes a focused test fail. |

## Target Files
New: src/systems/planningPod.js, tests/planningPod.test.js, tests/planningPodJourney.test.jsx (store/intent tests), scripts/verify-planning-pod.mjs (real-browser journey/capture checks).
Modify: src/systems/store.js (transient lease/CAS), src/components/AgentCharacter.jsx (consume intent through existing movement), src/systems/movementSystem.js (small validated seat/home helper, not geometry), src/components/PixelOffice.jsx (coordinator lifecycle), src/config/officeExperience.json (owned flag).
Regression references: tests/doorClaims.test.js, tests/doorCrossingSeparation.test.js, tests/agentSeparationInvariants.test.js, tests/behaviorEngine.test.js and existing movement/watchdog tests.
Docs: this spec, proposed ADR-011, DSoT. No status producers, collision constants, behavior pools or furniture layout edits.

## Implementation Steps
Split into 2-5 minute independently verifiable changes.
| Step | Change / verification | AC |
|---|---|---|
| S1 | Accept ADR/DSoT; red pure eligibility/episode/arbitration tests with namespace cases. | 1,2,7 |
| S2 | Transient lease/CAS/epoch + deterministic seat/return-anchor helper; store tests. | 2,4,6 |
| S3 | Connect intents through beginJourney/door claims; arrival and forced-door tests. | 3,4 |
| S4 | Fence cancellation, return and all teardown/error paths; parameterized interrupted-journey integration. | 4,5,6,7 |
| S5 | Capture P1-P6, owner movement signoff, rollout flag, full tests/soak/negative controls. | 8,9 |

## Verification
npx vitest run tests/planningPod.test.js tests/planningPodJourney.test.jsx tests/doorClaims.test.js tests/doorCrossingSeparation.test.js tests/agentSeparationInvariants.test.js tests/behaviorEngine.test.js — all pass; no artificial driver that bypasses production journey code.
npm test; npm run build; node scripts/bundle-budget.mjs; npm run smoke; npm run smoke:panel; node scripts/sim-soak.mjs --spawn --minutes 1; pwsh -File .agentcortex/bin/validate.ps1 — zero failures. Random soak is supporting evidence only; deterministic contention and rendered owner approval remain mandatory. No platform source is required beyond an honest synthetic planning fixture for integration tests.
node scripts/verify-planning-pod.mjs — real RAF, beginJourney/door arbitration, pause/abort/StrictMode and rendered-position checks in an isolated dev server. Reuse panel-features-verify.mjs's dev module import, setting transient experienceFlags only for the fixture. No new jsdom dependency or production debug global; a server-rendered JSX snapshot cannot prove movement/effect lifecycle.

## Risks and Rollback
Highest risk: returning a tracked actor or releasing a stale epoch into the wrong journey. Keep the existing door machinery and rendered-position abort invariant; never widen this into traffic refactoring. Disable planningPodEnabled, reconcile feature-owned journeys and safely clear feature state; preserve ordinary door ownership and all unrelated dirty/untracked state. No reset/clean or direct coordinate rollback.

## Domain Decisions
- [DECISION] A single real planning representative may use an existing meeting seat under a narrowly scoped ADR exception.
- [CONSTRAINT] No group-event shortcut, peer relocation, text inference or ambient solo meetings.
- [CONSTRAINT] Global seat ownership and door-route ownership are independently fenced; neither is stolen by timeout.
- [TRADEOFF] Losers or unsafe/brief episodes remain at their current location instead of manufacturing motion.
- [CONSTRAINT] Each actor returns toward its own validated anchor; blockers interrupt decoration immediately.
- [CONSTRAINT] Pixel/movement approval and deterministic contention evidence cannot be replaced by a green random soak.

## Claude Resume
This work is independent of AVO-198 and AVO-201, but follows AVO-199 for the shared rollout flags and settled scene lifecycle. Merge/rebase the prior unit first, bootstrap a dedicated architecture-change branch/log. ADR-011 and DSoT baseline are approved, this spec is frozen, and actual movement visual acceptance remains pending. Full implement->review->test->handoff->ship gates apply.
