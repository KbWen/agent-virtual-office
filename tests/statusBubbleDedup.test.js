import { describe, it, expect, beforeEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'

// Regression: a speech bubble must fire on a REAL status/task change, not on every poll/heartbeat
// re-application of the same status. Otherwise a status file re-written each tick (new timestamp/seq
// but same status+task) re-pops every active agent's bubble at once — the "every character suddenly
// speaks for no reason / refresh feeling" the owner reported. (Same class as the changedAt 0s fix.)

describe('status bubble fires on change, not on poll re-apply', () => {
  beforeEach(() => {
    useOfficeStore.setState({ externalStatus: {} })
    useOfficeStore.setState((s) => {
      const agents = {}
      for (const [id, a] of Object.entries(s.agents)) agents[id] = { ...a, bubble: null, inGroupEvent: false }
      return { agents }
    })
  })

  it('a real status/task change pops a bubble', () => {
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Edit' }])
    expect(useOfficeStore.getState().agents.dev.bubble).toBeTruthy()
  })

  it('a SAME-signature re-application does NOT re-pop the bubble', () => {
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Edit' }])
    useOfficeStore.getState().clearBubble('dev')                 // bubble clears on its doSchedule timer
    expect(useOfficeStore.getState().agents.dev.bubble).toBeNull()
    // poll/heartbeat re-applies the SAME status+task (file re-written with a new timestamp/seq)
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Edit' }])
    expect(useOfficeStore.getState().agents.dev.bubble).toBeNull() // must NOT re-pop
  })

  it('a task change after a re-apply DOES pop a fresh bubble', () => {
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Edit' }])
    useOfficeStore.getState().clearBubble('dev')
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    expect(useOfficeStore.getState().agents.dev.bubble).toBeTruthy()
  })

  it('a status change (working→done) pops a fresh bubble', () => {
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'qa', status: 'working', task: 'magnifier' }])
    useOfficeStore.getState().clearBubble('qa')
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'qa', status: 'done', task: 'magnifier' }])
    expect(useOfficeStore.getState().agents.qa.bubble).toBeTruthy()
  })

  // AVO-104: a SubagentStart skill activation must surface the localized skill bubble through the
  // store's existing bubble channel (generateContextBubble → agent.bubble → BehaviorBubble). This
  // is the store→bubble link the unit + pipeline tests don't cover end-to-end.
  it('a skill activation sets the localized skill bubble on the agent (working)', () => {
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'qa', status: 'working', task: 'review', skill: 'review' }])
    expect(useOfficeStore.getState().agents.qa.bubble).toBe('🧐 Reviewing')
  })

  it('a blocked update with a skill does NOT show the skill bubble (honesty: working-phase only)', () => {
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'qa', status: 'blocked', task: 'review', skill: 'review', reasonCode: 'blocked-unknown' }])
    expect(useOfficeStore.getState().agents.qa.bubble).not.toBe('🧐 Reviewing')
  })
})
