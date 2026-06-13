// AVO-136 — Event juice resolver (PURE, no React/DOM).
//
// Maps a real office event id → a one-shot visual "juice" descriptor, or null. The juice is pure
// motion polish layered on a moment the office ALREADY conveys (bubbles + behaviors); it carries no
// new semantic state. Therefore reduced-motion returns null (no juice) — the event is still legible
// via its existing bubbles/behaviors. Non-juiced events (and unknown ids) return null too: juice is
// scoped to RARE meaningful moments only, never an idle-loop.
//
// Kept pure + tiny so the gating (which event juices, reduced-motion off) is unit-testable without a
// DOM. The render layer (EventJuice overlay in PixelOffice) and the per-agent desk-shake read these.

// One descriptor per juiced event. count/durationMs are conservative caps (no infinite loops);
// the render layer plays each exactly once, keyed by the event, then unmounts.
const EVENT_JUICE = Object.freeze({
  'deploy-success': { kind: 'confetti', count: 14, durationMs: 1200 },
  'eureka':         { kind: 'sparkle',  count: 6,  durationMs: 900 },
})

// Resolve the juice for an active event. Returns null under reduced-motion (motion fully disabled,
// semantic state preserved elsewhere) and for any non-juiced / unknown event.
export function juiceForEvent(eventId, { reducedMotion = false } = {}) {
  if (reducedMotion) return null
  const j = EVENT_JUICE[eventId]
  return j ? { ...j, eventId } : null
}

// Per-agent desk-slam shake gate: a brief LOCAL jitter on the affected agent only (never the whole
// office), and only when not in reduced-motion. The desk-slam posture + confused expression remain
// the semantic tell, so reduced-motion simply drops the jitter.
export function shouldShakeDesk(behavior, reducedMotion = false) {
  return !reducedMotion && behavior === 'desk-slam'
}

export const JUICED_EVENT_IDS = Object.freeze(Object.keys(EVENT_JUICE))
