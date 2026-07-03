// Node-safe ambient appearance contract for alternate renderers.
//
// This mirrors the existing lighting/theme/weather semantics without importing
// React components, the store, i18n, or browser-only .js modules from package
// subpaths. Renderers decide how to draw the weather and tints; this module only
// resolves the honest visual state.

export const AMBIENT_APPEARANCE_VERSION = 'ambient-appearance-v1'

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const item of Object.values(value)) deepFreeze(item)
  return value
}

const LIGHTING_KEYFRAMES = deepFreeze([
  { h: 0, rgb: [12, 14, 38], op: 0.38 },
  { h: 5, rgb: [22, 24, 60], op: 0.36 },
  { h: 6, rgb: [88, 66, 112], op: 0.30 },
  { h: 6.5, rgb: [212, 132, 140], op: 0.24 },
  { h: 7, rgb: [255, 208, 152], op: 0.17 },
  { h: 8, rgb: [255, 236, 206], op: 0.06 },
  { h: 9, rgb: [255, 255, 255], op: 0 },
  { h: 16, rgb: [255, 255, 255], op: 0 },
  { h: 16.5, rgb: [255, 244, 222], op: 0.05 },
  { h: 17, rgb: [255, 188, 116], op: 0.08 },
  { h: 18, rgb: [236, 126, 92], op: 0.13 },
  { h: 19, rgb: [108, 68, 120], op: 0.26 },
  { h: 20, rgb: [46, 44, 96], op: 0.32 },
  { h: 21, rgb: [26, 28, 70], op: 0.36 },
  { h: 23, rgb: [12, 14, 38], op: 0.38 },
])

export const MAX_LIGHTING_OPACITY = 0.38
const NIGHT_OVERLAY = Object.freeze({ fill: 'rgb(12, 14, 38)', opacity: MAX_LIGHTING_OPACITY })

export const THEME_OPACITY_CAP = 0.20
export const THEME_LIGHTING_SUM_CAP = 0.45
export const THEMES = deepFreeze([
  { id: 'default', fill: 'rgb(255,255,255)', opacity: 0 },
  { id: 'winter', fill: 'rgb(150,180,210)', opacity: 0.14 },
  { id: 'autumn', fill: 'rgb(214,150,96)', opacity: 0.14 },
])
export const THEME_IDS = Object.freeze(THEMES.map((theme) => theme.id))
export const DEFAULT_THEME = 'default'

export const WEATHER_KIND = Object.freeze({
  CLEAR: 'clear',
  CLOUDY: 'cloudy',
  RAIN: 'rain',
  THUNDERSTORM: 'thunderstorm',
})

const MOOD_TO_WEATHER = Object.freeze({
  normal: WEATHER_KIND.CLEAR,
  smooth: WEATHER_KIND.CLEAR,
  intense: WEATHER_KIND.CLEAR,
  idle: WEATHER_KIND.CLEAR,
  rushing: WEATHER_KIND.CLOUDY,
  frustrated: WEATHER_KIND.RAIN,
  stuck: WEATHER_KIND.THUNDERSTORM,
})

function lerp(a, b, t) {
  return a + (b - a) * t
}

export function getLightingOverlay(hour) {
  const n = Number(hour)
  if (!Number.isFinite(n)) return { ...NIGHT_OVERLAY }
  const h = ((n % 24) + 24) % 24

  let lo = LIGHTING_KEYFRAMES[0]
  let hi = LIGHTING_KEYFRAMES[LIGHTING_KEYFRAMES.length - 1]
  for (let i = 0; i < LIGHTING_KEYFRAMES.length - 1; i++) {
    if (h >= LIGHTING_KEYFRAMES[i].h && h <= LIGHTING_KEYFRAMES[i + 1].h) {
      lo = LIGHTING_KEYFRAMES[i]
      hi = LIGHTING_KEYFRAMES[i + 1]
      break
    }
  }

  const span = hi.h - lo.h
  const t = span === 0 ? 0 : (h - lo.h) / span
  const r = Math.round(lerp(lo.rgb[0], hi.rgb[0], t))
  const g = Math.round(lerp(lo.rgb[1], hi.rgb[1], t))
  const b = Math.round(lerp(lo.rgb[2], hi.rgb[2], t))
  const opacity = Math.round(lerp(lo.op, hi.op, t) * 1000) / 1000
  return { fill: `rgb(${r}, ${g}, ${b})`, opacity }
}

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

export function moodToWeather(mood) {
  return MOOD_TO_WEATHER[mood] || WEATHER_KIND.CLEAR
}

export function buildAmbientAppearanceViewModel({
  hour,
  mood,
  themeId = DEFAULT_THEME,
  lightingEnabled = true,
  weatherEffects = true,
  reducedMotion = false,
} = {}) {
  const hasFiniteHour = Number.isFinite(Number(hour))
  const lightingOverlay = getLightingOverlay(hour)
  const lightingOpacity = lightingEnabled && hasFiniteHour ? lightingOverlay.opacity : 0
  const theme = isValidTheme(themeId) ? themeId : DEFAULT_THEME
  const baseThemeOverlay = themeOverlay(theme)
  const themeOpacity = cappedThemeOpacity(baseThemeOverlay.opacity, lightingOpacity)
  const weather = moodToWeather(mood)
  const weatherReduced = Boolean(reducedMotion || !weatherEffects)

  return {
    version: AMBIENT_APPEARANCE_VERSION,
    weather: {
      kind: weather,
      visible: weather !== WEATHER_KIND.CLEAR,
      animated: weather !== WEATHER_KIND.CLEAR && !weatherReduced,
      reducedMotion: weatherReduced,
    },
    lighting: {
      enabled: Boolean(lightingEnabled),
      overlay: { ...lightingOverlay },
      visible: Boolean(lightingEnabled && hasFiniteHour && lightingOverlay.opacity > 0),
    },
    theme: {
      id: theme,
      overlay: { fill: baseThemeOverlay.fill, opacity: themeOpacity },
      baseOpacity: baseThemeOverlay.opacity,
      visible: themeOpacity > 0,
    },
  }
}
