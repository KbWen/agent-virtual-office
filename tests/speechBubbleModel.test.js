import { describe, expect, it } from 'vitest'

import {
  bubbleDisplayText,
  computeBubbleLayout,
  computeEdgeShift,
  estimateBubbleTextWidth,
  sanitizeBubbleText,
  speechBubbleGeometry,
} from '../src/systems/speechBubbleModel.mjs'
import { computeEdgeShift as computeEdgeShiftFromLegacyComponent } from '../src/components/BehaviorBubble.jsx'

describe('speechBubbleModel — portable speech bubble view-model', () => {
  it('removes replacement characters and lone surrogates while preserving paired emoji', () => {
    expect(sanitizeBubbleText(`go\uFFFD\uD83D🚀\uDC00`)).toBe('go🚀')
    expect(sanitizeBubbleText('修好🧪流程')).toBe('修好🧪流程')
  })

  it('truncates by Unicode code points, not UTF-16 code units', () => {
    expect(bubbleDisplayText('abcdefghijklmnopq')).toBe('abcdefghijklmnop…')
    expect(bubbleDisplayText('修好🧪流程', 3)).toBe('修好🧪…')
  })

  it('estimates CJK/emoji bubble width wider than ASCII and preserves legacy minimum width', () => {
    expect(estimateBubbleTextWidth('abc')).toBe(19.5)
    expect(estimateBubbleTextWidth('修好🧪')).toBe(33)
    expect(computeBubbleLayout('abc')).toEqual({ displayMsg: 'abc', boxW: 48 })
    expect(computeBubbleLayout('abcdefghijklmnopq')).toEqual({
      displayMsg: 'abcdefghijklmnop…',
      boxW: 129,
    })
  })

  it('computes reusable SVG geometry while keeping the tail anchored to the speaker', () => {
    expect(speechBubbleGeometry({ x: 0, y: 0, boxW: 100, shift: 20 })).toMatchObject({
      bx: -30,
      by: -34,
      tailAnchor: 0,
      tailBaseY: -8,
      tailTipY: -2,
      textX: 20,
    })

    expect(speechBubbleGeometry({ x: 0, y: 0, boxW: 100, below: true })).toMatchObject({
      by: 8,
      tailBaseY: 8,
      tailTipY: 2,
    })
  })

  it('keeps the legacy component edge-shift export equivalent to the node-safe model', () => {
    const input = { boxW: 100, absX: 30, scale: 1, sceneW: 800, edgePad: 4 }
    expect(computeEdgeShiftFromLegacyComponent(input)).toBe(computeEdgeShift(input))
  })
})
