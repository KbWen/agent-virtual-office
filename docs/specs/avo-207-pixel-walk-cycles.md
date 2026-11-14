---
status: shipped
title: Pixel walk cycles (AVO-207 increment 1 — derivation recipe + Res)
backlog: AVO-207
classification: feature
created: 2026-11-14
parent: docs/specs/phased-pixel-character-refresh.md
design: docs/design/phased-pixel-character-refresh.md
---

# Pixel walk cycles

## Goal

In the Pixel appearance, a role that has an accepted 4-frame side walk cycle walks with it instead
of sliding its front master sideways. This increment ships the shared mechanism, a re-runnable
derivation recipe for Gemini's raw frames, and the first accepted cycle (Res). Other roles join as
data-only changes once their frames pass review.

## Owner rules (2026-11-14)

- A character must never change shape or look between frames or versus its master. Looks are
  secondary to sameness.
- Raw frames are never resized or repainted to make them fit. A frame that does not match its
  master natively is regenerated, not adjusted.
- Same-state before/after visuals are shown to the owner before any look change is committed.

## Scope

1. **Derivation recipe** `scripts/pixel_walk_derive.py <raw> <master> <out>`: input is Gemini's raw
   1024x1024 JPEG on white, which must sit on an exact 64x64 logical grid (16x16 blocks). Each
   logical pixel takes the median colour of its block centre (removes JPEG noise without changing
   the drawing); background = near-white connected to the border; a rim pass of at most 2 layers
   clears the light JPEG halo on the silhouette while keeping colours present in the role's master.
   Output: 512x512 RGBA, exact 8x8 blocks, hard alpha. The logical drawing is unchanged: no crop,
   recentre, resize or repaint. Refuses inputs that are not on an exact grid. Prints a JSON report
   (input/output sha256, removed pixels, measured head row, sole row, body centre).
2. **Manifest**: `views['walk-side-0'..'walk-side-3']` per role, each with file, pivot and sha256,
   recorded in `public/assets/characters/pixel-v1/PROVENANCE.md` with the source raw and its hash.
   A role uses walk frames only when all four are present.
3. **Frame selection** (Pixel only): while walking and facing left or right, the role shows
   `walk-side-<step % 4>`; facing left mirrors the image around the foot anchor. Facing up/down,
   reduced motion, or no complete cycle → the front master, as today. Walk frames do not use the
   extra CSS bob (the frames carry their own motion).
4. **Cadence**: the existing walk timer (`WALK_FRAME_INTERVAL` = 250 ms) advances a 0..3 step;
   Classic keeps its two-frame alternation (`step % 2`).
5. **Preload**: walk frames are part of the atomic pack preload (no pop-in mid-walk).

## Non-goals

- No new art in this increment beyond Res's four accepted frames; no up/down walk frames.
- No change to movement, speed, routes, door claims, facing rules, statuses or overlays.
- Boss/dog/pet walk frames (separate increments, after their review).

## Acceptance criteria

| AC | Requirement | Verification |
|---|---|---|
| W-01 | Recipe is deterministic and refuses off-grid input. | Run twice → identical sha256; an off-grid raw (designer f0) is refused. |
| W-02 | Derived Res frames keep the drawing: same logical pixels as the raw grid apart from removed background/halo. | Report counts + side-by-side on light and dark floors. |
| W-03 | Every shipped walk file matches its recorded sha256 and is a 512x512 PNG. | Manifest unit test. |
| W-04 | Walking right shows walk-side-0..3 in order; left mirrors; up/down shows the front master. | Unit tests on the view selector + live clip. |
| W-05 | Reduced motion or an incomplete cycle shows the front master while walking. | Unit tests. |
| W-06 | Feet stay on the unchanged world anchor through the cycle and on the walk/idle switch. | Pivot test + enlarged live capture. |
| W-07 | Classic appearance is unchanged (two-frame alternation). | Existing tests + code inspection. |
| W-08 | Owner sees same-state before/after (front-master slide vs walk cycle) before commit. | Clip/screenshots sent; owner go recorded. |
| W-09 | Build, full test suite and bundle budget pass. | `npm run build`, `npm test`, `node scripts/bundle-budget.mjs`. |

## Rollback

Remove the role's `walk-side-*` entries (data) or revert the feature commits; the role falls back
to the front master while walking. No store migration.
