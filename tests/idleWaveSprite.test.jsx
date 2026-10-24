import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CharacterPixelSprite } from '../src/components/AgentCharacter.jsx'

function sprite(props = {}) {
  return renderToStaticMarkup(<svg><CharacterPixelSprite charId="pm" expression="normal"
    facing="down" isMoving={false} walkFrame={0} {...props} /></svg>)
}

describe('idle wave rendered sprites', () => {
  it('renders two bounded one-shot hand phases only for an active wave', () => {
    const normal = sprite()
    const wave = sprite({ idleWave: 1 })
    expect(normal).not.toContain('data-idle-wave')
    expect(wave).toContain('data-idle-wave="1"')
    expect(wave).toContain('data-idle-wave-phase="0"')
    expect(wave).toContain('data-idle-wave-phase="1"')
    expect(wave).toContain('calcMode="discrete"')
    expect(wave).not.toContain('repeatCount="indefinite"')
    expect(wave).toContain('translate(-16, -40) scale(1)')
  })

  it('never overlays a gesture on walking pixels', () => {
    expect(sprite({ isMoving: true, idleWave: 1 })).toBe(sprite({ isMoving: true }))
  })

  it.each(['pm', 'dev', 'res', 'worker', 'designer', 'feat-branch~dev'])(
    'keeps every rendered pixel on the existing grid and feet fixed for %s', charId => {
      const normal = sprite({ charId })
      const wave = sprite({ charId, idleWave: 1 })
      const rects = markup => [...markup.matchAll(/<rect x="(\d+)" y="(\d+)" width="2" height="2" fill="([^"]+)"/g)]
        .map(([, x, y, color]) => ({ x: Number(x), y: Number(y), color }))
      const feet = rects(normal).filter(p => p.y >= 28)
      expect(rects(wave).filter(p => p.y >= 28)).toEqual([...feet, ...feet])
      expect(rects(wave).every(p => p.x <= 30 && p.y <= 38)).toBe(true)
    },
  )
})
