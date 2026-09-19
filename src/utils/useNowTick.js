// A local clock tick for components that render relative times ("3m", "waiting · 3m", "1m ago").
//
// 2026-09-19 review, REV-08: those labels are computed at render, and their components re-render only
// when the store changes — so when nothing changes (every agent waiting on the human is exactly that
// case) the labels froze. A component that shows relative time owns this tick instead of relying on
// unrelated store churn. The tick is LOCAL state on purpose: a clock field in the shared store would
// wake every subscriber in the office every 10s.
import { useEffect, useState } from 'react'

// 10s — the roster already hides a "since" label until it is 10s old, so a label is never more than
// one floor-width stale.
export const NOW_TICK_MS = 10_000

// Pure scheduler, kept separate so its lifecycle is testable with fake timers (no DOM in the suite).
export function startTicker(onTick, intervalMs) {
  const id = setInterval(onTick, intervalMs)
  return () => clearInterval(id)
}

// Returns the clock for THIS render and re-renders the caller every `intervalMs` while `enabled`.
// It reads the clock at render rather than returning the last tick's timestamp, so a consumer that
// has just been enabled (an inspector opened long after mount) never renders one stale frame.
// Callers derive every relative time in a render from this one value.
export function useNowTick(intervalMs = NOW_TICK_MS, enabled = true) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!enabled) return undefined
    return startTicker(() => setTick((n) => n + 1), intervalMs)
  }, [intervalMs, enabled])
  return Date.now()
}
