import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CharacterBody } from '../src/components/CharacterBody.jsx'
import { CharacterPixelSprite } from '../src/components/AgentCharacter.jsx'

const svg = (el) => renderToStaticMarkup(<svg>{el}</svg>)
const CLASSIC = <g data-body="classic-marker" />

describe('CharacterBody (Phase-1 Pixel appearance)', () => {
  it('classic appearance renders the supplied procedural body untouched', () => {
    const html = svg(<CharacterBody appearance="classic" charId="dev" classic={CLASSIC} />)
    expect(html).toContain('classic-marker')
    expect(html).not.toContain('<image')
  })

  it('pixel renders only the role master, pivot-placed, pointer-transparent, no classic pieces', () => {
    const html = svg(<CharacterBody appearance="pixel" charId="sess~dev" classic={CLASSIC} />)
    expect(html).not.toContain('classic-marker')
    expect(html).toContain('data-pixel-role="dev"')
    expect(html).toMatch(/href="[^"]*\/assets\/characters\/pixel-v1\/dev\.png"/)
    expect(html).toContain('x="-31.5"')
    expect(html).toContain('y="-48.125"')
    expect(html).toContain('pointer-events:none')
    expect(html).toContain('image-rendering:pixelated')
    // classic body bounds stay the hit target
    expect(html).toMatch(/<rect x="-16" y="-40" width="32" height="40" fill="transparent"/)
    expect((html.match(/<image/g) || []).length).toBe(1)
  })

  it('never mirrors a front master for left facing (only walk-cycle frames mirror)', () => {
    const html = svg(<CharacterBody appearance="pixel" charId="gate" facing="left" classic={CLASSIC} />)
    expect(html).not.toMatch(/scale\(-1/)
  })

  it('bob only while walking and never under reduced motion', () => {
    expect(svg(<CharacterBody appearance="pixel" charId="pm" isMoving={false} />)).toContain('data-pixel-bob="0"')
    expect(svg(<CharacterBody appearance="pixel" charId="pm" isMoving />)).toContain('avo-pixel-walk-bob')
    const rm = svg(<CharacterBody appearance="pixel" charId="pm" isMoving reducedMotion />)
    expect(rm).toContain('data-pixel-bob="0"')
    expect(rm).not.toContain('avo-pixel-walk-bob')
  })

  it('alias and unknown roles resolve explicitly', () => {
    expect(svg(<CharacterBody appearance="pixel" charId="worker" />)).toContain('data-pixel-role="dev"')
    expect(svg(<CharacterBody appearance="pixel" charId="who-knows" />)).toContain('data-pixel-role="pm"')
  })
})

// AVO-207: Res has the first reviewed 4-frame right-facing walk cycle (docs/specs/avo-207-pixel-walk-cycles.md).
describe('CharacterBody walk cycle (AVO-207)', () => {
  const view = (html) => html.match(/data-pixel-view="([^"]+)"/)[1]
  const walk = (props) => svg(<CharacterBody appearance="pixel" charId="res" isMoving facing="right" {...props} />)

  it('walking right steps through walk-side-0..3 and loops', () => {
    expect([0, 1, 2, 3, 4, 5].map((s) => view(walk({ walkStep: s })))).toEqual(
      ['walk-side-0', 'walk-side-1', 'walk-side-2', 'walk-side-3', 'walk-side-0', 'walk-side-1'])
    const html = walk({ walkStep: 2 })
    expect(html).toMatch(/href="[^"]*\/pixel-v1\/res-walk-side-2\.png"/)
    expect(html).toContain('data-pixel-mirrored="0"')
    expect(html).not.toMatch(/scale\(-1/)
  })

  it('walking left shows the same frame mirrored around the foot anchor', () => {
    const html = walk({ facing: 'left', walkStep: 1 })
    expect(view(html)).toBe('walk-side-1')
    expect(html).toContain('data-pixel-mirrored="1"')
    expect(html).toContain('transform="scale(-1, 1)"')
  })

  it('places each walk frame by its own measured sole (pivot 31.5, 57) on the world foot anchor', () => {
    const html = walk({ walkStep: 0 })
    expect(html).toContain('x="-27.5625"') // -31.5 * 7/8
    expect(html).toContain('y="-49.875"') // -57 * 7/8
  })

  it('walk frames carry their own motion: no CSS bob', () => {
    const html = walk({ walkStep: 0 })
    expect(html).toContain('data-pixel-bob="0"')
    expect(html).not.toContain('avo-pixel-walk-bob')
  })

  it('walking up or down keeps the front master (no side frames for vertical walking)', () => {
    for (const facing of ['up', 'down']) {
      const html = walk({ facing, walkStep: 1 })
      expect(view(html)).toBe('front')
      expect(html).toContain('avo-pixel-walk-bob')
    }
  })

  it('reduced motion walks with the static front master, unmirrored', () => {
    const html = walk({ facing: 'left', walkStep: 3, reducedMotion: true })
    expect(view(html)).toBe('front')
    expect(html).toContain('data-pixel-mirrored="0"')
    expect(html).toContain('data-pixel-bob="0"')
  })

  it('standing never uses walk frames, whatever the facing', () => {
    const html = svg(<CharacterBody appearance="pixel" charId="res" facing="left" walkStep={2} />)
    expect(view(html)).toBe('front')
    expect(html).not.toMatch(/scale\(-1/)
  })

  it('a role without a reviewed cycle walks with its front master, as before', () => {
    const html = svg(<CharacterBody appearance="pixel" charId="gate" isMoving facing="right" walkStep={1} />)
    expect(view(html)).toBe('front')
    expect(html).toContain('avo-pixel-walk-bob')
  })

  it('classic appearance ignores walk steps beyond its own two-frame alternation', () => {
    const html = svg(<CharacterBody appearance="classic" charId="res" isMoving facing="right" walkStep={3} classic={CLASSIC} />)
    expect(html).toContain('classic-marker')
    expect(html).not.toContain('<image')
  })

  it('walking wins over a seated back view or a signature action pose', () => {
    const seated = svg(<CharacterBody appearance="pixel" charId="res" isMoving seated facing="right" walkStep={1} status="working" />)
    expect(view(seated)).toBe('walk-side-1')
    expect(seated).not.toContain('data-seated')
    const action = svg(<CharacterBody appearance="pixel" charId="res" isMoving facing="left" walkStep={2} behavior="research" status="working" />)
    expect(view(action)).toBe('walk-side-2')
  })
})

describe('Classic sprite with the 0..3 walk step (AVO-207 W-07)', () => {
  const sprite = (walkFrame) => renderToStaticMarkup(
    <svg><CharacterPixelSprite charId="res" expression="normal" isMoving walkFrame={walkFrame} facing="right" /></svg>)
  it('steps 2 and 3 draw exactly the same legs as steps 0 and 1', () => {
    expect(sprite(2)).toBe(sprite(0))
    expect(sprite(3)).toBe(sprite(1))
    expect(sprite(1)).not.toBe(sprite(0))
  })
})
