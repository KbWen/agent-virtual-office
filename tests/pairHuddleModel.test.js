import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PAIR_HUDDLE_WINDOW,
  buildPairLinkViewModel,
  findSharedFilePair,
  isPairHuddleWriteTask,
  normalizeFilePath,
  pairEndpointPosition,
} from '../src/systems/pairHuddleModel.mjs'

const NOW = 1_000_000

const entry = (status, activeFile, activeFileAt) => ({ status, activeFile, activeFileAt })

describe('pairHuddleModel public API', () => {
  it('keeps legacy case-insensitive comparison by default', () => {
    const ext = {
      dev: entry('working', 'C:\\R\\src\\Store.js', NOW - 1000),
      qa: entry('working', 'c:/r/src/store.js', NOW - 2000),
    }

    expect(normalizeFilePath('C:\\R\\src\\Store.js')).toBe('c:/r/src/store.js')
    expect(findSharedFilePair(ext, NOW, DEFAULT_PAIR_HUDDLE_WINDOW)).toEqual(['dev', 'qa'])
  })

  it('lets portable renderers opt into case-sensitive path comparison', () => {
    const ext = {
      dev: entry('working', '/repo/src/Store.js', NOW - 1000),
      qa: entry('working', '/repo/src/store.js', NOW - 2000),
    }

    expect(normalizeFilePath('/repo/src/Store.js', { caseSensitive: true })).toBe('/repo/src/Store.js')
    expect(findSharedFilePair(ext, NOW, DEFAULT_PAIR_HUDDLE_WINDOW, { caseSensitive: true })).toBeNull()
  })

  it('builds a renderer-facing pair link view-model with endpoint positions', () => {
    const model = buildPairLinkViewModel({
      now: NOW,
      externalStatus: {
        dev: entry('working', '/repo/src/store.js', NOW - 1000),
        qa: entry('working', '/repo/src/store.js', NOW - 2000),
      },
      agents: {
        dev: { position: { x: 10, y: 20 } },
        qa: { targetPosition: { x: 50, y: 60 }, position: { x: 40, y: 50 } },
      },
    })

    expect(model).toMatchObject({
      visible: true,
      pair: ['dev', 'qa'],
      link: { a: 'dev', b: 'qa', file: 'store.js', path: '/repo/src/store.js', pathKey: '/repo/src/store.js' },
      positions: { from: { x: 10, y: 20 }, to: { x: 50, y: 60 } },
    })
  })

  it('does not over-claim co-editing when an explicit task is read-class', () => {
    const ext = {
      dev: { ...entry('working', '/repo/src/store.js', NOW - 1000), task: 'Edit' },
      qa: { ...entry('working', '/repo/src/store.js', NOW - 2000), task: 'Read' },
    }

    expect(isPairHuddleWriteTask('Edit')).toBe(true)
    expect(isPairHuddleWriteTask('Read')).toBe(false)
    expect(findSharedFilePair(ext, NOW, DEFAULT_PAIR_HUDDLE_WINDOW)).toBeNull()
    expect(buildPairLinkViewModel({ externalStatus: ext, now: NOW }).visible).toBe(false)
  })

  it('returns a stable hidden shape when there is no honest pair', () => {
    expect(buildPairLinkViewModel({
      now: NOW,
      externalStatus: {
        dev: entry('working', '/repo/src/store.js', NOW - 1000),
        qa: entry('working', '/repo/src/router.js', NOW - 1000),
      },
    })).toEqual({ visible: false, pair: null, link: null, positions: null })
  })

  it('exports endpoint position fallback independently for non-SVG renderers', () => {
    expect(pairEndpointPosition({ targetPosition: { x: 2, y: 3 }, position: { x: 1, y: 1 } })).toEqual({ x: 2, y: 3 })
    expect(pairEndpointPosition({ position: { x: 1, y: 1 } })).toEqual({ x: 1, y: 1 })
    expect(pairEndpointPosition(null)).toBeNull()
  })
})
