/**
 * #C — idle-gap inference tests.
 *
 * Covers:
 *   - working + ≥45s gap → status='thinking'
 *   - blocked + ≥90s gap → status='awaiting-approval'
 *   - non-stalled (< threshold) → no inference
 *   - hook update during stall resets the clock (no inference triggered)
 *   - infer routes through applyExternalStatus with source='idle-gap-infer'
 *   - already-inferred agents don't re-infer (no thrash)
 *   - stop function unsubscribes + clears interval
 *   - SSR / invalid store safety
 *
 * Uses fake timers + a minimal zustand-like store shim (real store would
 * pull in officeLife + behaviorEngine ticks which we don't want here).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  startIdleGapInference,
  _resetIdleGapState,
} from '../src/inference/idleGapInfer.js'

// Minimal store shim — mimics zustand by putting applyExternalStatus IN state.
function makeStore(initialAgents = {}) {
  const applyExternalStatus = vi.fn((updates, meta) => {
    const agents = { ...state.agents }
    for (const u of updates) agents[u.agentId] = { ...(agents[u.agentId] || {}), status: u.status }
    state = { ...state, agents }
    notify()
  })
  let state = { agents: { ...initialAgents }, applyExternalStatus }
  const listeners = new Set()
  const notify = () => { for (const l of listeners) l(state) }
  return {
    getState: () => state,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l) },
    setAgents: (next) => { state = { ...state, agents: { ...next } }; notify() },
    setAgentStatus: (id, status) => {
      state = { ...state, agents: { ...state.agents, [id]: { ...(state.agents[id] || {}), status } } }
      notify()
    },
    applyExternalStatus,  // expose at top level for assertions
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-29T13:00:00Z'))
  _resetIdleGapState()
})

afterEach(() => { vi.useRealTimers() })

describe('idleGapInfer — working → thinking inference', () => {
  it('working agent with no update for 45s → thinking', () => {
    const store = makeStore({ dev: { status: 'working', task: 'Bash' } })
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(45000)
    expect(store.applyExternalStatus).toHaveBeenCalledTimes(1)
    expect(store.applyExternalStatus.mock.calls[0][0]).toEqual([{ agentId: 'dev', status: 'thinking' }])
    expect(store.applyExternalStatus.mock.calls[0][1].source).toBe('idle-gap-infer')
    stop()
  })

  it('working <45s does NOT infer', () => {
    const store = makeStore({ dev: { status: 'working', task: 'Bash' } })
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(40000)
    expect(store.applyExternalStatus).not.toHaveBeenCalled()
    stop()
  })

  it('hook update during stall resets the clock — no inference', () => {
    const store = makeStore({ dev: { status: 'working', task: 'Bash' } })
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(30000)
    // Simulate a real hook tick: status stays working but task changes (= real signal)
    store.setAgentStatus('dev', 'working')
    store.setAgents({ ...store.getState().agents, dev: { status: 'working', task: 'Read' } })
    vi.advanceTimersByTime(30000) // 30s more — total 60s but only 30s since last update
    expect(store.applyExternalStatus).not.toHaveBeenCalled()
    stop()
  })

  it('AVO-173: a tool change on externalStatus (production shape) resets the clock — no false thinking', () => {
    // Production: `task` lives on externalStatus[id], NOT on agents[id] (store.js applyExternalStatus
    // writes only status/behavior/expression to the agents slice). A tool change (Bash→Read) with
    // status staying 'working' must reset the clock so a busy agent is not mislabelled 'thinking'.
    // Fails before the fix (computeSig read agents[id].task, always undefined → no reset → infers).
    const apply = vi.fn()
    let state = {
      agents: { dev: { status: 'working' } },
      externalStatus: { dev: { task: 'Bash' } },
      applyExternalStatus: apply,
    }
    const listeners = new Set()
    const store = {
      getState: () => state,
      subscribe: (l) => { listeners.add(l); return () => listeners.delete(l) },
    }
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(30000)
    // Real hook tick: status unchanged on the agents slice, the TOOL changes on externalStatus only.
    state = { ...state, externalStatus: { dev: { task: 'Read' } } }
    for (const l of listeners) l(state)
    vi.advanceTimersByTime(30000) // 60s total, but only 30s since the tool change
    expect(apply).not.toHaveBeenCalled()
    stop()
  })

  it('configurable threshold respected', () => {
    const store = makeStore({ dev: { status: 'working', task: 'Bash' } })
    const stop = startIdleGapInference(store, { intervalMs: 500, workingGapMs: 5000 })
    vi.advanceTimersByTime(5000)
    expect(store.applyExternalStatus).toHaveBeenCalledTimes(1)
    stop()
  })
})

describe('idleGapInfer — blocked → awaiting-approval inference', () => {
  it('blocked agent with no update for 90s → awaiting-approval', () => {
    const store = makeStore({ dev: { status: 'blocked', task: 'Bash' } })
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(90000)
    expect(store.applyExternalStatus).toHaveBeenCalledTimes(1)
    expect(store.applyExternalStatus.mock.calls[0][0]).toEqual([{ agentId: 'dev', status: 'awaiting-approval' }])
    stop()
  })

  it('blocked <90s does NOT infer', () => {
    const store = makeStore({ dev: { status: 'blocked', task: 'Bash' } })
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(80000)
    expect(store.applyExternalStatus).not.toHaveBeenCalled()
    stop()
  })

  it('blocked 45s does NOT trigger thinking (90s threshold for blocked, not 45s)', () => {
    const store = makeStore({ dev: { status: 'blocked', task: 'Bash' } })
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(46000)
    // 45s exceeds workingGap but agent is blocked not working
    expect(store.applyExternalStatus).not.toHaveBeenCalled()
    stop()
  })
})

describe('idleGapInfer — no-op for non-target statuses', () => {
  it.each(['idle', 'done', 'thinking', 'awaiting-approval'])(
    'status=%s never triggers inference (already inferred or non-target)',
    (status) => {
      const store = makeStore({ dev: { status } })
      const stop = startIdleGapInference(store, { intervalMs: 1000 })
      vi.advanceTimersByTime(120000)
      expect(store.applyExternalStatus).not.toHaveBeenCalled()
      stop()
    }
  )
})

describe('idleGapInfer — multi-agent independence', () => {
  it('one working agent crosses threshold; another doesnt — only one infers', () => {
    const store = makeStore({
      dev: { status: 'working', task: 'Bash' },
      qa: { status: 'working', task: 'Read' },
    })
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(30000) // not yet
    // Update qa to reset its clock
    store.setAgents({ ...store.getState().agents, qa: { status: 'working', task: 'Edit' } })
    vi.advanceTimersByTime(20000) // dev: 50s total, qa: 20s since update
    // dev should infer thinking, qa should not
    const calls = store.applyExternalStatus.mock.calls.filter(c => c[1]?.source === 'idle-gap-infer')
    expect(calls.length).toBe(1)
    expect(calls[0][0]).toEqual([{ agentId: 'dev', status: 'thinking' }])
    stop()
  })
})

describe('idleGapInfer — no thrash on inferred state', () => {
  it('after thinking inference, subsequent polls dont re-infer', () => {
    const store = makeStore({ dev: { status: 'working', task: 'Bash' } })
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(45000) // First inference
    expect(store.applyExternalStatus).toHaveBeenCalledTimes(1)
    // Force agent status back to thinking (simulating applyExternalStatus result)
    store.setAgents({ ...store.getState().agents, dev: { status: 'thinking' } })
    vi.advanceTimersByTime(60000) // Another minute
    expect(store.applyExternalStatus).toHaveBeenCalledTimes(1) // still just 1
    stop()
  })
})

describe('idleGapInfer — lifecycle safety', () => {
  it('stop function clears interval — no further inferences', () => {
    const store = makeStore({ dev: { status: 'working', task: 'Bash' } })
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    stop()
    vi.advanceTimersByTime(120000)
    expect(store.applyExternalStatus).not.toHaveBeenCalled()
  })

  it('invalid store argument returns no-op stop', () => {
    expect(() => startIdleGapInference(null)).not.toThrow()
    expect(() => startIdleGapInference({ getState: 'no' })).not.toThrow()
    const stop = startIdleGapInference({ getState: () => ({ agents: {} }) }) // missing subscribe
    expect(() => stop()).not.toThrow()
  })
})

describe('idleGapInfer — applyExternalStatus call meta', () => {
  it('marks source as idle-gap-infer and disables workflow meta', () => {
    const store = makeStore({ dev: { status: 'working', task: 'Bash' } })
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(45000)
    const meta = store.applyExternalStatus.mock.calls[0][1]
    expect(meta.source).toBe('idle-gap-infer')
    expect(meta.hasWorkflow).toBe(false)
    stop()
  })
})

// ─── Fix 3: stop() prunes evicted agent entries from lastUpdatedAt ────
describe('idleGapInfer — stop() prunes evicted agents (fix #3)', () => {
  it('stop() removes Map entries for agents no longer in the store', () => {
    // Start with two agents, then evict one before stopping.
    // After stop(), a second inference instance with only the remaining agent
    // should not carry phantom state from the evicted agent.
    const store = makeStore({
      dev: { status: 'working', task: 'Bash' },
      qa:  { status: 'working', task: 'Test' },
    })
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(10000)

    // Evict 'qa' — store no longer has it
    store.setAgents({ dev: store.getState().agents.dev })
    stop()
    // The pruning in stopIdleGapInference() should have removed 'qa'.
    // Now start a fresh instance — it should seed only 'dev' and not re-infer 'qa'.
    const store2 = makeStore({ dev: { status: 'working', task: 'Bash' } })
    const stop2 = startIdleGapInference(store2, { intervalMs: 1000 })
    vi.advanceTimersByTime(45000)
    // Only dev should infer; qa phantom should not appear
    const inferCalls = store2.applyExternalStatus.mock.calls.filter(c => c[1]?.source === 'idle-gap-infer')
    expect(inferCalls.length).toBeGreaterThanOrEqual(1)
    const inferredIds = inferCalls.flatMap(c => c[0].map(u => u.agentId))
    expect(inferredIds).not.toContain('qa')
    stop2()
  })

  it('stop() is safe when no agents remain in the store', () => {
    const store = makeStore({ dev: { status: 'working', task: 'Bash' } })
    const stop = startIdleGapInference(store, { intervalMs: 1000 })
    // Evict all agents
    store.setAgents({})
    expect(() => stop()).not.toThrow()
  })
})
