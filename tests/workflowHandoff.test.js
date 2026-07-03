/**
 * AVO-105 — workflow handoff trigger tests.
 *
 * Verifies that the subscription:
 *   - fires the correct addHandoff(from, to, {subtle: true}) for each
 *     mapped transition
 *   - does NOT fire on null↔phase transitions (boot, ship-completion)
 *   - does NOT fire on unmapped transitions
 *   - silently skips when the role agent isnt in the roster (e.g. lightweight)
 *   - returns a working unsubscribe function
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { startWorkflowHandoffs, WORKFLOW_HANDOFFS } from '../src/inference/workflowHandoff.js'

function makeStore(initial = {}) {
  let state = {
    activeWorkflow: initial.activeWorkflow ?? null,
    agents: initial.agents ?? {
      pm: {}, arch: {}, dev: {}, qa: {}, ops: {}, res: {}, gate: {}, designer: {},
    },
    addHandoff: vi.fn(),
  }
  const listeners = new Set()
  return {
    getState: () => state,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l) },
    setWorkflow: (workflow) => {
      state = { ...state, activeWorkflow: workflow }
      for (const l of listeners) l(state)
    },
    addHandoff: state.addHandoff,
    setAgents: (agents) => {
      state = { ...state, agents }
      for (const l of listeners) l(state)
    },
  }
}

describe('workflowHandoff — table-driven trigger', () => {
  it.each(Object.entries(WORKFLOW_HANDOFFS))(
    'fires addHandoff for %s',
    (key, { from, to }) => {
      const [fromPhase, toPhase] = key.split('->')
      const store = makeStore({ activeWorkflow: `/${fromPhase}` })
      const stop = startWorkflowHandoffs(store)
      store.setWorkflow(`/${toPhase}`)
      expect(store.addHandoff).toHaveBeenCalledWith(from, to, { subtle: true })
      stop()
    }
  )

  it('passes subtle: true (workflow handoffs render the calm variant)', () => {
    const store = makeStore({ activeWorkflow: '/plan' })
    const stop = startWorkflowHandoffs(store)
    store.setWorkflow('/implement')
    expect(store.addHandoff).toHaveBeenCalledTimes(1)
    expect(store.addHandoff.mock.calls[0][2]).toEqual({ subtle: true })
    stop()
  })

  it('normalises workflow strings: /Ship and SHIP are the same as /ship', () => {
    const store = makeStore({ activeWorkflow: '/review' })
    const stop = startWorkflowHandoffs(store)
    store.setWorkflow('/SHIP')
    expect(store.addHandoff).toHaveBeenCalledWith('gate', 'ops', { subtle: true })
    stop()
  })
})

describe('workflowHandoff — null/boot safety', () => {
  it('does not fire on the initial null → /something transition (boot)', () => {
    const store = makeStore({ activeWorkflow: null })
    const stop = startWorkflowHandoffs(store)
    store.setWorkflow('/plan') // first non-null observation, not a "transition"
    expect(store.addHandoff).not.toHaveBeenCalled()
    stop()
  })

  it('does not fire on /something → null (workflow cleared)', () => {
    const store = makeStore({ activeWorkflow: '/ship' })
    const stop = startWorkflowHandoffs(store)
    store.setWorkflow(null)
    expect(store.addHandoff).not.toHaveBeenCalled()
    stop()
  })
})

describe('workflowHandoff — no-op cases', () => {
  it('unmapped transition does NOT fire', () => {
    const store = makeStore({ activeWorkflow: '/audit' })
    const stop = startWorkflowHandoffs(store)
    store.setWorkflow('/retro')
    expect(store.addHandoff).not.toHaveBeenCalled()
    stop()
  })

  it('repeated identical workflow does NOT fire', () => {
    const store = makeStore({ activeWorkflow: '/plan' })
    const stop = startWorkflowHandoffs(store)
    store.setWorkflow('/plan')
    store.setWorkflow('/plan')
    expect(store.addHandoff).not.toHaveBeenCalled()
    stop()
  })

  it('skips when from-role agent missing (lightweight mode)', () => {
    const store = makeStore({
      activeWorkflow: '/plan',
      agents: { planner: {}, worker: {}, checker: {} }, // no arch / dev / etc.
    })
    const stop = startWorkflowHandoffs(store)
    store.setWorkflow('/implement') // would normally fire arch → dev
    expect(store.addHandoff).not.toHaveBeenCalled()
    stop()
  })

  it('skips when to-role agent missing', () => {
    const store = makeStore({
      activeWorkflow: '/plan',
      agents: { arch: {} /* dev missing */ },
    })
    const stop = startWorkflowHandoffs(store)
    store.setWorkflow('/implement')
    expect(store.addHandoff).not.toHaveBeenCalled()
    stop()
  })
})

describe('workflowHandoff — lifecycle', () => {
  it('returns a working unsubscribe', () => {
    const store = makeStore({ activeWorkflow: '/plan' })
    const stop = startWorkflowHandoffs(store)
    stop()
    store.setWorkflow('/implement')
    expect(store.addHandoff).not.toHaveBeenCalled()
  })

  it('invalid store argument returns no-op stop', () => {
    expect(() => startWorkflowHandoffs(null)).not.toThrow()
    expect(() => startWorkflowHandoffs({ getState: 'no' })).not.toThrow()
    const stop = startWorkflowHandoffs({ getState: () => ({}) })
    expect(() => stop()).not.toThrow()
  })
})

describe('workflowHandoff — re-entrant safety (BUG-PIN)', () => {
  it('does NOT infinite-loop when addHandoff itself triggers subscribers', () => {
    // Zustand fires listeners synchronously on setState. If `prevWorkflow` is
    // updated AFTER addHandoff, the re-entrant call sees the stale prev value,
    // determines this is still a "new" transition, and fires addHandoff again
    // → stack overflow. The fix advances prevWorkflow BEFORE the side effect.
    let setStateCount = 0
    const realAddHandoff = (from, to, opts) => {
      // Simulate zustand: every setState fires listeners synchronously
      setStateCount++
      // Echo the state change to all listeners — this is what triggered the bug.
      // We pass the CURRENT state (which still has /implement as activeWorkflow)
      // so the listener sees same activeWorkflow as before; with the bug, prev
      // would still be /plan and the listener would call addHandoff again.
      for (const l of listeners) l({ ...state, handoffs: [...state.handoffs, { from, to, ...opts }] })
    }
    const state = {
      activeWorkflow: '/plan',
      agents: { arch: {}, dev: {} },
      addHandoff: realAddHandoff,
      handoffs: [],
    }
    const listeners = new Set()
    const store = {
      getState: () => state,
      subscribe: (l) => { listeners.add(l); return () => listeners.delete(l) },
    }
    const stop = startWorkflowHandoffs(store)
    // Trigger the transition that would have looped pre-fix
    state.activeWorkflow = '/implement'
    expect(() => {
      for (const l of listeners) l(state)
    }).not.toThrow()
    // Should fire EXACTLY ONCE, even though addHandoff re-fires the listener
    expect(setStateCount).toBe(1)
    stop()
  })
})

describe('workflowHandoff — full chain narrative', () => {
  it('end-to-end /spec → /plan → /implement → /test → /review → /ship fires 4 handoffs', () => {
    // /spec → /plan : arch → pm
    // /plan → /implement : arch → dev
    // /implement → /test : dev → qa
    // /test → /review : qa → gate
    // /review → /ship : gate → ops
    // = 5 handoffs total
    const store = makeStore({ activeWorkflow: '/spec' })
    const stop = startWorkflowHandoffs(store)
    store.setWorkflow('/plan')
    store.setWorkflow('/implement')
    store.setWorkflow('/test')
    store.setWorkflow('/review')
    store.setWorkflow('/ship')
    expect(store.addHandoff).toHaveBeenCalledTimes(5)
    const calls = store.addHandoff.mock.calls.map(c => [c[0], c[1]])
    expect(calls).toEqual([
      ['arch', 'pm'],
      ['arch', 'dev'],
      ['dev', 'qa'],
      ['qa', 'gate'],
      ['gate', 'ops'],
    ])
    stop()
  })
})
