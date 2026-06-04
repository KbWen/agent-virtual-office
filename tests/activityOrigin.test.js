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

describe('eventFeed — real events survive the organic flood (HIGH-1 regression)', () => {
  beforeEach(() => useOfficeStore.setState({ activityLog: [], eventFeed: [] }))

  it('a real (hook) event is NOT evicted by 60 organic behavior writes', () => {
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'dev', status: 'blocked', label: 'npm test failed' }])
    // Flood organic theater — these write to activityLog (50-cap) but must NEVER touch eventFeed.
    for (let i = 0; i < 60; i++) {
      useOfficeStore.getState().setAgentBehavior('pm', i % 2 ? 'typing' : 'reading-screen', 'normal', null)
    }
    const ef = useOfficeStore.getState().eventFeed
    const survived = ef.find((e) => e.type === 'status' && e.agentId === 'dev' && e.message === 'npm test failed')
    expect(survived).toBeTruthy()                       // real event still present after the flood
    expect(ef.every((e) => e.origin !== 'organic')).toBe(true) // feed buffer holds zero organic
  })

  it('eventFeed is bounded (≤30) and newest-first', () => {
    for (let i = 0; i < 40; i++) useOfficeStore.getState().setActiveEvent({ id: 'e' + i, name: 'E' + i })
    const ef = useOfficeStore.getState().eventFeed
    expect(ef.length).toBeLessThanOrEqual(30)
    expect(ef[0].message).toBe('e39') // newest first
  })

  it('organic handoffs stay out of the feed; workflow handoffs enter it', () => {
    useOfficeStore.setState({ eventFeed: [] })
    useOfficeStore.getState().addHandoff('arch', 'qa')               // organic
    useOfficeStore.getState().addHandoff('pm', 'dev', { subtle: true }) // workflow
    const ef = useOfficeStore.getState().eventFeed
    expect(ef.some((e) => e.type === 'handoff' && e.from === 'pm')).toBe(true)
    expect(ef.some((e) => e.type === 'handoff' && e.from === 'arch')).toBe(false)
  })
})
