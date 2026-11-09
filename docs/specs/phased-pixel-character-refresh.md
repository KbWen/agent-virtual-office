---
status: frozen
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

## Delivered in this ship (2026-11-09, owner asked to ship now and batch the art later)

- Phase 1 complete (P1-01..P1-11).
- Seated-at-desk option C for both appearances (working statuses only).
- Phase 2 increment 1: 8 reviewed back views + 8 signature action poses, honesty-gated.
- Visitor routes (boss/dog) moved onto the shared navigation model (see Known shared-world items).

Not in this ship: gait/walk frames (Phase 3) and any further reviewed views. They continue as
art-gated batches under backlog AVO-207: each batch is reviewed against the acceptance list in the
external gait brief, derived with a recorded recipe, imported per role as `views.*` entries, and
shipped on its own small PR. Until a role has an accepted walk cycle it keeps the front master while
walking. First pending batch: res + arch right-facing 4-frame walk (7/8 frames delivered as
white-background JPEG raw outputs; arch-walk-side-3 pending; conversion to 512px alpha PNG not done).

## Phase 2 / Phase 3 (original plan; remaining parts continue under AVO-207)

- Phase 2: per-asset manifest additions for individually reviewed action key poses and
  direction idles; resolver priority moving → gait/facing/front, stationary → reviewed
  behavior pose → facing idle → front. Each import records source master, raw bytes,
  dimensions/alpha, pivot, transform history and review status. Rejected/raw files never
  reach runtime. R2 review gate.
- Phase 3: one evidence-selected gait cycle for one high-frequency role and one complete
  action sequence, with explicit static fallbacks for everything else. R3 final review.

## Seated at desk (owner R1 decision 2026-11-08: option C)

Shared by both appearances, presentation only. An agent is drawn seated when it rests exactly on
its own desk seat (desk roles only; not walking/moving, not in a group event) AND its live status is
working / planning / (derived) thinking — owner follow-up 2026-11-08: mostly-backs felt distant, so
idle, done, blocked and awaiting-approval agents stand and face the viewer. The body is drawn
SEAT_SHIFT (8 local units) lower and clipped at the chair's top edge so the chair painted beneath
shows instead of legs; back view (Classic: procedural back of head in the role's hair colours).
Pixel sits only for roles whose
reviewed back-view asset is listed in the manifest (`views.back`); until then the front master
stands, as in Phase 1. World feet, routes, hit target and overlays are unchanged.

## Phase 2 increment 1 — back views + signature action poses (owner-requested 2026-11-08/09)

One reviewed key pose per role, shown only while that role performs ITS OWN signature behavior
and is not walking: pm typing, arch whiteboard (pointing), dev drink-coffee, qa magnifier, ops
deploy-button, res research (book), designer writing-notes, gate shield-verify.
Honesty (owner delegated the call 2026-11-09): work-claiming poses (all except dev coffee and res
book) require a live working status (working/planning/thinking); an idle agent's work-ish fidget
behavior keeps the front master. Priority: walking -> front master; own signature pose (gated as
above) -> that pose, standing and facing the viewer, even at the desk; seated (working at desk) ->
back; otherwise front master. Classic is unchanged.
Runtime files are derived by scripts/pixel_alpha_cleanup.py (owner asked for the white/grey rim
to be made transparent); sources untouched; recipe and hashes in pixel-v1/PROVENANCE.md.

Back views imported 2026-11-08 at the owner's request (first Phase 2 increment): the 2026-11-07
idle-up candidates for all 8 roles, after review (later re-derived with the residue cleanup) (see pixel-v1/PROVENANCE.md and
docs/reviews/2026-11-08-pixel-phase1/back-view-import-review.jpg). Used only seated, where the
known below-sole residue row is clipped. All front + view files are preloaded before the atomic swap.

## Phase 3 selection evidence (2026-11-08)

90 s live sample (4 working + 4 idle agents): 73% of walking samples face left/right; res walks
60% of the time, arch 34%. First gait request therefore = right-facing 4-frame walk for res,
then arch (external brief `phased-handoff/GEMINI-GAIT-BATCH-1.md`). Desk-work actions (≈63% of
stationary time) wait for the owner's R1 decision on seated orientation.

## Known shared-world items

Boss/dog visitor routes crossing desks and the lounge waypoint/collider mismatch were re-reproduced
on current source and fixed in this branch at the owner's request (2026-11-08): visitors route
through the shared navigation model with a lounge-table collider, constant-speed sampling and
depth sorting (docs/reviews/2026-11-08-visitor-routes/, 0 violations in both appearances).
The larger foot-anchored boss from the same draft scope (AVO-202, owner WIP backlog) is NOT done.

## Rollback

Appearance-only: choose Classic (or clear `avo.office-appearance`). Code rollback is a
revert of this feature's commits; no store migration exists.
