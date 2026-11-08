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
// views.back = owner-requested import (2026-11-08) of the 2026-11-07 idle-up candidates, used ONLY for
// the seated-at-desk pose (everything below the waist is clipped behind the chair).
// Dev's canvas is off-centre (twin tails) and her soles end one row higher.
export const PIXEL_V1_PACK = Object.freeze({
  version: 'pixel-v1',
  sourceSize: SOURCE_SIZE,
  roles: Object.freeze({
    pm:       { file: 'pm.png',       pivot: { x: 32, y: 56 }, sha256: '64b3b93551b2c6064877fe29f51de984301860c807a99e95372150bfa303d245',
      views: { back: { file: 'pm-back.png', pivot: { x: 31.5, y: 57 }, sha256: '04c603a98548d606be3991c20148c47a2df96ffad2a25ce12fc5711bbd77763d' } } },
    arch:     { file: 'arch.png',     pivot: { x: 32, y: 56 }, sha256: '4dbbc0792212b9a9e7921a965c6a9b38c4a429d350e3ac566be20c9c14c7442a',
      views: { back: { file: 'arch-back.png', pivot: { x: 31, y: 56 }, sha256: '5cf00fcf0ddeba3d7c7dd055abb204e17367371f4c916472cd656c3912053501' } } },
    dev:      { file: 'dev.png',      pivot: { x: 36, y: 55 }, sha256: 'da81bee1bd1cb480783c878236458f6ded0d8ce88b9b8f81041c9c2cf1d4bd31',
      views: { back: { file: 'dev-back.png', pivot: { x: 36, y: 57 }, sha256: 'e2a4052ece046595ae677a06657aacb9a97710cb0de947d5b73724083ee72079' } } },
    qa:       { file: 'qa.png',       pivot: { x: 32, y: 56 }, sha256: 'd5f64afbf0a3778e1fe99fd5114fd409bcc60447e0de5f59a995a454f4f854ed',
      views: { back: { file: 'qa-back.png', pivot: { x: 32, y: 56 }, sha256: 'ff4c6de508b008565ee7a1e01a7ddaca4b6387ff481af95569119cae715f6e95' } } },
    ops:      { file: 'ops.png',      pivot: { x: 32, y: 56 }, sha256: '4916b663dad415068dfeba8b1ec07b634883b081e37693ce09c1cc7fd17f8db0',
      views: { back: { file: 'ops-back.png', pivot: { x: 32, y: 56 }, sha256: '2952b81ce35d8112004e5d2b90baa25b49698a831203bb366d9c3bfea8669ed5' } } },
    res:      { file: 'res.png',      pivot: { x: 32, y: 56 }, sha256: 'd638fee5040d840b32097e97e647052cb397e9ea0def93b1b861dca77e68a6f7',
      views: { back: { file: 'res-back.png', pivot: { x: 32, y: 57 }, sha256: '17150b272363f8ac4b13c8edd87a52628b227f9fd4d055fe6aa69eef646c0c61' } } },
    gate:     { file: 'gate.png',     pivot: { x: 32, y: 56 }, sha256: '8692bcceee24a97423808a49c1a0bb5f6b31383ce87d9555b2b97b8889832dd8',
      views: { back: { file: 'gate-back.png', pivot: { x: 31.5, y: 56 }, sha256: '339999b385020d8cab781edcaa6657d4a6079186277a45ad322093af2e543180' } } },
    designer: { file: 'designer.png', pivot: { x: 32.5, y: 56 }, sha256: '61a665352ce563ba3a8a6de6cd6db5b6adc71be1873b93f0648059f200ed679c',
      views: { back: { file: 'designer-back.png', pivot: { x: 32, y: 57 }, sha256: '96728530404986b37b9f3707385644770de9dfb0ef9818564f3b7babf2107784' } } },
  }),
  // Lightweight-mode roles reuse the identity the classic palette already maps them to.
  aliases: Object.freeze({ planner: 'pm', worker: 'dev', checker: 'qa' }),
  // Mirrors classic's `CHAR_STYLES[...] || CHAR_STYLES.pm` fallback.
  fallbackRole: 'pm',
})

// Optional reviewed views per role (Phase 2+). A role without `views.back` keeps its front
// master everywhere (honest fallback); no unreviewed file is ever listed here.
function viewEntry(role, view, pack) {
  const r = pack.roles[role]
  return (view !== 'front' && r.views?.[view]) || r
}

export function pixelHasBackView(role, pack = PIXEL_V1_PACK) {
  return !!pack.roles[role]?.views?.back
}

// Every file the pack can render (front masters + reviewed views): all are preloaded before the
// atomic swap so no pose pops in late.
export function requiredPixelUrls(pack = PIXEL_V1_PACK, base = BASE_URL) {
  const urls = []
  for (const [role, r] of Object.entries(pack.roles)) {
    urls.push(pixelAssetUrl(role, pack, base))
    for (const view of Object.keys(r.views || {})) urls.push(pixelAssetUrl(role, pack, base, view))
  }
  return urls
}

export function pixelAssetUrl(role, pack = PIXEL_V1_PACK, base = BASE_URL, view = 'front') {
  return `${base}${viewEntry(role, view, pack).file}`
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
export function pixelBodyPlacement(role, pack = PIXEL_V1_PACK, scale = PIXEL_DISPLAY_SCALE, view = 'front') {
  const { pivot } = viewEntry(role, view, pack)
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
  // Decoded images stay referenced for the page lifetime so the browser keeps them in its image
  // cache and the swapped-in <image> elements do not have to refetch/revalidate (no blank flash).
  let retainedImages = []
  const listeners = new Set()
  const emit = (patch) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  }
  const persist = (value) => {
    try { storage?.setItem(APPEARANCE_STORAGE_KEY, value) } catch { /* session-only */ }
  }

  function preloadPixel(myToken) {
    return Promise.all(requiredPixelUrls(pack).map((url) => loadImage(url)))
      .then((images) => {
        if (myToken !== token) return
        retainedImages = images
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
    retainedCount: () => retainedImages.length,
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
