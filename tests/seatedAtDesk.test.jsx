import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HOME_POSITIONS } from '../src/systems/movementSystem.js'
import { isSeatedAtDesk, DESK_ROLES, SEAT_SHIFT, SEAT_CLIP_Y } from '../src/systems/seating.js'
import { applyBackView } from '../src/systems/backView.js'
import { CharacterBody } from '../src/components/CharacterBody.jsx'
import { PIXEL_V1_PACK, pixelHasBackView } from '../src/systems/characterAppearance.js'

const home = (id) => ({ ...HOME_POSITIONS[id] })

describe('isSeatedAtDesk (R1 option C)', () => {
  it('seats every desk role resting exactly on its home seat', () => {
    for (const id of DESK_ROLES) expect(isSeatedAtDesk({ id, position: home(id) }), id).toBe(true)
  })
  it('session-prefixed ids sit at their base role desk', () => {
    expect(isSeatedAtDesk({ id: 'feat-x~dev', position: home('dev') })).toBe(true)
  })
  it('never seats gate, lightweight helpers or unknown roles', () => {
    for (const id of ['gate', 'planner', 'worker', 'checker', 'mystery']) {
      expect(isSeatedAtDesk({ id, position: HOME_POSITIONS[id] || { x: 0, y: 0 } }), id).toBe(false)
    }
  })
  it('stands while walking, moving, in a group event, or off the exact seat', () => {
    expect(isSeatedAtDesk({ id: 'pm', position: home('pm'), isWalking: true })).toBe(false)
    expect(isSeatedAtDesk({ id: 'pm', position: home('pm'), isMoving: true })).toBe(false)
    expect(isSeatedAtDesk({ id: 'pm', position: home('pm'), inGroupEvent: true })).toBe(false)
    expect(isSeatedAtDesk({ id: 'pm', position: { x: home('pm').x + 6, y: home('pm').y } })).toBe(false)
    expect(isSeatedAtDesk({ id: 'pm', position: null })).toBe(false)
  })
  it('stands and faces the viewer while waiting on the human', () => {
    expect(isSeatedAtDesk({ id: 'pm', position: home('pm'), status: 'blocked' })).toBe(false)
    expect(isSeatedAtDesk({ id: 'pm', position: home('pm'), status: 'awaiting-approval' })).toBe(false)
    for (const status of ['idle', 'working', 'planning', 'done']) {
      expect(isSeatedAtDesk({ id: 'pm', position: home('pm'), status }), status).toBe(true)
    }
  })
})

describe('applyBackView', () => {
  it('turns every face pixel (rows 4-9) into hair colour and leaves other rows alone', () => {
    const grid = Array.from({ length: 20 }, (_, y) => Array.from({ length: 16 }, (_, x) => (x % 3 === 0 ? null : `c${y}`)))
    const back = applyBackView(grid, '#hair', '#shade')
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 16; x++) {
        if (grid[y][x] === null) expect(back[y][x]).toBe(null)
        else if (y >= 4 && y <= 8) expect(back[y][x]).toBe('#hair')
        else if (y === 9) expect(back[y][x]).toBe('#shade')
        else expect(back[y][x]).toBe(grid[y][x])
      }
    }
    expect(grid[6][1]).toBe('c6') // input not mutated
  })
})

describe('seated frame rendering', () => {
  const svg = (el) => renderToStaticMarkup(<svg>{el}</svg>)
  it('shifts and clips the body, keeps the standing hit target', () => {
    const html = svg(<CharacterBody appearance="classic" charId="pm" seated seatClipId="seat-clip-pm" classic={<g data-body="classic-marker" />} />)
    expect(html).toContain('data-seated="1"')
    expect(html).toContain(`translate(0, ${SEAT_SHIFT})`)
    expect(html).toContain('clip-path="url(#seat-clip-pm)"')
    expect(html).toContain(`height="${80 + SEAT_CLIP_Y}"`)
    expect(html).toMatch(/<rect x="-16" y="-40" width="32" height="40" fill="transparent"/)
    expect(html).toContain('classic-marker')
  })
  it('standing bodies are untouched', () => {
    const html = svg(<CharacterBody appearance="classic" charId="pm" classic={<g data-body="classic-marker" />} />)
    expect(html).not.toContain('data-seated')
  })
  it('no Pixel role has a back view until a reviewed asset is added to the manifest', () => {
    for (const role of Object.keys(PIXEL_V1_PACK.roles)) expect(pixelHasBackView(role), role).toBe(false)
  })
})
