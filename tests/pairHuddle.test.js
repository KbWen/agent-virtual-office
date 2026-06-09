/**
 * AVO-106 — pure pair-huddle detector honesty invariants.
 * The detector must only return a pair when two DISTINCT agents are genuinely on the
 * byte-identical file within the recency window. See spec §Honesty Contract.
 */
import { describe, it, expect } from 'vitest'
import { findSharedFilePair, normalizeFilePath, fileBasename, pairKey } from '../src/systems/pairHuddle.js'

const WIN = 90000
const NOW = 1_000_000

// helper: build an externalStatus entry
const E = (status, activeFile, activeFileAt) => ({ status, activeFile, activeFileAt })

describe('normalizeFilePath / fileBasename', () => {
  it('unifies separators and lower-cases for comparison', () => {
    expect(normalizeFilePath('C:\\Users\\X\\src\\Store.js')).toBe('c:/users/x/src/store.js')
  })
  it('returns null for empty / non-string', () => {
    expect(normalizeFilePath('')).toBeNull()
    expect(normalizeFilePath(null)).toBeNull()
    expect(normalizeFilePath(42)).toBeNull()
  })
  it('basename is the real file name (display)', () => {
    expect(fileBasename('C:\\Users\\X\\src\\store.js')).toBe('store.js')
    expect(fileBasename('/a/b/c/App.jsx')).toBe('App.jsx')
    expect(fileBasename('lonefile')).toBe('lonefile')
    expect(fileBasename('')).toBe('')
  })
  it('pairKey is order-independent', () => {
    expect(pairKey('dev', 'qa')).toBe(pairKey('qa', 'dev'))
  })
})

describe('findSharedFilePair — fires only on a real shared file', () => {
  it('AC-1: two distinct agents on the byte-identical path → pair (most-recent first)', () => {
    const ext = {
      dev: E('working', '/r/src/store.js', NOW - 1000),
      qa:  E('working', '/r/src/store.js', NOW - 5000),
    }
    expect(findSharedFilePair(ext, NOW, WIN)).toEqual(['dev', 'qa'])
  })

  it('AC-1: separators/case differences still match the same logical file', () => {
    const ext = {
      dev: E('working', 'C:\\R\\src\\Store.js', NOW - 1000),
      qa:  E('working', 'c:/r/src/store.js', NOW - 2000),
    }
    expect(findSharedFilePair(ext, NOW, WIN)).toEqual(['dev', 'qa'])
  })

  it('AC-2: different paths → NO pair', () => {
    const ext = {
      dev: E('working', '/r/src/store.js', NOW - 1000),
      qa:  E('working', '/r/src/router.js', NOW - 1000),
    }
    expect(findSharedFilePair(ext, NOW, WIN)).toBeNull()
  })

  it('AC-2: same BASENAME in different dirs is NOT the same file', () => {
    const ext = {
      dev: E('working', '/r/a/index.js', NOW - 1000),
      qa:  E('working', '/r/b/index.js', NOW - 1000),
    }
    expect(findSharedFilePair(ext, NOW, WIN)).toBeNull()
  })

  it('AC-4: a stale activeFileAt (> window) drops that agent → NO pair', () => {
    const ext = {
      dev: E('working', '/r/src/store.js', NOW - 1000),
      qa:  E('working', '/r/src/store.js', NOW - (WIN + 1)),  // stale
    }
    expect(findSharedFilePair(ext, NOW, WIN)).toBeNull()
  })

  it('an unstamped activeFileAt (null/NaN) is not "on it now"', () => {
    const ext = {
      dev: E('working', '/r/src/store.js', NOW - 1000),
      qa:  E('working', '/r/src/store.js', null),
    }
    expect(findSharedFilePair(ext, NOW, WIN)).toBeNull()
  })

  it('idle agents are excluded even on the same file', () => {
    const ext = {
      dev: E('working', '/r/src/store.js', NOW - 1000),
      qa:  E('idle',    '/r/src/store.js', NOW - 1000),
    }
    expect(findSharedFilePair(ext, NOW, WIN)).toBeNull()
  })

  it('an agent with no activeFile never pairs', () => {
    const ext = {
      dev: E('working', '/r/src/store.js', NOW - 1000),
      qa:  E('working', null, NOW - 1000),
    }
    expect(findSharedFilePair(ext, NOW, WIN)).toBeNull()
  })

  it('done agents still count (the file correlation is real within the window)', () => {
    const ext = {
      dev: E('done', '/r/src/store.js', NOW - 1000),
      qa:  E('working', '/r/src/store.js', NOW - 2000),
    }
    expect(findSharedFilePair(ext, NOW, WIN)).toEqual(['dev', 'qa'])
  })

  it('>2 on the same file → the two MOST-RECENT are chosen', () => {
    const ext = {
      dev:  E('working', '/r/x.js', NOW - 9000),
      qa:   E('working', '/r/x.js', NOW - 1000),
      ops:  E('working', '/r/x.js', NOW - 3000),
    }
    expect(findSharedFilePair(ext, NOW, WIN)).toEqual(['qa', 'ops'])
  })

  it('picks the freshest co-active file when two files each have a pair', () => {
    const ext = {
      dev:  E('working', '/r/old.js',  NOW - 8000),
      qa:   E('working', '/r/old.js',  NOW - 7000),  // pair freshness = 7000-ago
      ops:  E('working', '/r/new.js',  NOW - 2000),
      arch: E('working', '/r/new.js',  NOW - 1000),  // pair freshness = 2000-ago (fresher)
    }
    expect(findSharedFilePair(ext, NOW, WIN)).toEqual(['arch', 'ops'])
  })

  it('empty / single-agent snapshots → null', () => {
    expect(findSharedFilePair({}, NOW, WIN)).toBeNull()
    expect(findSharedFilePair({ dev: E('working', '/r/x.js', NOW) }, NOW, WIN)).toBeNull()
    expect(findSharedFilePair(null, NOW, WIN)).toBeNull()
  })
})
