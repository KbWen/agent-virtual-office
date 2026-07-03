// Node-safe office theme tint model for package consumers.

export const THEME_OPACITY_CAP = 0.20
export const THEME_LIGHTING_SUM_CAP = 0.45
export const THEMES = Object.freeze([
  { id: 'default', fill: 'rgb(255,255,255)', opacity: 0 },
  { id: 'winter', fill: 'rgb(150,180,210)', opacity: 0.14 },
  { id: 'autumn', fill: 'rgb(214,150,96)', opacity: 0.14 },
])
export const THEME_IDS = Object.freeze(THEMES.map((theme) => theme.id))
export const DEFAULT_THEME = 'default'

export function isValidTheme(id) {
  return THEME_IDS.includes(id)
}

export function themeOverlay(themeId) {
  const theme = THEMES.find((item) => item.id === themeId) || THEMES[0]
  return { fill: theme.fill, opacity: Math.min(theme.opacity, THEME_OPACITY_CAP) }
}

export function cappedThemeOpacity(themeOpacity, lightingOpacity = 0, sumCap = THEME_LIGHTING_SUM_CAP) {
  const capped = Math.min(Math.max(0, themeOpacity || 0), THEME_OPACITY_CAP)
  const lit = Math.max(0, lightingOpacity || 0)
  const remaining = Math.max(0, sumCap - lit)
  return Math.min(capped, remaining)
}
