// Pure integration/connection status view-model.
//
// Keep this node-safe and renderer-agnostic. UI layers can translate labelKey and decide how to draw
// the tone; the severity precedence lives here so alternate renderers share the same health truth.

const HEALTH_DOT = Object.freeze({
  offline:  { trouble: true,  labelKey: 'status.apiOffline',  tone: 'red',     pulse: false },
  degraded: { trouble: true,  labelKey: 'status.apiRetrying', tone: 'amber',   pulse: true  },
  fallback: { trouble: true,  labelKey: 'ui.fallbackAgents',  tone: 'amber',   pulse: true  },
  live:     { trouble: false, labelKey: 'ui.live',            tone: 'emerald', pulse: true  },
  idle:     { trouble: false, labelKey: 'status.local',       tone: 'gray',    pulse: false },
})

export function healthDotState({ statusSource, integrationHealth, externalCount = 0 } = {}) {
  const ih = integrationHealth?.state
  let level
  if (ih === 'offline') level = 'offline'
  else if (ih === 'degraded') level = 'degraded'
  else if (statusSource === 'fallback') level = 'fallback'
  else if (statusSource === 'external') level = 'live'
  else level = 'idle'
  const cfg = HEALTH_DOT[level]
  return {
    level,
    trouble: cfg.trouble,
    tone: cfg.tone,
    pulse: cfg.pulse,
    labelKey: cfg.labelKey,
    labelVal: level === 'fallback' ? externalCount : null,
  }
}
