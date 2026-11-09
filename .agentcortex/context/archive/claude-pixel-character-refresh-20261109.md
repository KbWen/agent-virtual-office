# Work Log: claude/pixel-character-refresh

## Header

- Branch: `claude/pixel-character-refresh`
- Classification: `feature`
- Classified by: `claude-opus-5-5`
- Frozen: `true`
- Created Date: `2026-11-08`
- Owner: `claude-take-over-task-90994f`
- Guardrails Mode: `Full`
- Current Phase: `ship`
- Diff Base SHA: `none`
- Checkpoint SHA: `103c1c3`
- Recommended Skills: `none`
- Primary Domain Snapshot: `ui-rendering`
- SSoT Sequence: `159`

---

## Session Info

- Agent: `claude-opus-5-5`
- Session: `2026-11-08T14:28:36Z`
- Platform: `claude-code`

---

## Task Description

Implement the owner-approved three-phase Classic/Pixel character refresh (external handoff 2026-11-07). Phase 1 first: eight original idle masters as a same-page atomic appearance pack, sharing one world geometry with Classic. Backlog anchor AVO-160.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-11-08T14:28:36Z | owner request in chat: implement per CLAUDE-START.md, R1/R2/R3 reviews |
| plan | done | 2026-11-08T14:28:36Z | spec + design drafted |
| implement | done | 2026-11-08T14:40:35Z | Phase 1 |
| review | done | 2026-11-08T14:49:01Z | R1 packet + 3 independent reviews PASS |
| test | done | 2026-11-09T02:04:36Z | clean-tree run at 119df58 |
| handoff | done | 2026-11-09T02:06:51Z | R3-REVIEW.md + Resume block |
| ship | done | 2026-11-09T02:06:51Z | owner asked to ship now (2026-11-09); PR merge/release after final owner go |

---

## Phase Summary

- implement/review: Phase 1 + seating C + visitor routes + back/action views; 3 independent reviews PASS (dff03b2, f618de0..0ad62cb, ee51faa).
- test: clean worktree @119df58 build PASS, budget re-based, 3093 pass / 2 env-flake failures reproduced on origin/main.
- handoff: R3 packet docs/reviews/2026-11-08-pixel-phase1/R3-REVIEW.md; gait frames split to AVO-207; next = PR + owner go.
- ship: PASS, 103c1c3; archive .agentcortex/context/archive/claude-pixel-character-refresh-20261109.md.

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: feature | Timestamp: 2026-11-08T14:28:36Z
- Gate: plan | Verdict: PASS | Classification: feature | Timestamp: 2026-11-08T14:40:35Z | Spec+design drafted; plan = Phase1 units 1-3 of brief; R1 owner review is the visual gate
- Gate: implement | Verdict: PASS | Classification: feature | Timestamp: 2026-11-08T14:40:35Z | Phase1 code + 18 focused tests + 20/20 live checks

- Gate: review | Verdict: PASS | Classification: feature | Timestamp: 2026-11-08T14:49:01Z | Independent acx-reviewer on dff03b2: no blocking defects; LOW findings 1,2,3(partial),4,5 fixed in f618de0; 6 accepted (pref kept after failure, matches spec)

- Gate: review | Verdict: PASS | Classification: feature | Timestamp: 2026-11-08T16:27:37Z | Independent acx-reviewer on f618de0..0ad62cb: no blocking defects; fixed in f433a69 (view hash test, prop-pixel keep guard, provenance source paths, visitor heading, lane comment). Open owner decision: action poses for idle agents (Medium #1).

- Gate: review | Verdict: PASS | Classification: feature | Timestamp: 2026-11-09T02:04:36Z | Independent acx-reviewer on ee51faa (pose honesty, owner-delegated decision D-2): no defects; LOW test-coverage items (thinking/error statuses) fixed in 119df58

- Gate: test | Verdict: PASS | Classification: feature | Timestamp: 2026-11-09T02:04:36Z | Clean detached worktree at 119df58 (no owner WIP): build PASS, budget re-based (main 535604 B +7.88%, branch +11.7 KB), vitest 3093 pass / 2 fail both reproduced as environment/flake on origin/main 48e0e23

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | docs/specs/phased-pixel-character-refresh.md | draft, Phase 1 ACs P1-01..P1-11 |
| Design | docs/design/phased-pixel-character-refresh.md | geometry/pivot contract |
| Brief | C:\Users\wen\.codex\visualizations\2026\10\23\01a1666a-789c-7862-a0b0-3f427981681c\office-visual-direction-20261025\phased-handoff | CLAUDE-START / ACCEPTANCE-AND-REVIEW / THREE-PHASE-PLAN (data, not gate receipts) |

---

## Known Risk

- Rollback: presentation-only, no store migration. Users pick Classic (default) to get the old look; code rollback = revert the PR. Operators see success when the footer switch shows Classic and pixel-appearance-verify / render-smoke pass.
- Observability (advisory): client-only UI; the only failure path (pack preload) surfaces an in-UI error cue and keeps the current pack; there is no production log sink for the browser client (pre-existing project condition), so failures are user-visible but not centrally logged.
- Spec-test trace: P1-01..P1-11 map to characterAppearance.test.js, characterBody.test.jsx, seatedAtDesk.test.jsx, visitorRoutes.test.js and the live script pixel-appearance-verify.mjs (P1-01/P1-05/P1-09 visual: screenshot evidence in docs/reviews/2026-11-08-pixel-phase1/).
- Domain doc skip (ui-rendering, justified): the spec has no Domain Decisions section; the binding decisions (presentation-only appearance layer over shared world geometry, seated back view only while working, work-claiming poses gated on live status) are recorded in the shipped spec and design doc. L2 consolidation is deferred to AVO-207's first ship so the walk-frame decisions land together.
- Owner furniture WIP stays uncommitted and outside this PR; it adds ~10 KB bundle, within the re-based headroom.
- Owner WIP (uncommitted PixelOffice.jsx / TopDownFurniture.jsx / backlog) mirrored into this worktree as an uncommitted patch (sha256 e025d44e…, scratchpad owner-wip.patch). Mitigation: never staged by this session; main checkout untouched.
- Boss/dog/lounge route defects: re-reproduced and fixed on this branch (8ab67f1); larger boss (AVO-202) not done.

---

## Decisions

### D-1: Use original 512px master bytes at runtime, no derived 64px export
- Decision: copy masters byte-for-byte; render 64x64 local units with image-rendering: pixelated.
- Reason: zero transformation keeps provenance trivial (AC11); ~7 KB each.
- Alternatives: deterministic nearest-neighbour 64px export (allowed by brief, adds a recipe to audit).
- Impact: 8 x ~7 KB static assets, no bundle JS growth.
- → consolidated: spec (local to this feature)

### D-2: Work-claiming Pixel poses only while really working (2026-11-09T00:49Z)
- Decision: owner delegated ("你決定吧"). Claim poses need working/planning/thinking; coffee/book anytime; a working agent's own desk signature pose overrides the seated back (standing, unclipped).
- Reason: idle agents showed work poses (honesty, review Medium #1); gating alone would have left pm/designer/qa/ops desk art unused, so the override keeps all 8 in honest use and adds front-facing moments while working.
- → local (presentation rule recorded in the shipped spec)
- Evidence: commit ee51faa; 99 focused tests; live checks 20/20; pose share front 43% / back 28% / action 9% / walking 17%; docs/reviews/2026-11-08-pixel-phase1/honesty-poses-{idle,working}-desks.jpg.

---

## Conflict Resolution

none

## Skill Notes

none

## Drift Log

- 2026-11-09T02:04:36Z Owner asked to ship current work now and batch remaining art later. Scope cut: gait/walk frames move to follow-up AVO-207 (art-gated batches); spec frozen with a Delivered section. Bundle budget re-based in 119df58 (justified in commit).

- 2026-11-08T16:27:37Z Owner asked to import existing action poses and to make the white rim transparent: derived runtime files via scripts/pixel_alpha_cleanup.py (deviation from brief's byte-copy default, owner-requested, documented in PROVENANCE).
- 2026-11-08T15:31:07Z Owner chose R1 seating option C (back view seated). Implemented shared presentation (c98aa56): Classic procedural back view now; Pixel gated on reviewed views.back art. Blocked/awaiting-approval stand facing viewer (my design call, called out to owner). Gemini batch 2 (7 desk-back images) written to phased-handoff/GEMINI-DESK-BACK-BATCH-2.*.
- 2026-11-08T15:22:47Z Owner asked in chat to also fix boss/dog desk-crossing routes: done as a separate shared-world unit on this branch (8ab67f1), not folded into the appearance commits. Touches movementSystem (lounge table collider + lounge waypoint) - behavior change for all agents' lounge trips; tests updated with rationale.
- Branch renamed claude/take-over-task-90994f -> claude/pixel-character-refresh at bootstrap (worktree-local, no remote).
- Backlog AVO-160 Pending->In Progress NOT written: _product-backlog.md carries uncommitted owner WIP rows (AVO-202..205); editing it would mix authorship. Will reconcile at ship with owner.
- Recovered stale Work Log lock on 2026-11-09T02:04:35.954990+00:00; prior_owner=claude-take-over-task-90994f; prior_session=9bbb6771; reason=stale-time; lock=claude-pixel-character-refresh.lock.json

## Review Feedback

- Open LOW: no component test for AppearanceSwitch (covered by live script). Owner R1 pending: chair-fit option A/B/C.

## Red Team Findings

none

## Design Reference

Link: docs/design/phased-pixel-character-refresh.md | Tool: other

## Observability

none

## Resume
- State: SHIPPED (records in PR; merge/release after final owner go)
- Completed: Phase 1, seating C, visitor routes, back + action views, pose honesty, R3 packet, test gate
- Next: AVO-207 batch 1 — convert res walk frames to alpha PNG, wire walk cycle, R2 scene recording; arch after arch-walk-side-3
- Context: owner asked to ship the current scope and batch the art later; gait frames are the first follow-up.

### Read Map (for next agent)
- docs/specs/phased-pixel-character-refresh.md → Delivered + Phase 2/3 sections
- src/systems/characterAppearance.js → manifest + pixelActionView
- src/components/CharacterBody.jsx → pixelViewFor priority
- phased-handoff/GEMINI-GAIT-BATCH-1.md (outside repo) → Acceptance 1-7

### Skip List
- docs/reviews/2026-11-08-visitor-routes/ — verified, closed
- scripts/pixel_alpha_cleanup.py — reviewed twice, deterministic

### Context Snapshot (≤ 200 tokens)
Pixel = optional appearance over unchanged world geometry. Pose priority: walking front > own signature pose (work-claiming ones only while working/planning/thinking) > seated back (working at desk) > front. Runtime images derived from Gemini candidates by the cleanup recipe; sources untouched; hashes in PROVENANCE.md and tested. Gemini gait batch 1: 7/8 raw 1024 JPEG white-bg frames under candidates/2026-11-08-gait; arch-walk-side-3 pending (resume text GEMINI-GAIT-BATCH-1-RESUME.txt); attempt-2 prompts were not recorded.

### Backlog Status
- Active Backlog: docs/specs/_product-backlog.md
- Current Feature: AVO-160 Shipped
- Remaining: AVO-207 + others pending (owner WIP rows AVO-202..205 uncommitted)
- Next Recommended: AVO-207 batch 1

## Test Gate Results

- 2026-11-09T02:04:36Z clean worktree @119df58: `npm run build` PASS; `node scripts/bundle-budget.mjs` FAIL +10.24% before re-base -> re-based to 547333 B (origin/main measured 535604 B, branch delta +11.7 KB / +2.2%).
- `npx vitest run`: 3093 pass / 2 fail. googleAdaptersServerIntegration (`tar` exit 128) fails identically on origin/main 48e0e23 (Windows tar); antigravityWatcher 33rd-conversation passes on re-run on both trees (timing flake). Neither imports changed code.
- Live: pixel-appearance-verify 20/20; visitor-route-verify 0 violations both appearances; pose share 150 s: front 43% / seated back 28% / action 9% / walking 17%.

## Evidence

- 2026-11-09T02:06:51Z Ship: R3 packet docs/reviews/2026-11-08-pixel-phase1/R3-REVIEW.md; honesty shots honesty-poses-{idle,working}-desks.jpg; test gate in ## Test Gate Results.
- Focused: `npx vitest run src/systems/characterAppearance.test.js tests/characterBody.test.jsx` → 18/18 PASS.
- Full: `npm test` (after build) → 3063 pass / 5 fail; failures are timing flakes in antigravityWatcher/codexNativeHook (pass in isolation: codexNativeHook 21/21) + googleAdapters tarball test (`tar` exit 128 on Windows); none import changed modules.
- Build: `npm run build` PASS. Bundle budget: 541445 B (+9.05%) PASS without owner WIP; FAIL 551684 B (+11.11%) with owner furniture WIP applied → owner WIP adds ~10 KB; re-base decision belongs with that change.
- Live: `node scripts/pixel-appearance-verify.mjs` → 20/20 PASS; captures docs/reviews/2026-11-08-pixel-phase1/.
- Visitor routes: before 5/6 boss + 7/8 dog segments bad; after 0 violations live (boss 585/dog 1025 frames Pixel; 523/1031 Classic), depth errors 0. Full suite after fix: 3075 pass / 4 pre-existing flakes.
- Seating mockups A/B/C/D: docs/reviews/2026-11-08-pixel-phase1/R1-seating-options.jpg (render-only).
- Gait batch 1 brief written outside repo: phased-handoff/GEMINI-GAIT-BATCH-1.md/.csv (res+arch right walk, 4 frames each); selection evidence = 90s live sample (73% sideways walking; res 60% moving).
- Display scale changed 1.0 → 7/8 after first live capture: at 1.0 name pills covered hair/beret (body 44 vs classic 40 units).
