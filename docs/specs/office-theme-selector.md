---
title: AVO-123 Office theme selector (lightweight overlay-grade)
status: shipped
created: 2026-06-13
signal_tier: none
backlog: AVO-123
issue: 41
depends_on: AVO-111
---

# AVO-123 — Office theme selector

## Intent

Let people re-skin the office mood (want-to-open / ownership) via a **lightweight, legibility-safe overlay grade** — NOT a 150-fill re-color. A theme is one global tint rect rendered BENEATH the agent/status layer (the exact mechanism the AVO-111 time-of-day lighting already uses), opt-in from the ⚙ menu, persisted. Status legibility (the #1 law) is protected by construction (status sits above the tint) AND by a tested contrast guard.

This spec is the §4.4 DSoT. Approach + theme set decided by a 3-lens game-design panel (cozy art-director · calm-tech legibility skeptic · office/management-sim), 2026-06-13, owner-selected the lightweight overlay-grade.

## Scope

**IN — 4 pure-tint themes** (each a `{fill, opacity}` grade composing on top of the lighting overlay, beneath sprites):
- **Default** — clear baseline (`opacity: 0`).
- **Dark / low-light** — desaturated indigo `rgb(20,24,52)` @ 0.18.
- **Winter** — cool periwinkle `rgb(150,180,210)` @ 0.14.
- **Autumn** — warm terracotta `rgb(214,150,96)` @ 0.14 (deliberately OFF the working-amber `#EF9F27` hue band).

**Legibility guards (panel-mandated):**
- Per-theme opacity ceiling **0.20**.
- **Summed cap**: `themeOpacity + lightingOpacity ≤ 0.45` — if exceeded, the theme tint is scaled down (lighting carries the honest day/night signal and wins). Pure helper `cappedThemeOpacity`.
- Tints are desaturated and off the status hue bands; status rings/badges render above the tint.
- A **unit test** composites each theme tint (at cap) + max lighting over the base floor and asserts every `STATUS_COLORS` ring keeps a luminance-contrast ratio ≥ the Default baseline (minus a small tolerance). Build fails on regression.

**Persistence + surface:**
- `theme` in the store, persisted to localStorage (joins the existing persisted-prefs set); default `'default'`.
- Swatches in the ⚙ settings menu (radiogroup, like the pet-skin picker) — NOT the resting bar.
- en + zh-TW theme names; `role="radio"` + `aria-label`.

**DROPPED from v1 (deferred, with rationale):**
- **Classic retro / limited-palette** — a tint cannot remap a palette; a true retro look needs per-sprite re-coloring (scope explosion). Deferred.
- **Cyberpunk** — to read as cyberpunk a tint must be high-saturation at an opacity that endangers ring-vs-floor contrast (panel legibility veto). A safe version needs window-sky recoloring (more scope). Deferred.
- **Winter snow / Autumn leaves particles** — would sharpen the seasonal read but is a new particle layer; deferred (the temperature tints already read as distinct moods).

**NON-GOALS:** no 150-fill CSS-variable refactor; no agent movement / behavioral-semantic change (AC); no new motion (reduced-motion unchanged — a static tint adds none); no change to status colors.

## Design (concrete)

- **Pure module** `src/systems/theme.js`: `THEMES` (ordered list of `{id, fill, opacity}`), `themeOverlay(themeId)` → `{fill, opacity}` (Default → opacity 0), `cappedThemeOpacity(themeOpacity, lightingOpacity, sumCap=0.45)` → scaled opacity honoring the summed cap, `THEME_OPACITY_CAP = 0.20`. All pure, unit-tested.
- **Store**: `theme` state + `setTheme(id)`; persisted via the existing prefs persistence; hydrate on init.
- **PixelOffice**: render a theme tint `<rect 0 0 800 560 fill={themeOverlay.fill} opacity={cappedThemeOpacity(themeOverlay.opacity, lightOverlay.opacity)} pointerEvents="none">` in the lighting-overlay slot (beneath the agent layer). Skipped entirely when opacity resolves to 0 (Default).
- **ControlPanel ⚙ menu**: a "Theme" radiogroup of swatches (reuse the pet-skin radio pattern); `setTheme` on select; persists.
- **i18n**: `settings.theme` + `theme.<id>` names (en + zh-TW).
- **Contrast test** `tests/theme.test.js`: pure — for each theme, composite (tint@cap over floor, then +max-lighting) and assert each STATUS_COLORS ring's contrast ratio vs the composited floor ≥ baseline tolerance; plus pin the opacity cap + summed cap.

## Acceptance Criteria

1. Selecting a theme applies a global tint beneath the status layer; agents/behaviors/status semantics are unchanged (no movement).
2. Every theme keeps status-surface contrast readable — proven by the per-theme × per-status contrast unit test (≥ baseline).
3. Theme tint opacity ≤ 0.20; theme+lighting summed opacity ≤ 0.45 (tested); Default renders no rect.
4. Theme persists across reload (localStorage); swatches live in the ⚙ menu, not the resting bar; en + zh-TW; keyboard-accessible radiogroup.
5. Reduced-motion behavior unchanged (theme adds no motion).
6. Visual QA covers desktop + narrow layouts (screenshots).
7. Full suite + build + render-smoke green.

## Risks & Rollback

- Risk — ring-vs-floor contrast collapse: mitigated by opacity cap + summed cap + off-band desaturated tints + the contrast unit test (build-failing).
- Risk — themes feel samey: mitigated by distinct temperature moods (cool/warm/dark) at perceptible-but-safe opacity; Retro/Cyberpunk/particles deferred rather than shipped weak.
- Rollback: additive; `theme: 'default'` = byte-identical prior look; revert the implement commit (no migration).
