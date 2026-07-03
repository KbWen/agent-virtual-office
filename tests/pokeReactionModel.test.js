import { describe, expect, it } from 'vitest'
import {
  LONG_AT,
  POKE_INTENSITY_TIMING,
  POKE_MOTION_PROFILE,
  POKE_QUIP_MS,
  POKE_RESET_MS,
  POKE_WINDOW_MS,
  TURNAWAY_AT,
  buildPokeReactionViewModel,
  pickPokeReaction,
  pickQuipIndex,
  poolKeyForStatus,
  pushPoke,
  streakInWindow,
} from '../src/systems/pokeReactionModel.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  pickPokeReaction as legacyPickPokeReaction,
  poolKeyForStatus as legacyPoolKeyForStatus,
  pushPoke as legacyPushPoke,
} from '../src/systems/pokeReaction.js'

describe('pokeReactionModel public API', () => {
  it('matches legacy status pool and history behavior', () => {
    expect(poolKeyForStatus('awaiting-approval')).toBe('blocked')
    expect(poolKeyForStatus('nonsense')).toBe('idle')
    expect(poolKeyForStatus('blocked')).toBe(legacyPoolKeyForStatus('blocked'))

    const history = [0, 1000]
    expect(pushPoke(history, 2000)).toEqual(legacyPushPoke(history, 2000))
    expect(history).toEqual([0, 1000])
  })

  it('matches legacy escalation thresholds and reset windows', () => {
    let history = []
    let now = 0
    const intensities = []
    for (let i = 0; i < TURNAWAY_AT; i++) {
      now += 300
      const reaction = pickPokeReaction('working', history, now)
      history = reaction.nextHistory
      intensities.push(reaction.intensity)
    }

    expect(intensities[LONG_AT - 2]).toBe('normal')
    expect(intensities[LONG_AT - 1]).toBe('long')
    expect(intensities[TURNAWAY_AT - 1]).toBe('turnaway')
    expect(pickPokeReaction('working', history, now)).toEqual(legacyPickPokeReaction('working', history, now))
    expect(pickPokeReaction('working', [0], POKE_WINDOW_MS).streak).toBe(1)
    expect(pickPokeReaction('working', history, now + POKE_RESET_MS + 1).streak).toBe(1)
  })

  it('exposes streak and quip index for alternate renderers', () => {
    expect(streakInWindow([0, 10, 20], 21)).toBe(3)
    expect(pickQuipIndex(4, 5)).toBe(0)
    expect(buildPokeReactionViewModel({
      status: 'blocked',
      history: [100, 200],
      now: 300,
      poolLength: 2,
    })).toMatchObject({
      poolKey: 'blocked',
      streak: 3,
      intensity: 'long',
      quipIndex: 0,
      timing: POKE_INTENSITY_TIMING.long,
      turnAway: false,
    })
  })

  it('returns turnaway timing for persistent pokes without changing real status', () => {
    const model = buildPokeReactionViewModel({
      status: 'done',
      history: [100, 200, 300, 400],
      now: 500,
      poolLength: 3,
    })

    expect(model.poolKey).toBe('done')
    expect(model.intensity).toBe('turnaway')
    expect(model.timing).toMatchObject({
      bobMs: 720,
      bobClearMs: 720,
      quipMs: POKE_QUIP_MS,
      animationSeconds: 0.5,
      motion: POKE_MOTION_PROFILE.turnaway,
      turnAway: true,
    })
    expect(model.nextHistory).toEqual([100, 200, 300, 400, 500])
  })

  it('keeps public renderer timing in parity with current AgentCharacter hardcoded motion', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const source = readFileSync(path.join(here, '../src/components/AgentCharacter.jsx'), 'utf8')

    expect(source).toContain('setTimeout(() => setPokeQuip(null), 1200)')
    expect(source).toContain("setTimeout(() => setPokeBob(null), r.intensity === 'normal' ? 460 : 720)")
    for (const profile of Object.values(POKE_MOTION_PROFILE)) {
      expect(source).toContain(profile.values)
      expect(source).toContain(profile.keyTimes)
      expect(source).toContain(profile.dur)
    }
  })
})
