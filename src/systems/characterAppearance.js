// Character appearance (Classic procedural body vs Pixel raster pack).
// Spec: docs/specs/phased-pixel-character-refresh.md — ONE world, TWO appearances.
// Appearance is presentation only: nothing here touches the office store, positions,
// routes, door claims or statuses. The Pixel pack swaps atomically: every required image
// must load + decode at the expected size before `active` changes.

export const APPEARANCE_STORAGE_KEY = 'avo.office-appearance'
export const APPEARANCES = ['classic', 'pixel']

// Logical grid of every pixel-v1 master (512px source, uniform 8×8 blocks).
export const PIXEL_LOGICAL_SIZE = 64
// Local units per logical pixel. 7/8 makes the tallest master (hair/hat ≈ 44 logical) ≈ 38.5 units,
// inside the classic body's 40-unit envelope, so every shared overlay (name tag, task label, rings,
// bubbles) keeps its classic clearance. Measured at R1: 1.0 let name pills cover hair/beret.
export const PIXEL_DISPLAY_SCALE = 7 / 8
const SOURCE_SIZE = 512
const BASE_URL = `${(typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'}assets/characters/pixel-v1/`

// pivot = measured sole contact in logical px (see public/assets/characters/pixel-v1/PROVENANCE.md).
// Dev's canvas is off-centre (twin tails) and her soles end one row higher.
export const PIXEL_V1_PACK = Object.freeze({
  version: 'pixel-v1',
  sourceSize: SOURCE_SIZE,
  roles: Object.freeze({
    pm:       { file: 'pm.png',       pivot: { x: 32, y: 56 }, sha256: '64b3b93551b2c6064877fe29f51de984301860c807a99e95372150bfa303d245' },
    arch:     { file: 'arch.png',     pivot: { x: 32, y: 56 }, sha256: '4dbbc0792212b9a9e7921a965c6a9b38c4a429d350e3ac566be20c9c14c7442a' },
    dev:      { file: 'dev.png',      pivot: { x: 36, y: 55 }, sha256: 'da81bee1bd1cb480783c878236458f6ded0d8ce88b9b8f81041c9c2cf1d4bd31' },
    qa:       { file: 'qa.png',       pivot: { x: 32, y: 56 }, sha256: 'd5f64afbf0a3778e1fe99fd5114fd409bcc60447e0de5f59a995a454f4f854ed' },
    ops:      { file: 'ops.png',      pivot: { x: 32, y: 56 }, sha256: '4916b663dad415068dfeba8b1ec07b634883b081e37693ce09c1cc7fd17f8db0' },
    res:      { file: 'res.png',      pivot: { x: 32, y: 56 }, sha256: 'd638fee5040d840b32097e97e647052cb397e9ea0def93b1b861dca77e68a6f7' },
    gate:     { file: 'gate.png',     pivot: { x: 32, y: 56 }, sha256: '8692bcceee24a97423808a49c1a0bb5f6b31383ce87d9555b2b97b8889832dd8' },
    designer: { file: 'designer.png', pivot: { x: 32.5, y: 56 }, sha256: '61a665352ce563ba3a8a6de6cd6db5b6adc71be1873b93f0648059f200ed679c' },
  }),
  // Lightweight-mode roles reuse the identity the classic palette already maps them to.
  aliases: Object.freeze({ planner: 'pm', worker: 'dev', checker: 'qa' }),
  // Mirrors classic's `CHAR_STYLES[...] || CHAR_STYLES.pm` fallback.
  fallbackRole: 'pm',
})

export function pixelAssetUrl(role, pack = PIXEL_V1_PACK, base = BASE_URL) {
  return `${base}${pack.roles[role].file}`
}

// "feat-x~dev" → "dev"; aliases resolved; unknown → fallbackRole (explicit, tested).
export function resolvePixelRole(charId, pack = PIXEL_V1_PACK) {
  const raw = typeof charId === 'string' ? charId : ''
  const base = raw.includes('~') ? raw.split('~').pop() : raw
  if (Object.prototype.hasOwnProperty.call(pack.roles, base)) return base
  const alias = pack.aliases[base]
  if (alias && pack.roles[alias]) return alias
  return pack.fallbackRole
}

// Image placement INSIDE the fixed actor group (local units). Puts the measured sole contact on
// local (0,0) = the unchanged world foot anchor; uniform scale only (no per-image normalisation).
export function pixelBodyPlacement(role, pack = PIXEL_V1_PACK, scale = PIXEL_DISPLAY_SCALE) {
  const { pivot } = pack.roles[role]
  const size = PIXEL_LOGICAL_SIZE * scale
  return { x: -pivot.x * scale, y: -pivot.y * scale, width: size, height: size }
}

export function normalizeAppearance(value) {
  return APPEARANCES.includes(value) ? value : 'classic'
}

// Browser preload: resolve only after load + decode at the declared source size.
export function loadImageInBrowser(url, expectedSize = SOURCE_SIZE) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') { reject(new Error('Image unavailable')); return }
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      const done = () => {
        if (img.naturalWidth !== expectedSize || img.naturalHeight !== expectedSize) {
          reject(new Error(`unexpected size ${img.naturalWidth}x${img.naturalHeight} for ${url}`))
        } else resolve(img)
      }
      if (typeof img.decode === 'function') img.decode().then(done, () => reject(new Error(`decode failed: ${url}`)))
      else done()
    }
    img.onerror = () => reject(new Error(`load failed: ${url}`))
    img.src = url
  })
}

// Small external store (useSyncExternalStore-compatible). Injected storage + loader keep it
// unit-testable without a DOM.
export function createAppearanceStore({ storage, loadImage = loadImageInBrowser, pack = PIXEL_V1_PACK, warn = console.warn } = {}) {
  let requested = 'classic'
  try { requested = normalizeAppearance(storage?.getItem(APPEARANCE_STORAGE_KEY)) } catch { /* session-only */ }
  let state = { requested, active: 'classic', status: 'idle', error: null }
  let token = 0
  let pixelReady = false
  const listeners = new Set()
  const emit = (patch) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  }
  const persist = (value) => {
    try { storage?.setItem(APPEARANCE_STORAGE_KEY, value) } catch { /* session-only */ }
  }

  function preloadPixel(myToken) {
    const roles = Object.keys(pack.roles)
    return Promise.all(roles.map((role) => loadImage(pixelAssetUrl(role, pack))))
      .then(() => {
        if (myToken !== token) return
        pixelReady = true
        emit({ active: 'pixel', status: 'ready', error: null })
      }, (err) => {
        if (myToken !== token) return
        warn('[Office] Pixel appearance unavailable; keeping current appearance.', err?.message || err)
        emit({ status: 'error', error: String(err?.message || err) })
      })
  }

  function request(value) {
    const next = normalizeAppearance(value)
    token += 1
    persist(next)
    if (next === 'classic') {
      emit({ requested: 'classic', active: 'classic', status: 'idle', error: null })
      return Promise.resolve()
    }
    if (pixelReady) {
      emit({ requested: 'pixel', active: 'pixel', status: 'ready', error: null })
      return Promise.resolve()
    }
    emit({ requested: 'pixel', status: 'loading', error: null })
    return preloadPixel(token)
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    request,
    // Startup: honour a stored Pixel preference, still atomically (Classic until ready).
    init() {
      if (state.requested === 'pixel' && state.active !== 'pixel' && state.status !== 'loading') return request('pixel')
      return Promise.resolve()
    },
  }
}

let defaultStorage
try { defaultStorage = typeof window === 'undefined' ? undefined : window.localStorage } catch { defaultStorage = undefined }
const appearanceStore = createAppearanceStore({ storage: defaultStorage })
export const getAppearanceSnapshot = appearanceStore.getSnapshot
export const subscribeAppearance = appearanceStore.subscribe
export const requestAppearance = appearanceStore.request
export const initAppearance = appearanceStore.init
