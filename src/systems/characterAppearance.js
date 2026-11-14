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
// views = owner-requested imports (2026-11-08/09): back (seated at desk) + one signature action per
// role. Runtime files are DERIVED from Gemini candidates by scripts/pixel_alpha_cleanup.py (outer
// light/grey background residue -> transparent, identity colours of the master kept); sources and
// hashes are recorded in public/assets/characters/pixel-v1/PROVENANCE.md.
// Dev's canvas is off-centre (twin tails) and her soles end one row higher.
export const PIXEL_V1_PACK = Object.freeze({
  version: 'pixel-v1',
  sourceSize: SOURCE_SIZE,
  roles: Object.freeze({
    pm:       { file: 'pm.png',       pivot: { x: 32, y: 56 }, sha256: '64b3b93551b2c6064877fe29f51de984301860c807a99e95372150bfa303d245',
      views: {
        'back': { file: 'pm-back.png', pivot: { x: 31.5, y: 57 }, sha256: 'bfb2fa0fc9d50a2a1e85c7d2e55dc77a55dbaa63517f963e4d38792bdc6a628b' },
        'typing': { file: 'pm-typing.png', pivot: { x: 31.5, y: 56 }, sha256: '2f4bbe71576687343849748c8b0e1fd23f35aaf85b35e2ec23d9c186db21faa1' },
      } },
    arch:     { file: 'arch.png',     pivot: { x: 32, y: 56 }, sha256: '4dbbc0792212b9a9e7921a965c6a9b38c4a429d350e3ac566be20c9c14c7442a',
      views: {
        'back': { file: 'arch-back.png', pivot: { x: 31, y: 56 }, sha256: '339522ca5bd498b4cf88273344b53d07442e497c6f10ed7de953759163fbd817' },
        'pointing-board': { file: 'arch-pointing-board.png', pivot: { x: 31.5, y: 56 }, sha256: '055e340d98d5aa94e8f2e37610451b130446288a03eb80711575badb2363b793' },
      } },
    dev:      { file: 'dev.png',      pivot: { x: 36, y: 55 }, sha256: 'da81bee1bd1cb480783c878236458f6ded0d8ce88b9b8f81041c9c2cf1d4bd31',
      views: {
        'back': { file: 'dev-back.png', pivot: { x: 36, y: 57 }, sha256: '1e7564273729f2b1c7791741621d82274de681986a6eb64f4423ee65691b316b' },
        'drinking-coffee': { file: 'dev-drinking-coffee.png', pivot: { x: 36, y: 57 }, sha256: 'bbdd786f7f5941e7822ce31a5b816226d2d8a285b33af8e81a3131445cfa9424' },
      } },
    qa:       { file: 'qa.png',       pivot: { x: 32, y: 56 }, sha256: 'd5f64afbf0a3778e1fe99fd5114fd409bcc60447e0de5f59a995a454f4f854ed',
      views: {
        'back': { file: 'qa-back.png', pivot: { x: 32, y: 57 }, sha256: 'b59c17b8fe55ae074a63969fce667fb675280fda9aaa8132566646656446439e' },
        'reading-magnifier': { file: 'qa-reading-magnifier.png', pivot: { x: 31.5, y: 57 }, sha256: '2bfcf0164c8a0a3197d7abfce1d32c04cd3935dc6cc63cb67c29398941ac629d' },
      } },
    ops:      { file: 'ops.png',      pivot: { x: 32, y: 56 }, sha256: '4916b663dad415068dfeba8b1ec07b634883b081e37693ce09c1cc7fd17f8db0',
      views: {
        'back': { file: 'ops-back.png', pivot: { x: 32, y: 56 }, sha256: '39a0de129bea2063ede86c6bf23736c654be055ba6624037409d09e8f2eaf615' },
        'control-deploy': { file: 'ops-control-deploy.png', pivot: { x: 32, y: 56 }, sha256: 'e4d620b6c6a48512ac07a00646aad8c894e4db5a6ebf4ea25ef3d1a6a143ef03' },
      } },
    res:      { file: 'res.png',      pivot: { x: 32, y: 56 }, sha256: 'd638fee5040d840b32097e97e647052cb397e9ea0def93b1b861dca77e68a6f7',
      views: {
        'back': { file: 'res-back.png', pivot: { x: 32, y: 57 }, sha256: 'bf5a7f160eb16ed06c495084248ac69c177be5c721cfb53047208529ce2b1e99' },
        'reading-book': { file: 'res-reading-book.png', pivot: { x: 32, y: 57 }, sha256: '2bfc9da351fd6268fb77d380388bb1ba4b6bc3309e290b20b1fce473d5e1daf9' },
        // AVO-207 walk cycle (right-facing; mirrored for left). Derived by scripts/pixel_walk_derive.py.
        // pivot y = measured sole row 56 + 1; x = measured torso centre (31.2-31.4 in every frame).
        'walk-side-0': { file: 'res-walk-side-0.png', pivot: { x: 31.5, y: 57 }, sha256: '729eaff66c18a22cba5ccfccfb15c86ea910f81277338053a349ea4525b8b2c1' },
        'walk-side-1': { file: 'res-walk-side-1.png', pivot: { x: 31.5, y: 57 }, sha256: '5ee2b66e35d69f646a2abd46e20da843f32e2a1c00237dc4dd9344b042fd673e' },
        'walk-side-2': { file: 'res-walk-side-2.png', pivot: { x: 31.5, y: 57 }, sha256: '354f169c51d47fd23c5b694f37281b7e5e543c10bd8a69fa4dc294cd0f4db4b7' },
        'walk-side-3': { file: 'res-walk-side-3.png', pivot: { x: 31.5, y: 57 }, sha256: '20163e5200334848731a3b8381bbc225352602d53ec064c457c0212157b31924' },
      } },
    gate:     { file: 'gate.png',     pivot: { x: 32, y: 56 }, sha256: '8692bcceee24a97423808a49c1a0bb5f6b31383ce87d9555b2b97b8889832dd8',
      views: {
        'back': { file: 'gate-back.png', pivot: { x: 31.5, y: 57 }, sha256: 'a362fcb49be4987c28398b24e1f6f2ae8a127e532741775299857f1cd0a5c0f4' },
        'control-shield': { file: 'gate-control-shield.png', pivot: { x: 32, y: 57 }, sha256: 'c5ed74774526bb43815ec3e1bda0dd861275d8510af2a4532add9d1387bec256' },
      } },
    designer: { file: 'designer.png', pivot: { x: 32.5, y: 56 }, sha256: '61a665352ce563ba3a8a6de6cd6db5b6adc71be1873b93f0648059f200ed679c',
      views: {
        'back': { file: 'designer-back.png', pivot: { x: 32, y: 57 }, sha256: '0c172c3685b79d4eeca586aae99919309c7a41334cc108249abb4ec408a900d4' },
        'writing-notes': { file: 'designer-writing-notes.png', pivot: { x: 32.5, y: 57 }, sha256: 'da236a7db6fb46bc8136e596009aa0be8d95e199b6147cd2c57b361d3a5e47dd' },
      } },
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

// AVO-207 walk cycle: four right-facing side frames, used only when ALL four are reviewed and
// listed (a partial set never shows). Returns the view for walk step `step` (0..3 cycles), or null.
export const WALK_CYCLE_FRAMES = 4
export function pixelWalkView(role, step, pack = PIXEL_V1_PACK) {
  const views = pack.roles[role]?.views
  if (!views) return null
  for (let i = 0; i < WALK_CYCLE_FRAMES; i++) if (!views[`walk-side-${i}`]) return null
  const n = Number.isFinite(step) ? Math.trunc(step) : 0
  return `walk-side-${((n % WALK_CYCLE_FRAMES) + WALK_CYCLE_FRAMES) % WALK_CYCLE_FRAMES}`
}

// Behavior -> signature action pose. A role shows a pose only for ITS OWN signature behavior and
// only when that reviewed view exists; otherwise the front master (honest fallback).
// Honesty (owner delegated the call 2026-11-09): a pose that CLAIMS work (typing, board, magnifier,
// deploy, shield, notes) needs a live working status - an idle agent's work-ish fidget behavior
// stays the plain front master. Break/reading poses (coffee, book) claim nothing and show anytime.
export const BEHAVIOR_POSES = Object.freeze({
  typing: 'typing',
  whiteboard: 'pointing-board',
  'drink-coffee': 'drinking-coffee',
  magnifier: 'reading-magnifier',
  'deploy-button': 'control-deploy',
  research: 'reading-book',
  'writing-notes': 'writing-notes',
  'shield-verify': 'control-shield',
})

export const NON_CLAIM_POSES = Object.freeze(new Set(['drinking-coffee', 'reading-book']))

export function pixelActionView(role, behavior, { working = true } = {}, pack = PIXEL_V1_PACK) {
  const view = BEHAVIOR_POSES[behavior]
  if (!view || !pack.roles[role]?.views?.[view]) return null
  return working || NON_CLAIM_POSES.has(view) ? view : null
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
