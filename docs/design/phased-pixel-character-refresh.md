---
status: draft
spec: docs/specs/phased-pixel-character-refresh.md
reference: external standalone simulation (phased-handoff/index.html, preview-phase1.png) — visual reference only, not production evidence
---

# Design — Phased Pixel character refresh

## Geometry contract (one world, two appearances)

- Actor group: unchanged `translate(world x, y) scale(1.35)`; local origin = world feet.
- Classic body: 16×20 grid × 2 units → 32×40 local units, feet at local y = 0.
- Pixel body: 512×512 master = 64×64 logical grid (8×8 uniform blocks verified on all
  eight). Drawn at **1 local unit per logical pixel** (64×64 local units, nearest-neighbour
  via `image-rendering: pixelated`). Visible body ≈ 43–44 units tall (hair/hat included)
  versus classic 40, so overlays above the head keep their clearance.
- Placement: `x = -pivot.x`, `y = -pivot.y` so the measured sole contact lands on local
  (0, 0). Pivots are measured from opaque (α ≥ 250) sole pixels in the bottom rows:

| role | pivot x | pivot y | note |
|---|---|---|---|
| pm, arch, qa, ops, gate | 32 | 56 | soles rows 54–55 |
| res | 32 | 56 | |
| designer | 32.5 | 56 | |
| dev | 36 | 55 | canvas off-centre (twin tails), soles end row 54 |

  The partial-alpha row below the soles is a dark soft outline (no white matte), so it
  is not counted as contact.
- Shadow: keep the classic `ellipse(0,1,10,3)` so both appearances share one ground cue.
- Hit target: transparent rect `(-16, -40, 32, 40)` = classic body bounds; image has
  `pointer-events: none`.

## Pack loading

`characterAppearance.js` owns a tiny external store `{ requested, active, status }`.
`requestAppearance('pixel')` preloads all eight URLs with `Image()` + `decode()`, checks
`naturalWidth/naturalHeight === 512`, then flips `active` in one notification. A request
token discards stale completions (Classic chosen mid-load wins). Failure → `active`
unchanged, `status: 'error'`, preference kept so a later retry is possible.

## Control

Footer full mode: a small segmented `Classic | Pixel` pair before ⚙ (`aria-pressed`),
showing `…` while loading and a short localized error title on failure. Compact/panel
mode is out of Phase 1 (space budget); the preference still applies there.

## Visual examples

Same-state Classic vs Pixel captures from the live app are produced for review R1 and
stored with the work-log evidence.

## Walk cycle (AVO-207)

Spec: `docs/specs/avo-207-pixel-walk-cycles.md`. Pixel only; Classic unchanged.

```
facing right, walking      facing left, walking        facing up/down or reduced motion
[f0][f1][f2][f3] loop      same frames, mirrored        front master (as before)
 250 ms per frame          around the foot anchor       + existing 1-unit bob (front only)
```

- Frames are 64-grid side views drawn at the master's size; each frame's measured sole sits on the
  unchanged world foot anchor (local 0,0), so switching between walking and standing never moves
  the feet.
- A role uses walk frames only when its four frames are all accepted; otherwise it walks with the
  front master exactly as in Phase 1.
- Overlays (name tag, task label, rings, bubbles, hit target) do not mirror or move.
- Visual acceptance = same-state before/after capture approved by the owner (front-master slide vs
  walk cycle, both facings, light and dark floor).
