import { describe, it, expect } from 'vitest'
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { CoffeeMachine } from '../src/components/TopDownFurniture.jsx'

// AVO-193 (REV-10 of the 2026-09-19 review). Clicking the coffee machine while every agent is
// genuinely working does nothing: `triggerInteractiveEvent(store, 'tea-break')` returns false and
// `fireInteractionReaction` bails on its first line, because INTERACTION_REACTOR has entries for
// `deploy-success` and `eureka` but none for `tea-break`. AVO-191 made that silence CORRECT — no
// working agent gets dragged to the machine — so the fix is feedback, not a behaviour change.
// The owner chose, from rendered candidates: the MACHINE reacts (steam + its screen reads BUSY).
// Nothing here may touch an agent, a status or activeEvent — the machine answers, nobody else.

const SRC = path.join(process.cwd(), 'src')
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8')
const render = (props) => renderToStaticMarkup(<svg>{<CoffeeMachine x={20} y={445} {...props} />}</svg>)
const screenText = (html) => (html.match(/>(CAFE|BUSY)</) || [])[1] || null
const steamPaths = (html) => (html.match(/<path[^>]*coffee-steam|<path/g) || []).length

describe('CoffeeMachine — the machine answers a click it cannot serve (AVO-193)', () => {
  it('idle: the screen reads CAFE and there is no steam', () => {
    const html = render({})
    expect(screenText(html)).toBe('CAFE')
    expect(html).not.toContain('data-coffee-busy')
    expect(steamPaths(html)).toBe(0)
  })

  it('busy: the screen reads BUSY and three wisps of steam appear', () => {
    const html = render({ busy: true, busyKey: 1 })
    expect(screenText(html)).toBe('BUSY')
    expect(html).toContain('data-coffee-busy')
    expect(steamPaths(html)).toBe(3)
  })

  it('busy steam animates via the CSS keyframes, never SMIL', () => {
    // An <animate begin="0s"> inserted after page load counts from DOCUMENT start and is already
    // frozen at its end state — measured while prototyping, the steam was simply invisible. The
    // steam must be a CSS animation; the existing indicator <animate> is repeatCount=indefinite
    // and unaffected, so the guard is scoped to the steam group.
    const html = render({ busy: true, busyKey: 1 })
    const steamGroup = html.slice(html.indexOf('data-coffee-busy'))
    expect(steamGroup).toContain('coffee-steam')
    expect(steamGroup.slice(0, steamGroup.indexOf('</g>'))).not.toContain('<animate')
  })

  it('reduced motion: the screen still changes and the steam still shows, but nothing moves', () => {
    const html = render({ busy: true, busyKey: 1, reducedMotion: true })
    expect(screenText(html)).toBe('BUSY')
    expect(steamPaths(html)).toBe(3)
    expect(html).not.toContain('coffee-steam')
  })

  it('the machine renders the same shell either way — only the screen and steam differ', () => {
    // Guards against the feedback accidentally moving or resizing the machine: the body, the
    // indicator and the tray must be byte-identical between the two states.
    const shell = (html) => html.replace(/<text[^>]*>(CAFE|BUSY)<\/text>/, '').replace(/<g opacity[^]*?<\/g><circle/, '<circle')
    expect(shell(render({ busy: true, busyKey: 1 }))).toBe(shell(render({})))
  })
})

describe('AVO-193 wiring — the two files that must agree', () => {
  it('the keyframes the component names exist in the stylesheet', () => {
    const name = (read('components/TopDownFurniture.jsx').match(/animation: `?([a-z-]+) /) || [])[1]
    expect(name).toBe('coffee-steam')
    expect(read('index.css')).toContain(`@keyframes ${name}`)
  })

  it('the click site only shows BUSY when the event did NOT start', () => {
    // The whole point of AVO-191 is that a refused tea-break stays refused. The feedback must hang
    // off the falsy return of triggerInteractiveEvent, never replace or precede the call.
    const office = read('components/PixelOffice.jsx')
    const corner = office.slice(office.indexOf('function CoffeeCorner'))
    const body = corner.slice(0, corner.indexOf('\n}'))
    expect(body).toMatch(/triggerInteractiveEvent\(useOfficeStore, 'tea-break'\)/)
    // no status / position / bubble write anywhere in the click handler
    expect(body).not.toMatch(/setAgentBehavior|applyExternalStatus|setState|position/)
  })
})
