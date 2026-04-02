import { describe, it, expect } from 'vitest'
import { createPersistedState } from '../src/systems/store.js'

describe('createPersistedState', () => {
  it('keeps only persistable agent fields', () => {
    const persisted = createPersistedState({
      agents: {
        dev: {
          behavior: 'typing',
          expression: 'focused',
          deskItemCount: { coffee: 2, sticky: 0, books: 1 },
          position: { x: 10, y: 20 },
          facing: 'left',
          status: 'working',
          bubble: 'hello',
        },
      },
      mood: 'rushing',
      externalStatus: { dev: { status: 'working' } },
      statusSource: 'external',
      activeWorkflow: 'Implement',
    })

    expect(persisted).toMatchObject({
      agents: {
        dev: {
          behavior: 'typing',
          expression: 'focused',
          deskItemCount: { coffee: 2, sticky: 0, books: 1 },
          position: { x: 10, y: 20 },
          facing: 'left',
        },
      },
    })
    expect(persisted.agents.dev.status).toBeUndefined()
    expect(persisted.agents.dev.bubble).toBeUndefined()
    expect(persisted.externalStatus).toBeUndefined()
    expect(persisted.activeWorkflow).toBeUndefined()
  })

  it('produces the same persisted payload when only transient state changes', () => {
    const stateA = {
      agents: {
        qa: {
          behavior: 'magnifier',
          expression: 'normal',
          deskItemCount: { coffee: 0, sticky: 0, books: 0 },
          position: { x: 30, y: 40 },
          facing: 'down',
          status: 'idle',
          bubble: null,
        },
      },
      mood: 'normal',
      activeWorkflow: null,
    }
    const stateB = {
      agents: {
        qa: {
          ...stateA.agents.qa,
          status: 'working',
          bubble: 'Checking tests',
        },
      },
      mood: 'intense',
      activeWorkflow: 'Review',
    }

    const persistedA = createPersistedState(stateA)
    const persistedB = createPersistedState(stateB)

    expect({ ...persistedA, _savedAt: 0 }).toEqual({ ...persistedB, _savedAt: 0 })
  })
})
