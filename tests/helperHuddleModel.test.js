import { describe, expect, it } from 'vitest'

import {
  buildHelperHuddleViewModel,
  HELPER_MAX_VISIBLE,
  helperCountByParent,
  helperHuddleSignature,
  parseHelperHuddleSignatureEntry,
  resolveAnchoredHelperLayout,
} from '../src/systems/helperHuddleModel.mjs'
import { resolveHelperLayout } from '../src/systems/movementSystem.js'

describe('helperHuddleModel — portable helper huddle view-model', () => {
  it('counts helpers by parent defensively', () => {
    expect(helperCountByParent([
      { parentRole: 'dev' },
      { parentRole: 'dev' },
      { parentRole: 'qa' },
      {},
      null,
    ])).toEqual({ dev: 2, qa: 1 })
    expect(helperCountByParent(null)).toEqual({})
  })

  it('builds a flat primitive signature and skips absent parent roles', () => {
    const signature = helperHuddleSignature({
      helpers: [
        { parentRole: 'planner' },
        { parentRole: 'arch' },
        { parentRole: 'planner' },
      ],
      agents: {
        planner: { position: { x: 139.6, y: 240.4 }, color: '#378ADD' },
      },
    })

    expect(signature).toEqual({ planner: '2|140|240|#378ADD' })
    expect(signature.arch).toBeUndefined()
  })

  it('parses signature entries for renderers that subscribe to the flat map', () => {
    expect(parseHelperHuddleSignatureEntry('3|140|240|#abc')).toEqual({
      count: 3,
      anchor: { x: 140, y: 240 },
      color: '#abc',
    })
    expect(parseHelperHuddleSignatureEntry('2|||')).toEqual({
      count: 2,
      anchor: null,
      color: '',
    })
  })

  it('resolves capped sprites, overflow, and heavy state from an injected anchor', () => {
    const layout = resolveAnchoredHelperLayout(12, { x: 100, y: 200 })

    expect(layout.sprites).toEqual([
      { x: 85, y: 216 },
      { x: 115, y: 216 },
      { x: 100, y: 227 },
    ])
    expect(layout.sprites).toHaveLength(HELPER_MAX_VISIBLE)
    expect(layout.overflow).toBe(9)
    expect(layout.heavy).toBe(true)
    expect(resolveAnchoredHelperLayout(0, { x: 100, y: 200 }).sprites).toEqual([])
    expect(resolveAnchoredHelperLayout(2, null).anchor).toBeNull()
  })

  it('returns renderer rows with optional default anchors for missing positions', () => {
    const view = buildHelperHuddleViewModel({
      helpers: [{ parentRole: 'dev' }, { parentRole: 'dev' }, { parentRole: 'qa' }],
      agents: {
        dev: { color: '#123' },
        qa: { position: { x: 200, y: 300 }, color: '#456' },
      },
      defaultAnchors: { dev: { x: 10, y: 20 } },
    })

    expect(view.signature).toEqual({
      dev: '2|||#123',
      qa: '1|200|300|#456',
    })
    expect(view.rows.map((row) => [row.role, row.count, row.color, row.anchor])).toEqual([
      ['dev', 2, '#123', { x: 10, y: 20 }],
      ['qa', 1, '#456', { x: 200, y: 300 }],
    ])
  })

  it('keeps the movementSystem legacy role wrapper equivalent when an anchor is injected', () => {
    const anchor = { x: 140, y: 240 }
    expect(resolveHelperLayout('pm', 4, anchor)).toEqual(resolveAnchoredHelperLayout(4, anchor))
  })
})
