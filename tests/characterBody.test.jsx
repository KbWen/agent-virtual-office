import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CharacterBody } from '../src/components/CharacterBody.jsx'

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

  it('never mirrors for left facing (Phase 1 shows the front master)', () => {
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
