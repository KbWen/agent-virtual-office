# Phase 1 Pixel appearance — live verification (2026-11-08T14:40:35Z)

Spec: docs/specs/phased-pixel-character-refresh.md. Tool: `node scripts/pixel-appearance-verify.mjs`
(own Vite dev server on an empty OFFICE_STATUS_DIR, headless Chromium 1280x920 @2x, real footer
control clicks). Working tree includes the owner's uncommitted furniture WIP (mirrored patch), so
captures show the current desks/chairs.

Result: 20/20 live checks PASS (live-checks.json).

| Capture | Shows |
|---|---|
| classic-scene.jpg / pixel-scene.jpg | Same staged state, same viewport, before/after toggle |
| classic-desks-top.jpg / pixel-desks-top.jpg | Enlarged desks: feet on the unchanged world anchor |
| pixel-live-status-scene.jpg | Gate idle→working delivered by a real hook status file while in Pixel |
| switch-error.jpg | gate.png aborted → error cue, Classic kept, 0 Pixel bodies |

Invariants asserted on the render/store across 3 toggles: actor transforms, store
position/target/facing/isMoving, door-claim state (doorTraffic) byte-identical; actor <g> nodes
are the same DOM objects (no remount). Click on the body hit area and Enter on a focused actor
select the agent. Reduced motion → 0 walk-bob nodes.

Finding carried to R1 (not changed here): at desks both appearances put the feet on the top edge
of the chair (shared world anchor + current chair geometry), which can read as standing on the
chair. Any fix is shared paint order/occlusion or seat geometry, applied to both appearances.

## Pose share (live sample, 120 s, 4 working + 4 idle, Pixel)
- before actions: front 43% | walking 12% | seated back 39% | (signature behavior shown as front) 6%
- after actions:  front 42% | walking 9%  | seated back 42% | action 6%
Front standing stays as common; every action pose also faces the viewer.
