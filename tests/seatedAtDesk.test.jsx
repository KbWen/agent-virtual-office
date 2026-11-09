import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HOME_POSITIONS } from '../src/systems/movementSystem.js'
import { isSeatedAtDesk, DESK_ROLES, SEAT_SHIFT, SEAT_CLIP_Y } from '../src/systems/seating.js'
import { applyBackView } from '../src/systems/backView.js'
import { CharacterBody, pixelViewFor } from '../src/components/CharacterBody.jsx'
import { PIXEL_V1_PACK, pixelHasBackView, BEHAVIOR_POSES, pixelActionView } from '../src/systems/characterAppearance.js'

const home = (id) => ({ ...HOME_POSITIONS[id] })

describe('isSeatedAtDesk (R1 option C)', () => {
  it('seats every desk role resting exactly on its home seat', () => {
    for (const id of DESK_ROLES) expect(isSeatedAtDesk({ id, position: home(id), status: 'working' }), id).toBe(true)
  })
  it('session-prefixed ids sit at their base role desk', () => {
    expect(isSeatedAtDesk({ id: 'feat-x~dev', position: home('dev'), status: 'working' })).toBe(true)
  })
  it('never seats gate, lightweight helpers or unknown roles', () => {
    for (const id of ['gate', 'planner', 'worker', 'checker', 'mystery']) {
      expect(isSeatedAtDesk({ id, position: HOME_POSITIONS[id] || { x: 0, y: 0 }, status: 'working' }), id).toBe(false)
    }
  })
  it('stands while walking, moving, in a group event, or off the exact seat', () => {
    expect(isSeatedAtDesk({ id: 'pm', position: home('pm'), status: 'working', isWalking: true })).toBe(false)
    expect(isSeatedAtDesk({ id: 'pm', position: home('pm'), status: 'working', isMoving: true })).toBe(false)
    expect(isSeatedAtDesk({ id: 'pm', position: home('pm'), status: 'working', inGroupEvent: true })).toBe(false)
    expect(isSeatedAtDesk({ id: 'pm', position: { x: home('pm').x + 6, y: home('pm').y }, status: 'working' })).toBe(false)
    expect(isSeatedAtDesk({ id: 'pm', position: null })).toBe(false)
  })
  it('sits with its back to the viewer only while really working', () => {
    for (const status of ['working', 'planning', 'thinking']) {
      expect(isSeatedAtDesk({ id: 'pm', position: home('pm'), status }), status).toBe(true)
    }
    for (const status of ['idle', 'done', 'blocked', 'awaiting-approval', 'error', undefined]) {
      expect(isSeatedAtDesk({ id: 'pm', position: home('pm'), status }), String(status)).toBe(false)
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
  it('every Pixel role has a reviewed back view; the pixel body switches file and pivot when seated', () => {
    for (const role of Object.keys(PIXEL_V1_PACK.roles)) expect(pixelHasBackView(role), role).toBe(true)
    const html = svg(<CharacterBody appearance="pixel" charId="dev" seated seatClipId="seat-clip-dev" />)
    expect(html).toContain('data-pixel-view="back"')
    expect(html).toMatch(/pixel-v1\/dev-back\.png/)
    expect(html).toContain('x="-31.5"') // dev back pivot x 36 * 7/8
  })
})

describe('Pixel signature action poses', () => {
  const svg = (el) => renderToStaticMarkup(<svg>{el}</svg>)
  const SIGNATURE = { pm: 'typing', arch: 'whiteboard', dev: 'drink-coffee', qa: 'magnifier', ops: 'deploy-button', res: 'research', designer: 'writing-notes', gate: 'shield-verify' }
  it("each role has exactly its own signature pose, and no one borrows another role's", () => {
    for (const [role, behavior] of Object.entries(SIGNATURE)) {
      expect(pixelActionView(role, behavior), role).toBe(BEHAVIOR_POSES[behavior])
      for (const [other, b2] of Object.entries(SIGNATURE)) if (other !== role) expect(pixelActionView(role, b2), `${role}/${b2}`).toBe(null)
    }
  })
  it('pose priority: walking front > own action > seated back > front', () => {
    expect(pixelViewFor({ charId: 'pm', isMoving: true, seated: true, behavior: 'typing', status: 'working' })).toBe('front')
    expect(pixelViewFor({ charId: 'pm', seated: true, behavior: 'typing', status: 'working' })).toBe('typing')
    expect(pixelViewFor({ charId: 'pm', seated: true, behavior: 'reading-screen', status: 'working' })).toBe('back')
    expect(pixelViewFor({ charId: 'pm', behavior: 'typing', status: 'planning' })).toBe('typing')
    expect(pixelViewFor({ charId: 'pm', behavior: 'typing', status: 'thinking' })).toBe('typing')
    expect(pixelViewFor({ charId: 'pm', behavior: 'coffee' })).toBe('front')
    expect(pixelViewFor({ charId: 'worker', behavior: 'drink-coffee' })).toBe('drinking-coffee') // alias -> dev
    expect(pixelViewFor({ charId: 'mystery', behavior: 'whiteboard' })).toBe('front') // fallback pm has no whiteboard pose
  })
  it('work-claiming poses need a live working status; coffee/book claim nothing', () => {
    for (const status of ['idle', 'done', 'blocked', 'awaiting-approval', 'error', undefined]) {
      for (const [role, behavior] of Object.entries(SIGNATURE)) {
        const want = ['dev', 'res'].includes(role) ? BEHAVIOR_POSES[behavior] : 'front'
        expect(pixelViewFor({ charId: role, behavior, status }), `${role}/${status}`).toBe(want)
      }
    }
    expect(pixelActionView('ops', 'deploy-button', { working: false })).toBe(null)
    expect(pixelActionView('ops', 'deploy-button', { working: true })).toBe('control-deploy')
  })
  it('an action pose at the desk stands (not clipped); the back view sits', () => {
    const typing = svg(<CharacterBody appearance="pixel" charId="pm" seated behavior="typing" status="working" />)
    expect(typing).toContain('data-pixel-view="typing"'); expect(typing).not.toContain('data-seated')
    const back = svg(<CharacterBody appearance="pixel" charId="pm" seated behavior="reading-screen" status="working" />)
    expect(back).toContain('data-pixel-view="back"'); expect(back).toContain('data-seated')
    const classic = svg(<CharacterBody appearance="classic" charId="pm" seated behavior="typing" status="working" classic={<g />} />)
    expect(classic).toContain('data-seated')
  })
  it('a seated body is covered by a chair back drawn in front of it, never left cut off', () => {
    const back = svg(<CharacterBody appearance="pixel" charId="pm" seated behavior="reading-screen" status="working" />)
    expect(back).toContain('data-chair-back="pixel"')
    // chair back comes after the clipped body in paint order (in front of it)
    expect(back.indexOf('data-chair-back')).toBeGreaterThan(back.indexOf('data-pixel-view="back"'))
    const classic = svg(<CharacterBody appearance="classic" charId="pm" seated status="working" classic={<g data-x="1" />} />)
    expect(classic).toContain('data-chair-back="classic"')
    expect(classic.indexOf('data-chair-back')).toBeGreaterThan(classic.indexOf('data-x'))
    // standing (action pose at the desk, or not seated) has no chair back over the body
    expect(svg(<CharacterBody appearance="pixel" charId="pm" seated behavior="typing" status="working" />)).not.toContain('data-chair-back')
    expect(svg(<CharacterBody appearance="pixel" charId="pm" />)).not.toContain('data-chair-back')
  })
  it('renders the action file with its own pivot', () => {
    const html = svg(<CharacterBody appearance="pixel" charId="arch" behavior="whiteboard" status="working" />)
    expect(html).toContain('data-pixel-view="pointing-board"')
    expect(html).toMatch(/pixel-v1\/arch-pointing-board\.png/)
  })
})
