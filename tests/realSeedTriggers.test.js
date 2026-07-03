import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { startOfficeLife } from '../src/systems/officeLife.js'
import { useOfficeStore } from '../src/systems/store.js'
import { SEED_COOLDOWN_MS, WORK_CLAIM_SIGNAL_WINDOW } from '../src/systems/constants.js'

// living-office-events Phase 4 — the CAUSAL real→event link (the owner's "沒有驅動任何一件事情").
// A real-signal EDGE fires the matching coordinated event IMMEDIATELY (not merely makes it eligible
// for the next random tick). Honesty-gated, mutex'd, cooldown'd. Uses the REAL store (has .subscribe).

describe('real-seeded triggers (P4)', () => {
  let teardown
  beforeEach(() => {
    useOfficeStore.setState({ isPaused: false, activeEvent: null, mood: 'normal', externalStatus: {}, helpers: [] })
    teardown = startOfficeLife(useOfficeStore)
  })
  afterEach(() => {
    if (teardown) teardown()
    vi.restoreAllMocks()
    useOfficeStore.setState({ activeEvent: null })
  })

  it('mood edge → smooth causally fires eureka immediately', () => {
    useOfficeStore.setState({ mood: 'smooth' })
    expect(useOfficeStore.getState().activeEvent?.id).toBe('eureka')
  })

  it('mood edge → frustrated fires dev-arch-disagree', () => {
    useOfficeStore.setState({ mood: 'frustrated' })
    expect(useOfficeStore.getState().activeEvent?.id).toBe('dev-arch-disagree')
  })

  it('Ops transitioning to done fires deploy-success', () => {
    useOfficeStore.setState({ externalStatus: { ops: { status: 'done', changedAt: Date.now() } } })
    expect(useOfficeStore.getState().activeEvent?.id).toBe('deploy-success')
  })

  it('Ops transitioning to done with a stale signal does NOT fire deploy-success', () => {
    useOfficeStore.setState({
      externalStatus: {
        ops: { status: 'done', changedAt: Date.now() - WORK_CLAIM_SIGNAL_WINDOW - 1 },
      },
    })
    expect(useOfficeStore.getState().activeEvent).toBeNull()
  })

  it('a new subagent (helpers rises) does NOT fire standup (regression fix — standup piles all agents)', () => {
    useOfficeStore.setState({ helpers: [{ id: 'h1', parentRole: 'dev', role: 'dev' }] })
    expect(useOfficeStore.getState().activeEvent).toBeNull() // SubagentStart shows via helper sprites, not a gather
  })

  it('global cooldown: a second distinct real-seed is gated right after the first (calm-tech, anti event-spam)', () => {
    useOfficeStore.setState({ mood: 'smooth' })
    expect(useOfficeStore.getState().activeEvent?.id).toBe('eureka')
    useOfficeStore.setState({ activeEvent: null, externalStatus: { ops: { status: 'working', changedAt: Date.now() } } })
    useOfficeStore.setState({ externalStatus: { ops: { status: 'done', changedAt: Date.now() } } }) // ops→done edge, but within global cooldown
    expect(useOfficeStore.getState().activeEvent).toBeNull()
  })

  it('mutex: nothing real-seeds while an event is already active', () => {
    useOfficeStore.setState({ activeEvent: { id: 'tea-break' } })
    useOfficeStore.setState({ mood: 'smooth' })
    expect(useOfficeStore.getState().activeEvent?.id).toBe('tea-break') // unchanged
  })

  it('cooldown: the same trigger does not re-fire within the cooldown window', () => {
    useOfficeStore.setState({ mood: 'smooth' })
    expect(useOfficeStore.getState().activeEvent?.id).toBe('eureka')
    useOfficeStore.setState({ activeEvent: null, mood: 'normal' }) // clear + reset the edge
    useOfficeStore.setState({ mood: 'smooth' })                    // edge again, still in cooldown
    expect(useOfficeStore.getState().activeEvent).toBeNull()        // cooldown blocks the re-fire
  })

  it('global cooldown boundary allows a distinct seed exactly at SEED_COOLDOWN_MS', () => {
    const t0 = 1_000_000
    vi.spyOn(Date, 'now').mockReturnValue(t0)
    useOfficeStore.setState({ mood: 'smooth' })
    expect(useOfficeStore.getState().activeEvent?.id).toBe('eureka')

    useOfficeStore.setState({
      activeEvent: null,
      mood: 'normal',
      externalStatus: { ops: { status: 'working', changedAt: t0 } },
    })
    Date.now.mockReturnValue(t0 + SEED_COOLDOWN_MS - 1)
    useOfficeStore.setState({ externalStatus: { ops: { status: 'done', changedAt: Date.now() } } })
    expect(useOfficeStore.getState().activeEvent).toBeNull()

    useOfficeStore.setState({ externalStatus: { ops: { status: 'working', changedAt: Date.now() } } })
    Date.now.mockReturnValue(t0 + SEED_COOLDOWN_MS)
    useOfficeStore.setState({ externalStatus: { ops: { status: 'done', changedAt: Date.now() } } })
    expect(useOfficeStore.getState().activeEvent?.id).toBe('deploy-success')
  })

  it('per-event cooldown is 3x and allows the same event at the exact boundary', () => {
    const t0 = 2_000_000
    vi.spyOn(Date, 'now').mockReturnValue(t0)
    useOfficeStore.setState({ mood: 'smooth' })
    expect(useOfficeStore.getState().activeEvent?.id).toBe('eureka')

    useOfficeStore.setState({ activeEvent: null, mood: 'normal' })
    Date.now.mockReturnValue(t0 + SEED_COOLDOWN_MS * 3 - 1)
    useOfficeStore.setState({ mood: 'smooth' })
    expect(useOfficeStore.getState().activeEvent).toBeNull()

    useOfficeStore.setState({ mood: 'normal' })
    Date.now.mockReturnValue(t0 + SEED_COOLDOWN_MS * 3)
    useOfficeStore.setState({ mood: 'smooth' })
    expect(useOfficeStore.getState().activeEvent?.id).toBe('eureka')
  })

  it('simultaneous mood and ops edges keep mood seed ordering first', () => {
    const now = Date.now()
    useOfficeStore.setState({
      externalStatus: { ops: { status: 'working', changedAt: now } },
      mood: 'normal',
    })
    useOfficeStore.setState({
      mood: 'smooth',
      externalStatus: { ops: { status: 'done', changedAt: now } },
    })
    expect(useOfficeStore.getState().activeEvent?.id).toBe('eureka')
  })
})
