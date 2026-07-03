export const POKE_STATUS_POOL = Object.freeze({
  working: 'working',
  planning: 'working',
  thinking: 'working',
  blocked: 'blocked',
  'awaiting-approval': 'blocked',
  done: 'done',
  idle: 'idle',
})

export const POKE_WINDOW_MS = 5000
export const POKE_RESET_MS = 10000
export const LONG_AT = 3
export const TURNAWAY_AT = 5
export const POKE_QUIP_MS = 1200

export const POKE_MOTION_PROFILE = Object.freeze({
  normal: {
    values: '0 0;0 -4;0 0',
    keyTimes: '0;0.5;1',
    dur: '0.32s',
  },
  long: {
    values: '0 0;0 -5;0 -2;0 -5;0 0',
    keyTimes: '0;0.25;0.5;0.75;1',
    dur: '0.6s',
  },
  turnaway: {
    values: '0 0;-3 0;3 0;-2 0;0 0',
    keyTimes: '0;0.25;0.5;0.75;1',
    dur: '0.5s',
  },
})

export const POKE_INTENSITY_TIMING = Object.freeze({
  normal: {
    bobMs: 460,
    bobClearMs: 460,
    quipMs: POKE_QUIP_MS,
    animationSeconds: 0.32,
    motion: POKE_MOTION_PROFILE.normal,
    turnAway: false,
  },
  long: {
    bobMs: 720,
    bobClearMs: 720,
    quipMs: POKE_QUIP_MS,
    animationSeconds: 0.6,
    motion: POKE_MOTION_PROFILE.long,
    turnAway: false,
  },
  turnaway: {
    bobMs: 720,
    bobClearMs: 720,
    quipMs: POKE_QUIP_MS,
    animationSeconds: 0.5,
    motion: POKE_MOTION_PROFILE.turnaway,
    turnAway: true,
  },
})

export function poolKeyForStatus(status) {
  return POKE_STATUS_POOL[status] || 'idle'
}

export function pushPoke(history, now) {
  const recent = (Array.isArray(history) ? history : []).filter(
    (t) => typeof t === 'number' && Number.isFinite(t) && now - t < POKE_RESET_MS
  )
  recent.push(now)
  return recent
}

export function streakInWindow(history, now) {
  return (Array.isArray(history) ? history : []).filter((t) => now - t < POKE_WINDOW_MS).length
}

export function pickQuipIndex(poolLength, streak) {
  if (!poolLength || poolLength < 1) return 0
  return Math.max(0, streak - 1) % poolLength
}

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

export function buildPokeReactionViewModel({
  status = 'idle',
  history = [],
  now = Date.now(),
  poolLength = 0,
} = {}) {
  const reaction = pickPokeReaction(status, history, now)
  const timing = POKE_INTENSITY_TIMING[reaction.intensity] || POKE_INTENSITY_TIMING.normal
  return {
    ...reaction,
    quipIndex: pickQuipIndex(poolLength, reaction.streak),
    timing,
  }
}
