---
doc_state: snapshot
title: Optimization Audit Handoff to Claude
date: 2026-07-23
baseline_sha: 5284921
scope: verified optimization opportunities; no runtime changes
status: closed — all four work units shipped
---

# Optimization Audit Handoff to Claude

> [!NOTE]
> **Closed 2026-08-03 — every work unit below shipped.** This file is a temporal record of the
> 2026-07-23 audit, committed for provenance; it is **not** an open work list. Where each landed:
>
> | Work unit | Shipped as | Spec |
> |---|---|---|
> | AVO-190 soak target identity | `fec1086` (PR #204) | `docs/specs/avo-190-soak-target-identity.md` |
> | AVO-188 abort-in-place | `ac07a4d` (PR #204) | `docs/specs/avo-188-abort-movement-in-place.md` |
> | AVO-189 reachable RAF diagnostic | `feb23ef` (PR #204) | `docs/specs/avo-189-reachable-raf-watchdog-diagnostic.md` |
> | AVO-187 temporal doorway claim | `018ef1e` (PR #204), ADR-010 | `docs/specs/avo-187-temporal-doorway-claim.md` |
>
> The audit's line references point at `main@5284921` and have since moved. Backlog rows AVO-187–190
> are `Shipped`; the per-ship evidence is in `current_state.md` §Ship History.

## TL;DR

The repository is healthy and heavily tested, but four already-tracked defects remain current at
`main@5284921`. Do not start a broad refactor. First make the soak target trustworthy (AVO-190),
then fix stale movement truth (AVO-188) and the dead RAF diagnostic (AVO-189). Treat the doorway
stack (AVO-187) as a separate feature with an ADR and temporal claim design.

## Current state

- Audit only: no production code was changed.
- Focused baseline: `npx vitest run tests/doorCrossingSeparation.test.js tests/rafWatchdog.test.js tests/journeyDeconfliction.test.js tests/soakInvariants.test.js tests/store.test.js` -> 5 files, 74 tests passed.
- Important: `doorCrossingSeparation.test.js` is a characterization of the defect. Its passing
  assertions prove the doorway geometry is still incapable of clearing the stack alarm; they do
  not mean AVO-187 is fixed.
- Existing architecture explicitly rejects refactoring based only on file size. Follow
  `docs/architecture/monolith-extraction-map.md` and keep each change small and reversible.

## Confirmed opportunities

| Order | Issue | Why it matters | Current evidence | Classification |
|---:|---|---|---|---|
| 1 | AVO-190: soak can attach to the wrong app | A green soak can be confident nonsense, invalidating later movement evidence | `scripts/sim-soak.mjs:67-84` accepts any HTTP 2xx on `:5173`; `scripts/overlap-recorder.mjs:15` hardcodes the same port | quick-win |
| 2 | AVO-188: aborted movement leaves `isMoving:true` | The inspector follows `targetPosition` for a standing agent and reports false motion | abort paths clear local refs/journey only at `AgentCharacter.jsx:1143-1150` and `1299-1312`; store arrival is the only action that clears motion at `store.js:753-760` | quick-win |
| 3 | AVO-189: RAF restart diagnostic is structurally unreachable | Broken walk recovery can remain invisible while tests assert only disconnected pure helpers | the counter resets on every delivered frame at `AgentCharacter.jsx:857-860`; a lost chain increments to 1 at `916`, but reporting requires `>=2` at `48-50` | tiny-fix |
| 4 | AVO-187: doorway pauses guarantee visual overlap | Production-reachable P1 visual/honesty defect; clean CI measured 4/4 stacks on one pinned axis | `movementSystem.js:467-483` offsets only perpendicular to travel; characterization covers every `DOOR_SIDES` entry | feature; ADR required |

## Recommended execution plan

Keep these as separate work units/commits. Do not mix the AVO-187 feature with the three smaller
correctness fixes.

### Work unit 1 — AVO-190: fail closed on the soak target

Target files:

- `scripts/sim-soak.mjs`
- `scripts/overlap-recorder.mjs`
- a focused test file for the extracted target-identity check

Implementation direction:

1. Replace the generic `urlUp()` reuse decision with an identity check that proves the target is
   this Vite app and exposes `/src/systems/store.js`; a root-page 2xx alone is insufficient.
2. Make both the default `:5173` path and explicit `SOAK_URL` fail closed on identity mismatch.
3. Reuse the same check in `overlap-recorder.mjs`, or make that script spawn/accept an explicit URL
   instead of blindly using `:5173`.
4. Do not silently fall back from a user-supplied wrong `SOAK_URL` to another server.

Acceptance criteria:

- A fake HTTP server returning 200 is rejected before Playwright sampling starts.
- A real AVO Vite server is accepted.
- Error output names the rejected URL and says the app identity check failed.
- `npm run soak:spawn -- --minutes <short-value>` still exercises the fresh-server path.

### Work unit 2 — AVO-188: add an abort-in-place store transition

Target files:

- `src/systems/store.js`
- `src/components/AgentCharacter.jsx`
- focused store/component helper tests

Implementation direction:

1. Add one named store action for aborting movement in place. It should defensively copy the real
   visual position and atomically set `position`, `targetPosition`, `isMoving:false`, and
   `journeyTarget:null` without snapping to the old target.
2. Use it in the force-unstick and behavior-watchdog abort paths instead of only clearing the
   journey claim.
3. Handle true component removal without breaking the symmetric effect at
   `AgentCharacter.jsx:938-980`. That cleanup also runs on live re-placed fibers and must remain
   restorable; calling abort unconditionally there would reintroduce the July soak regression.
4. Never pass the live mutable `visualPosRef.current` object into store state without copying it.

Acceptance criteria:

- An aborted agent is stationary at its last rendered coordinates: `position === targetPosition`,
  `isMoving === false`, and `journeyTarget === null`.
- No teleport to the abandoned waypoint.
- StrictMode/live teardown still restores a valid walk and its journey claim.
- `AgentInspector` anchors to the real position after abort.

### Work unit 3 — AVO-189: make the diagnostic represent a reachable event

Target files:

- `src/components/AgentCharacter.jsx`
- `tests/rafWatchdog.test.js`

Implementation direction:

1. Define the event precisely: a focused, visible walk whose RAF handle is genuinely absent when
   the stale-loop watchdog fires.
2. Remove or redesign the impossible `consecutiveLostRestarts >= 2` contract. The present counter
   cannot reach 2 because any delivered frame resets it and a restarted pending frame resets it.
3. Add a sequence-level test that drives the same state transitions as the watchdog callback.
   Testing `shouldRecordRafWatchdogRestart(false, true, 2)` in isolation is not evidence of reachability.
4. Keep host-throttled pending frames and unfocused documents excluded from fault reporting.

Acceptance criteria:

- A planted lost-chain sequence increments `watchdogRestarts` and would emit the DEV warning.
- Pending-frame throttling and unfocused/hidden cases remain silent.
- The test fails against `5284921` for the intended reason (test-the-test evidence).

### Work unit 4 — AVO-187: temporal doorway claim

Required design work before implementation:

1. Add an ADR that records the temporal one-at-a-time doorway claim and its interaction with
   accepted ADR-004. Do not implement per-frame agent separation.
2. Add/freeze an individual spec with ownership, claim lifetime, timeout/recovery, cancellation,
   fairness, and multi-room two-door routing behavior.
3. Design the claim at target/route-assignment time. Raising `DOOR_JITTER` cannot solve the geometry.

Likely target files after approval:

- `src/systems/movementSystem.js`
- `src/components/AgentCharacter.jsx` and/or `src/systems/store.js` for claim lifecycle
- `tests/doorCrossingSeparation.test.js` (convert characterization into the new contract)
- `tests/journeyDeconfliction.test.js`
- soak/invariant coverage for sustained doorway stacks

Acceptance criteria:

- Two agents cannot hold the same doorway-side claim simultaneously.
- Claims release on arrival, abort, agent removal, and timeout; no stale claim can deadlock routing.
- Multi-room routes do not deadlock while acquiring two different doors.
- The existing characterization is replaced by a failing-then-passing contract test.
- A fresh-spawn soak shows zero sustained doorway stacks and preserves zero teleport/frozen/off-floor violations.

## Constraints and non-goals

- Do not split `AgentCharacter.jsx`, `store.js`, or `movementSystem.js` merely to reduce line count.
- Do not combine an extraction/refactor with a behavior fix in the same first commit.
- Do not use `setAgentArrived()` for aborted movement; it snaps to `targetPosition`.
- Do not raise `DOOR_JITTER` as the AVO-187 fix.
- Do not trust `watchdogRestarts === 0` as soak evidence until AVO-189 is fixed.
- Preserve the product honesty rule: displayed movement and diagnostics must reflect observed state.

## Read map for Claude

Read first:

- `AGENTS.md` and `.agentcortex/context/current_state.md`
- `docs/specs/_product-backlog.md` rows AVO-187 through AVO-190
- `docs/adr/ADR-004-no-per-frame-agent-separation.md`
- `src/components/AgentCharacter.jsx` around the RAF watchdog, symmetric cleanup, and both abort paths
- `src/systems/store.js` movement actions
- `scripts/sim-soak.mjs` server selection and sampling startup
- `tests/doorCrossingSeparation.test.js` and `tests/rafWatchdog.test.js`

Can skip initially:

- `docs/reviews/2026-06-20-audit.md` beyond its verdict/non-findings; the broad-refactor question is already settled.
- `src/components/PixelOffice.jsx`; high line count is not part of these fixes.
- dependency upgrades and `package-lock.json` version metadata; they are unrelated to the confirmed runtime risks.

## Resume block

- State: optimization audit complete; implementation not started.
- Baseline: `main@5284921`.
- Next: bootstrap AVO-190 as the first independent quick-win, then proceed in the order above.
- Risk focus: false-positive verification, store/render position divergence, StrictMode teardown behavior,
  and stale temporal claims.
- Closure recommendation: keep `main` unchanged; open separate reviewed PRs for each work unit.
