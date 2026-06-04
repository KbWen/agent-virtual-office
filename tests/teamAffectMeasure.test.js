import { describe, it, expect } from 'vitest'
import { resolveFocusFacing, calcFacing } from '../src/systems/movementSystem.js'
import { floorTickAllowed } from '../src/systems/officeLife.js'
import { LIVE_FLOOR_FIRE_CHANCE } from '../src/systems/constants.js'

// living-office-events — measurement closure of AC-4 (orientation) + AC-7 (scaled-not-muted floor).

describe('AC-4: resolveFocusFacing — team orients toward the live desk (untracked-only)', () => {
  // dev is the hot desk at the right; the idle agent sits to its left → should face 'right'.
  const baseState = {
    focusAnchor: 'dev',
    agents: {
      dev: { position: { x: 400, y: 200 }, status: 'working' },
      qa: { position: { x: 100, y: 200 }, status: 'idle' },
    },
    externalStatus: { dev: { status: 'working' } }, // dev is tracked; qa is untracked
  }

  it('an UNTRACKED agent faces toward the anchor desk', () => {
    const dir = resolveFocusFacing(baseState, 'qa', 100, 200)
    expect(dir).toBe('right') // anchor (dev) is to qa's right
    expect(dir).toBe(calcFacing(100, 200, 400, 200))
  })

  it('a TRACKED agent is NEVER oriented (R1)', () => {
    expect(resolveFocusFacing(baseState, 'dev', 400, 200)).toBeNull()
  })

  it('bails when the anchor is missing, self, or idle', () => {
    expect(resolveFocusFacing({ ...baseState, focusAnchor: null }, 'qa', 100, 200)).toBeNull()
    expect(resolveFocusFacing({ ...baseState, focusAnchor: 'qa' }, 'qa', 100, 200)).toBeNull() // self
    const idleAnchor = { ...baseState, agents: { ...baseState.agents, dev: { position: { x: 400, y: 200 }, status: 'idle' } } }
    expect(resolveFocusFacing(idleAnchor, 'qa', 100, 200)).toBeNull()
  })

  it('resolves a slug~role worktree anchor to its base-role rendered agent', () => {
    const wt = {
      focusAnchor: 'feat-x~dev',
      agents: { dev: { position: { x: 400, y: 50 }, status: 'working' }, qa: { position: { x: 400, y: 300 }, status: 'idle' } },
      externalStatus: {},
    }
    // anchor (dev) is above qa → qa faces 'up'
    expect(resolveFocusFacing(wt, 'qa', 400, 300)).toBe('up')
  })
})

describe('AC-7: floorTickAllowed scales (not mutes) the ambient floor when live', () => {
  const live = { statusSource: 'external', teamPulse: 0.9 }
  const fallbackLive = { statusSource: 'fallback', teamPulse: 0.5 }
  const idleDemo = { statusSource: 'organic', teamPulse: 0 }

  it('an idle/demo session fires the floor at full rate (always allowed)', () => {
    for (let i = 0; i < 50; i++) expect(floorTickAllowed(idleDemo)).toBe(true)
  })

  it('a live session SCALES the floor toward LIVE_FLOOR_FIRE_CHANCE — neither muted (0) nor full (1)', () => {
    const n = 6000
    let fired = 0
    for (let i = 0; i < n; i++) if (floorTickAllowed(live)) fired++
    const rate = fired / n
    expect(rate).toBeGreaterThan(0)               // NOT muted (AC-7: working never silent)
    expect(rate).toBeLessThan(1)                  // genuinely scaled down vs idle/demo
    expect(Math.abs(rate - LIVE_FLOOR_FIRE_CHANCE)).toBeLessThan(0.06) // ≈ the configured chance
  })

  it('a count-only (fallback) live session is also scaled — not over-firing', () => {
    const n = 6000
    let fired = 0
    for (let i = 0; i < n; i++) if (floorTickAllowed(fallbackLive)) fired++
    expect(fired / n).toBeLessThan(1)
  })
})
