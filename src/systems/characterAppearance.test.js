import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import {
  APPEARANCE_STORAGE_KEY, PIXEL_V1_PACK, PIXEL_LOGICAL_SIZE, PIXEL_DISPLAY_SCALE,
  createAppearanceStore, normalizeAppearance, pixelAssetUrl, pixelBodyPlacement, resolvePixelRole,
} from './characterAppearance.js'

const ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']

function memStorage(initial = {}) {
  const m = new Map(Object.entries(initial))
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }
}
const deferred = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b }); return { p, res, rej } }
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('pixel-v1 pack manifest', () => {
  it('declares exactly the eight canonical roles', () => {
    expect(Object.keys(PIXEL_V1_PACK.roles).sort()).toEqual([...ROLES].sort())
  })

  it('every shipped file matches its recorded sha256 and is a 512x512 PNG (no transformation)', () => {
    for (const role of ROLES) {
      const { file, sha256 } = PIXEL_V1_PACK.roles[role]
      const bytes = readFileSync(resolve(__dirname, '../../public/assets/characters/pixel-v1', file))
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256)
      expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG')
      expect(bytes.readUInt32BE(16)).toBe(512) // IHDR width
      expect(bytes.readUInt32BE(20)).toBe(512) // IHDR height
    }
  })
})

describe('resolvePixelRole', () => {
  it('maps canonical, session-prefixed, alias and unknown ids explicitly', () => {
    for (const r of ROLES) expect(resolvePixelRole(r)).toBe(r)
    expect(resolvePixelRole('feat-x~dev')).toBe('dev')
    expect(resolvePixelRole('a~b~gate')).toBe('gate')
    expect(resolvePixelRole('planner')).toBe('pm')
    expect(resolvePixelRole('worker')).toBe('dev')
    expect(resolvePixelRole('checker')).toBe('qa')
    expect(resolvePixelRole('mystery')).toBe('pm')
    expect(resolvePixelRole(undefined)).toBe('pm')
    expect(resolvePixelRole('toString')).toBe('pm') // no prototype leakage
  })
})

describe('pixelBodyPlacement (image-local only — world feet stay at local 0,0)', () => {
  it('puts the measured sole contact on the actor origin for every role', () => {
    for (const role of ROLES) {
      const p = pixelBodyPlacement(role)
      const { pivot } = PIXEL_V1_PACK.roles[role]
      expect(p.width).toBe(PIXEL_LOGICAL_SIZE * PIXEL_DISPLAY_SCALE)
      expect(p.height).toBe(p.width)
      expect(p.x + pivot.x * PIXEL_DISPLAY_SCALE).toBe(0)
      expect(p.y + pivot.y * PIXEL_DISPLAY_SCALE).toBe(0)
    }
  })
  it('keeps Dev off-centre per her measured soles, not her alpha box', () => {
    expect(pixelBodyPlacement('dev')).toMatchObject({ x: -31.5, y: -48.125 })
    expect(pixelBodyPlacement('pm')).toMatchObject({ x: -28, y: -49 })
  })
  it('keeps the tallest master inside the classic 40-unit body envelope', () => {
    // highest opaque logical row across the eight masters is 13 (hair/hat top)
    for (const role of Object.keys(PIXEL_V1_PACK.roles)) {
      const p = pixelBodyPlacement(role)
      expect(p.y + 13 * PIXEL_DISPLAY_SCALE).toBeGreaterThanOrEqual(-40)
    }
  })
})

describe('appearance store (atomic pack switch)', () => {
  it('defaults to classic and ignores junk stored values', () => {
    expect(normalizeAppearance('neon')).toBe('classic')
    const s = createAppearanceStore({ storage: memStorage({ [APPEARANCE_STORAGE_KEY]: 'neon' }), loadImage: vi.fn() })
    expect(s.getSnapshot()).toMatchObject({ requested: 'classic', active: 'classic', status: 'idle' })
  })

  it('swaps to pixel only after ALL eight images resolve', async () => {
    const pending = new Map()
    const loadImage = vi.fn((url) => { const d = deferred(); pending.set(url, d); return d.p })
    const storage = memStorage()
    const s = createAppearanceStore({ storage, loadImage })
    const done = s.request('pixel')
    expect(loadImage).toHaveBeenCalledTimes(8)
    expect(s.getSnapshot()).toMatchObject({ requested: 'pixel', active: 'classic', status: 'loading' })
    const urls = [...pending.keys()]
    urls.slice(0, 7).forEach((u) => pending.get(u).res())
    await flush()
    expect(s.getSnapshot().active).toBe('classic') // 7/8 is never shown
    pending.get(urls[7]).res()
    await done
    expect(s.getSnapshot()).toMatchObject({ active: 'pixel', status: 'ready' })
    expect(storage.getItem(APPEARANCE_STORAGE_KEY)).toBe('pixel')
  })

  it('keeps the current complete pack when any required image fails', async () => {
    const warn = vi.fn()
    const loadImage = vi.fn((url) => (url.endsWith('gate.png') ? Promise.reject(new Error('corrupt')) : Promise.resolve()))
    const s = createAppearanceStore({ storage: memStorage(), loadImage, warn })
    await s.request('pixel')
    expect(s.getSnapshot()).toMatchObject({ active: 'classic', status: 'error' })
    expect(warn).toHaveBeenCalled()
  })

  it('a Classic choice made mid-load wins over the late Pixel completion', async () => {
    const d = deferred()
    const s = createAppearanceStore({ storage: memStorage(), loadImage: () => d.p })
    const pixel = s.request('pixel')
    await s.request('classic')
    d.res()
    await pixel
    expect(s.getSnapshot()).toMatchObject({ requested: 'classic', active: 'classic', status: 'idle' })
  })

  it('re-selecting pixel after a successful load swaps immediately without reloading', async () => {
    const loadImage = vi.fn(() => Promise.resolve())
    const s = createAppearanceStore({ storage: memStorage(), loadImage })
    await s.request('pixel')
    await s.request('classic')
    await s.request('pixel')
    expect(loadImage).toHaveBeenCalledTimes(8)
    expect(s.getSnapshot().active).toBe('pixel')
  })

  it('init honours a stored pixel preference, still Classic until loaded', async () => {
    const d = deferred()
    const s = createAppearanceStore({ storage: memStorage({ [APPEARANCE_STORAGE_KEY]: 'pixel' }), loadImage: () => d.p })
    const p = s.init()
    expect(s.getSnapshot()).toMatchObject({ requested: 'pixel', active: 'classic', status: 'loading' })
    d.res(); await p
    expect(s.getSnapshot().active).toBe('pixel')
  })

  it('urls are same-origin relative paths under the pack folder', () => {
    expect(pixelAssetUrl('dev')).toMatch(/\/assets\/characters\/pixel-v1\/dev\.png$/)
    expect(pixelAssetUrl('dev')).not.toMatch(/^https?:/)
  })
})
