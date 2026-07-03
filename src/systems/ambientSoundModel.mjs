import { WEATHER_KIND, moodToWeather } from './weatherModel.mjs'

export const AMBIENT_SOUND_VERSION = 'ambient-sound-v1'
export const SOUNDSCAPE_STORAGE_KEY = 'avo.sound.enabled'

export const MASTER_CAP = 0.10
export const MASTER_CENTER = 0.05
export const BREATHE_DEPTH = 0.015
export const CLATTER_TAP_GAIN = 0.04
export const RAIN_GAIN = 0.05
export const STORM_GAIN = 0.08
export const MIN_INTERVAL_MS = 280
export const MAX_INTERVAL_MS = 2200
export const RATE_SMOOTH_TC = 4.0
export const ENABLE_RAMP = 1.6
export const DISABLE_RAMP = 1.2
export const RAIN_RAMP = 2.2

export function rainTargetGain(mood, weatherEffects, reducedMotion) {
  if (reducedMotion || !weatherEffects) return 0
  const weather = moodToWeather(mood)
  if (weather === WEATHER_KIND.THUNDERSTORM) return STORM_GAIN
  if (weather === WEATHER_KIND.RAIN) return RAIN_GAIN
  return 0
}

export function meanIntervalForPulse(pulse) {
  const value = Math.max(0, Math.min(1, Number(pulse) || 0))
  if (value <= 0) return Infinity
  return MAX_INTERVAL_MS + (MIN_INTERVAL_MS - MAX_INTERVAL_MS) * value
}

export function initSoundscapeEnabled(win = (typeof window !== 'undefined' ? window : undefined)) {
  if (!win) return false
  try {
    const value = win.localStorage?.getItem(SOUNDSCAPE_STORAGE_KEY)
    if (value === null || value === undefined) return false
    if (win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return false
    return value === 'on'
  } catch {
    return false
  }
}

export function shouldRunSoundscape(state = {}) {
  return Boolean(state.soundscapeEnabled && !state.reducedMotion)
}

export function ambientSoundStateSignature(state = {}) {
  return [
    state.soundscapeEnabled ? 1 : 0,
    state.reducedMotion ? 1 : 0,
    state.weatherEffects ? 1 : 0,
    String(state.mood),
  ].join('|')
}

export function buildAmbientSoundViewModel({
  mood,
  weatherEffects = true,
  reducedMotion = false,
  soundscapeEnabled = false,
  teamPulse = 0,
} = {}) {
  const enabled = shouldRunSoundscape({ soundscapeEnabled, reducedMotion })
  const weather = moodToWeather(mood)
  const rainGain = enabled ? rainTargetGain(mood, weatherEffects, reducedMotion) : 0
  const keyboardInterval = enabled ? meanIntervalForPulse(teamPulse) : Infinity

  return {
    version: AMBIENT_SOUND_VERSION,
    enabled,
    reducedMotion: Boolean(reducedMotion),
    master: {
      cap: MASTER_CAP,
      target: enabled ? MASTER_CENTER : 0,
    },
    keyboard: {
      audible: Number.isFinite(keyboardInterval),
      meanIntervalMs: keyboardInterval,
      pulse: Math.max(0, Math.min(1, Number(teamPulse) || 0)),
    },
    weather: {
      kind: weather,
      audible: rainGain > 0,
      gain: rainGain,
      gatedByWeatherEffects: !weatherEffects,
      gatedByReducedMotion: Boolean(reducedMotion),
    },
  }
}
