import { describe, expect, it } from 'vitest'
import {
  AMBIENT_SOUND_VERSION,
  MASTER_CAP,
  SOUNDSCAPE_STORAGE_KEY,
  ambientSoundStateSignature,
  buildAmbientSoundViewModel,
  initSoundscapeEnabled,
  meanIntervalForPulse,
  rainTargetGain,
  shouldRunSoundscape,
} from '../src/systems/ambientSoundModel.mjs'
import {
  rainTargetGain as legacyRainTargetGain,
  meanIntervalForPulse as legacyMeanIntervalForPulse,
  initSoundscapeEnabled as legacyInitSoundscapeEnabled,
} from '../src/systems/ambientSound.js'

describe('ambientSoundModel', () => {
  it('keeps legacy ambientSound helper parity', () => {
    for (const mood of ['normal', 'smooth', 'intense', 'idle', 'rushing', 'frustrated', 'stuck', undefined]) {
      expect(rainTargetGain(mood, true, false), `rain ${String(mood)}`).toBe(legacyRainTargetGain(mood, true, false))
      expect(rainTargetGain(mood, false, false), `weather gate ${String(mood)}`).toBe(legacyRainTargetGain(mood, false, false))
      expect(rainTargetGain(mood, true, true), `motion gate ${String(mood)}`).toBe(legacyRainTargetGain(mood, true, true))
    }
    for (const pulse of [-1, 0, 0.1, 0.5, 1, 2, undefined]) {
      expect(meanIntervalForPulse(pulse), `pulse ${String(pulse)}`).toBe(legacyMeanIntervalForPulse(pulse))
    }
  })

  it('builds an honest renderer-facing soundscape model', () => {
    const model = buildAmbientSoundViewModel({
      mood: 'stuck',
      weatherEffects: true,
      reducedMotion: false,
      soundscapeEnabled: true,
      teamPulse: 0.5,
    })

    expect(model).toMatchObject({
      version: AMBIENT_SOUND_VERSION,
      enabled: true,
      master: { cap: MASTER_CAP, target: 0.05 },
      keyboard: { audible: true, pulse: 0.5 },
      weather: { kind: 'thunderstorm', audible: true, gain: 0.08 },
    })
    expect(model.keyboard.meanIntervalMs).toBe(meanIntervalForPulse(0.5))
  })

  it('stays silent when disabled, reduced-motion, or weather effects are off', () => {
    expect(buildAmbientSoundViewModel({ mood: 'stuck', soundscapeEnabled: false, teamPulse: 1 }).weather.gain).toBe(0)
    expect(buildAmbientSoundViewModel({ mood: 'stuck', soundscapeEnabled: false, teamPulse: 1 }).keyboard.audible).toBe(false)

    const reduced = buildAmbientSoundViewModel({ mood: 'stuck', soundscapeEnabled: true, reducedMotion: true, teamPulse: 1 })
    expect(reduced.enabled).toBe(false)
    expect(reduced.weather.gatedByReducedMotion).toBe(true)
    expect(reduced.weather.gain).toBe(0)

    const weatherOff = buildAmbientSoundViewModel({ mood: 'stuck', soundscapeEnabled: true, weatherEffects: false, teamPulse: 1 })
    expect(weatherOff.weather.gatedByWeatherEffects).toBe(true)
    expect(weatherOff.weather.gain).toBe(0)
  })

  it('exposes store preference and state signature helpers', () => {
    const win = {
      localStorage: { getItem: (key) => key === SOUNDSCAPE_STORAGE_KEY ? 'on' : null },
      matchMedia: () => ({ matches: false }),
    }
    expect(initSoundscapeEnabled(win)).toBe(true)
    expect(legacyInitSoundscapeEnabled(win)).toBe(true)
    expect(shouldRunSoundscape({ soundscapeEnabled: true, reducedMotion: false })).toBe(true)
    expect(shouldRunSoundscape({ soundscapeEnabled: true, reducedMotion: true })).toBe(false)
    expect(ambientSoundStateSignature({
      soundscapeEnabled: true,
      reducedMotion: false,
      weatherEffects: true,
      mood: 'frustrated',
    })).toBe('1|0|1|frustrated')
    expect(ambientSoundStateSignature({ soundscapeEnabled: true, reducedMotion: false, weatherEffects: true })).toBe('1|0|1|undefined')
    expect(ambientSoundStateSignature({ soundscapeEnabled: true, reducedMotion: false, weatherEffects: true, mood: null })).toBe('1|0|1|null')
    expect(ambientSoundStateSignature({ soundscapeEnabled: true, reducedMotion: false, weatherEffects: true, mood: '' })).toBe('1|0|1|')
  })
})
