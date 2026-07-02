import { describe, expect, it } from 'vitest'

import {
  BEHAVIOR_INDICATOR_TABLE,
  behaviorIndicatorIconKey,
  behaviorIndicatorState,
  hasBehaviorIndicator,
  KNOWN_CHARACTER_BEHAVIORS,
  NO_INDICATOR_CHARACTER_BEHAVIORS,
} from '../src/systems/behaviorIndicatorModel.mjs'
import {
  behaviorIndicatorState as behaviorIndicatorStateFromCore,
  KNOWN_CHARACTER_BEHAVIORS as KNOWN_CHARACTER_BEHAVIORS_FROM_CORE,
} from '../src/systems/statusCore.mjs'

describe('behaviorIndicatorModel — portable behavior icon semantics', () => {
  it('exposes every rendered overhead icon as a stable semantic token', () => {
    expect(behaviorIndicatorIconKey('typing')).toBe('keyboard')
    expect(behaviorIndicatorState('typing', 2)).toMatchObject({
      behavior: 'typing',
      iconKey: 'keyboard',
      variant: 'typing',
      animated: true,
      known: true,
      frame: 2,
      offset: { x: 14, y: -8 },
    })

    expect(behaviorIndicatorState('gantt-chart')).toMatchObject({
      iconKey: 'chart',
      variant: 'timeline',
    })
    expect(behaviorIndicatorState('shield-verify')).toMatchObject({
      iconKey: 'shield',
      variant: 'verify',
    })
  })

  it('normalizes alias behaviors to the shared icon families', () => {
    expect(behaviorIndicatorState('drink-coffee')).toMatchObject({ iconKey: 'coffee', variant: 'steam' })
    expect(behaviorIndicatorState('goto-coffee-machine')).toMatchObject({ iconKey: 'coffee', variant: 'steam' })
    expect(behaviorIndicatorState('scratch-head')).toMatchObject({ iconKey: 'frustration', variant: 'marks' })
    expect(behaviorIndicatorState('sigh')).toMatchObject({ iconKey: 'frustration', variant: 'marks' })
    expect(behaviorIndicatorState('desk-slam')).toMatchObject({ iconKey: 'frustration', variant: 'marks' })
  })

  it('keeps legal no-icon behaviors known without inventing an overhead glyph', () => {
    for (const behavior of NO_INDICATOR_CHARACTER_BEHAVIORS) {
      expect(behaviorIndicatorState(behavior), behavior).toMatchObject({
        behavior,
        iconKey: null,
        variant: null,
        animated: false,
        known: true,
      })
      expect(hasBehaviorIndicator(behavior)).toBe(false)
    }
  })

  it('marks truly unknown behaviors as unknown and clamps animation frames', () => {
    expect(behaviorIndicatorState('new-future-behavior', 99)).toMatchObject({
      behavior: 'new-future-behavior',
      iconKey: null,
      known: false,
      frame: 3,
    })
    expect(behaviorIndicatorState('typing', NaN).frame).toBe(0)
  })

  it('keeps the known behavior drift guard broader than the icon table', () => {
    expect(KNOWN_CHARACTER_BEHAVIORS).toContain('pass-document')
    expect(KNOWN_CHARACTER_BEHAVIORS).toContain('desk-slam')
    expect(Object.keys(BEHAVIOR_INDICATOR_TABLE).every((key) => KNOWN_CHARACTER_BEHAVIORS.includes(key))).toBe(true)
  })

  it('accepts every behavior currently emitted by the behavior engine pools', () => {
    const engineBehaviors = [
      'typing',
      'reading-screen',
      'writing-notes',
      'whiteboard',
      'research',
      'gantt-chart',
      'magnifier',
      'deploy-button',
      'shield-verify',
      'drink-coffee',
      'drink-water',
      'stretch',
      'look-window',
      'check-phone',
      'eat-snack',
      'print',
      'chat',
      'pass-document',
      'thumbs-up',
      'goto-coffee-machine',
      'toilet',
      'nap',
      'phone-call',
      'scratch-head',
      'sigh',
      'desk-slam',
    ]

    for (const behavior of engineBehaviors) {
      expect(behaviorIndicatorState(behavior).known, behavior).toBe(true)
    }
  })

  it('is exported through the aggregate status-core path', () => {
    expect(behaviorIndicatorStateFromCore('whiteboard')).toMatchObject({ iconKey: 'whiteboard' })
    expect(KNOWN_CHARACTER_BEHAVIORS_FROM_CORE).toContain('typing')
  })
})
