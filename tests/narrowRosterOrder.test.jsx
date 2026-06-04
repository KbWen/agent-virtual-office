import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useOfficeStore } from '../src/systems/store.js'
import { charName } from '../src/i18n.js'
import NarrowRoster from '../src/components/NarrowRoster.jsx'

// Deterministic render test for the vertical roster's ORDER + dimming, with a CONTROLLED store and
// NO live integration (SSR runs one render; the component has no effects). This is the proof the
// live preview can't give — in the dev env the office is wired to the running Claude session, whose
// hook poll overwrites any injected status at commit time. Here the store is the only source.

function setStatuses(map) {
  useOfficeStore.setState((s) => {
    const agents = { ...s.agents }
    const externalStatus = { ...s.externalStatus }
    for (const [id, status] of Object.entries(map)) {
      if (agents[id]) agents[id] = { ...agents[id], status }
      externalStatus[id] = { ...(externalStatus[id] || {}), status, expiresAt: 300000 }
    }
    return { agents, externalStatus, rosterMode: true }
  })
}

// Agent name spans are the only `font-semibold` elements; capture them in render order.
function renderedNameOrder() {
  const html = renderToStaticMarkup(React.createElement(NarrowRoster))
  return [...html.matchAll(/font-semibold[^>]*>([^<]+)</g)].map((m) => m[1])
}

// Map each row's status by pairing the data-roster-status attribute order with the name order.
function renderedRows() {
  const html = renderToStaticMarkup(React.createElement(NarrowRoster))
  const statuses = [...html.matchAll(/data-roster-status="([^"]+)"/g)].map((m) => m[1])
  const names = [...html.matchAll(/font-semibold[^>]*>([^<]+)</g)].map((m) => m[1])
  return names.map((n, i) => ({ name: n, status: statuses[i] }))
}

describe('NarrowRoster render order (controlled store, no live poll)', () => {
  beforeEach(() => {
    useOfficeStore.setState({ rosterMode: true, externalStatus: {} })
    // reset all agents to idle baseline
    useOfficeStore.setState((s) => {
      const agents = {}
      for (const [id, a] of Object.entries(s.agents)) agents[id] = { ...a, status: 'idle' }
      return { agents }
    })
  })

  it('renders one card per (non-session) agent', () => {
    const rows = renderedRows()
    expect(rows.length).toBe(8) // pm, arch, dev, qa, ops, res, gate, designer
  })

  it('a BLOCKED agent is pinned to the TOP', () => {
    setStatuses({ gate: 'blocked', dev: 'working', qa: 'working' })
    const order = renderedNameOrder()
    expect(order[0]).toBe(charName('gate'))
  })

  it('with NO blocked agent, order is the STABLE id order (no churn)', () => {
    setStatuses({ dev: 'working', qa: 'done', ops: 'working' })
    const order = renderedNameOrder()
    // stable id order: arch, designer, dev, gate, ops, pm, qa, res
    expect(order).toEqual(['arch', 'designer', 'dev', 'gate', 'ops', 'pm', 'qa', 'res'].map(charName))
  })

  it('working↔done does NOT change the order (same active tier)', () => {
    setStatuses({ dev: 'working', ops: 'working' })
    const a = renderedNameOrder()
    setStatuses({ dev: 'done', ops: 'working' })
    const b = renderedNameOrder()
    expect(b).toEqual(a) // dev flipping to done did not move it
  })

  it('idle rows are dimmed (opacity-60); active/blocked rows are not', () => {
    setStatuses({ gate: 'blocked', dev: 'working' }) // rest idle
    const html = renderToStaticMarkup(React.createElement(NarrowRoster))
    // blocked card carries the red bg and must NOT be dimmed
    expect(/data-roster-status="blocked"[^>]*opacity-60/.test(html)).toBe(false)
    // at least one idle card is dimmed
    expect(/opacity-60/.test(html)).toBe(true)
  })

  it('shows the quiet resting hint when the whole team is idle', () => {
    // all idle (beforeEach baseline)
    const html = renderToStaticMarkup(React.createElement(NarrowRoster))
    expect(html.includes('data-roster-quiet="1"')).toBe(true)
  })

  it('hides the quiet hint when someone is active', () => {
    setStatuses({ dev: 'working' })
    const html = renderToStaticMarkup(React.createElement(NarrowRoster))
    expect(html.includes('data-roster-quiet="1"')).toBe(false)
  })
})
