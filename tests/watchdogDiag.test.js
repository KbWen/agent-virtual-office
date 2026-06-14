import { describe, it, expect } from 'vitest'
import { shouldShowWatchdogDiag, isRafDebugEnabled } from '../src/components/controlPanelLabels.js'

// #28 — the RAF-watchdog restart counter (store.watchdogRestarts) is surfaced as an OPT-IN DEV
// diagnostic chip: shown only in dev, only once a stall has happened (count > 0), AND only when the
// debug flag is opted in. Off by default for everyone so it never becomes visual noise. Pure gate so
// it's unit-testable without a DOM — `isDev` and `debugEnabled` are passed explicitly to decouple
// from the test runner's import.meta.env.DEV and from window.
describe('shouldShowWatchdogDiag (#28)', () => {
  it('shows in DEV once a stall has been recorded (count > 0) AND debug is opted in', () => {
    expect(shouldShowWatchdogDiag(1, true, true)).toBe(true)
    expect(shouldShowWatchdogDiag(7, true, true)).toBe(true)
  })

  it('stays hidden by default in DEV even with a non-zero count (debug not opted in)', () => {
    expect(shouldShowWatchdogDiag(5, true, false)).toBe(false)
    expect(shouldShowWatchdogDiag(1, true, false)).toBe(false)
  })

  it('stays hidden in DEV while the count is still 0 (unobtrusive at rest)', () => {
    expect(shouldShowWatchdogDiag(0, true, true)).toBe(false)
  })

  it('is never shown in production, even opted-in with a non-zero count (zero prod cost)', () => {
    expect(shouldShowWatchdogDiag(5, false, true)).toBe(false)
    expect(shouldShowWatchdogDiag(0, false, true)).toBe(false)
  })

  it('guards against non-numeric / negative counts', () => {
    expect(shouldShowWatchdogDiag(undefined, true, true)).toBe(false)
    expect(shouldShowWatchdogDiag(null, true, true)).toBe(false)
    expect(shouldShowWatchdogDiag(-1, true, true)).toBe(false)
    expect(shouldShowWatchdogDiag(NaN, true, true)).toBe(false)
  })
})

// #28 — the opt-in gate itself: `?debug=raf` in the URL OR localStorage `avo.debug.raf=on`. Safe in
// SSR/test (no window → false) and resilient to a throwing localStorage.
describe('isRafDebugEnabled (#28 opt-in)', () => {
  const mkWin = ({ search = '', stored = null, throws = false } = {}) => ({
    location: { search },
    localStorage: { getItem: () => { if (throws) throw new Error('blocked'); return stored } },
  })

  it('is off when no window is present (SSR / test default)', () => {
    expect(isRafDebugEnabled(undefined)).toBe(false)
  })

  it('is off by default with a bare window', () => {
    expect(isRafDebugEnabled(mkWin())).toBe(false)
  })

  it('opts in via the ?debug=raf URL param', () => {
    expect(isRafDebugEnabled(mkWin({ search: '?debug=raf' }))).toBe(true)
    expect(isRafDebugEnabled(mkWin({ search: '?foo=1&debug=raf&bar=2' }))).toBe(true)
  })

  it('does not opt in for an unrelated debug value', () => {
    expect(isRafDebugEnabled(mkWin({ search: '?debug=other' }))).toBe(false)
  })

  it('opts in via localStorage avo.debug.raf=on', () => {
    expect(isRafDebugEnabled(mkWin({ stored: 'on' }))).toBe(true)
    expect(isRafDebugEnabled(mkWin({ stored: 'off' }))).toBe(false)
  })

  it('never throws when localStorage access is blocked', () => {
    expect(isRafDebugEnabled(mkWin({ throws: true }))).toBe(false)
    expect(isRafDebugEnabled(mkWin({ search: '?debug=raf', throws: true }))).toBe(true)
  })
})
