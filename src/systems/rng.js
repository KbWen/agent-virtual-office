/**
 * Seeded RNG seam (S1 — AC-S1a / AC-C1 / AC-C1b).
 *
 * Default: pass-through to Math.random so behaviour is unchanged when no seed is set.
 * Test seam: __setRng(fn) swaps the implementation; resetRng() restores Math.random.
 *
 * Consumer pattern:
 *   import { rng } from './rng.js'
 *   const v = rng()   // replaces Math.random()
 *
 * NOT a class, NOT persisted, no module-level accumulator beyond the current fn pointer.
 * mulberry32 recipe (fast, well-distributed, zero-dependency):
 *   import { makeMulberry32 } from './rng.js'
 *   const fn = makeMulberry32(seed)
 *   __setRng(fn)
 */

let _rng = Math.random

/** Drop-in replacement for Math.random() — routes through the active seam. */
export function rng() {
  return _rng()
}

/**
 * Swap the RNG implementation.
 * Call with a seeded PRNG (e.g. makeMulberry32(seed)) in tests; call resetRng() in afterAll/afterEach.
 * @param {() => number} fn
 */
export function __setRng(fn) {
  if (typeof fn !== 'function') throw new TypeError('rng must be a function')
  _rng = fn
}

/** Restore Math.random (test teardown). */
export function resetRng() {
  _rng = Math.random
}

/**
 * Factory: mulberry32 PRNG — fast, deterministic, uniform [0, 1).
 * Canonical recipe; behavior is well-tested in the JS ecosystem.
 * @param {number} seed  uint32 seed (will be coerced to >>> 0)
 * @returns {() => number}
 */
export function makeMulberry32(seed) {
  let a = seed >>> 0
  return function mulberry32() {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
