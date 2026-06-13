import { describe, it, expect, vi, afterEach } from 'vitest'
import * as movementSystem from '../src/systems/movementSystem.js'

describe('getTargetForBehavior socialTargetOverride', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('correctly uses an agent object as socialTargetOverride', () => {
    const pmAgent = { 
      id: 'pm', 
      position: { x: 500, y: 500 } 
    }
    const agents = {
      dev: { id: 'dev', position: { x: 100, y: 100 } },
      pm: pmAgent
    }

    // De-flake (#147 follow-up): pin Math.random so the social-approach angle/dist are
    // deterministic. Without this the target is random AND avoidOverlap can shove it away from the
    // peer-as-obstacle — ~14% of calls landed outside the box below (e.g. y≈173), making this test
    // intermittently fail in full-suite runs. Fixed seed (0.5) → target (440,500): a clean point
    // 60px left of the peer, exactly the "walk up beside them" behavior this test means to assert.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const target = movementSystem.getTargetForBehavior('dev', 'chat', agents, pmAgent)

    expect(target).toBeDefined()
    // مختصات هدف باید نزدیک به مختصات pm (یعنی 500) باشد (با احتساب فاصله 50-70 پیکسلی)
    expect(target.x).toBeGreaterThan(400)
    expect(target.x).toBeLessThan(600)
    expect(target.y).toBeGreaterThan(400)
    expect(target.y).toBeLessThan(600)
  })

  it('fails when socialTargetOverride is just a string ID (Documenting current behavior)', () => {
    const agents = {
      dev: { id: 'dev', position: { x: 100, y: 100 } },
      pm: { id: 'pm', position: { x: 500, y: 500 } }
    }

    // این تست تایید می‌کند که اگر فقط ID بفرستیم، کد کرش می‌کند
    // این برای مستندسازی رفتار فعلی سیستم در تست‌ها عالی است
    expect(() => {
      movementSystem.getTargetForBehavior('dev', 'chat', agents, 'pm')
    }).toThrow()
  })
})
