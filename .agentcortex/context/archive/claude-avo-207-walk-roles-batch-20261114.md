# Work Log: claude/avo-207-walk-roles-batch

## Header

- Branch: `claude/avo-207-walk-roles-batch` (stacked on PR #273 branch; #273 is green, merge was classifier-blocked, awaiting owner)
- Classification: `quick-win`
- Classified by: `claude-opus-5-5`
- Frozen: `true`
- Created Date: `2026-11-14`
- Owner: `KbWen`
- Guardrails Mode: `Lite`
- Current Phase: `ship`
- Diff Base SHA: `9de654f`
- Checkpoint SHA: `3035711` (+ 2026-11-15 follow-up commit)
- Recommended Skills: `verification-before-completion (auto), karpathy-principles (auto)`
- Primary Domain Snapshot: `none`
- SSoT Sequence: `163`

---

## Session Info

- Agent: `claude-opus-5-5`
- Session: `2026-11-14T13:45:42Z` (lock session id)
- Platform: `claude-code`
- Override: none
- Context Read Receipt: current_state.md (Update Sequence 163) · previous increment archive claude-gemini-image-quota-character-actions-23ad2f-20261114.md · spec docs/specs/avo-207-pixel-walk-cycles.md

---

## Task Description

AVO-207 increment 2 (owner: "好，修了接上", plus live-review feedback the same evening): fix the
derivation recipe (halo specks that match a master white), add the reviewed walk cycles of the
other roles as data, and per owner: walking up/down reuses the side cycle on the last left/right
side. Owner live review held back PM, QA, Ops, Designer and Gate (legs do not read as walking; PM
face changes between frames); only Arch and Dev ship. Boss not wired (no Pixel boss, palette issue).
quick-win: 1 script + manifest data + 2 small presentation edits, existing spec amended (W-10..W-14).

Follow-up 2026-11-15 (same increment, owner-directed): fix-wave-6 QA/Ops rejected; walk sheets (one 2x2 image per role)
replace per-frame generation: PM (7b) and QA/Ops/Designer/Gate (7c) wired with an owner-approved uniform scale
(50 grid -> master height) and a near/far tone swap; Arch f2 / Dev f2-f3 tone fix and Dev specks; state-matrix test.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-11-14T13:45Z | quick-win, Lite |
| plan | done | 2026-11-14T13:47Z | plan below |
| implement | done | 2026-11-14T13:48Z | commit 3035711 after owner go ("可以，commit") |
| ship | done | 2026-11-14T14:10:02Z | closure in the same branch/PR |

---

## Phase Summary

- ship: PASS (2026-11-15 follow-up closure re-written, guarded + byte-verified) — SSoT seq 163->164 (guarded, byte-verified), Ship History entry + 1 rotated to archive/ship-history-2026.md, Spec Index line amended, backlog AVO-207 note (stays In Progress), Work Log archived + INDEX.jsonl.
- implement: 3035711; owner approved the live server + before/after sheet; tests 3111 pass (1 pre-existing tar failure).
- plan: Target Files · scripts/pixel_walk_derive.py (halo rule) · public/assets/characters/pixel-v1/{arch,dev}-walk-side-{0..3}.png + PROVENANCE.md · src/systems/characterAppearance.js (views) · src/components/CharacterBody.jsx + AgentCharacter.jsx (vertical walking keeps last side) · tests · spec amendment + design doc. Risk: halo rule could clear a real light edge (overlay review); Res bytes must not change. Rollback: drop the views / revert. Confidence 85%.
- bootstrap: quick-win (data + small presentation rule under the shipped AVO-207 spec); backlog AVO-207 already In Progress.
- ⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-11-14T13:45:42Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-11-14T13:47:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-11-14T14:08:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-11-14T14:10:02Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | docs/specs/avo-207-pixel-walk-cycles.md | increment 2 ACs W-10..W-13 |
| Review | external kit phased-handoff/REVIEW-FIX-5-20261114.md | per-role verdicts, leg-swap numbers |
| Prompt | external kit phased-handoff/GEMINI-GAIT-FIX-6-OPENING.txt | redo of held-back roles (10 frames) |
| Prompt | external kit phased-handoff/GEMINI-PET-MASTERS-W2-OPENING.txt | dog/cat masters at people pixel size |

---

## Known Risk

- Halo rule (HALO_DELTA 12) decides by brightness vs inner neighbours; a thin light feature on the edge with no inner neighbour could be cleared. Mitigation: --review overlays checked for Arch/Dev; Res re-derives byte-identical.
- Vertical walking now shows a side view while moving up/down (owner request); a role without a cycle is unchanged.

---

## Decisions

### D-1: Ship only roles whose legs read as walking
- Decision: Arch and Dev ship; PM, QA, Ops, Designer, Gate held back until fix wave 6.
- Reason: owner live review; leg-area diff Ops f1==f3 (0), Designer f1~f3 (6), QA f0~f2 (15); PM no passing leg + face drift; Gate legs hidden by coat.
- Impact: those roles keep the front master while walking. → local (superseded by D-2 on 2026-11-15)

### D-2: Walk sheets + uniform scale for PM/QA/Ops/Designer/Gate
- Decision: generate the 4 frames as one 2x2 sheet; accept the sheet's 50 grid and scale it uniformly (nearest-neighbour, one factor per role) to the master's height; swap near/far tones so the far leg/arm is darker.
- Reason: per-frame generation could not coordinate limbs or keep the face; owner chose "以 PM 試等比縮放" and later "全部接上".
- Impact: exception to the no-resize rule for sheet roles only, recorded in spec W-14 and PROVENANCE. → spec

### D-3: State priority guarded by a matrix test
- Decision: walk > own action pose > seated back > front; mirror/bob/seat clip only on their view; tests/pixelStateMatrix.test.jsx.
- Reason: owner: different states must not fight or cover each other.
- Impact: test-only. → local

---

## Drift Log

- Skip Attempt: NO
- Scope adjusted twice mid-implement on owner feedback (vertical walking added; roles held back) — owner-directed, recorded in spec W-11/W-12.
- PR #273 merge attempt denied by the auto-mode classifier; branch stacked instead.
- Token Leak: NO

---

## Evidence

- Recipe: Res f0-f3 re-derived with the new rule -> sha256 identical to shipped files.
- Grid: all 17 fix-wave raws on the exact 64 grid (figure p95 8-12); cat still refused (p95 236, ~50 grid).
- Overlays reviewed (scratchpad fix5/review7.png): cleared pixels only on outer outline / leg gaps.
- Focused tests: `npx vitest run tests/characterBody.test.jsx src/systems/characterAppearance.test.js` -> 38 passed.
- Full suite (before hold-back): 3109 pass; googleAdapters tar failure pre-existing; codexNativeHook timeout under load, passes alone (21/21).
- Build OK; bundle-budget PASS.
- Live (dev server, Pixel): Dev/QA/Ops cycled walk-side-0..3, mirrored for left (before hold-back); after: vertical moves of Arch/Res played walk-side-* (Res mirrored = last side left); no console errors.
- Full suite after hold-back: 3111 passed, 1 failed (googleAdapters tar, pre-existing). Build OK; bundle-budget PASS 550332 (+0.55%).
- Owner go: "可以，commit" (2026-11-14) after the live server + before-after-arch-dev sheet.

---

## Resume

- State: SHIPPED (quick-win) on branch claude/avo-207-walk-roles-batch, stacked on PR #273; all eight roles walk.
- Next: merge #273 then this PR; optional: hide the small BehaviorIndicator while a Pixel action pose already shows the prop (owner call); pet masters W2 after owner look approval; Agentic OS upgrade (owner request 2026-11-15).

## Follow-up 2026-11-15 (owner: "以 PM 試等比縮放" -> "可以，接上")
- Gemini fix-6 QA/Ops frames rejected by owner ("都不太行"): uncommitted QA/Ops wiring removed by targeted edits, PNGs parked in scratchpad held-walk/fix6-rejected.
- Walk-sheet wave 7 reviewed: all 32 cells refused (50/48 grid, baked grid lines). PM sheet sampled on its native 50 grid and uniformly scaled 0.9565 to master height (owner-approved exception, spec W-14, PROVENANCE recipe).
- Wired PM walk-side-0..3. Focused tests 38 pass; seatedAtDesk pose-priority test updated (PM now walks with its cycle; QA held back -> front).
- Full suite: 3110 pass / 2 fail (googleAdapters tar pre-existing; seatedAtDesk fixed after; eventEpochRace + codexNativeHook load flakes pass alone 46/46). Build OK; budget PASS +0.65%.
- Live (headless, Pixel): PM right = walk-side-0..3 unmirrored, left = mirrored; size matches neighbours. Not committed (awaiting owner).
- 2026-11-15 owner "換成 7b": PM frames replaced by walk-sheet wave 7b (rounder face, scale 0.9362, same pivots). Focused tests 53 pass; live headless capture: right unmirrored, left mirrored, cycling walk-side-0..3.
- 2026-11-15 owner "夠了，接上": PM f2/f3 near/far tone swap (existing colours only; f2 128 px, f3 73 px) wired; focused tests 53 pass; live: right unmirrored, left mirrored, cycling 0..3.
- 2026-11-15 owner "可以，接上": Arch f2 trouser + Dev f2/f3 shoe near/far tone fix wired (39/6/8 px); focused tests 53 pass; live Arch/Dev cycle 0..3, left mirrored.
- 2026-11-15 owner "好，修掉": Dev hair/hoodie/hand specks replaced by neighbour median (f0 12, f1 9, f2 3, f3 11 px); tests 53 pass.
- 2026-11-15 owner "全部接上": QA/Ops/Designer/Gate walk sheets (7c) wired (scale 0.9149, near/far tone swap, Designer speck). Focused tests 52 pass; full 3107 pass / 4 fail (antigravityWatcher load flake passes alone 38/38; googleAdapters tar pre-existing); build OK, budget +1.05%; live: all four cycle 0..3, left mirrored.
