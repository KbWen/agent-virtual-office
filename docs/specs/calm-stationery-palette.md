---
title: Calm Stationery Palette (main floor, walls, team signs, inspector)
status: shipped
classification: feature
primary_domain: ui-rendering
---

# Calm Stationery Palette

> **Amended 2026-09-13 (round 2, owner-requested, before the ship commit):** "記得要模擬+測試看有沒有改壞喔，然後設計檔不要寫死，畢竟是開源repo，要讓大家好看、好修改、且有規則". This added Contract §4 (tokens + enforced rules) and widened AC1 to the palette module, plus AC10/AC11. After a fresh-context review, R1 was restated as a status-hue floor guard with its rendered-opacity limit, and the close ✕ was ruled an icon (3:1). Spec unfrozen → edited → re-frozen in-session; logged in the Work Log Drift Log.

Design source of truth for a bounded visual refinement. Distilled from the local design packet
`scratch/design-handoff/` (README.md tokens + reference.html inspector + details.svg sign), which
is untracked workspace material; this file is the committed, inspectable artifact.

## Problem

The main view reads as broad, similarly weighted floor areas split by strong dark wall bands, with
near-invisible team labels. The inspector uses a saturated role-colour header over a bright white
body, so it feels separate from the room. Measured, not assumed: every status colour sits at
1.04–1.75:1 (solid) against the current main floor (rings render below full opacity — 50% peak at base effort — so lower still), and every status-coloured text line in the inspector
already fails 4.5:1 even on white (working amber is 2.17:1).

## Tokens (Warm stationery studio)

| Token | Value | Use in this pass |
|---|---|---|
| paper | `#F5F2E9` | Inspector base |
| ink | `#303C37` | Inspector primary text; team-sign text |
| muted ink | `#626D65` | Inspector secondary text |
| line | `#B9B7A8` | Inspector outline and divider |
| accent | `#345D50` | The one short rule under the ENGINEERING sign |
| floor | `#D6C29C` ("warm oak" blend, owner-selected) | Main office floor (and its north door cut, which is the same floor) |
| wall face | `#806E5A` ("warm oak" blend, owner-selected) | Interior thick walls |

`wood #BA9266` is reference-only: furniture is out of scope.

**Owner selection (2026-09-13).** The packet's pure-stationery values (floor `#DED3B8`, wall `#A39C89`)
were rendered and shown to the owner beside two warm blends. The owner asked for a blend that stays
comfortable and pretty and chose "warm oak" plus a light role-tint card header. The rejected wall had
also measured 1.03:1 against the Research/Meeting floors. On the chosen floor every status colour still
gains contrast (solid: working 1.04 → 1.25, blocked 1.75 → 2.26; at the rings' rendered 50%: working 1.01 → 1.13,
blocked 1.38 → 1.56), and the chosen wall holds 1.73:1 against
Research.

## Contract

1. **Scene** (`PixelOffice.jsx`, static fills only). Main floor and its north door cut take `floor`.
   Interior wall faces take `wall face`; the existing 3px darker edges stay. Floor grid texture
   opacity is reduced, not removed. Entrance/hallway, meeting, lounge and research fills, the outer
   frame, door posts, every coordinate and dimension, and all overlays (time-of-day lighting, theme
   tint, lamp halos) are unchanged.
2. **Signature**. The existing ENGINEERING label keeps its text, position and middle anchor, and
   gains ink text in the system sans stack plus one short centred `accent` rule beneath it.
   PLANNING and REVIEW take the same ink colour with no rule, at their original faint opacity and
   font (at a readable opacity PLANNING prints over the sprint board). Room labels (MEETING, RESEARCH,
   LOUNGE) and other signs are unchanged.
3. **Inspector** (`AgentInspector.jsx`, presentation only). Paper background; 1 CSS-px outline in
   `line` (non-scaling stroke); corner radius equivalent to 6 CSS px; the existing subtle
   `bubble-shadow` filter is kept, not added to. The saturated header surface is replaced by a light
   role-colour tint (16%) over the same 28-unit header band, name in ink. Name ≈16px, body ≈14px, history ≈12px on screen at the
   read target (scene units = px / `INSPECTOR_READ_TARGET`). Status text is ink, and the status dot
   and the scene ring keep `STATUS_COLORS` (the emoji glyph is unchanged). Rows, actions, i18n keys, `W`/`H`, clamping, counter-scaling
   (`sceneScale`, `INSPECTOR_READ_TARGET`, `INSPECTOR_SCALE_MAX`), Escape/Enter/Space close and the
   connection line are unchanged.
4. **Tokens and rules** (owner-requested round 2: "設計檔不要寫死…要讓大家好看、好修改、且有規則"). All
   room-shell, team-sign and inspector-card colours, opacities, fonts and card type sizes live in
   `src/systems/officePalette.js` (`SCENE`, `SIGNS`, `CARD`, `RULES`). The components reference the
   tokens and repeat no palette hex. `tests/officePalette.test.js` enforces R1 each status colour (solid) ≥ 1.2:1
   against the main floor — a hue-camouflage guard, not a rendered-ring certificate; R2 wall ≥ 1.5:1
   against every bordering floor; R3 card text ≥ 4.5:1, including the name over every role's header
   tint, and the close ✕ icon ≥ 3:1 over it; R4 `STATUS_COLORS` only on the status dot; and R5 no
   repeated palette literals and no literal fill on any room-shell rect. Each rule is also asserted to fail on a real past bad value. Contributor guide:
   `docs/ARCHITECTURE.md` §Office palette.

## Acceptance Criteria

1. Production diff touches only `src/components/PixelOffice.jsx`, `src/components/AgentInspector.jsx`
   and the new `src/systems/officePalette.js`.
2. No coordinate, dimension, status colour, role colour, i18n key, store read or handler changes.
3. Inspector text meets 4.5:1 on paper (ink 10.27, muted 4.82); the close ✕ icon meets 3:1 over every role tint.
4. Status rings keep or gain contrast against the main floor.
5. Doors and room edges still read at 1280×720 (wall vs Research ≥ 1.7:1).
6. Same-state BEFORE/AFTER captures (hermetic server, staged fixtures) at 1280×720, 1440×900 and
   panel ~400×600, covering no-signal, idle, working, blocked, awaiting-approval and inspector-open.
   Night lighting is checked at least once.
7. In full view the inspector stays inside the scene; Escape and the keyboard close button still
   work; zh-TW detail rows do not collide. (Panel mode already lets the card overflow its cropped
   viewBox on `main`; that is pre-existing, unchanged here, and out of scope.)
8. Existing test suite and `npm run build` pass; `bundle-budget` stays within its limit.
9. The owner has seen the chosen look rendered before it is committed.
10. Moving the values into tokens changes no pixel: same-state captures match the owner-approved
    AFTER set (differences limited to animated/time-varying elements).
11. Simulation still passes: hermetic `sim-soak`, `render-smoke` and the panel smoke
    (`smoke:panel`), plus the palette rules test proven red on a mutation.

## Domain Decisions

- [DECISION] Status colour is a graphic channel, never a text colour: in the inspector it lives on the status dot and the scene ring, and all text is ink/muted ink, because no `STATUS_COLORS` value reaches 4.5:1 as text.
- [DECISION] Scene palette changes are static fills beneath the agent layer only; room readability (walls vs neighbouring floors) and ring contrast are measured before a token is accepted.
- [DECISION] Taste calls on how the office looks are made by the owner from same-state rendered candidates, not delegated through a design packet.

## Non-goals

- Sprite or character redesign (explicitly rejected by the owner), furniture, bubbles, toolbar.
- Theme system, new controls, textures, rugs, animation, fonts or dependencies.
- Cool workshop palette (comparison only).
