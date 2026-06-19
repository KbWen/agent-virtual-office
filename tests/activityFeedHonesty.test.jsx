import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useOfficeStore } from '../src/systems/store.js'
import ActivityFeed from '../src/components/ActivityFeed.jsx'

// AVO-141 — the floating ActivityFeed must (1) source the REAL-events `eventFeed` ONLY (never the
// all-origins `activityLog` theater, nor the decorative `activeEvent` banner), and (2) self-hide in
// roster mode (the inline presence-rail feed already shows these events — avoid two feeds on screen).
//
// SSR (renderToStaticMarkup) is this project's render-test tool (no jsdom). The widget is collapsed by
// default, so the SSR-observable proxy for the `entries` list is the unread badge (its count = recent
// entries). The badge reads the SAME `entries` memo the expanded list would, so asserting on it proves
// the data SOURCE. test-the-test: reverting the component to read `activityLog` flips BOTH the positive
// (eventFeed → badge) and the negative (organic activityLog → no badge) assertions.

// timestamp resolved at call time (NOT frozen at module load) so the badge's `< 30000ms` recency
// window can never lapse between import and assertion — removes a latent flake on a slow runner.
const recent = (over) => ({ id: 'e1', timestamp: Date.now(), type: 'status', agentId: 'dev', status: 'working', message: 'Bash', origin: 'hook', ...over })

function reset({ eventFeed = [], activityLog = [], rosterMode = false, activeEvent = null } = {}) {
  useOfficeStore.setState({ eventFeed, activityLog, rosterMode, activeEvent })
}
const render = () => renderToStaticMarkup(<ActivityFeed mode="full" />)
const BADGE = 'bg-blue-500'  // the unread-count badge marker (rendered only in the collapsed state)

describe('AVO-141 — ActivityFeed honesty + dedup', () => {
  beforeEach(() => reset())

  it('sources eventFeed: a recent REAL event shows an unread badge', () => {
    reset({ eventFeed: [recent()] })
    expect(render()).toContain(BADGE)
  })

  it('does NOT source activityLog: organic theater there shows NO badge', () => {
    // The exact regression the repoint fixes — an all-origins activityLog entry must not register as
    // unread "activity". eventFeed empty → unreadCount 0 → no badge.
    reset({ activityLog: [recent({ origin: 'organic', message: 'nap' })], eventFeed: [] })
    expect(render()).not.toContain(BADGE)
  })

  it('does NOT inject the decorative activeEvent banner', () => {
    // A live activeEvent (lunch/tea/meeting set-piece) must no longer be unshift'd as "live" activity.
    reset({ activeEvent: { id: 'lunch', name: 'Lunch' }, eventFeed: [] })
    expect(render()).not.toContain(BADGE)
  })

  it('self-hides in roster mode (no second feed on screen)', () => {
    reset({ rosterMode: true, eventFeed: [recent()] })
    expect(render()).toBe('')
  })

  it('renders in office mode (rosterMode false)', () => {
    reset({ rosterMode: false, eventFeed: [recent()] })
    const html = render()
    expect(html).not.toBe('')
    expect(html).toContain('📋')
  })
})
