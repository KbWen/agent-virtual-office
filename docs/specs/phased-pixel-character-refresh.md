---
status: draft
title: Phased Pixel character refresh (Classic / Pixel appearance)
backlog: AVO-160
classification: feature
created: 2026-11-08
design: docs/design/phased-pixel-character-refresh.md
source_brief: external owner/Codex handoff 2026-11-07 (CLAUDE-START.md, ACCEPTANCE-AND-REVIEW.md, THREE-PHASE-PLAN.md) — brief, not a gate receipt
---

# Phased Pixel character refresh

## Goal

Give the eight office employees an optional hand-drawn Pixel appearance that users can
switch to on the same page, without changing anything the office *means*: one world,
two appearances. Delivered in three independently reviewable phases. This spec is the
repository record of AVO-160 (custom sprite-asset pipeline); AVO-124 cosmetics stay out.

## Non-goals

- No furniture/room repaint, no camera/viewBox change, no new boss/visitor/pet art.
- No new moods, statuses, needs, metrics or engagement loops (ADR-006/007/008).
- No per-appearance geometry: world feet, home positions, routes, door claims and
  colliders are shared and MUST NOT change on a toggle, reload or asset load.
- No mandatory image generation. Missing art is an honest neutral-front fallback.

## Phase 1 scope (this delivery)

1. Asset pack `pixel-v1`: the eight ORIGINAL idle masters copied byte-for-byte (no
   transformation) into `public/assets/characters/pixel-v1/<role>.png`, with a manifest
   recording SHA-256, decoded size, logical grid (64), and measured foot-contact pivot.
2. Decorative body renderer inside the existing actor group: the Pixel image replaces
   only the classic procedural body. Status rings, name tag, task label, reason badge,
   bubbles, selection, click/poke/keyboard handlers stay outside the replaced subtree.
   The image is `pointer-events: none`; a transparent hit rect keeps the classic body's
   pointer target.
3. Front master for every facing; no mirroring; no classic arm/face/wave pieces painted
   over the raster body. Unsupported expressions render neutral; live truth stays in the
   existing overlays.
4. Optional ~1-local-unit bob only while actually walking; off under reduced motion.
5. Appearance preference `avo.office-appearance` (`classic` default) with an atomic
   switch: all eight required images must load and decode (`naturalWidth === 512`)
   before the whole roster swaps. Any failure keeps the current complete pack and shows
   a concise error cue. No reload, no remount of actors or office.
6. One compact Classic/Pixel control in the existing full-mode footer next to ⚙,
   keyboard operable, `aria-pressed`, localized en + zh-TW. Narrow roster rows follow
   the active appearance.
7. Role resolution: session-prefixed ids strip to base role (`feat~dev` → `dev`);
   lightweight aliases `planner→pm`, `worker→dev`, `checker→qa` (same identity the
   classic palette already maps); unknown role → `pm` master, mirroring classic's
   `CHAR_STYLES.pm` fallback. Helpers, boss, dog, pets remain shared procedural art.

## Acceptance criteria (Phase 1)

| AC | Requirement | Verification |
|---|---|---|
| P1-01 | Eight Pixel employees render their own master at app scale. | Live capture, both appearances, same viewport/state. |
| P1-02 | Toggle changes presentation only: actor world positions, door claims, statuses, timers unchanged; actors are not remounted. | Store snapshot before/after toggle in the live app + DOM node identity check + unit tests. |
| P1-03 | Feet contact: image foot pivot sits on the unchanged world foot anchor (incl. Dev's off-centre canvas). | Pivot unit tests from measured manifest + enlarged live capture at desks. |
| P1-04 | Atomic pack: success swaps all eight; a missing/corrupt/undersized image keeps the current pack, no mixed roster. | Loader unit tests (success / failure / stale request) + live failure injection. |
| P1-05 | Live statuses/names/labels/bubbles remain accurate in Pixel. | Real status fixture through the supported status path, captured in Pixel. |
| P1-06 | Click, poke, keyboard (Enter/Space) and focus still work in Pixel. | Live interaction + existing tests green. |
| P1-07 | Reduced motion disables the walk bob; live-state feedback unaffected. | Unit test + DOM check. |
| P1-08 | Unknown/alias role resolution is explicit. | Resolver unit tests. |
| P1-09 | Existing scene interactions (paper star, plant, postcard) keep working. | Existing tests green + live smoke. |
| P1-10 | Rollback: setting Classic (or removing the pref) restores the procedural body; no store data touched. | Live toggle + code inspection. |
| P1-11 | Build, full test suite and bundle budget pass. | `npm run build`, `npm test`, `node scripts/bundle-budget.mjs`. |

## Phase 2 / Phase 3 (planned, not in this delivery)

- Phase 2: per-asset manifest additions for individually reviewed action key poses and
  direction idles; resolver priority moving → gait/facing/front, stationary → reviewed
  behavior pose → facing idle → front. Each import records source master, raw bytes,
  dimensions/alpha, pivot, transform history and review status. Rejected/raw files never
  reach runtime. R2 review gate.
- Phase 3: one evidence-selected gait cycle for one high-frequency role and one complete
  action sequence, with explicit static fallbacks for everything else. R3 final review.

## Phase 3 selection evidence (2026-11-08)

90 s live sample (4 working + 4 idle agents): 73% of walking samples face left/right; res walks
60% of the time, arch 34%. First gait request therefore = right-facing 4-frame walk for res,
then arch (external brief `phased-handoff/GEMINI-GAIT-BATCH-1.md`). Desk-work actions (≈63% of
stationary time) wait for the owner's R1 decision on seated orientation.

## Known shared-world items (tracked, not fixed here)

Historical boss/dog visitor routes crossing desks and lounge waypoint/collider mismatch
(AVO-202 draft scope). Must be re-reproduced on current source and handled as a separate
shared-world correctness unit; Pixel art does not fix or hide them.

## Rollback

Appearance-only: choose Classic (or clear `avo.office-appearance`). Code rollback is a
revert of this feature's commits; no store migration exists.
