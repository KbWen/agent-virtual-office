// AVO-123 — office theme selector (PURE, no React/DOM).
//
// A theme is a LIGHTWEIGHT global tint grade — one full-office rect rendered BENEATH the agent/status
// layer (the same mechanism as the AVO-111 time-of-day lighting overlay), NOT a re-color of the
// office's ~150 SVG fills. Status rings/badges render ABOVE the tint, so legibility is protected by
// construction; it is FURTHER protected by an opacity cap + a summed (theme+lighting) cap so no
// theme — alone or stacked on deep-night lighting — can wash the scene out. The per-theme contrast
// guard is unit-tested (tests/theme.test.js).

// Per-theme tint ceiling. Tints are desaturated and OFF the status hue bands (working-amber,
// blocked-red) so a colored ring never loses contrast against the tinted floor.
export const THEME_OPACITY_CAP = 0.20

// Summed budget: a theme tint stacks on top of the lighting tint. Deep-night lighting already spends
// ~0.38; without a sum cap, night + theme could bury the scene. Lighting wins (it carries the honest
// day/night signal) — the theme tint is scaled down to fit the remaining budget.
export const THEME_LIGHTING_SUM_CAP = 0.45

// Ordered for the settings radiogroup. Default is the clear baseline (opacity 0 → no rect rendered).
// LIGHT tints only — they barely lower floor luminance, so the colored status rings keep their
// contrast (proven by tests/theme.test.js). A "Dark/low-light" tint was DROPPED: any genuinely-dark
// tint pushes the working-amber / idle-gray rings below the contrast guard, and one faint enough to
// pass (≤0.08) doesn't read as dark — plus the office already has an honest dark mood via the
// time-of-day NIGHT lighting. Retro (needs per-sprite palette remap) and Cyberpunk (saturation
// endangers ring contrast) were likewise deferred — a tint alone can't deliver them safely.
export const THEMES = Object.freeze([
  { id: 'default', fill: 'rgb(255,255,255)', opacity: 0.0 },
  { id: 'winter',  fill: 'rgb(150,180,210)', opacity: 0.14 }, // cool periwinkle
  { id: 'autumn',  fill: 'rgb(214,150,96)',  opacity: 0.14 }, // warm terracotta, off the amber band
])

export const THEME_IDS = Object.freeze(THEMES.map((t) => t.id))
export const DEFAULT_THEME = 'default'

export function isValidTheme(id) {
  return THEME_IDS.includes(id)
}

// The tint grade for a theme id (unknown → default/clear). opacity is already ≤ THEME_OPACITY_CAP.
export function themeOverlay(themeId) {
  const th = THEMES.find((t) => t.id === themeId) || THEMES[0]
  return { fill: th.fill, opacity: Math.min(th.opacity, THEME_OPACITY_CAP) }
}

// Resolve the actual tint opacity to render, given the live lighting overlay opacity. Caps the theme
// tint to THEME_OPACITY_CAP, then scales it down so theme+lighting never exceeds THEME_LIGHTING_SUM_CAP
// (lighting wins). Returns 0 when nothing should render (Default, or no budget left).
export function cappedThemeOpacity(themeOpacity, lightingOpacity = 0, sumCap = THEME_LIGHTING_SUM_CAP) {
  const capped = Math.min(Math.max(0, themeOpacity || 0), THEME_OPACITY_CAP)
  const lit = Math.max(0, lightingOpacity || 0)
  const remaining = Math.max(0, sumCap - lit)
  return Math.min(capped, remaining)
}
