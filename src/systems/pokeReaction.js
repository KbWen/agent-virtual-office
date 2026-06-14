// AVO-158 — Poke / acknowledge micro-interaction (pure logic).
//
// Decides the reaction when a user pokes (clicks) a character: which quip to show and how
// "intense" the bob is, based ONLY on the agent's REAL status + the recent poke history.
// Honest by construction (ADR-005): quips are keyed by real status; this module never
// touches position or status. Pure + DOM-free → unit-testable.
//
// Model A: the reaction is layered onto the existing click; this module supplies the
// content + escalation, the component supplies the animation/bubble.

// Status → quip pool key. Unknown/legacy statuses fall back to 'idle' so a quip always
// exists and never claims a state the agent isn't in (a blocked agent never gets a working
// quip — it maps to its own pool or the neutral idle pool, never cross-status).
const STATUS_POOL = Object.freeze({
  working: 'working',
  planning: 'working',
  thinking: 'working',
  blocked: 'blocked',
  'awaiting-approval': 'blocked',
  done: 'done',
  idle: 'idle',
})

export function poolKeyForStatus(status) {
  return STATUS_POOL[status] || 'idle'
}

// Escalation thresholds (cozy, not punishing).
export const POKE_WINDOW_MS = 5000   // pokes within this window count toward escalation
export const POKE_RESET_MS = 10000   // idle gap that resets the streak
export const LONG_AT = 3              // 3rd poke in-window → longer bob
export const TURNAWAY_AT = 5          // 5th+ poke in-window → brief "turn away / ok ok"

// Append `now` to history, dropping pokes older than the reset gap. Returns the trimmed,
// chronologically-ordered timestamp list (most-recent last).
export function pushPoke(history, now) {
  const recent = (Array.isArray(history) ? history : []).filter(
    (t) => typeof t === 'number' && Number.isFinite(t) && now - t < POKE_RESET_MS
  )
  recent.push(now)
  return recent
}

// Count consecutive pokes inside the escalation window ending at `now`.
function streakInWindow(history, now) {
  return history.filter((t) => now - t < POKE_WINDOW_MS).length
}

// Deterministic-but-varied quip index: rotate through the pool by streak length so repeat
// pokes cycle quips (no Math.random — keeps it test-stable and avoids the workflow-style
// randomness ban spirit; variety comes from the streak counter).
export function pickQuipIndex(poolLength, streak) {
  if (!poolLength || poolLength < 1) return 0
  return Math.max(0, (streak - 1)) % poolLength
}

// Core: given the agent's real status + prior poke history + now, return the reaction.
// `intensity`: 'normal' | 'long' | 'turnaway'. The caller maps these to bob duration and a
// possible turn-away beat, and resolves the quip TEXT from i18n via
// `pickQuipIndex(pool.length, streak)` against the pool named by `poolKey`.
export function pickPokeReaction(status, history, now) {
  const nextHistory = pushPoke(history, now)
  const streak = streakInWindow(nextHistory, now)
  let intensity = 'normal'
  if (streak >= TURNAWAY_AT) intensity = 'turnaway'
  else if (streak >= LONG_AT) intensity = 'long'
  return {
    poolKey: poolKeyForStatus(status),
    streak,
    intensity,
    nextHistory,
    turnAway: intensity === 'turnaway',
  }
}
