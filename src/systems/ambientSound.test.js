import { describe, it, expect, vi, afterEach } from 'vitest'
import { rainTargetGain, meanIntervalForPulse, initSoundscapeEnabled, MASTER_CAP, startAmbientSound } from './ambientSound'

// vitest has no AudioContext, so these cover the PURE gate/honesty logic only.
// The audio lifecycle (silence@0, clatter-rises, suspend-on-off, no-autoplay-warning)
// is verified separately via headless Playwright per docs/specs/ambient-soundscape.md.

describe('rainTargetGain — honesty double-gate', () => {
  it('is silent unless weatherEffects is ON', () => {
    expect(rainTargetGain('frustrated', false, false)).toBe(0)
    expect(rainTargetGain('stuck', false, false)).toBe(0)
  })

  it('is silent under prefers-reduced-motion even when it would rain', () => {
    expect(rainTargetGain('frustrated', true, true)).toBe(0)
    expect(rainTargetGain('stuck', true, true)).toBe(0)
  })

  it('plays for frustrated (rain) and louder for stuck (storm) when both gates are open', () => {
    const rain = rainTargetGain('frustrated', true, false)
    const storm = rainTargetGain('stuck', true, false)
    expect(rain).toBeGreaterThan(0)
    expect(storm).toBeGreaterThan(rain)
    expect(storm).toBeLessThanOrEqual(MASTER_CAP) // never exceeds the master ceiling
  })

  it('is silent for every non-rainy mood even with gates open', () => {
    for (const m of ['normal', 'smooth', 'intense', 'idle', 'rushing']) {
      expect(rainTargetGain(m, true, false)).toBe(0)
    }
  })
})

describe('meanIntervalForPulse — keyboard bed (honest silence at zero)', () => {
  it('returns Infinity at/below zero pulse (no taps scheduled — true silence)', () => {
    expect(meanIntervalForPulse(0)).toBe(Infinity)
    expect(meanIntervalForPulse(-0.5)).toBe(Infinity)
    expect(meanIntervalForPulse(undefined)).toBe(Infinity)
  })

  it('gets faster (shorter interval) as the real pulse rises', () => {
    expect(meanIntervalForPulse(1)).toBeLessThan(meanIntervalForPulse(0.5))
    expect(meanIntervalForPulse(0.5)).toBeLessThan(meanIntervalForPulse(0.1))
  })

  it('clamps pulse > 1 to the fastest finite interval (no machine-gun overshoot)', () => {
    expect(meanIntervalForPulse(5)).toBe(meanIntervalForPulse(1))
    expect(Number.isFinite(meanIntervalForPulse(1))).toBe(true)
  })
})

describe('initSoundscapeEnabled — default OFF, reduced-motion force-off', () => {
  const mkWin = (stored, reduced = false) => ({
    localStorage: { getItem: () => stored },
    matchMedia: (q) => ({ matches: reduced && q.includes('reduced-motion') }),
  })

  it('defaults OFF when there is no stored preference', () => {
    expect(initSoundscapeEnabled(mkWin(null))).toBe(false)
  })

  it('reads a stored on/off preference', () => {
    expect(initSoundscapeEnabled(mkWin('on'))).toBe(true)
    expect(initSoundscapeEnabled(mkWin('off'))).toBe(false)
  })

  it('forces OFF under prefers-reduced-motion even if stored ON', () => {
    expect(initSoundscapeEnabled(mkWin('on', true))).toBe(false)
  })

  it('is OFF when there is no window (SSR-safe)', () => {
    expect(initSoundscapeEnabled(undefined)).toBe(false)
  })
})

function fakeParam(value = 0) {
  return {
    value,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(function (next) { this.value = next }),
    linearRampToValueAtTime: vi.fn(function (next) { this.value = next }),
    exponentialRampToValueAtTime: vi.fn(function (next) { this.value = next }),
  }
}

function fakeNode() {
  return {
    gain: fakeParam(), frequency: fakeParam(), threshold: fakeParam(), ratio: fakeParam(), knee: fakeParam(), Q: fakeParam(),
    connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
  }
}

function makeAudioHarness(resumeImpl) {
  const contexts = []
  class FakeAudioContext {
    constructor() {
      this.sampleRate = 1000
      this.currentTime = 0
      this.destination = {}
      this.state = 'suspended'
      this.gainNodes = []
      this.bufferSourceCount = 0
      this.suspend = vi.fn(() => { this.state = 'suspended'; return Promise.resolve() })
      this.close = vi.fn(() => { this.state = 'closed'; return Promise.resolve() })
      this.resume = vi.fn(() => resumeImpl ? resumeImpl(this) : (this.state = 'running', Promise.resolve()))
      contexts.push(this)
    }
    createGain() { const node = fakeNode(); this.gainNodes.push(node); return node }
    createDynamicsCompressor() { return fakeNode() }
    createOscillator() { return fakeNode() }
    createBuffer() { return { getChannelData: () => new Float32Array(2000) } }
    createBufferSource() { this.bufferSourceCount++; return fakeNode() }
    createBiquadFilter() { return fakeNode() }
  }
  const listeners = new Map()
  const win = {
    AudioContext: FakeAudioContext,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  }
  const docListeners = new Map()
  const doc = {
    hidden: false,
    addEventListener: (name, fn) => docListeners.set(name, fn),
    removeEventListener: (name) => docListeners.delete(name),
    dispatch: (name) => docListeners.get(name)?.(),
  }
  return { contexts, win, doc }
}

function makeStore(initial) {
  let state = initial
  const listeners = new Set()
  return {
    getState: () => state,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    set: (patch) => { state = { ...state, ...patch }; for (const listener of [...listeners]) listener(state) },
  }
}

const activeAudioState = {
  soundscapeEnabled: false,
  reducedMotion: false,
  weatherEffects: false,
  mood: 'normal',
  teamPulse: 0,
  experienceFlags: { calmEnabled: true },
  officeCalm: { mode: 'active', eligibleSince: null },
}

describe('startAmbientSound — subscribed quiet lifecycle', () => {
  let stop
  afterEach(() => {
    stop?.()
    stop = null
    vi.useRealTimers()
    delete window.AudioContext
    delete window.webkitAudioContext
    delete globalThis.document
  })

  it('fades and truly suspends at 1.2s + 80ms, while active reversal cancels stale suspension', async () => {
    vi.useFakeTimers()
    const h = makeAudioHarness()
    globalThis.window = h.win
    globalThis.document = h.doc
    const store = makeStore(activeAudioState)
    stop = startAmbientSound(store)
    store.set({ soundscapeEnabled: true }) // real subscribed toggle edge
    await Promise.resolve()
    const ctx = h.contexts[0]
    expect(ctx).toBeTruthy()

    store.set({ officeCalm: { mode: 'quiet', eligibleSince: 0 } })
    expect(ctx.suspend).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1279)
    expect(ctx.suspend).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(ctx.suspend).toHaveBeenCalledTimes(1)

    // A fresh active edge resumes the existing blessed graph. Reversing before
    // the second grace expires prevents its old callback from suspending it.
    store.set({ officeCalm: { mode: 'active', eligibleSince: null } })
    await Promise.resolve()
    store.set({ officeCalm: { mode: 'quiet', eligibleSince: 0 } })
    await vi.advanceTimersByTimeAsync(1000)
    store.set({ officeCalm: { mode: 'active', eligibleSince: null } })
    await vi.advanceTimersByTimeAsync(500)
    expect(ctx.suspend).toHaveBeenCalledTimes(1)
    expect(ctx.gainNodes[0].gain.linearRampToValueAtTime.mock.calls.at(-1)[0]).toBe(0.05)
    expect(vi.getTimerCount()).toBe(1) // the clatter scheduler was restarted on quiet exit
  })

  it('does not create or resume audio on quiet entry, and stale resume completion cannot wake quiet audio', async () => {
    const resumeResolvers = []
    vi.useFakeTimers()
    const h = makeAudioHarness(() => new Promise((resolve) => { resumeResolvers.push(resolve) }))
    globalThis.window = h.win
    globalThis.document = h.doc
    const store = makeStore({ ...activeAudioState, soundscapeEnabled: true })
    stop = startAmbientSound(store) // persisted ON remains dormant until a gesture
    store.set({ officeCalm: { mode: 'quiet', eligibleSince: 0 } })
    expect(h.contexts).toHaveLength(0)

    store.set({ officeCalm: { mode: 'active', eligibleSince: null } })
    store.set({ soundscapeEnabled: false })
    store.set({ soundscapeEnabled: true }) // user gesture edge creates/resumes graph
    store.set({ soundscapeEnabled: false })
    store.set({ soundscapeEnabled: true }) // a newer toggle can overtake the pending resume
    const ctx = h.contexts[0]
    expect(ctx.resume).toHaveBeenCalledTimes(2)
    resumeResolvers[0]() // old resume completion must not suspend the newer active state
    await Promise.resolve()
    expect(ctx.suspend).not.toHaveBeenCalled()
    store.set({ officeCalm: { mode: 'quiet', eligibleSince: 0 } })
    resumeResolvers[1]()
    await Promise.resolve()
    expect(ctx.suspend).toHaveBeenCalled()
  })

  it('visibility and teardown invalidate quiet suspension timers and never wake while hidden', async () => {
    vi.useFakeTimers()
    const h = makeAudioHarness()
    globalThis.window = h.win
    globalThis.document = h.doc
    const store = makeStore(activeAudioState)
    stop = startAmbientSound(store)
    store.set({ soundscapeEnabled: true })
    await Promise.resolve()
    const ctx = h.contexts[0]
    store.set({ officeCalm: { mode: 'quiet', eligibleSince: 0 } })
    h.doc.hidden = true
    h.doc.dispatch('visibilitychange')
    expect(ctx.suspend).toHaveBeenCalledTimes(1)
    const resumeCountWhileHidden = ctx.resume.mock.calls.length
    store.set({ officeCalm: { mode: 'active', eligibleSince: null } })
    expect(ctx.resume).toHaveBeenCalledTimes(resumeCountWhileHidden)
    h.doc.hidden = false
    h.doc.dispatch('visibilitychange')
    expect(ctx.resume).toHaveBeenCalledTimes(resumeCountWhileHidden + 1)
    store.set({ officeCalm: { mode: 'active', eligibleSince: null } })
    store.set({ officeCalm: { mode: 'quiet', eligibleSince: 0 } })
    stop()
    stop = null
    const suspendsAtTeardown = ctx.suspend.mock.calls.length
    await vi.advanceTimersByTimeAsync(2000)
    expect(ctx.suspend).toHaveBeenCalledTimes(suspendsAtTeardown)
    expect(ctx.close).toHaveBeenCalledTimes(1)
  })
})
