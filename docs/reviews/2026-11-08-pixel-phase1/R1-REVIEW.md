# R1 — first real Phase 1 integration (Classic / Pixel)

Branch `claude/pixel-character-refresh` @ 00ee9ee (worktree; not pushed, not merged).
Prepared 2026-11-08T14:49:01Z. Owner/Codex review point R1 per ACCEPTANCE-AND-REVIEW.md.

## What to look at
- R1-classic-vs-pixel-desks.jpg — same staged state, same viewport, Classic above / Pixel below.
- classic-scene.jpg / pixel-scene.jpg — whole office, before/after one toggle.
- pixel-live-status-scene.jpg — Gate idle→working arriving from a real hook status file while in Pixel.
- switch-error.jpg — gate.png blocked: error cue, Classic kept, no Pixel bodies.

## World-invariant proof (live-checks.json, 20/20)
Across Classic→Pixel→Classic→Pixel: actor transforms, store position/target/facing/isMoving and
door-claim state byte-identical; the 8 actor DOM nodes are the same objects (no remount).
Click on the body and Enter on a focused actor still select; reduced motion → no walk bob.

## Source diff (code only)
characterAppearance.js (manifest, pivots, atomic store) · CharacterBody.jsx · AgentCharacter.jsx
(+11/-8, body call site only) · NarrowRoster.jsx · ControlPanel.jsx (footer switch) · main.jsx
(init) · index.css (bob) · locales en/zh-TW · 8 PNGs (byte copies) · tests (21) · verify script.

## Tests
Focused 21/21. Full suite 3063 pass; 5 failures are pre-existing timing flakes / Windows `tar`
in watcher/hook adapter suites that do not import changed code. Build PASS. Bundle budget PASS
for this branch alone (+9.05%); the owner's uncommitted furniture WIP pushes it to +11.11%.

## Feet / chair fit — needs an owner decision
Feet land on the world anchor in both appearances; at desks that anchor sits on the chair's top
edge, so both Classic and Pixel can read as "standing on the chair". Render-only mockups of the
same staged state (R1-seating-options.jpg; made by editing the live DOM, no source change):
- A current — standing, feet on the chair edge.
- B chair painted over the legs, body drawn lower (image-local offset) — front-facing; reads as
  "behind the chair" more than "on it".
- D no chair — standing desk; cleanest, no art needed, but removes the owner's new chair art.
- C back view seated — reads most clearly as working at a desk; costs faces while at the desk.
  Mockup uses UNAPPROVED 2026-11-07 idle-up candidates purely as a concept.
Each option applies to BOTH appearances.

**Owner chose C (2026-11-08).** Implemented for Classic (R1-classic-seated-backview.jpg);
Pixel waits for reviewed back-view art (Gemini batch 2) and keeps the standing front master meanwhile.

## Open items
- Desk-work action prompts wait for the A/B/C choice. Gait batch 1 (Res, Arch right-facing
  walk, 4 frames each) is ready: phased-handoff/GEMINI-GAIT-BATCH-1.md, with a paste-first
  opening in GEMINI-GAIT-BATCH-1-OPENING.txt.
- Boss/dog/lounge route defects: reproduced and FIXED as a separate shared-world unit, see
  docs/reviews/2026-11-08-visitor-routes/ (recordings + per-frame checks, both appearances).
- Panel/compact footer has no switch in Phase 1 (preference still applies).
