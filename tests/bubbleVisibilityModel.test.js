import { describe, expect, it } from 'vitest'
import {
  BUBBLE_ROTATE_MS,
  BUBBLE_VISIBLE_CAP,
  buildBubbleVisibilityViewModel,
  bubblePriority,
  selectVisibleBubbles,
} from '../src/systems/bubbleVisibilityModel.mjs'
import {
  BUBBLE_ROTATE_MS as LEGACY_ROTATE_MS,
  bubblePriority as legacyBubblePriority,
  selectVisibleBubbles as legacySelectVisibleBubbles,
} from '../src/systems/bubbleVisibility.js'

const agent = (bubble, status) => ({ bubble, status })
const ext = (status, changedAt) => ({ status, changedAt })

describe('bubbleVisibilityModel public API', () => {
  it('matches the legacy app detector for core selection behavior', () => {
    const agents = {
      dev: agent('typing', 'working'),
      qa: agent('blocked', 'blocked'),
      ops: agent('done', 'done'),
    }
    const externalStatus = {
      dev: ext('working', 30),
      qa: ext('blocked', 10),
      ops: ext('done', 20),
    }

    expect(bubblePriority('awaiting-approval')).toBe(legacyBubblePriority('awaiting-approval'))
    expect(BUBBLE_ROTATE_MS).toBe(LEGACY_ROTATE_MS)
    expect([...selectVisibleBubbles(agents, externalStatus, 2, 0)]).toEqual([
      ...legacySelectVisibleBubbles(agents, externalStatus, 2, 0),
    ])
  })

  it('keeps blocked bubbles pinned over working bubbles', () => {
    const visible = selectVisibleBubbles({
      dev: agent('typing', 'working'),
      qa: agent('stuck', 'blocked'),
    }, {
      dev: ext('working', 99),
      qa: ext('blocked', 1),
    }, 1)

    expect(visible).toEqual(new Set(['qa']))
  })

  it('rotates equal-priority ties by epoch without frame jitter', () => {
    const agents = {
      arch: agent('a', 'working'),
      dev: agent('b', 'working'),
      ops: agent('c', 'working'),
    }
    const externalStatus = {
      arch: ext('working', 10),
      dev: ext('working', 10),
      ops: ext('working', 10),
    }

    expect([...selectVisibleBubbles(agents, externalStatus, 1, 100)]).toEqual([
      ...selectVisibleBubbles(agents, externalStatus, 1, 200),
    ])
    expect([...selectVisibleBubbles(agents, externalStatus, 1, 0)]).not.toEqual([
      ...selectVisibleBubbles(agents, externalStatus, 1, BUBBLE_ROTATE_MS),
    ])
  })

  it('returns a renderer-facing view-model with stable visible ids', () => {
    const model = buildBubbleVisibilityViewModel({
      agents: {
        dev: agent('typing', 'working'),
        qa: agent(null, 'working'),
      },
      externalStatus: {
        dev: ext('working', 3),
      },
      cap: BUBBLE_VISIBLE_CAP,
    })

    expect(model.visibleIds).toEqual(['dev'])
    expect(model.visible.has('dev')).toBe(true)
    expect(model.cap).toBe(3)
  })
})
