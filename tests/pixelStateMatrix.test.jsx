// AVO-207 owner rule (2026-11-15): "different states must not fight or cover each other".
// Matrix over every Pixel role (plus an alias) x status x behavior x motion context: one fixed priority
// (walk > own action pose > seated back > front) picks the view, and each distinct outcome is rendered
// once to prove it draws exactly one body image from that role's own manifest, with mirroring, bob and
// the seat clip applied only to the view they belong to.
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CharacterBody, pixelViewFor } from '../src/components/CharacterBody.jsx'
import { PIXEL_V1_PACK, BEHAVIOR_POSES, NON_CLAIM_POSES } from '../src/systems/characterAppearance.js'
import { VALID_STATUSES } from '../src/utils/statusContract.mjs'

const ROLES = [...Object.keys(PIXEL_V1_PACK.roles), 'feat-x~qa']
const STATUSES = [...VALID_STATUSES, 'error', 'thinking']
const BEHAVIORS = [null, 'toilet', 'eat-snack', 'phone-call', ...Object.keys(BEHAVIOR_POSES)]
const WORKING = new Set(['working', 'planning', 'thinking'])
// [isMoving, seated, reducedMotion, facing]; sideFacing is 'left', so up/down walking mirrors.
const MOTION = []
for (const isMoving of [false, true]) for (const seated of [false, true]) for (const reducedMotion of [false, true])
  for (const facing of ['left', 'right', 'up', 'down']) MOTION.push([isMoving, seated, reducedMotion, facing])
const attr = (html, name) => (html.match(new RegExp(`${name}="([^"]*)"`)) || [])[1]
const baseRole = (id) => (id.includes('~') ? id.split('~').pop() : id)

function expectedView(role, status, behavior, isMoving, seated, reducedMotion, walkStep) {
  if (isMoving) return reducedMotion ? 'front' : `walk-side-${walkStep}`
  const pose = BEHAVIOR_POSES[behavior]
  const own = pose && PIXEL_V1_PACK.roles[role].views[pose] && (WORKING.has(status) || NON_CLAIM_POSES.has(pose))
  return own ? pose : (seated ? 'back' : 'front')
}

describe('Pixel body state matrix (no state overrides another)', () => {
  const outcomes = new Map()
  let cases = 0
  for (const charId of ROLES) for (const status of STATUSES) for (const behavior of BEHAVIORS)
    for (const [isMoving, seated, reducedMotion, facing] of MOTION) for (const walkStep of [0, 3]) {
      const role = baseRole(charId)
      const view = expectedView(role, status, behavior, isMoving, seated, reducedMotion, walkStep)
      const mirrored = view.startsWith('walk-side-') && facing !== 'right'
      const clipped = seated && view === 'back'
      cases++
      const key = `${charId}|${view}|${mirrored}|${clipped}`
      if (!outcomes.has(key)) outcomes.set(key, { charId, role, status, behavior, isMoving, seated, reducedMotion, facing, walkStep, view, mirrored, clipped })
    }

  it('the priority picks the expected view in every combination', () => {
    for (const charId of ROLES) for (const status of STATUSES) for (const behavior of BEHAVIORS)
      for (const [isMoving, seated, reducedMotion] of MOTION) for (const walkStep of [0, 3]) {
        const got = pixelViewFor({ charId, isMoving, seated, behavior, status, walkStep, reducedMotion })
        expect(got, `${charId} ${status} ${behavior} ${isMoving} ${seated} ${reducedMotion} ${walkStep}`)
          .toBe(expectedView(baseRole(charId), status, behavior, isMoving, seated, reducedMotion, walkStep))
      }
    expect(cases).toBeGreaterThan(20000)
  })

  it('every distinct outcome draws one image of its own role, mirrored/bobbed/clipped only where it belongs', () => {
    for (const o of outcomes.values()) {
      const html = renderToStaticMarkup(<svg><CharacterBody appearance="pixel" charId={o.charId} isMoving={o.isMoving}
        seated={o.seated} reducedMotion={o.reducedMotion} behavior={o.behavior} status={o.status} facing={o.facing}
        sideFacing="left" walkStep={o.walkStep} /></svg>)
      const ctx = JSON.stringify(o)
      expect((html.match(/<image/g) || []).length, ctx).toBe(1)
      expect(attr(html, 'data-pixel-role'), ctx).toBe(o.role)
      expect(attr(html, 'data-pixel-view'), ctx).toBe(o.view)
      const file = o.view === 'front' ? PIXEL_V1_PACK.roles[o.role].file : PIXEL_V1_PACK.roles[o.role].views[o.view].file
      expect(html, ctx).toContain(`/pixel-v1/${file}"`)
      expect(attr(html, 'data-pixel-mirrored'), ctx).toBe(o.mirrored ? '1' : '0')
      expect(attr(html, 'data-pixel-bob'), ctx).toBe('0') // every role has a cycle: no front-master bob
      expect(html.includes('data-seated="1"'), ctx).toBe(o.clipped)
    }
    expect(outcomes.size).toBeGreaterThan(50) // 9 role ids x (front, back, own poses, 4 walk frames x mirrored)
  })
})
