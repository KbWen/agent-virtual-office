import { describe, expect, it } from 'vitest'
import {
  BLOCKED_LIKE_STATUSES,
  PET_MODES,
  PET_STATE_VERSION,
  PET_TYPES,
  buildPetStateViewModel,
  countAttentionBlockers,
  derivePetState,
  firstAttentionBlockerId,
  modeEmote,
  nextPetType,
  petIsMobile,
  petMotionGrammar,
  petReadabilityScale,
  pickWanderTarget,
  resolvePetMode,
  runTarget,
  segmentWalkable,
} from '../src/systems/petStateModel.mjs'
import * as legacy from '../src/systems/petState.js'

describe('petStateModel', () => {
  it('keeps legacy pet state parity', () => {
    expect(PET_MODES).toEqual(legacy.PET_MODES)
    expect(PET_TYPES).toEqual(legacy.PET_TYPES)
    expect([...BLOCKED_LIKE_STATUSES].sort()).toEqual([...legacy.BLOCKED_LIKE_STATUSES].sort())

    for (const mood of ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle', 'bogus', undefined]) {
      for (const blockedCount of [0, 1, 3]) {
        expect(derivePetState({ mood, blockedCount }), `${String(mood)}:${blockedCount}`).toBe(
          legacy.derivePetState({ mood, blockedCount }),
        )
      }
    }
    for (const mode of Object.values(PET_MODES)) {
      expect(petIsMobile(mode), `mobile ${mode}`).toBe(legacy.petIsMobile(mode))
      expect(modeEmote(mode), `emote ${mode}`).toBe(legacy.modeEmote(mode))
    }
  })

  it('matches legacy blockers, targets, type cycling, motion, and readability', () => {
    const externalStatus = {
      qa: { status: 'awaiting-approval' },
      dev: { status: 'blocked' },
      pm: { status: 'working' },
    }
    expect(countAttentionBlockers(externalStatus)).toBe(legacy.countAttentionBlockers(externalStatus))
    expect(firstAttentionBlockerId(externalStatus)).toBe(legacy.firstAttentionBlockerId(externalStatus))
    expect(runTarget({ x: 300, y: 200 })).toEqual(legacy.runTarget({ x: 300, y: 200 }))
    for (const type of [...PET_TYPES, 'bogus']) {
      expect(nextPetType(type)).toBe(legacy.nextPetType(type))
      expect(petMotionGrammar(type)).toEqual(legacy.petMotionGrammar(type))
    }
    for (const scale of [1, 1.5, 0.64, 0.25, 0.4, 0, -1, NaN]) {
      expect(petReadabilityScale(scale)).toBe(legacy.petReadabilityScale(scale))
    }
  })

  it('matches legacy transient mode and walkability helpers', () => {
    for (const base of [PET_MODES.WANDER, PET_MODES.NAP, PET_MODES.HIDE]) {
      for (const alert of [false, true]) {
        for (const celebrate of [false, true]) {
          expect(resolvePetMode({ base, alert, celebrate })).toBe(legacy.resolvePetMode({ base, alert, celebrate }))
        }
      }
    }

    const from = { x: 0, y: 0 }
    const to = { x: 0, y: 10 }
    const blocked = { x: 0, y: 6 }
    const isWalkable = (x, y) => Math.hypot(x - blocked.x, y - blocked.y) > 1
    expect(segmentWalkable(from, to, isWalkable)).toBe(legacy.segmentWalkable(from, to, isWalkable))

    let i = 0
    const sample = () => i++ === 0 ? { x: 0, y: 10 } : { x: 0, y: 50 }
    const always = () => true
    expect(pickWanderTarget(from, sample, always)).toEqual({ x: 0, y: 10 })
  })

  it('builds a renderer-facing pet view model from real status signals', () => {
    const model = buildPetStateViewModel({
      mood: 'smooth',
      externalStatus: {
        qa: { status: 'awaiting-approval' },
        dev: { status: 'working' },
      },
      celebrate: true,
      petType: 'dog',
      sceneScale: 0.25,
      targetPosition: { x: 300, y: 200 },
    })

    expect(model).toMatchObject({
      version: PET_STATE_VERSION,
      baseMode: PET_MODES.HIDE,
      mode: PET_MODES.HIDE,
      emote: legacy.modeEmote(PET_MODES.HIDE),
      mobile: false,
      blocked: { count: 1, firstId: 'qa' },
      type: { id: 'dog', next: 'rabbit' },
      scale: 1.6,
      target: { x: 300, y: 218 },
    })
    expect(model.type.motion).toEqual(petMotionGrammar('dog'))
  })

  it('does not let an explicit stale blockedCount hide real external blockers', () => {
    const model = buildPetStateViewModel({
      mood: 'smooth',
      externalStatus: { qa: { status: 'awaiting-approval' } },
      blockedCount: 0,
      celebrate: true,
    })

    expect(model.blocked).toEqual({ count: 1, firstId: 'qa' })
    expect(model.baseMode).toBe(PET_MODES.HIDE)
    expect(model.mode).toBe(PET_MODES.HIDE)
  })
})
