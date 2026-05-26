import { describe, it, expect, beforeEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'

// ─── markIntegrationProbe — state machine ────────────────────────────
describe('store — markIntegrationProbe state machine', () => {
  beforeEach(() => {
    useOfficeStore.setState({
      integrationHealth: {
        state: 'idle',
        lastSuccessAt: null,
        lastErrorAt: null,
        consecutiveFailures: 0,
      },
    })
  })

  it('first successful probe: idle → online, consecutiveFailures=0', () => {
    useOfficeStore.getState().markIntegrationProbe({ ok: true })
    const h = useOfficeStore.getState().integrationHealth
    expect(h.state).toBe('online')
    expect(h.consecutiveFailures).toBe(0)
    expect(h.lastSuccessAt).toBeGreaterThan(0)
    expect(h.lastErrorAt).toBeNull()
  })

  it('first failure: idle → degraded, consecutiveFailures=1', () => {
    useOfficeStore.getState().markIntegrationProbe({ ok: false })
    const h = useOfficeStore.getState().integrationHealth
    expect(h.state).toBe('degraded')
    expect(h.consecutiveFailures).toBe(1)
    expect(h.lastErrorAt).toBeGreaterThan(0)
    expect(h.lastSuccessAt).toBeNull()
  })

  it('two consecutive failures: degraded, consecutiveFailures=2', () => {
    useOfficeStore.getState().markIntegrationProbe({ ok: false })
    useOfficeStore.getState().markIntegrationProbe({ ok: false })
    expect(useOfficeStore.getState().integrationHealth.state).toBe('degraded')
    expect(useOfficeStore.getState().integrationHealth.consecutiveFailures).toBe(2)
  })

  it('three consecutive failures: → offline, consecutiveFailures=3', () => {
    useOfficeStore.getState().markIntegrationProbe({ ok: false })
    useOfficeStore.getState().markIntegrationProbe({ ok: false })
    useOfficeStore.getState().markIntegrationProbe({ ok: false })
    expect(useOfficeStore.getState().integrationHealth.state).toBe('offline')
    expect(useOfficeStore.getState().integrationHealth.consecutiveFailures).toBe(3)
  })

  it('fourth failure when already offline: capped at 3, no re-render (same-value guard)', () => {
    // Drive to offline first
    for (let i = 0; i < 3; i++) useOfficeStore.getState().markIntegrationProbe({ ok: false })
    const before = useOfficeStore.getState().integrationHealth

    useOfficeStore.getState().markIntegrationProbe({ ok: false })
    const after = useOfficeStore.getState().integrationHealth

    // State and failures unchanged — the set() returned {} (no-op)
    expect(after.state).toBe('offline')
    expect(after.consecutiveFailures).toBe(3)
    // Object identity: {} merge → new object, but same-value guard prevents
    // any field change so the no-op return keeps the reference stable
    expect(after.consecutiveFailures).toBe(before.consecutiveFailures)
  })

  it('recovery: offline → online after a successful probe, counter reset', () => {
    for (let i = 0; i < 3; i++) useOfficeStore.getState().markIntegrationProbe({ ok: false })
    expect(useOfficeStore.getState().integrationHealth.state).toBe('offline')

    useOfficeStore.getState().markIntegrationProbe({ ok: true })
    const h = useOfficeStore.getState().integrationHealth
    expect(h.state).toBe('online')
    expect(h.consecutiveFailures).toBe(0)
    expect(h.lastSuccessAt).toBeGreaterThan(0)
  })

  it('success when already online: same-value guard — no state change', () => {
    useOfficeStore.getState().markIntegrationProbe({ ok: true })
    const firstSuccessAt = useOfficeStore.getState().integrationHealth.lastSuccessAt

    // Second success: nextState='online', failures=0 — same as current
    // guard returns {} so lastSuccessAt is NOT updated (no-op)
    useOfficeStore.getState().markIntegrationProbe({ ok: true })
    const h = useOfficeStore.getState().integrationHealth
    expect(h.state).toBe('online')
    expect(h.consecutiveFailures).toBe(0)
    expect(h.lastSuccessAt).toBe(firstSuccessAt)
  })
})

// ─── setStatusSource / setIntegrationSource — same-value guard ───────
describe('store — setStatusSource / setIntegrationSource idempotency', () => {
  beforeEach(() => {
    useOfficeStore.setState({ statusSource: 'organic', integrationSource: null })
  })

  it('setStatusSource changes value when different', () => {
    useOfficeStore.getState().setStatusSource('external')
    expect(useOfficeStore.getState().statusSource).toBe('external')
  })

  it('setStatusSource is idempotent when called with the same value', () => {
    useOfficeStore.setState({ statusSource: 'external' })
    useOfficeStore.getState().setStatusSource('external')
    expect(useOfficeStore.getState().statusSource).toBe('external')
  })

  it('setIntegrationSource sets a new source', () => {
    useOfficeStore.getState().setIntegrationSource('codex-cli')
    expect(useOfficeStore.getState().integrationSource).toBe('codex-cli')
  })

  it('setIntegrationSource is idempotent on same value', () => {
    useOfficeStore.setState({ integrationSource: 'codex-cli' })
    useOfficeStore.getState().setIntegrationSource('codex-cli')
    expect(useOfficeStore.getState().integrationSource).toBe('codex-cli')
  })

  it('setIntegrationSource(undefined) → null (falsy coercion)', () => {
    useOfficeStore.setState({ integrationSource: 'codex-cli' })
    useOfficeStore.getState().setIntegrationSource(undefined)
    expect(useOfficeStore.getState().integrationSource).toBeNull()
  })

  it('setIntegrationSource("") → null (empty string is falsy)', () => {
    useOfficeStore.getState().setIntegrationSource('')
    expect(useOfficeStore.getState().integrationSource).toBeNull()
  })
})

// ─── setSelectedAgent — toggle behaviour ─────────────────────────────
describe('store — setSelectedAgent toggle', () => {
  beforeEach(() => {
    useOfficeStore.setState({ selectedAgent: null })
  })

  it('selecting an agent when none is selected → selects it', () => {
    useOfficeStore.getState().setSelectedAgent('dev')
    expect(useOfficeStore.getState().selectedAgent).toBe('dev')
  })

  it('re-selecting the same agent deselects it (toggle to null)', () => {
    useOfficeStore.setState({ selectedAgent: 'dev' })
    useOfficeStore.getState().setSelectedAgent('dev')
    expect(useOfficeStore.getState().selectedAgent).toBeNull()
  })

  it('selecting a different agent switches the selection', () => {
    useOfficeStore.setState({ selectedAgent: 'dev' })
    useOfficeStore.getState().setSelectedAgent('qa')
    expect(useOfficeStore.getState().selectedAgent).toBe('qa')
  })

  it('clearSelectedAgent always sets null regardless of current selection', () => {
    useOfficeStore.setState({ selectedAgent: 'arch' })
    useOfficeStore.getState().clearSelectedAgent()
    expect(useOfficeStore.getState().selectedAgent).toBeNull()
  })
})

// ─── setActiveWorkflow — same-value guard ─────────────────────────────
describe('store — setActiveWorkflow same-value guard', () => {
  beforeEach(() => {
    useOfficeStore.setState({ activeWorkflow: null })
  })

  it('sets a workflow name', () => {
    useOfficeStore.getState().setActiveWorkflow('Review')
    expect(useOfficeStore.getState().activeWorkflow).toBe('Review')
  })

  it('clears when called with null', () => {
    useOfficeStore.setState({ activeWorkflow: 'Build' })
    useOfficeStore.getState().setActiveWorkflow(null)
    expect(useOfficeStore.getState().activeWorkflow).toBeNull()
  })

  it('setActiveWorkflow(undefined) → null (nullish coercion)', () => {
    useOfficeStore.setState({ activeWorkflow: 'Build' })
    useOfficeStore.getState().setActiveWorkflow(undefined)
    expect(useOfficeStore.getState().activeWorkflow).toBeNull()
  })

  it('same value is idempotent', () => {
    useOfficeStore.setState({ activeWorkflow: 'Build' })
    useOfficeStore.getState().setActiveWorkflow('Build')
    expect(useOfficeStore.getState().activeWorkflow).toBe('Build')
  })
})
