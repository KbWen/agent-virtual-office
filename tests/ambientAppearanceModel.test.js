import { describe, expect, it } from 'vitest'
import {
  AMBIENT_APPEARANCE_VERSION,
  DEFAULT_THEME,
  MAX_LIGHTING_OPACITY,
  THEME_IDS,
  THEME_LIGHTING_SUM_CAP,
  THEME_OPACITY_CAP,
  THEMES,
  WEATHER_KIND,
  buildAmbientAppearanceViewModel,
  cappedThemeOpacity,
  getLightingOverlay,
  isValidTheme,
  moodToWeather,
  themeOverlay,
} from '../src/systems/ambientAppearanceModel.mjs'
import { getLightingOverlay as legacyLightingOverlay, MAX_OPACITY as LEGACY_MAX_OPACITY } from '../src/systems/lighting.js'
import {
  DEFAULT_THEME as LEGACY_DEFAULT_THEME,
  THEME_IDS as LEGACY_THEME_IDS,
  THEME_LIGHTING_SUM_CAP as LEGACY_THEME_LIGHTING_SUM_CAP,
  THEME_OPACITY_CAP as LEGACY_THEME_OPACITY_CAP,
  THEMES as LEGACY_THEMES,
  cappedThemeOpacity as legacyCappedThemeOpacity,
  isValidTheme as legacyIsValidTheme,
  themeOverlay as legacyThemeOverlay,
} from '../src/systems/theme.js'
import { moodToWeather as legacyMoodToWeather } from '../src/components/TopDownFurniture.jsx'
import { STATUS_COLORS } from '../src/systems/statusVisualModel.mjs'

function parseColor(color) {
  if (color.startsWith('#')) {
    const raw = color.slice(1)
    const hex = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ]
  }
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0]
}

function compositeOver(base, tint, alpha) {
  return base.map((value, index) => value * (1 - alpha) + tint[index] * alpha)
}

function relLum([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((value) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

function contrast(left, right) {
  const l1 = relLum(left)
  const l2 = relLum(right)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

describe('ambientAppearanceModel', () => {
  it('keeps lighting overlay parity with the legacy lighting module', () => {
    expect(MAX_LIGHTING_OPACITY).toBe(LEGACY_MAX_OPACITY)
    for (const hour of [undefined, NaN, -1, 0, 6, 6.5, 7, 9, 16, 18, 20, 23, 24, 25]) {
      expect(getLightingOverlay(hour), `hour ${String(hour)}`).toEqual(legacyLightingOverlay(hour))
    }
  })

  it('keeps theme registry and opacity cap parity with the legacy theme module', () => {
    expect(DEFAULT_THEME).toBe(LEGACY_DEFAULT_THEME)
    expect(THEME_IDS).toEqual(LEGACY_THEME_IDS)
    expect(THEMES).toEqual(LEGACY_THEMES)
    expect(THEME_OPACITY_CAP).toBe(LEGACY_THEME_OPACITY_CAP)
    expect(THEME_LIGHTING_SUM_CAP).toBe(LEGACY_THEME_LIGHTING_SUM_CAP)

    for (const themeId of ['default', 'winter', 'autumn', 'dark', undefined]) {
      expect(isValidTheme(themeId), `valid ${String(themeId)}`).toBe(legacyIsValidTheme(themeId))
      expect(themeOverlay(themeId), `overlay ${String(themeId)}`).toEqual(legacyThemeOverlay(themeId))
    }
    for (const [themeOpacity, lightingOpacity] of [[0.5, 0], [0.2, 0.38], [0.18, 0.4], [0.18, 0.45], [-1, 0.1]]) {
      expect(cappedThemeOpacity(themeOpacity, lightingOpacity)).toBe(legacyCappedThemeOpacity(themeOpacity, lightingOpacity))
    }
  })

  it('keeps mood-to-weather parity and conservative unknown fallbacks', () => {
    for (const mood of ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle', 'mystery', null, undefined, 42]) {
      expect(moodToWeather(mood), `weather ${String(mood)}`).toBe(legacyMoodToWeather(mood))
    }
    expect(moodToWeather('STUCK')).toBe(WEATHER_KIND.CLEAR)
  })

  it('builds a renderer-facing appearance model matching PixelOffice composition rules', () => {
    const model = buildAmbientAppearanceViewModel({
      hour: 0,
      mood: 'frustrated',
      themeId: 'winter',
      lightingEnabled: true,
      weatherEffects: true,
      reducedMotion: false,
    })

    expect(model).toMatchObject({
      version: AMBIENT_APPEARANCE_VERSION,
      weather: {
        kind: WEATHER_KIND.RAIN,
        visible: true,
        animated: true,
        reducedMotion: false,
      },
      lighting: {
        enabled: true,
        overlay: legacyLightingOverlay(0),
        visible: true,
      },
      theme: {
        id: 'winter',
        overlay: { fill: 'rgb(150,180,210)', opacity: 0.07 },
        baseOpacity: 0.14,
        visible: true,
      },
    })
  })

  it('respects lighting/weather toggles, reduced motion, and invalid theme fallback', () => {
    const model = buildAmbientAppearanceViewModel({
      hour: 0,
      mood: 'stuck',
      themeId: 'cyberpunk',
      lightingEnabled: false,
      weatherEffects: false,
      reducedMotion: true,
    })

    expect(model.lighting).toMatchObject({
      enabled: false,
      overlay: legacyLightingOverlay(0),
      visible: false,
    })
    expect(model.theme).toMatchObject({
      id: DEFAULT_THEME,
      overlay: { fill: 'rgb(255,255,255)', opacity: 0 },
      visible: false,
    })
    expect(model.weather).toMatchObject({
      kind: WEATHER_KIND.THUNDERSTORM,
      visible: true,
      animated: false,
      reducedMotion: true,
    })
  })

  it('does not render deep-night lighting when the high-level view-model receives no hour', () => {
    const model = buildAmbientAppearanceViewModel()
    expect(getLightingOverlay(undefined).opacity).toBe(MAX_LIGHTING_OPACITY)
    expect(model.lighting.overlay.opacity).toBe(MAX_LIGHTING_OPACITY)
    expect(model.lighting.visible).toBe(false)
    expect(model.theme.overlay.opacity).toBe(0)
  })

  it('keeps status colors readable under worst-case lighting plus every theme', () => {
    const floor = parseColor('#F8F4E8')
    const baseline = Object.fromEntries(
      Object.entries(STATUS_COLORS).map(([status, color]) => [status, contrast(parseColor(color), floor)]),
    )

    for (const hour of [0, 23]) {
      for (const theme of THEME_IDS) {
        const model = buildAmbientAppearanceViewModel({ hour, themeId: theme })
        expect(model.lighting.overlay.opacity + model.theme.overlay.opacity).toBeLessThanOrEqual(THEME_LIGHTING_SUM_CAP)
        const litFloor = compositeOver(floor, parseColor(model.lighting.overlay.fill), model.lighting.overlay.opacity)
        const themedFloor = compositeOver(litFloor, parseColor(model.theme.overlay.fill), model.theme.overlay.opacity)
        for (const [status, color] of Object.entries(STATUS_COLORS)) {
          expect(
            contrast(parseColor(color), themedFloor),
            `${hour}/${theme}/${status}`,
          ).toBeGreaterThanOrEqual(1.05)
          expect(baseline[status]).toBeGreaterThan(1)
        }
      }
    }
  })

  it('freezes exported theme constants and returns mutable overlay/view-model copies', () => {
    expect(Object.isFrozen(THEMES)).toBe(true)
    expect(Object.isFrozen(THEMES[1])).toBe(true)
    expect(() => {
      THEMES[1].opacity = 1
    }).toThrow(TypeError)

    const overlay = themeOverlay('winter')
    overlay.opacity = 1
    expect(themeOverlay('winter').opacity).toBe(0.14)

    const model = buildAmbientAppearanceViewModel({ themeId: 'winter', hour: 13 })
    model.theme.overlay.opacity = 1
    expect(buildAmbientAppearanceViewModel({ themeId: 'winter', hour: 13 }).theme.overlay.opacity).toBe(0.14)
  })
})
