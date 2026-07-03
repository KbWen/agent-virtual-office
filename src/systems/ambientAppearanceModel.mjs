// Node-safe ambient appearance contract for alternate renderers.
//
// This mirrors the existing lighting/theme/weather semantics without importing
// React components, the store, i18n, or browser-only .js modules from package
// subpaths. Renderers decide how to draw the weather and tints; this module only
// resolves the honest visual state.

export { WEATHER_KIND, moodToWeather } from './weatherModel.mjs'
import { WEATHER_KIND, moodToWeather } from './weatherModel.mjs'
export { MAX_LIGHTING_OPACITY, getLightingOverlay } from './lightingModel.mjs'
import { getLightingOverlay } from './lightingModel.mjs'
export {
  DEFAULT_THEME,
  THEMES,
  THEME_IDS,
  THEME_LIGHTING_SUM_CAP,
  THEME_OPACITY_CAP,
  cappedThemeOpacity,
  isValidTheme,
  themeOverlay,
} from './themeModel.mjs'
import {
  DEFAULT_THEME,
  cappedThemeOpacity,
  isValidTheme,
  themeOverlay,
} from './themeModel.mjs'

export const AMBIENT_APPEARANCE_VERSION = 'ambient-appearance-v1'

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
