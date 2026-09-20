# Work Log: fix/avo-196-offscreen-speaker-bubbles

## Header

- Branch: `fix/avo-196-offscreen-speaker-bubbles`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `2026-09-20`
- Created Date: `2026-09-20`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `f431b66`
- Checkpoint SHA: `987aeac`
- Recommended Skills: `verification-before-completion, systematic-debugging, karpathy-principles`
- Primary Domain Snapshot: `ui-rendering`
- SSoT Sequence: `130`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-09-20 00:45 UTC`
- Platform: `claude-code`
- Files Read: `4`

---

## Task Description

Backlog AVO-196 (review-finding from PR #236's round-2 review): in panel mode a speaker whose body is entirely outside the crop still shows a speech bubble inside it — e.g. the lounge `stretch` spot (180,490) renders its bubble at y 388–414, fully visible, with no visible speaker. PR #236 closed the above/left/right cases (an off-crop speaker's bubble is neither flipped nor clamped into view) and left this one as a design call. Owner decided 2026-09-20 from rendered candidates: **hide the bubble when the speaker is entirely off-view, EXCEPT blocked / awaiting-approval**, which ADR-007 D1 licenses as the interrupt-worthy message (and which the panel's control bar also surfaces).

Chain: `/plan → /implement → (light review) → /test → /ship`.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | complete | 2026-09-20 | Branch from `main`@f431b66 (v1.6.9); backlog row Pending → In Progress. |
| plan | complete | 2026-09-20 | Pure helper + one call site, mirroring the #236 orphan guard. |
| implement | complete | 2026-09-20 | anchor-based `isSpeakerOnScreen` + one call site + 10 tests |
| review | skipped (optional for quick-win) | 2026-09-20 | light self-review + 2 mutations; design already owner-approved |
| test | complete | 2026-09-20 | 131 files / 2495 tests; build; budget +0.68%; render + panel smoke |
| handoff | n/a | — | quick-win exempt |
| ship | complete | 2026-09-20 | PR #240 |

---

## Phase Summary

- bootstrap/plan: `quick-win` — `BehaviorBubble.jsx` (new pure `isSpeakerOnScreen`) + `AgentCharacter.jsx` (one call site) + tests; 2 modules, no new surface. Design already approved by the owner from a prototype capture, so no second visual round is needed — the implementation is re-captured as evidence. | Confidence: 94% — high

- implement/test: the rule is the ANCHOR (where the agent stands), matching the three sides #236 already guards — a first cut used a ~44-unit sprite height, which made the lounge coffee spot (80,475) "visible" by 4 units; the anchor rule is simpler and consistent, and the tests were corrected to it. One #236 render case changed meaning (a meeting-chair speaker now renders no bubble at all rather than an unflipped one); the pure helpers still pin the flip/clamp geometry. 131 files / 2495 tests; 2 mutations killed (no blocked exemption / never hide).

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-20T00:45:25Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-20T00:45:25Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-20T00:51:39Z
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-20T00:51:39Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-20T00:51:39Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Backlog | docs/specs/_product-backlog.md AVO-196 | review-finding, P3 |
| ADR | docs/adr/ADR-007-dialogue-channel-separation-and-honesty-gate.md §D1 | `blocked` is the licensed bubble exception |
| Precedent | .agentcortex/context/archive/fix-review-2026-09-19-20260919.md | #236 orphan guard (both axes) |

---

## Known Risk

- R1: hiding a bubble must never hide an interrupt-worthy message → blocked / awaiting-approval are exempt (BLOCKED_FAMILY), pinned by tests.
- R2: the full office (`0 0 800 560`) must be unaffected — every agent anchor is inside it; pinned by a test sweep.
- R3: my own backlog note said this "collides with ADR-007 (voice is not suppressed)". Re-read at design time: ADR-007 D1 says no such thing; it licenses `blocked` to seize the bubble. The note is corrected in this branch.
- Rollback: single commit; `git revert` restores today's behaviour. No data or payload change.

---

## Decisions

none

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

- Skip Attempt: NO
- Gate Fail Reason: N/A
- Token Leak: NO
- Backlog row AVO-196 advanced Pending → In Progress at bootstrap (the one transition bootstrap owns).
- Design approved by the owner from prototype captures (2026-09-20) before any repo edit; prototypes lived in a scratch worktree.

---

## Review Feedback

none

---

## Red Team Findings

none

---

## Design Reference

- Tool: other (rendered captures) · Link: owner-approved prototype sheet (panel wide crop, idle speaker + blocked speaker below the view) · Approved: yes (owner, 2026-09-20)

---

## Observability

none

---

## Resume

- State: SHIPPED (quick-win) - PR #240. Next: AVO-193 (the coffee-machine click feedback the owner chose as variant B).

---

## Test Gate Results

- `npx vitest run` -> Test Files 131 passed (131) - Tests 2495 passed (2495) at 987aeac.
- Test file: `tests/panelOverlayBounds.test.jsx` (+10: 6 pure `isSpeakerOnScreen` cases incl. the full-office sweep and non-finite anchors, 3 render cases, 1 updated #236 case).

---

## Evidence

- Final implementation, same staged scene in a real browser: visible bubbles inside the wide panel = only the BLOCKED speaker (`res` 4411 px²); the idle lounge speaker's bubble is gone. Identical to the owner-approved prototype.
- `npm run build` ✓ · bundle-budget PASS 499887 B (+0.68%) · render-smoke PASS (4 viewports, 0 errors) · panel smoke PASS.
- Prototype measurement (base vs prototype, wide panel, two speakers below the view): base showed both bubbles inside the crop (`res` blocked 4411 px², `designer` idle 3511 px²); prototype showed only the blocked one (4411 px²).
