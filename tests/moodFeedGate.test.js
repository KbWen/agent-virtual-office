import { describe, it, expect } from 'vitest'
import { changedUpdates } from '../src/inference/inferStatus.js'

// Regression: the mood engine must be fed only REAL status/task changes. A poll/heartbeat that
// re-delivers unchanged statuses (new ETag from a cosmetic re-write) must NOT push repeated events
// into the sliding-window mood — that falsely trips 'rushing'/'intense' and pins teamPulse high,
// cascading to weather + the L2 lean-in + real-seed. (Same change-gate class as the bubble/feed fix.)

describe('changedUpdates — mood-feed gate', () => {
  it('a same-signature re-application yields NOTHING (no inflation on poll/heartbeat)', () => {
    const prev = { dev: { status: 'working', task: 'Edit' }, qa: { status: 'blocked', task: 'magnifier' } }
    const updates = [
      { agentId: 'dev', status: 'working', task: 'Edit' },
      { agentId: 'qa', status: 'blocked', task: 'magnifier' },
    ]
    expect(changedUpdates(prev, updates)).toEqual([])
  })

  it('a NEW agent and a STATUS change and a TASK change are all included', () => {
    const prev = { dev: { status: 'working', task: 'Edit' } }
    expect(changedUpdates(prev, [{ agentId: 'qa', status: 'working', task: 'm' }]).map(u => u.agentId)).toEqual(['qa']) // new
    expect(changedUpdates(prev, [{ agentId: 'dev', status: 'done', task: 'Edit' }]).length).toBe(1)   // status changed
    expect(changedUpdates(prev, [{ agentId: 'dev', status: 'working', task: 'Bash' }]).length).toBe(1) // task changed
  })

  it('mixed batch: only the changed agents pass', () => {
    const prev = { dev: { status: 'working', task: 'Edit' }, qa: { status: 'idle' } }
    const out = changedUpdates(prev, [
      { agentId: 'dev', status: 'working', task: 'Edit' }, // unchanged
      { agentId: 'qa', status: 'working', task: 'Bash' },  // idle→working
    ])
    expect(out.map(u => u.agentId)).toEqual(['qa'])
  })

  it('null/empty prev → everything counts as a change', () => {
    expect(changedUpdates(null, [{ agentId: 'dev', status: 'working' }]).length).toBe(1)
    expect(changedUpdates({}, []).length).toBe(0)
  })
})
