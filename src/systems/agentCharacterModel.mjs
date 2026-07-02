import { behaviorIndicatorState } from './behaviorIndicatorModel.mjs'

export {
  BASE_GLOW,
  CHAR_SCALE,
  characterBubbleLayout,
  characterBubbleMessage,
  characterStatusRing,
  characterStatusVisual,
  computeLabelScale,
  EFFORT_GLOW,
  estimateTextWidth,
  LABEL_SCALE_MAX,
  nameTagMetrics,
} from './agentCharacterVisualModel.mjs'

export function characterIndicatorState({ status = 'idle', behavior = 'idle', isWalking = false, reasonCode = null } = {}) {
  if (isWalking) {
    return {
      kind: 'none',
      key: 'none',
      behavior: behavior || 'idle',
      iconKey: null,
      variant: null,
      known: true,
    }
  }
  if ((status || 'idle') === 'blocked') {
    return {
      kind: 'blocked-reason',
      key: `reason-${reasonCode || 'unknown'}`,
      reasonCode: reasonCode || null,
      behavior: behavior || 'idle',
      iconKey: 'blocked-reason',
      variant: reasonCode || 'unknown',
      known: true,
    }
  }
  const indicator = behaviorIndicatorState(behavior)
  return {
    kind: 'behavior',
    key: indicator.behavior,
    ...indicator,
  }
}
