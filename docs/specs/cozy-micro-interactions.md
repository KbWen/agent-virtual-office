---
title: AVO-125 Cozy Micro-Interactions (restrained)
status: shipped
created: 2026-06-13
signal_tier: none
backlog: AVO-125
depends_on: AVO-111
---

# AVO-125 — Cozy Micro-Interactions (restrained)

## Intent

Add ambient night charm so the office feels *alive after hours* — the chill+fun → want-to-open product value. Restrained scope; honor the AVO-111 ambient-overlay law (paint beneath the status layer, never compete with the real status channel, ride the `lightingEnabled` toggle + night gating, static/no-flicker).

This spec is the §4.4 Design Source of Truth. AVO is a procedural pixel-art SVG product (the office is drawn in code; there is no per-element Figma/Stitch artifact for any office element). The DSoT here = this spec's concrete values (exportable) + the rendered verification screenshots (inspectable, linkable). Design authored by a 5-lens design panel (`design-panel-avo125-cozy`, run wf_d5722c49) against the live office. Owner-accepted DSoT path for procedural SVG.

## Scope

**IN — Night desk-lamp warm halos.** A soft warm pool of lamplight on the floor under each of the 7 desk lamps, visible only when the office is dark and lighting is on.

**DROPPED — Status-tinted monitor glow.** Cut on an honesty/correctness finding (not taste): the monitor glow renders on FIXED desk coordinates (`DESK_DATA`, PixelOffice.jsx:611-619) while agents WALK and are not pinned to their desks (`setRenderPos`, AgentCharacter.jsx:332/803). A status-derived desk tint would therefore color an EMPTY desk while the agent (and its real status ring) is mid-room, lag the canonical ring, and risk a contradictory second status channel — three violations of the #1 status-legibility law in a REDUCE-not-add product. The existing neutral cool `#4af` "screen is on" glow stays AS-IS (no status meaning). The only honest future variant (a status-AGNOSTIC binary brightness, no hue map) is out of scope here.

**DEFERRED — coffee steam, growing desk-plants.** Not designed, not built.

## Design (panel-derived, concrete)

- **Geometry:** one static `<ellipse cx={d.x+22} cy={d.y+2} rx={28} ry={12} fill="url(#lamp-halo)"/>` per desk (all 7 in `DESK_DATA`). Centered just below/ahead of the lamp head (lamp at `d.x+22, d.y-14`, PixelOffice.jsx:1182), flattened (rx>ry) to read as a top-down floor pool, larger/softer than the lamp's own ground ellipse.
- **One shared gradient** in `<defs>` (next to `lounge-light`, ~line 911):
  `<radialGradient id="lamp-halo" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#FFE0A0" stopOpacity="0.14"/><stop offset="55%" stopColor="#FFD890" stopOpacity="0.05"/><stop offset="100%" stopColor="#FFD890" stopOpacity="0"/></radialGradient>`
  Color `#FFE0A0` / rgb(255,224,160) is a deliberate lamp-warmth hue OUTSIDE `STATUS_COLORS` (in the DeskLamp `#FFE4A0`/`#FFD060` family), paler/lower-chroma than working-ring amber `#EF9F27`, so it can never read as a status ring on the floor.
- **Opacity:** peak alpha 0.14 (hard ceiling 0.16) — additive warmth, well under `MAX_OPACITY` 0.38 and under the status-ring alpha.
- **Gating:** render the halo `<g pointerEvents="none">` only when `lightingEnabled && lightOverlay.opacity > 0` — the EXACT condition the AVO-111 tint uses (PixelOffice.jsx:1139). NOT the bare `hour >= 19` the NIGHT EFFECTS block uses (that ignores `lightingEnabled`). One toggle governs the whole lighting story; no new control, no new store flag. First-run OFF under prefers-reduced-motion/contrast (inherited from `lightingEnabled` default).
- **Z-order:** render in the slot AFTER the TIME-OF-DAY LIGHTING rect (1139) and BEFORE the AGENTS map (1158) — strictly beneath every sprite/ring/label/bubble. MUST NOT go in the post-agents NIGHT EFFECTS block.
- **Static only:** SVG radial gradient + plain ellipses; no `<animate>`, no flicker (photosensitivity). Do not inherit the DeskLamp bulb pulse.
- **Cheap:** 1 shared def + 7 ellipses = ~8 static nodes; gated render → nodes don't exist during clear midday (no per-frame work).

## Acceptance Criteria

1. At `hour=21` with `lightingEnabled` ON: a warm pool sits under each of the 7 desk lamps, beneath the agents.
2. A working-amber ring and a blocked-red ring still read cleanly over a lit desk (status legibility preserved).
3. Lighting toggle OFF (or reduced-motion first-run): NO halos render.
4. Midday (`hour=13`): NO halos (gate `lightOverlay.opacity > 0` is false).
5. No status-tinted monitor glow added; existing neutral `#4af` glow unchanged.
6. Full test suite green; vite build clean; no new per-frame work.

## Risks & Rollback

- Risk: halo + night-tint additive sum could approach the legibility ceiling at deep night → mitigated by 0.14 peak (sum well under 0.38) and beneath-agents z-order. Verify visually.
- Risk: DOM-node growth on a ~1000-node SVG → bounded to ~8 static, gated nodes.
- Rollback: revert the single implement commit; the feature also rides `lightingEnabled` (OFF → nothing renders), so it is config-disableable (§2.2 feature-flagged).

## Out-of-scope follow-up — RESOLVED (separate quick-win)

The existing NIGHT EFFECTS block (monitor glow + DeskLamps + ceiling/lounge lights + OVERTIME chip) was gated on `hour >= 19` only (ignored `lightingEnabled`) and rendered AFTER the agents — so its ambient light painted OVER sprites (latent z-order + toggle bug). **Fixed as its own change** (chip `task_9c31a8e0`): the block was relocated to the lighting slot (beneath the agent layer, beside the tint + halos) and re-gated to `lightingEnabled && lightOverlay.opacity > 0`, so one toggle governs the whole lighting story and the glow/lamps never paint over status. Verified at hour 21: glow/lamps beneath agents (legible on top); toggle OFF → 0 monitor-glow ellipses in DOM. Suite 1938/1938.
