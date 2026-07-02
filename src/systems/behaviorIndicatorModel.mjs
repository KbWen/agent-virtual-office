const DEFAULT_OFFSET = Object.freeze({ x: 14, y: -8 })

export { behaviorIndicatorIconKey } from './behaviorIndicatorIconKey.mjs'
import { behaviorIndicatorIconKey } from './behaviorIndicatorIconKey.mjs'

export const BEHAVIOR_INDICATOR_TABLE = Object.freeze({
  typing: Object.freeze({ iconKey: 'keyboard', variant: 'typing', animated: true }),
  'reading-screen': Object.freeze({ iconKey: 'document', variant: 'scan', animated: true }),
  'writing-notes': Object.freeze({ iconKey: 'pencil', variant: 'write', animated: true }),
  research: Object.freeze({ iconKey: 'magnifier', variant: 'search', animated: true }),
  'gantt-chart': Object.freeze({ iconKey: 'chart', variant: 'timeline', animated: true }),
  magnifier: Object.freeze({ iconKey: 'qa-magnifier', variant: 'check', animated: true }),
  'shield-verify': Object.freeze({ iconKey: 'shield', variant: 'verify', animated: true }),
  'deploy-button': Object.freeze({ iconKey: 'deploy', variant: 'button', animated: true }),
  'drink-coffee': Object.freeze({ iconKey: 'coffee', variant: 'steam', animated: true }),
  'goto-coffee-machine': Object.freeze({ iconKey: 'coffee', variant: 'steam', animated: true }),
  whiteboard: Object.freeze({ iconKey: 'whiteboard', variant: 'marker', animated: true }),
  meeting: Object.freeze({ iconKey: 'meeting-bubbles', variant: 'alternate', animated: true }),
  chat: Object.freeze({ iconKey: 'chat-bubble', variant: 'ellipsis', animated: false }),
  'check-phone': Object.freeze({ iconKey: 'phone', variant: 'screen', animated: true }),
  stretch: Object.freeze({ iconKey: 'stretch', variant: 'arms', animated: true }),
  nap: Object.freeze({ iconKey: 'sleep', variant: 'zzz', animated: true }),
  'thumbs-up': Object.freeze({ iconKey: 'thumbs-up', variant: 'pulse', animated: true }),
  print: Object.freeze({ iconKey: 'printer', variant: 'paper', animated: true }),
  'scratch-head': Object.freeze({ iconKey: 'frustration', variant: 'marks', animated: true }),
  sigh: Object.freeze({ iconKey: 'frustration', variant: 'marks', animated: true }),
  'desk-slam': Object.freeze({ iconKey: 'frustration', variant: 'marks', animated: true }),
  'phone-call': Object.freeze({ iconKey: 'phone-call', variant: 'call', animated: true }),
})

export const NO_INDICATOR_CHARACTER_BEHAVIORS = Object.freeze([
  'idle',
  'pass-document',
  'happy',
  'focused',
  'confused',
  'drink-water',
  'toilet',
  'look-window',
  'eat-snack',
])

export const KNOWN_CHARACTER_BEHAVIORS = Object.freeze([
  ...Object.keys(BEHAVIOR_INDICATOR_TABLE),
  ...NO_INDICATOR_CHARACTER_BEHAVIORS,
])

export function behaviorIndicatorState(behavior, frame = 0) {
  const normalized = behavior || 'idle'
  const entry = BEHAVIOR_INDICATOR_TABLE[normalized]
  if (!entry) {
    return {
      behavior: normalized,
      iconKey: null,
      variant: null,
      animated: false,
      known: KNOWN_CHARACTER_BEHAVIORS.includes(normalized),
      frame: normalizedFrame(frame),
      offset: { ...DEFAULT_OFFSET },
    }
  }

  return {
    behavior: normalized,
    iconKey: entry.iconKey,
    variant: entry.variant,
    animated: entry.animated,
    known: true,
    frame: normalizedFrame(frame),
    offset: { ...DEFAULT_OFFSET },
  }
}

export function hasBehaviorIndicator(behavior) {
  return Boolean(behaviorIndicatorIconKey(behavior))
}

function normalizedFrame(frame) {
  if (!Number.isFinite(frame)) return 0
  return Math.max(0, Math.floor(frame)) % 4
}
