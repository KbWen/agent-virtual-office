import { describe, it, expect } from 'vitest'
import { shouldShowWatchdogDiag } from '../src/components/ControlPanel.jsx'

// #28 — the RAF-watchdog restart counter (store.watchdogRestarts) is surfaced as a DEV-only
// diagnostic chip, shown only once a stall has actually happened (count > 0). Pure gate so it's
// unit-testable without a DOM. `isDev` is passed explicitly here to decouple from the test runner's
// import.meta.env.DEV.
describe('shouldShowWatchdogDiag (#28)', () => {
  it('shows in DEV once a stall has been recorded (count > 0)', () => {
    expect(shouldShowWatchdogDiag(1, true)).toBe(true)
    expect(shouldShowWatchdogDiag(7, true)).toBe(true)
  })

  it('stays hidden in DEV while the count is still 0 (unobtrusive at rest)', () => {
    expect(shouldShowWatchdogDiag(0, true)).toBe(false)
  })

  it('is never shown in production, even with a non-zero count (zero prod cost)', () => {
    expect(shouldShowWatchdogDiag(5, false)).toBe(false)
    expect(shouldShowWatchdogDiag(0, false)).toBe(false)
  })

  it('guards against non-numeric / negative counts', () => {
    expect(shouldShowWatchdogDiag(undefined, true)).toBe(false)
    expect(shouldShowWatchdogDiag(null, true)).toBe(false)
    expect(shouldShowWatchdogDiag(-1, true)).toBe(false)
    expect(shouldShowWatchdogDiag(NaN, true)).toBe(false)
  })
})
