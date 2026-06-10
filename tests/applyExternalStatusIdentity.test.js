/**
 * AVO-143 — applyExternalStatus no-op identity preservation.
 *
 * A pure poll re-apply (same status+task for every agent) must NOT reallocate
 * agent objects: per-agent identity AND the top-level s.agents identity are
 * preserved so AgentCharacter subscribers and Object-level selectors stop
 * re-rendering every 2s tick. externalStatus is EXPECTED to refresh each tick
 * (expiresAt is a moving expiry window) — only `agents` identity is at stake.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'

const META = { source: 'external', statusSource: 'external' }

function apply(updates) {
  useOfficeStore.getState().applyExternalStatus(updates, META)
}

describe('AVO-143 — no-op poll re-apply preserves agents identity', () => {
  beforeEach(() => {
    useOfficeStore.setState({ externalStatus: {}, statusSource: 'organic', activeWorkflow: null })
    // Settle a real working state first (this WILL reallocate — by design).
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
  })

  it('same status+task re-apply keeps the top-level s.agents reference', () => {
    const before = useOfficeStore.getState().agents
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    expect(useOfficeStore.getState().agents).toBe(before)
  })

  it('same status+task re-apply keeps the per-agent object reference', () => {
    const before = useOfficeStore.getState().agents.dev
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    expect(useOfficeStore.getState().agents.dev).toBe(before)
  })

  it('externalStatus expiry window STILL refreshes on a no-op re-apply (honesty: expiry must move)', async () => {
    const before = useOfficeStore.getState().externalStatus.dev.expiresAt
    await new Promise((r) => setTimeout(r, 5))
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    expect(useOfficeStore.getState().externalStatus.dev.expiresAt).toBeGreaterThan(before)
  })

  it('a REAL status change still reallocates (agent + top-level)', () => {
    const beforeAgents = useOfficeStore.getState().agents
    const beforeDev = beforeAgents.dev
    apply([{ agentId: 'dev', status: 'blocked', task: 'Bash' }])
    const after = useOfficeStore.getState()
    expect(after.agents).not.toBe(beforeAgents)
    expect(after.agents.dev).not.toBe(beforeDev)
    expect(after.agents.dev.status).toBe('blocked')
  })

  it('a task change (same status) still reallocates — sigChanged path', () => {
    const beforeDev = useOfficeStore.getState().agents.dev
    apply([{ agentId: 'dev', status: 'working', task: 'Edit' }])
    expect(useOfficeStore.getState().agents.dev).not.toBe(beforeDev)
  })

  it('an untouched OTHER agent keeps its reference even when one agent changes', () => {
    const beforeQa = useOfficeStore.getState().agents.qa
    apply([{ agentId: 'dev', status: 'blocked', task: 'Bash' }])
    expect(useOfficeStore.getState().agents.qa).toBe(beforeQa)
  })

  it('dynamic agent creation still mutates (new entry appears)', () => {
    const beforeAgents = useOfficeStore.getState().agents
    apply([{ agentId: 'wt1~dev', status: 'working', task: 'Bash', session: 'wt1' }])
    const after = useOfficeStore.getState().agents
    expect(after).not.toBe(beforeAgents)
    expect(after['wt1~dev']).toBeTruthy()
  })

  it('no-op re-apply does NOT re-pop a bubble (existing guarantee preserved)', () => {
    const bubbleBefore = useOfficeStore.getState().agents.dev.bubble
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    expect(useOfficeStore.getState().agents.dev.bubble).toBe(bubbleBefore)
  })
})
