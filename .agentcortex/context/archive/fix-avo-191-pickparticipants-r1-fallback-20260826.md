# Work Log: fix/avo-191-pickparticipants-r1-fallback

## Header

- Branch: `fix/avo-191-pickparticipants-r1-fallback`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `true`
- Created Date: `2026-08-25`
- Owner: `KbWen`
- Guardrails Mode: `Full`
- Current Phase: `ship`
- Diff Base SHA: `b4d0d5f`
- Checkpoint SHA: `1952f12`
- Recommended Skills: `verification-before-completion (auto), red-team-adversarial (auto), karpathy-principles (auto)`
- Primary Domain Snapshot: `office-runtime`
- SSoT Sequence: `117`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-08-25 claude-code`
- Platform: `claude-code`
- Files Read: `6`
- Context Read Receipt:
  - `current_state.md` -> read (same session as the v1.8.24 upgrade); Update Sequence `117`
  - Spec Scope -> backlog row AVO-191; no spec file (`—` in the backlog Spec column)
  - Running under the **newly upgraded v1.8.24 brain** — this task is the owner's requested
    end-to-end exercise of it.

---

## Task Description

AVO-191: `pickParticipants` in `src/systems/officeLife.js` falls back to **all** agents whenever
fewer than 2 are genuinely available, so on a busy office an ambient/clicked event can seize a
genuinely-working or blocked agent and relocate it — while `store.js:598` asserts the opposite
("R1-safe: pickParticipants never selects tracked working/blocked agents"). Restore the R1
guarantee the comment already claims, and make the comment true.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-08-25 | classified `quick-win` per backlog row; branch cut |
| plan | done | 2026-08-25 | 4 fallback sites + 6 call sites; MFR red-first |
| implement | done | 2026-08-26 | fallback removed, 6 call sites guarded, false comment corrected |
| review | done | 2026-08-26 | PASS; 1 accepted limitation filed rather than absorbed |
| test | done | 2026-08-26 | 2318/2318; build PASS; render-smoke PASS |
| handoff | n/a | — | quick-win exempt |
| ship | done | 2026-08-26 | SSoT entry at top (10/10 cap held); oldest rotated; log archived |

---

## Phase Summary

- plan: read the producer before the consumer. The backlog row says the fallback appears "twice";
  it is **four** sites (`all`, `random-2-3`, `random-1-neighbor`, and the default branch), and
  `pickParticipants` has **six** callers. Decided the honest resolution is an EMPTY cast rather
  than a smaller one -- if there are not enough genuinely-idle agents, the event does not happen.
  The decisive fact came from reading `isAvailable` rather than assuming: an agent with **no**
  `externalStatus` entry is already available, so the fallback could only ever fire when agents
  were genuinely tracked-busy. On the 8-slot base roster that means **>=7 of 8 busy** -- rare in
  normal use, and exactly the case where seizing someone is worst. That inverts the usual risk
  read: removing the fallback is low-blast-radius *because* of when it fired.
- implement: `pickParticipants` never returns the full roster now; each branch returns `[]` when
  the cast would be dishonest. That makes an empty cast reachable at all six callers, and
  `activeEvent` is the global event mutex -- a phantom one blocks every later event for its whole
  duration, a failure mode the file already carried a comment about. Added `fireWithCast`, which
  picks and bails before `setActiveEvent`, and routed the five autonomous callers through it; the
  user-click path reuses the existing honesty-gated-out branch (`fireInteractionReaction`) instead.
  In `fireSeed` the cast is now taken **before** the cooldown stamps, so an event that never fired
  no longer eats the anti-spam budget and silently suppresses the next real signal edge.
  `store.js`'s R1-safe comment was corrected rather than deleted -- it now records that the
  guarantee was false before AVO-191 and names the test that pins it.
- review: PASS. The change is 2 source files; the diff traces to the AC. The adversarial pass
  raised four candidate defects and three died on inspection: handlers already guard
  `participants[0]` and `participants[1]`, so a 1-person `coffee-spill` was always supported; the
  snapshot-vs-live `activeEvent` race in `fireWithCast` is pre-existing and unchanged; and the
  demo/untracked office is untouched for the `isAvailable` reason above (pinned by a regression
  test that passes on the **unfixed** baseline, so it is not merely restating the new behaviour).
  The fourth survived and is recorded as an accepted limitation rather than smoothed over.
- test: red-first. The repro was **RED 6 / GREEN 2 on the unfixed tree** -- a working agent was
  measurably dragged to the coffee area at `(111.4, 483.3)` -- and is 8/8 after. The two that
  passed on baseline are the regression pair, which is what makes them worth having. Full suite
  **116 files / 2318 tests** (from 115 / 2309); build PASS with the bundle *down* 496.26 -> 495.98
  kB, since five duplicated call sites collapsed into one helper; `render-smoke` 4 viewports,
  0 pageerrors, 0 console errors.
  One pre-existing test had to change, and it is the interesting one: `officeLife.test.js`'s
  "returns true for a known event id" built its store with `agents: {}` and asserted `true` -- it
  **encoded the defect**, requiring an empty office to fire a set-piece with zero participants and
  take the global mutex. Its guard-chain intent is preserved by giving it an actual cast, and the
  empty-office case is now asserted the other way in its own test.

- ship: PASS. Ship History entry inserted at the **top** via `guard_context_write --mode replace`
  (never `--mode append`), then re-read and diff-verified per the known stale-receipt hazard. The
  section was already at its 10/10 cap, so the oldest entry rotated verbatim into
  `archive/ship-history-2026.md` with its own rotation note. Backlog: AVO-191 -> Shipped, AVO-193
  and AVO-194 filed. Commits `447b149`, `1952f12`.

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-25T16:10:00+08:00
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-25T16:25:00+08:00
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-26T00:10:00+08:00
- Gate: review | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-26T00:25:00+08:00
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-26T00:35:00+08:00
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-26T00:55:00+08:00

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Backlog | `docs/specs/_product-backlog.md` AVO-191 | P2, quick-win, Pending; found during the AVO-192 panel |
| ADR | `docs/adr/ADR-008-no-fabricated-need-ambient-honesty.md` | ambient honesty rule set this fix serves |
| Code | `src/systems/officeLife.js:116-152` | the 4 fallback sites |
| Code | `src/systems/store.js:598` | the false R1-safe comment |

---

## Known Risk

- **Root Cause**: `pickParticipants` was written to guarantee an event always has a cast, and the
  "not enough idle people" case was resolved in favour of firing the event (`available.length >= 2
  ? available : agentIds`) rather than in favour of the R1 honesty rule. The rule was then
  documented at the consumer (`store.js:598`) as if the producer enforced it.
- **R1 — an event with no cast must not become a phantom `activeEvent`.** Removing the fallback
  makes an empty participant list reachable at 6 call sites, and `activeEvent` is the global event
  mutex — a phantom one blocks every subsequent event for its duration. The code already carries a
  comment recording exactly this failure mode (`officeLife.js:140-143`). Mitigation: every call
  site must skip `setActiveEvent` + `executeEvent` when the cast is empty; pinned by tests.
- **R2 — regression in the demo / untracked-agent case.** Mitigated by reading `isAvailable`
  first: an agent with **no** `externalStatus` entry is already available, so a fresh or demo
  office has a full cast and is untouched. The fallback only ever fired when agents were genuinely
  tracked-busy — which is precisely the case it must not fire in.
- **R3 — fewer ambient events on a busy office.** Accepted, and aligned with the owner's standing
  "too many people walking around" preference; working agents already carry their own animation,
  so a busy office does not read as dead.

---

## Decisions

none

---

## Conflict Resolution

none

---

## Skill Notes

### karpathy-principles (loaded /plan, `load_policy: phase-entry`, `cost_risk: low`)

- Checklist: state assumptions explicitly rather than picking silently between readings; make the
  minimum change that actually solves the problem; touch only what the request traces to; define
  success criteria and loop until verified.
- Constraint: **Surgical Changes** -- do not "improve" adjacent event code while removing the
  fallback. Every changed line traces to the AC or to making the removal safe.
- Applied here: the caller guards and the `fireSeed` cooldown reorder are NOT scope creep -- both
  are required for the removal to be safe, and each is justified in a comment at its site. The
  tea-break click-feedback gap, which is genuinely adjacent, was filed as AVO-193 instead.

### red-team-adversarial (loaded /review, `load_policy: phase-entry`)

- Checklist: attack your own change before defending it; try to REFUTE each candidate finding
  rather than confirm it; record the negative results so they are not re-derived.
- Constraint: a finding that dies on inspection still gets written down, with what killed it.
- Applied here: four candidates raised, three refuted by reading the code (handler index guards,
  a pre-existing `activeEvent` race, the demo-office regression), one survived and was filed.

### verification-before-completion (loaded /test, `load_policy: phase-entry`)

- Checklist: scope-diff before claiming done; run the real checks; quote evidence that postdates the
  last state write; state limitations rather than rounding them away.
- Constraint: "green suite" is not proof on its own -- prove the test would have caught the bug.
- Applied here: red-first, so the repro is measured failing on the unfixed tree (6/8) before it is
  trusted passing (8/8). The `sim-soak` result is reported as what it actually was, not rounded up
  to a pass.

---

## Drift Log

none

---

## Review Feedback

none

---

## Red Team Findings

### F-1 (LOW, accepted + filed) -- a coffee-machine click on a fully-busy office is now a silent no-op

`triggerInteractiveEvent` routes an empty cast into `fireInteractionReaction`, the same branch the
honesty gate uses. That branch knows only two events -- `INTERACTION_REACTOR = { 'deploy-success':
'ops', 'eureka': 'arch' }` -- so a **tea-break** click (the coffee machine) produces no bubble at
all when everyone is genuinely busy. The user gets no feedback.

Weighed rather than waved through. It is strictly better than the behaviour it replaces (a working
agent dragged across the office to the coffee machine), it needs >=7 of 8 agents tracked-busy to be
reachable, and nothing false is claimed -- which is the ADR-008 "degrade to honest neutral" bar.
Closing it properly means a new reactor mapping, a new locale key in both languages, and a design
call about **who** reacts -- new content, not a bug fix, and squarely outside a quick-win's scope.
Filed as a backlog row instead of folded in.

### F-2 (MEDIUM, filed as AVO-194) -- a SECOND R1 hole that does not go through `pickParticipants`

Found by chasing my own comment rather than trusting it. After correcting `store.js`'s R1-safe line
to say the guarantee now holds, I checked **who else** reaches that branch -- and `lunch-nap` does.
`officeLife.js:788` picks nappers with `agentIds.filter(id => !inGroupEvent && Math.random() < 0.5)`:
**externalStatus is never read**, so at 12:00 an agent that is genuinely `working` or `blocked` is
given `behavior: 'nap'`, `expression: 'sleepy'`, and a lunch-nap bubble. It passes `groupTarget:
null`, so it also enters the react-in-place branch of `setAgentGroupEvent` and can nudge that
agent's resting spot.

Milder than AVO-191 -- no walk across the office -- but the same family: the office states
something false about an agent that is really working, which is the ADR-008 line.

Not folded in. It is a different mechanism with its own product question (should a lunch nap be
suppressed entirely when too few agents are free, the way events now are?), and this is a frozen
quick-win scope. What WAS done here is the part that could not wait: the `store.js` comment now
states the guarantee's **scope** instead of asserting a blanket "R1-safe" that this caller
violates. Shipping an over-broad comment is the exact defect AVO-191 existed to fix.

### F-3 (instrument, not product) -- `sim-soak` is not hermetic, and it cannot exercise this fix

Stated before quoting any soak number, because a measurement's blind spots decide what it is
allowed to prove.

- **Not hermetic.** `vite.config.js:24` points the dev server's status API at
  `~/.claude/office-status.json` and `scanAndMerge`s every sibling `office-status-*.json`, so the
  office inside a soak is fed by **this very Claude Code session's hook traffic**. Measured live
  mid-run: `office-status-fix-avo-191-pickparticipants-2595.json` -> `dev: done, res: done,
  pm: working, ops: working`. Two consequences: soak runs are not comparable across sessions with
  different operator activity, and **editing a file during a soak triggers an HMR module reload
  that re-mounts agents** -- which is what happened to the 10-minute run at 00:23, so its
  `3 partial invariant violations` are confounded and are NOT quoted as a product signal.
- **It cannot exercise the AVO-191 branch at all.** The changed path needs fewer than 2 available
  agents. `isAvailable` treats `done` and untracked as available, so with a roster of 8 and only 4
  tracked (2 of them `done`), `available` never drops below 6. The soak is therefore a
  **regression check on the unchanged paths**, never evidence for the AC. The 160-combination
  invariant sweep is what carries the AC.
- **The coverage gate is tighter than this machine.** `soakCoverage.mjs` allows 0.5% jitter
  (`DEFAULT_JITTER_RATIO = 0.005`); measured shortfalls were 45/1920 (2.3%) and 53/2400 (2.2%)
  under Playwright on this box. That is a rig-vs-office distinction, not an office finding.

### Died on inspection (recorded so the negative result is not re-derived)

- **1-person `coffee-spill`**: handlers already guard `participants[0]` and `participants[1]`
  (`officeLife.js:241,253`), so a single-participant cast was always supported.
- **snapshot-vs-live `activeEvent` race in `fireWithCast`**: present identically before the change;
  not introduced here, not fixed here.
- **demo / untracked office regression**: impossible by `isAvailable`'s own definition -- a missing
  `externalStatus` entry counts as available. Pinned by a regression test that passes on the
  unfixed baseline.

---

## Design Reference

none

---

## Observability

none

---

## Resume

none

---

## Test Gate Results

- Command: `npx vitest run` -> **116 files / 2318 tests passed**, 0 failed (baseline 115 / 2309).
- Red-first: `tests/eventParticipantR1.test.js` on the unfixed tree -> **6 failed / 2 passed**;
  after the fix -> **8 passed**, then **9 passed** with the invariant sweep added.
- Invariant sweep: every ungated event (10) x all 16 busy masks over 4 agents = **160
  combinations**, asserting no agent reporting working/blocked is ever placed in an event or given
  a `groupTarget`. Honest limit: the sweep was written **after** the fix and has not been run
  against the unfixed tree; it reuses the same assertions that were measured RED there.

---

## Evidence

- **MFR RED (unfixed tree)**: `expected [ 'ops', 'arch', 'dev' ] to deeply equal []` -- all three
  tracked-busy agents seized by a tea-break; the `groupTarget` of a `working` agent moved to
  `{ x: 111.4, y: 483.3 }`, the coffee area.
- **GREEN**: `tests/eventParticipantR1.test.js` 8/8; full suite `Test Files 116 passed (116) /
  Tests 2318 passed (2318)`.
- **Build**: `npm run build` exit 0 -- `dist/assets/index-*.js 495.98 kB` (gzip 155.94 kB), down
  from 496.26 kB.
- **Render smoke**: `render-smoke PASS -- 4 viewports, min svg descendants 2042, 0 pageerrors,
  0 console errors`.
- **sim-soak, clean run** (10 min, no edits during it): `got 2344 [samples]; partial invariant
  violations: **0**`. The run still ERRORs on its own coverage gate -- 2344 against a required 2388
  -- and that gate is unmeetable here: shortfalls of 2.3% / 2.2% / 1.8% across three runs against a
  0.5% tolerance. Rig limit, measured, not an office signal. The confounded 00:23 run reported
  `3` violations; a clean re-run of the same tree reports `0`, which is what identifies the 3 as
  the HMR re-mount rather than a defect.
- **Blast-radius measurement**: the base roster is 8 (`HOME_POSITIONS`, `movementSystem.js:188`),
  and `isAvailable` counts an untracked agent as available -- so the removed fallback required
  >=7 of 8 agents to be tracked working/blocked/in-event before it could fire at all.
