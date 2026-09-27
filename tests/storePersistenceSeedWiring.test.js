/**
 * R6b (review round 2, LOW) — `loadPersistedState` seeds `_lastSavedAtWriteAt` from the loaded
 * blob's own `_savedAt` (store.js ~227) so the SAVEDAT_REFRESH_MS throttle counts from "when the
 * blob was last saved" across a reload, not from the module's initial 0. If that seed line is
 * dropped, the very next unchanged-content autosave after a reload writes again immediately
 * (worst case: one extra localStorage write) instead of respecting the 30-minute floor.
 *
 * This needs the ACTUAL DOM-dependent `loadPersistedState`/`savePersistedState` wiring, not just
 * the pure `resolvePersisted`/`shouldWritePersistedSnapshot` helpers (those are covered in
 * storePersistence.test.js) — so it uses `vi.resetModules()` + a dynamic `import()` per pass to
 * force store.js to re-run its module-level `const _persisted = loadPersistedState()` against a
 * freshly-seeded localStorage, isolated to this file's own module registry.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'

const hadWindow = 'window' in globalThis
const hadDocument = 'document' in globalThis
const hadNavigator = 'navigator' in globalThis
const hadLocalStorage = 'localStorage' in globalThis

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  if (!hadWindow) delete globalThis.window
  if (!hadDocument) delete globalThis.document
  if (!hadNavigator) delete globalThis.navigator
  if (!hadLocalStorage) delete globalThis.localStorage
})

function installWindowStubs() {
  // Minimal stub for platformDetect.js's detectProjectMode/detectPlatform, exercised as a side
  // effect of importing store.js once `window` is truthy. `parent === window` skips the iframe
  // branch; document.querySelector/getElementById return null (no data-mode / data-antigravity).
  const win = {
    location: { href: '', search: '' },
    __claude_artifact__: undefined, __antigravity__: undefined, __codex__: undefined,
    addEventListener() {}, removeEventListener() {},
  }
  win.parent = win
  globalThis.window = win
  globalThis.document = { querySelector: () => null, getElementById: () => null }
  // `navigator` is a read-only built-in global in this Node version — vi.stubGlobal handles the
  // property-descriptor override that a plain assignment can't.
  vi.stubGlobal('navigator', { userAgent: '' })
}

describe('persistence _lastSavedAtWriteAt seed on load (R6b)', () => {
  it('seeds the savedAt-refresh throttle from the loaded blob, so an immediately-following unchanged autosave does not write again', async () => {
    const mem = {}
    let setItemCalls = 0
    installWindowStubs()
    globalThis.localStorage = {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { setItemCalls++; mem[k] = String(v) },
      removeItem: (k) => { delete mem[k] },
    }

    // Pass 1: a fresh module instance with NO persisted blob yet, purely to capture the exact
    // shape `createPersistedState` produces for this store's default state — avoids hand-crafting
    // a fixture that could drift from the real roster/ledger shape.
    vi.resetModules()
    const mod1 = await import('../src/systems/store.js')
    const snapshot = mod1.createPersistedState(mod1.useOfficeStore.getState())
    mem['office-state'] = JSON.stringify(snapshot)   // seed localStorage for pass 2

    // Pass 2: a fresh module instance that now loads the seeded (fresh, non-stale) blob above —
    // this is the load this test is actually about.
    vi.resetModules()
    setItemCalls = 0
    const mod2 = await import('../src/systems/store.js')

    vi.useFakeTimers()
    // Trigger the debounced auto-persist subscription with a no-op touch. createPersistedState
    // on this SAME unchanged state reproduces byte-identical content to what was just seeded, so
    // only the `_lastSavedAtWriteAt` throttle (not the content-key dedup) decides whether this
    // particular autosave writes.
    mod2.useOfficeStore.setState({ mood: mod2.useOfficeStore.getState().mood })
    await vi.advanceTimersByTimeAsync(2100)   // the 2s auto-persist debounce

    // Before the R6b seed: `_lastSavedAtWriteAt` stays at the module's initial 0, so
    // `Date.now() - 0 >= SAVEDAT_REFRESH_MS` is (almost always, in real wall-clock terms) true —
    // this "unchanged" autosave would write again immediately even though content is identical
    // and no real time has passed since pass 1's snapshot. After the seed: `_lastSavedAtWriteAt`
    // is the just-loaded blob's own `_savedAt` (moments ago), comfortably under the 30-minute
    // refresh window, so no write should happen.
    expect(setItemCalls).toBe(0)
  })
})
