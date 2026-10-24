---
title: Optional Cozy Interactions — Design Source
status: frozen
created: 2026-10-23
approved: 2026-10-23
approval_scope: owner-selected-C1-C5-concepts
rendered_acceptance: owner-authorized-agent-verification-2026-10-24
---

# Optional Cozy Interactions

The owner selected all five existing candidate concepts. Preserve the existing paper/oak scene, role palette and quiet toolbar. This exports concrete implementation detail; actual rendered checks passed and the owner authorized closeout based on that verification on 2026-10-24.

## Settings and Optionality

Owner amendment: directly interactive game-like scene objects replace Settings actions. Remove Small toy and Share daily card actions from Settings. Keep the existing preference only for enhanced plant/pet/agent reactions. Star/postcard props are always visible in full scene mode and do not require that preference; hide them in compact panel/roster modes. No new furniture, route or work signal.

## Scene Reactions

- Plant: pot stays fixed; leaves sway -10/+8/0 degrees about the stem base, <=800ms, with a short warm outline around the plant. Reduced motion: static highlight/outline for the same bounded time. Re-click replaces the reaction. Focus is visible; an invisible 28x34 scene-unit hit area makes the existing object easier to touch. No new plant or layout change. Visibility amendment: owner explicitly required clearly visible normal-size interactive feedback on 2026-10-23; actual rendered acceptance remains pending.
- Pet: keep the existing heart; add one <=1s type acknowledgement. Cat eyelid/ear movement, dog wag, vacuum brush rotation. Never scale/relocate the pet or override genuine modes. Cancel on blocker/approval wait.
- Idle wave: one raised hand within the 16x20 grid, with two subtle phases during existing poke feedback. Feet, head, body colors and root transform unchanged; no extra persistent label. Walking/non-idle/reduced-motion use existing static acknowledgement behavior.

## Tabletop Paper Star

A 26-unit folded warm-paper star sits at (175,487) on the existing lounge round table. Its hit area counter-scales to >=44 CSS px at desktop and390px viewport (bounded to the immediate lounge surface). Hover/focus reveals a short localized hint. Direct primary-pointer/Space/Enter press progresses through three squash/expression tiers; release gives the corresponding bounded pop, wobble or spring, as dimensioned in Duration-sensitive star refinement below. Cancel/blur/unmount ends the press without a stuck pose. Reduced motion keeps static expression/color feedback. No standalone drawer/panel, permanent label, score, repeated particles or sound.

## Pinned Scene Postcard

A small paper postcard at (256,73), width22x18 units, is pinned on the right side of the existing notice board without covering its existing notes. Include a tiny scene/sun motif and red pin so it reads as an object. Hover/focus tilts/lifts the paper corner and shows a localized invitation; click/Enter/Space takes it into the existing larger preview. Hit target counter-scales similarly. Browser black outlines remain suppressed for pointer input; keyboard receives a gentle local cue. The preview opens with a short180ms paper-lift, skipped for reduced motion. Escape/Close returns focus to the pinned scene postcard. Roster toggle closes an open preview rather than replaying it later.

## Postcard Preview

An on-demand non-modal paper panel, max width 480px and viewport minus 24px, inset above attention/footer controls. Show loading/error/retry states in the same panel, then the generated card image, None/Plant/Cat choices and a local Download PNG action. Close/Escape cancels stale work and returns focus.

Production preview must use a locally generated PNG data URL compatible with the existing `img-src 'self' data:` policy; do not relax server CSP. Fence asynchronous conversion as well as canvas rendering. A decode failure must show the existing retry state and disable download, without a stale image error replacing a newer preview. Verify actual painted pixels and the downloaded PNG in the production build.

Sticker changes only a reserved decorative corner of the card, outside title/caption/footer/source data. Use a small native canvas plant/cat motif in the existing palette. No new remote asset. Selected decoration is explicitly cosmetic and need not persist. Keep source-backed postcard values and decoration/resource behavior unchanged; the scene entry is independent of the C1-C3 preference.

## Verification Views

Capture: Settings without toy/card actions; star/card visible with preference off; plant before/after; pet normal/blocked; idle wave and interrupted wave; direct pressed/released star, keyboard/cancel and narrow scene; each postcard sticker, loading/error/retry and close-during-render. Check 1280x800 and 390x844, both locales, reduced motion and attention strip visible. Compare agent/state/position snapshots independently of pixels.

### Duration-sensitive star refinement (owner selected)
Short press (<450ms): shallow squash, small240ms pop. Medium hold (450-1199ms): deeper squash, squeezed eyes, one460ms wobble. Long hold (>=1200ms, saturated): deepest squash, puffed cheeks, one680ms tall spring and three fixed glints. During holding, two thresholds update pose/expression and contextual hint. Release tier is computed from elapsed monotonic time, so delayed timers do not downgrade a gesture. Pointer/Space/Enter share timing. Cancellation, blur and unmount clear both threshold timers and the bounded release timer. Reduced motion uses three distinct static expression/color/hint acknowledgements for500ms without transforms/particles. Repeated input restarts only its own local presentation; no score, sound, office state or movement writes.
