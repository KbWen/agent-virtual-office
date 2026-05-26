import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatTimeAgo } from '../src/utils/formatTime.js'

// Locale keys time.now / time.secondsAgo / etc. are NOT in en.json → t() uses its
// fallback arguments: 'now', '{0}s ago', '{0}m ago', '{0}h ago'.
describe('formatTimeAgo', () => {
  const BASE = new Date('2026-04-08T12:00:00Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── Invalid / missing timestamps ───────────────────────────────────
  it('null → "now" (descriptive)', () => {
    expect(formatTimeAgo(null)).toBe('now')
  })
  it('null + compact → "0s"', () => {
    expect(formatTimeAgo(null, { compact: true })).toBe('0s')
  })
  it('undefined → "now"', () => {
    expect(formatTimeAgo(undefined)).toBe('now')
  })
  it('0 (falsy) → "now"', () => {
    expect(formatTimeAgo(0)).toBe('now')
  })
  it('NaN → "now"', () => {
    expect(formatTimeAgo(NaN)).toBe('now')
  })
  it('Infinity → "now"', () => {
    expect(formatTimeAgo(Infinity)).toBe('now')
  })

  // ─── Future timestamps (diff < 0) ────────────────────────────────────
  it('future timestamp → "now"', () => {
    expect(formatTimeAgo(BASE + 1000)).toBe('now')
  })
  it('future timestamp + compact → "0s"', () => {
    expect(formatTimeAgo(BASE + 1000, { compact: true })).toBe('0s')
  })

  // ─── Descriptive "now" zone: diff < 5 ────────────────────────────────
  it('diff=0 (exact now) → "now"', () => {
    expect(formatTimeAgo(BASE)).toBe('now')
  })
  it('diff=1 → "now"', () => {
    expect(formatTimeAgo(BASE - 1000)).toBe('now')
  })
  it('diff=4 → "now" (still within the <5s window)', () => {
    expect(formatTimeAgo(BASE - 4000)).toBe('now')
  })
  it('diff=4 + compact → "4s" (compact shows seconds even for diff<5)', () => {
    // The <!compact && diff < 5> early-return does NOT apply when compact=true
    expect(formatTimeAgo(BASE - 4000, { compact: true })).toBe('4s')
  })
  it('diff=0 + compact → "0s"', () => {
    expect(formatTimeAgo(BASE, { compact: true })).toBe('0s')
  })

  // ─── Seconds range: diff 5–59 ─────────────────────────────────────────
  it('diff=5 → "5s ago" (boundary: first second NOT shown as "now")', () => {
    expect(formatTimeAgo(BASE - 5000)).toBe('5s ago')
  })
  it('diff=5 + compact → "5s"', () => {
    expect(formatTimeAgo(BASE - 5000, { compact: true })).toBe('5s')
  })
  it('diff=30 → "30s ago"', () => {
    expect(formatTimeAgo(BASE - 30000)).toBe('30s ago')
  })
  it('diff=59 → "59s ago" (last second before minute boundary)', () => {
    expect(formatTimeAgo(BASE - 59000)).toBe('59s ago')
  })
  it('diff=59 + compact → "59s"', () => {
    expect(formatTimeAgo(BASE - 59000, { compact: true })).toBe('59s')
  })

  // ─── Minutes range: diff 60–3599 ─────────────────────────────────────
  it('diff=60 → "1m ago" (first minute)', () => {
    expect(formatTimeAgo(BASE - 60000)).toBe('1m ago')
  })
  it('diff=60 + compact → "1m"', () => {
    expect(formatTimeAgo(BASE - 60000, { compact: true })).toBe('1m')
  })
  it('diff=90 → "1m ago" (floor division)', () => {
    expect(formatTimeAgo(BASE - 90000)).toBe('1m ago')
  })
  it('diff=3599 → "59m ago" (last second before hour boundary)', () => {
    expect(formatTimeAgo(BASE - 3599000)).toBe('59m ago')
  })
  it('diff=3599 + compact → "59m"', () => {
    expect(formatTimeAgo(BASE - 3599000, { compact: true })).toBe('59m')
  })

  // ─── Hours range: diff ≥ 3600 ─────────────────────────────────────────
  it('diff=3600 → "1h ago" (first hour)', () => {
    expect(formatTimeAgo(BASE - 3600000)).toBe('1h ago')
  })
  it('diff=3600 + compact → "1h"', () => {
    expect(formatTimeAgo(BASE - 3600000, { compact: true })).toBe('1h')
  })
  it('diff=7200 → "2h ago"', () => {
    expect(formatTimeAgo(BASE - 7200000)).toBe('2h ago')
  })
  it('diff=86400 → "24h ago"', () => {
    expect(formatTimeAgo(BASE - 86400000)).toBe('24h ago')
  })
})
