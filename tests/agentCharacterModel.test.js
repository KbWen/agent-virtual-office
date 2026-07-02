import { describe, expect, it } from 'vitest'

import {
  BASE_GLOW,
  characterBubbleLayout,
  characterBubbleMessage,
  characterIndicatorState,
  characterStatusRing,
  characterStatusVisual,
  computeLabelScale,
  estimateTextWidth,
  LABEL_SCALE_MAX,
  nameTagMetrics,
} from '../src/systems/agentCharacterModel.mjs'
import {
  characterStatusVisual as characterStatusVisualFromCore,
  computeLabelScale as computeLabelScaleFromCore,
} from '../src/systems/statusCore.mjs'

describe('agentCharacterModel — portable character view tokens', () => {
  it('keeps the label counter-scale readability contract', () => {
    expect(computeLabelScale(1)).toBe(1)
    expect(computeLabelScale(1.5)).toBe(1)
    expect(computeLabelScale(0.8)).toBeCloseTo(1.25, 5)
    expect(computeLabelScale(0.5)).toBe(LABEL_SCALE_MAX)
    expect(computeLabelScale(0)).toBe(1)
  })

  it('estimates monospace name tag width with wider CJK characters', () => {
    expect(estimateTextWidth('QA')).toBe(14)
    expect(estimateTextWidth('設計')).toBe(20)
    expect(nameTagMetrics('設計')).toEqual({ tagW: 36, tagHalfW: 18 })
  })

  it('derives name tag fill, visibility, and active ring tokens from status', () => {
    expect(characterStatusVisual({ status: 'idle', color: '#abc', hovered: false })).toMatchObject({
      tagFill: '#abc',
      glowColor: '#888',
      showName: false,
      ring: null,
    })

    expect(characterStatusVisual({ status: 'blocked', color: '#abc' })).toMatchObject({
      tagFill: '#E24B4A',
      glowColor: '#E24B4A',
      showName: true,
      ring: { kind: 'blocked', animate: 'urgent-breathe', op: 0.4, sw: 2 },
    })

    expect(characterStatusVisual({ status: 'future-status', color: '#abc' })).toMatchObject({
      tagFill: '#abc',
      glowColor: null,
      showName: true,
      ring: null,
    })
  })

  it('folds effort and helper supervision into one status ring model', () => {
    expect(characterStatusRing({ status: 'working', effort: 'xhigh' })).toMatchObject({
      kind: 'active',
      animate: 'pulse',
      op: 0.85,
      sw: 3,
    })

    expect(characterStatusRing({ status: 'planning', effort: 'max' })).toMatchObject({
      kind: 'active',
      animate: 'pulse',
      ...BASE_GLOW,
    })

    expect(characterStatusRing({ status: 'working', hasActiveHelper: true })).toMatchObject({
      kind: 'supervising',
      animate: 'slow-breathe',
      op: 0.3,
      sw: 2,
    })
  })

  it('models non-active rings without requiring React', () => {
    expect(characterStatusRing({ status: 'awaiting-approval' })).toMatchObject({
      kind: 'awaiting-approval',
      animate: 'calm-breathe',
      op: 0.45,
    })
    expect(characterStatusRing({ status: 'done' })).toMatchObject({
      kind: 'done',
      animate: 'flash',
      sw: 2.5,
    })
  })

  it('keeps blocked reason badges as the dominant stationary indicator', () => {
    expect(characterIndicatorState({
      status: 'blocked',
      behavior: 'typing',
      reasonCode: 'api-rate-limit',
    })).toMatchObject({
      kind: 'blocked-reason',
      key: 'reason-api-rate-limit',
      reasonCode: 'api-rate-limit',
      behavior: 'typing',
      iconKey: 'blocked-reason',
      variant: 'api-rate-limit',
    })

    expect(characterIndicatorState({ status: 'working', behavior: 'typing' })).toMatchObject({
      kind: 'behavior',
      key: 'typing',
      behavior: 'typing',
      iconKey: 'keyboard',
      variant: 'typing',
    })

    expect(characterIndicatorState({ status: 'blocked', isWalking: true })).toMatchObject({
      kind: 'none',
      iconKey: null,
    })
  })

  it('flips bubbles below agents that are too close to the top edge', () => {
    expect(characterBubbleLayout({ position: { x: 100, y: 120 }, labelScale: 1 })).toMatchObject({
      below: false,
      y: -68,
    })
    expect(characterBubbleLayout({ position: { x: 100, y: 80 }, labelScale: 1.5 })).toMatchObject({
      below: true,
      y: 6,
    })
  })

  it('gives poke quips precedence over ambient bubbles', () => {
    expect(characterBubbleMessage({ pokeQuip: 'ok', bubbleVisible: true, bubble: 'ambient' })).toBe('ok')
    expect(characterBubbleMessage({ bubbleVisible: true, bubble: 'ambient' })).toBe('ambient')
    expect(characterBubbleMessage({ bubbleVisible: false, bubble: 'ambient' })).toBeNull()
  })

  it('is exported through the aggregate status-core path', () => {
    expect(computeLabelScaleFromCore(0.8)).toBeCloseTo(1.25, 5)
    expect(characterStatusVisualFromCore({ status: 'done', color: '#abc' }).tagFill).toBe('#5CB88A')
  })
})
