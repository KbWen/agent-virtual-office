export const PET_STATE_VERSION = 'pet-state-v1'

export const PET_MODES = Object.freeze({
  HIDE: 'hide',
  NAP: 'nap',
  EXCITED: 'excited',
  WANDER: 'wander',
  ALERT: 'alert',
  CELEBRATE: 'celebrate',
})

export const PET_TYPES = Object.freeze(['cat', 'vacuum', 'dog', 'rabbit', 'bird', 'hamster'])
export const BLOCKED_LIKE_STATUSES = Object.freeze(['blocked', 'awaiting-approval'])
const BLOCKED_LIKE_SET = new Set(BLOCKED_LIKE_STATUSES)

const MODE_EMOTE = Object.freeze({
  hide: '\u26a0',
  nap: '\ud83d\udca4',
  excited: '\u26a1',
  alert: '\u2757',
  wander: null,
  celebrate: null,
})

const MOOD_TO_PET = Object.freeze({
  stuck: PET_MODES.HIDE,
  frustrated: PET_MODES.HIDE,
  idle: PET_MODES.NAP,
  smooth: PET_MODES.EXCITED,
  rushing: PET_MODES.EXCITED,
  intense: PET_MODES.EXCITED,
  normal: PET_MODES.WANDER,
})

const MOTION = Object.freeze({
  cat: Object.freeze({ cadenceMul: 1.0, bob: true, bobAmp: 1.5, bobKeyframe: 'pet-bob', easing: 'ease-in-out' }),
  dog: Object.freeze({ cadenceMul: 0.7, bob: true, bobAmp: 2.5, bobKeyframe: 'pet-bob-lg', easing: 'ease-in-out' }),
  vacuum: Object.freeze({ cadenceMul: 1.1, bob: false, bobAmp: 0, bobKeyframe: 'pet-bob', easing: 'linear' }),
  rabbit: Object.freeze({ cadenceMul: 0.6, bob: true, bobAmp: 2.5, bobKeyframe: 'pet-bob-lg', easing: 'ease-out' }),
  bird: Object.freeze({ cadenceMul: 0.5, bob: true, bobAmp: 1.5, bobKeyframe: 'pet-bob', easing: 'ease-out' }),
  hamster: Object.freeze({ cadenceMul: 0.55, bob: true, bobAmp: 1.5, bobKeyframe: 'pet-bob', easing: 'ease-in-out' }),
})

export function modeEmote(mode) {
  return MODE_EMOTE[mode] || null
}

export function derivePetState({ mood, blockedCount = 0 } = {}) {
  if (Number.isFinite(blockedCount) && blockedCount > 0) return PET_MODES.HIDE
  return MOOD_TO_PET[mood] || PET_MODES.WANDER
}

export function countAttentionBlockers(externalStatus) {
  if (!externalStatus) return 0
  let count = 0
  for (const entry of Object.values(externalStatus)) {
    if (entry && BLOCKED_LIKE_SET.has(entry.status)) count++
  }
  return count
}

export function firstAttentionBlockerId(externalStatus) {
  if (!externalStatus) return null
  for (const id of Object.keys(externalStatus)) {
    if (BLOCKED_LIKE_SET.has(externalStatus[id]?.status)) return id
  }
  return null
}

export function petIsMobile(mode) {
  return mode === PET_MODES.WANDER || mode === PET_MODES.EXCITED
}

export function resolvePetMode({ base, alert = false, celebrate = false } = {}) {
  if (alert) return PET_MODES.ALERT
  if (celebrate && base !== PET_MODES.HIDE) return PET_MODES.CELEBRATE
  return base
}

export function nextPetType(type) {
  const index = PET_TYPES.indexOf(type)
  return PET_TYPES[(index + 1) % PET_TYPES.length]
}

export function petMotionGrammar(type) {
  return MOTION[type] || MOTION.cat
}

export function runTarget(pos) {
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null
  return { x: pos.x, y: pos.y + 18 }
}

export function segmentWalkable(from, to, isWalkable, stepPx = 2) {
  if (!from || !to || typeof isWalkable !== 'function') return false
  const dx = to.x - from.x
  const dy = to.y - from.y
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / stepPx))
  for (let i = 0; i <= steps; i++) {
    if (!isWalkable(from.x + (dx * i) / steps, from.y + (dy * i) / steps)) return false
  }
  return true
}

export function pickWanderTarget(from, sampleTarget, isWalkable, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    const target = sampleTarget()
    if (target && segmentWalkable(from, target, isWalkable)) return target
  }
  return null
}

export function petReadabilityScale(sceneScale) {
  if (!(sceneScale > 0)) return 1
  return Math.min(1.6, Math.max(1, 1 / Math.sqrt(Math.min(sceneScale, 1))))
}

export function buildPetStateViewModel({
  mood,
  externalStatus,
  blockedCount,
  alert = false,
  celebrate = false,
  petType = PET_TYPES[0],
  sceneScale = 1,
  targetPosition,
} = {}) {
  const statusBlockedCount = countAttentionBlockers(externalStatus)
  const resolvedBlockedCount = Number.isFinite(blockedCount)
    ? Math.max(blockedCount, statusBlockedCount)
    : statusBlockedCount
  const baseMode = derivePetState({ mood, blockedCount: resolvedBlockedCount })
  const mode = resolvePetMode({ base: baseMode, alert, celebrate })
  const motion = petMotionGrammar(petType)

  return {
    version: PET_STATE_VERSION,
    mode,
    baseMode,
    emote: modeEmote(mode),
    mobile: petIsMobile(mode),
    blocked: {
      count: resolvedBlockedCount,
      firstId: firstAttentionBlockerId(externalStatus),
    },
    type: {
      id: PET_TYPES.includes(petType) ? petType : PET_TYPES[0],
      next: nextPetType(petType),
      motion: { ...motion },
    },
    scale: petReadabilityScale(sceneScale),
    target: runTarget(targetPosition),
  }
}
