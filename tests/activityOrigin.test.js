import { describe, it, expect, beforeEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'

// COMMS Phase 1: every activity-log entry now carries an `origin` so the feed can keep real signal
// (hook/event/inferred) and drop organic officeLife theater. Handoffs are now logged too (they
// never were). These guard the write-time tagging that the whole feed filter depends on.

const findActivity = (pred) => useOfficeStore.getState().activityLog.find(pred)

describe('activity-log origin tagging (feed trust)', () => {
  beforeEach(() => useOfficeStore.setState({ activityLog: [] }))

  it('setActiveEvent logs an event-origin entry', () => {
    useOfficeStore.getState().setActiveEvent({ id: 'standup', name: 'Standup' })
    const e = findActivity((a) => a.type === 'event')
    expect(e).toBeTruthy()
    expect(e.origin).toBe('event')
  })

  it('a real (hook) done status logs a hook-origin entry', () => {
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'dev', status: 'done', label: 'shipped' }])
    const e = findActivity((a) => a.type === 'status' && a.agentId === 'dev' && a.status === 'done')
    expect(e).toBeTruthy()
    expect(e.origin).toBe('hook')
  })

  it('an idle-gap-inferred status is tagged inferred, not hook', () => {
    useOfficeStore.getState().applyExternalStatus(
      [{ agentId: 'qa', status: 'blocked', label: 'awaiting' }],
      { source: 'idle-gap-infer' },
    )
    const e = findActivity((a) => a.type === 'status' && a.agentId === 'qa')
    expect(e).toBeTruthy()
    expect(e.origin).toBe('inferred')
  })

  it('a workflow handoff (subtle) is logged to the feed as an event-origin handoff', () => {
    useOfficeStore.getState().addHandoff('pm', 'dev', { subtle: true })
    const e = findActivity((a) => a.type === 'handoff')
    expect(e).toBeTruthy()
    expect(e.origin).toBe('event')
    expect(e.from).toBe('pm')
    expect(e.to).toBe('dev')
  })

  it('an organic pass-document handoff is logged as organic (kept out of the feed)', () => {
    useOfficeStore.getState().addHandoff('arch', 'qa')
    const e = findActivity((a) => a.type === 'handoff' && a.from === 'arch')
    expect(e).toBeTruthy()
    expect(e.origin).toBe('organic')
  })

  it('handoff still drives the animation queue (handoffs[]) as before', () => {
    const before = useOfficeStore.getState().handoffs.length
    useOfficeStore.getState().addHandoff('res', 'gate', { subtle: true })
    const after = useOfficeStore.getState().handoffs
    expect(after.length).toBe(before + 1)
    expect(after[after.length - 1]).toMatchObject({ from: 'res', to: 'gate', subtle: true })
  })
})
