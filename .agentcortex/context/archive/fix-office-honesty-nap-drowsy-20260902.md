# Work Log: fix/office-honesty-nap-drowsy

## Header

- Branch: `fix/office-honesty-nap-drowsy`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `2026-09-02`
- Created Date: `2026-09-02`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `2375478`
- Checkpoint SHA: `none`
- Recommended Skills: `verification-before-completion, red-team-adversarial`
- Primary Domain Snapshot: `office-runtime`
- SSoT Sequence: `120`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-09-02 02:30 UTC`
- Platform: `claude-code`
- Files Read: `34`

---

## Task Description

Close AVO-194: the two time-linked office-life handlers never read `externalStatus`, so at 12:00
a genuinely working agent was shown asleep and at 14:00 one was painted tired with its speech
bubble cleared. Same R1 / ADR-008 class AVO-191 closed for scheduled events.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-02 | classified quick-win; found a THIRD site the backlog row does not record |
| plan | skipped | — | quick-win fast-path (`engineering_guardrails.md §10.3`) |
| implement | done | 2026-09-02 | predicate hoisted + both sites guarded + phantom-mutex guard |
| review | pending | — | — |
| test | done | 2026-09-02 | 4 new tests, all mutation-verified; suite 2323/2323 |
| handoff | n/a | — | quick-win exempt |
| ship | done | 2026-09-02 | merged as PR #220; SSoT Ship History + this archive + INDEX.jsonl chain entry |

---

## Phase Summary

**bootstrap** — AVO-194's backlog row records ONE site (`officeLife.js:788` lunch-nap). Reading
the file found a **second, unrecorded one**: the 14:00 post-lunch drowsiness block guarded only
`inGroupEvent`, so it painted every tracked working/blocked agent `tired`. That site carries a
second harm the row could not have anticipated — it calls `setAgentBehavior(id, behavior,
'tired', null)`, and the store's `nextBubble = bubble || null` means the `null` argument CLEARS
whatever the agent was saying. A blocked agent loses its voice for the 30s window. The status
ring and name-pill come from `externalStatus`, not the bubble, so status legibility itself is
never lost — that is what bounds the harm to voice rather than state.

**implement** — the availability predicate was a **closure inside `pickParticipants`**, which is
precisely why the time-linked handlers never consulted `externalStatus`: the rule was not
reachable from them. Hoisted to a module-scope `isAgentAvailable(id, agents, externalStatus)`
with `pickParticipants` delegating to it unchanged, so all three callers now share ONE definition
of "may this agent be used for ambient life" rather than three that can drift — the "it was four
sites, not two" shape AVO-191 hit. Both handlers now filter through it. The nap additionally
moves `setActiveEvent` BELOW the cast computation and wraps the body in a nested
`if (nappers.length > 0)` — deliberately a nested guard rather than an early `return`, because a
`return` is correct only while the hour blocks below stay mutually exclusive with `hour === 12`,
an invariant the next person to add an unconditional tail would silently break.

**test** — the existing `Fix 1` test **failed against the corrected code, and it was right to**.
Instrumenting it rather than guessing showed `startOfficeLife` consumes the first two
`Math.random` calls arming its schedulers, so the nap filter received `0.999` twice and picked
NOBODY — yet the test passed, because the old code called `setActiveEvent` before computing the
cast. It had been asserting a **phantom lunch-nap holding the global event mutex for 45s with
nobody asleep** — the exact hazard AVO-191 documented. Its random accounting is corrected and it
now also asserts somebody is actually napping, so it can never again pass on a phantom.

⚡ ACX

---

## Gate Evidence

- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T02:40:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T02:55:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T06:40:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | — | quick-win; behaviour restored to the documented R1 rule, no new surface |
| ADR | docs/adr/ADR-008-no-fabricated-need-ambient-honesty.md | fabricated emotional-state rule |
| Issue | docs/specs/_product-backlog.md AVO-194 | row records 1 of the 2 sites |
| PR | https://github.com/KbWen/agent-virtual-office/pull/220 | merged 2026-09-02 |

---

## Known Risk

- **R1 — the nap silently never fires again.** If `isAgentAvailable` were too strict the charm
  beat would vanish rather than narrow. Guarded by a test that asserts an untracked agent STILL
  naps while a tracked one does not, and by the live run below.
- **R2 — a test that passes on broken code.** Realised, then fixed: the first version of
  `a working agent is not given nap/sleepy/lunch-bubble at 12:00` did NOT go red under mutation,
  because its `Math.random` returned 0.999 and the OLD filter would have spared those agents for
  the wrong reason. Re-pinned so the dice say "nap"; all four now discriminate.

---

## Decisions

### D-1: one free agent is a real cast for a nap

- **Decision**: the nap fires whenever `nappers.length > 0`, not `>= 2`.
- **Reason**: AVO-191's `>= 2` bar exists because `all` / `random-2-3` events are *group* fictions
  that read as broken with one participant. A lunch nap is per-agent; one person napping alone is
  honest and legible.
- **Alternatives**: suppress entirely below 2 (the open question on the backlog row) — rejected as
  it would delete the beat on any office with one busy agent.
- **Impact**: `officeLife.js` hour-12 block only.

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

- Scope grew by one site during implement: the backlog row names `officeLife.js:788` only; the
  14:00 drowsiness handler is the same defect and is fixed here rather than filed separately,
  because it shares the single predicate this change introduces. Surfaced, not silent.

---

## Review Feedback

none

---

## Red Team Findings

none

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

- `npx vitest run` — **2323 passed / 116 files / 0 failed** (baseline at `2375478` was 2319; +4 new).
- Mutation verification, the only thing that makes the green mean anything: with
  `src/systems/officeLife.js` stashed to its pre-fix state, **all 4 new tests fail**
  (`4 failed | 26 passed`); with the fix restored, `30 passed`. Run twice — the first attempt had
  one non-discriminating test, corrected before the green was trusted.
- `npm run build` PASS (367ms). `bundle-budget` PASS at 496055 bytes vs baseline 496504
  (**-0.09%**, limit +10%).

---

## Evidence

- Third site confirmed by reading, not inference: `officeLife.js` hour-14 block guarded only
  `inGroupEvent`; `store.js setAgentBehavior` computes `nextBubble = bubble || null`, so the
  handler's `null` argument clears the agent's existing bubble.
- Predicate reachability was the root cause: `isAvailable` existed only as a closure inside
  `pickParticipants`, so no time-linked handler could apply it. Now `export function
  isAgentAvailable(...)` at module scope, `pickParticipants` delegating with identical semantics
  (`eventParticipantR1.test.js` green, unchanged).
- **Live proof in the real app, hour-14 site** (headless Chromium against a hermetic Vite with
  `OFFICE_STATUS_DIR` pointed at an empty dir; `dev` + `qa` staged working through the real
  `POST /api/status`): `PASS: drowsiness fired for [pm,arch,ops,res,gate,designer]; NO tracked
  working agent affected. dev expr=normal bubble="code first, think later!"`, `trackedTired: []`,
  0 console errors. Both halves shown at once — the charm beat still fires for the six untracked
  agents, and the tracked worker keeps BOTH its expression and its speech bubble.
- **Live proof in the real app, hour-12 site** (same rig): `PASS: nap fired for [ops]; NO tracked
  working agent affected. dev expr=focused`, `activeEventAtEnd: null`, 0 console errors. The nap
  demonstrably EXECUTED (an untracked agent is asleep at t=38s) while the tracked worker was left
  alone — the guard narrows the cast without disabling the beat, and no phantom event is left
  holding the mutex.
- **Five of the live runs before that were VACUOUS, and the assume-failure guard is what stopped
  each one from being read as a pass.** Root cause found by elimination, not guessed:
  `startOfficeLife` registers `timeInterval` (which calls `updateTime()`) BEFORE
  `timeEventInterval`, and both use the same 60000ms period — same-expiry timers fire in
  registration order, so `updateTime()` rewrote `hour` back to the real clock and the event
  handler read that value in the SAME event-loop tick. No re-pin interval can win that race. The
  `tea-break` appearing at t≈60s in every run was not the ambient scheduler; it was the hour-10
  auto-tea-break block firing on the real hour, which is the observation that identified the
  race. Rig fixed by replacing the `updateTime` action itself. **Not a production defect** — in
  production `updateTime()` writes exactly the hour the event block wants.
  Two earlier rig faults were also self-inflicted and worth recording: a 31s hour-alternation
  that ALIASED against the 60s tick (`floor(60k/31)` = 1,3,5,7,9,11 — every tick landed on the
  wrong hour), and a `
` that a heredoc turned into a real newline inside a JS string literal,
  so one run never executed at all.
