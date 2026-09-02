# Work Log: fix/office-multi-agent-reaction-lines

## Header

- Branch: `fix/office-multi-agent-reaction-lines`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `2026-09-02`
- Created Date: `2026-09-02`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `2375478`
- Checkpoint SHA: `none`
- Recommended Skills: `verification-before-completion`
- Primary Domain Snapshot: `game-feel`
- SSoT Sequence: `120`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-09-02 03:20 UTC`
- Platform: `claude-code`
- Files Read: `47`

---

## Task Description

Three `eventBubbles` keys are applied to MANY agents at once but held a single line, so every
reacting agent showed the identical speech bubble. Give them pools, and add a guard that derives
the fan-out call sites from source so a future key cannot reintroduce it.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-02 | found on a screenshot, not by reading — two identical bubbles side by side |
| plan | skipped | — | quick-win fast-path |
| implement | done | 2026-09-02 | 3 keys x 2 locales; the guard found the third |
| review | pending | — | — |
| test | done | 2026-09-02 | 6 assertions, all mutation-verified |
| handoff | n/a | — | quick-win exempt |
| ship | done | 2026-09-02 | merged as PR #222; SSoT Ship History + this archive + INDEX.jsonl chain entry |

---

## Phase Summary

**bootstrap** — a Food Delivery screenshot taken during this session's measurement work showed two
side-by-side bubbles reading `awesome! let's e…`. Tracing it: `eventBubble(key)` returns the value
as-is when the locale holds a string, and `food-delivery` applies it via
`participants.slice(1).forEach`. Not a random collision — **structural**, 100% of the time. Seven
sibling keys (`boss-visit`, `dog-visit`, `ac-broken`, `group-stretch`, `lunch-nap`,
`deploy-celebrate`, `pm-meeting-react`) already had 3–6 line pools, so this was an inconsistency
rather than a design choice.

**implement** — pools for `food-react` and `ac-fan`, each keeping the ORIGINAL line as entry one
so nothing already-approved is lost. Then the guard I wrote to prevent regressions immediately
paid for itself by finding a **third** site nobody had reported: `dog-woof`, applied to
`participants.slice(0, 3).forEach`, meaning up to three agents barked the identical `woof! 🐾`.
Pooled as well.

A first attempt rewrote the locales with `json.dumps`, which reformatted **1504 lines** of
unrelated content. Reverted and redone as a targeted per-line replacement preserving the file's
compact one-line-per-key style: the final diff is **6 changed lines across the two locales**.

**test** — the guard DERIVES the multi-agent key set from `officeLife.js` rather than hard-coding
it, so a new key added to a fan-out call site is covered without anyone remembering this file. The
naive "is there a `.forEach(`/`.map(` in the preceding 10 lines" heuristic produced one false
positive — `pm-meeting-lead`, a single-agent `setAgentGroupEvent('pm', …)` sitting eight lines
under an unrelated `otherIds.map(`. Rather than tune the window to a magic number (W=6 happened to
work), the rule is principled: a `setAgentGroupEvent('…'` / `setAgentBehavior('…'` with a QUOTED
LITERAL id targets one agent by construction and is excluded. That keeps the wider window's recall
and is stable against re-indentation.

⚡ ACX

---

## Gate Evidence

- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T03:25:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T03:35:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T06:40:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | — | content consistency; no new surface |
| ADR | docs/adr/ADR-007-dialogue-channel-separation-and-honesty-gate.md | new lines make no work-outcome claim |
| Issue | — | no backlog row; found by screenshot this session |
| PR | https://github.com/KbWen/agent-virtual-office/pull/222 | merged 2026-09-02 |

---

## Known Risk

- **R1 — a vacuous guard.** If the source scan stops matching (a refactor renames `eventBubble`),
  the derived set empties and every per-key assertion passes trivially. Guarded by an explicit
  `multi.length >= 10` plus a named-key containment check.
- **R2 — locale drift.** A future key could get a pool in `en` and stay a string in `zh-TW`,
  reintroducing the defect for half the users with nothing else noticing. Guarded by an
  en/zh shape-equality assertion over ALL `eventBubbles` keys, not just the three touched here.
- **R3 — residual collisions.** With 5 lines, two agents still coincide ~20% of the time. Accepted:
  the render layer caps concurrent bubbles at 3 (`BUBBLE_VISIBLE_CAP`), and this matches how the
  seven already-pooled sibling keys behave. Removing collisions entirely would need a cross-agent
  anti-repeat ring, which is a mechanism change, not content.

---

## Decisions

### D-1: content-only, no cross-agent anti-repeat

- **Decision**: fix by giving the keys pools; do not add a distinct-pick mechanism to `eventBubble`.
- **Reason**: the existing per-agent anti-repeat ring is per-agent by design, and seven sibling
  keys already live with the same residual collision rate. Content brings the identical-line rate
  from 100% to ~20% with zero mechanism risk.
- **Alternatives**: a shared recent-pick ring across an event's cast (deferred — real mechanism
  change, needs its own justification).
- **Impact**: `src/locales/*.json` only.

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

- Scope grew from two keys to three during test authoring: the derived guard found `dog-woof`,
  a fan-out site with a single line that no report had named. Fixed here because it is the same
  defect the same guard covers. Surfaced, not silent.

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

- `npx vitest run` — **2325 passed / 117 files / 0 failed** (baseline at `2375478` was 2319; +6).
- Mutation-verified: with `src/locales/` stashed to pre-fix state, **3 of the 6 assertions fail**
  (`[en]` pool, `[zh-TW]` pool, and the `eventBubble` wiring draw); restored, all 6 pass. The
  failure message names the key and the offending value
  (`en eventBubbles.food-react must be an array, got "awesome! let's eat!"`).
- `npm run build` PASS. `bundle-budget` PASS at 496320 bytes vs baseline 496504 (**-0.04%**).

---

## Evidence

- Defect confirmed on a real screenshot (Food Delivery, two rendered bubbles both
  `awesome! let's e…`) before any code was changed — not inferred from reading.
- Mechanism confirmed in source: `i18n.eventBubble` returns `val` unchanged for a string and only
  samples when `Array.isArray(val)`; `officeLife` applies `food-react` in
  `participants.slice(1).forEach`, `ac-fan` in `participants.forEach`, `dog-woof` in
  `participants.slice(0, 3).forEach`.
- Guard behaviour measured, not assumed: the derivation flags 14 fan-out keys and excludes exactly
  one literal-target site (`pm-meeting-lead@438`). Window widths 4/5/6/8/10 were each run — 4
  misses `dog-woof`, 8 and 10 false-positive `pm-meeting-lead` — which is why the literal-id rule
  exists instead of a tuned constant.
- Wiring, not just shape: 40 draws of `eventBubble('food-react')` through the real i18n module
  yield more than one distinct value, and every drawn value is a member of the en pool.
