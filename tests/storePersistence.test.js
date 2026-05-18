import { describe, it, expect } from 'vitest'
import { createPersistedState, validatePersistedAgent } from '../src/systems/store.js'

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

describe('validatePersistedAgent — deskItemCount sanitization (R63)', () => {
  it('keeps a well-formed deskItemCount as-is', () => {
    const v = validatePersistedAgent({ deskItemCount: { coffee: 3, sticky: 1, books: 2 } })
    expect(v.deskItemCount).toEqual({ coffee: 3, sticky: 1, books: 2 })
  })

  it('strips unknown keys from a corrupted/tampered deskItemCount', () => {
    const v = validatePersistedAgent({ deskItemCount: { coffee: 2, sticky: 0, books: 1, evil: 999, plant: 7 } })
    expect(Object.keys(v.deskItemCount).sort()).toEqual(['books', 'coffee', 'sticky'])
    expect(v.deskItemCount.evil).toBeUndefined()
  })

  it('coerces non-integer / string values to 0 so growth math never string-concats', () => {
    // Before R63: count[item] = ("lots" || 0) + 1 → "lots1" rendered as a count.
    const v = validatePersistedAgent({ deskItemCount: { coffee: 'lots', sticky: NaN, books: Infinity } })
    expect(v.deskItemCount).toEqual({ coffee: 0, sticky: 0, books: 0 })
  })

  it('clamps negative values to 0 and floors fractional values', () => {
    const v = validatePersistedAgent({ deskItemCount: { coffee: -5, sticky: 2.9, books: 0 } })
    expect(v.deskItemCount).toEqual({ coffee: 0, sticky: 2, books: 0 })
  })

  it('rejects non-object deskItemCount (array, string) → undefined', () => {
    expect(validatePersistedAgent({ deskItemCount: [1, 2, 3] }).deskItemCount).toBeUndefined()
    expect(validatePersistedAgent({ deskItemCount: 'corrupt' }).deskItemCount).toBeUndefined()
  })
})
