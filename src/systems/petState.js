// ─── Office pet state — a HONEST barometer of real aggregate office state ──────────────────────
// The pet is NOT decoration with a fake emotional life. Its mode is derived from real signals the
// office already computes (the mood enum + the live blocked count), mirroring the honest
// `moodToWeather(mood)` pattern. Pure + frozen table → unit-testable in isolation.
//
// Honesty guarantee: `hide` ALWAYS wins when an agent is actually blocked — the pet must never look
// happy/asleep while someone needs a human. That single rule is what keeps the toy truthful.

export const PET_MODES = Object.freeze({
  HIDE: 'hide',       // a real blocker, or a rough team mood — the pet crouches/hides
  NAP: 'nap',         // the team is idle/resting — the pet curls up
  EXCITED: 'excited', // momentum (smooth/rushing/intense) — the pet trots, tail up
  WANDER: 'wander',   // ordinary steady activity — the pet ambles
})

// mood enum (constants.VALID_MOODS): normal · rushing · frustrated · stuck · smooth · intense · idle
const MOOD_TO_PET = Object.freeze({
  stuck: 'hide',
  frustrated: 'hide',
  idle: 'nap',
  smooth: 'excited',
  rushing: 'excited',
  intense: 'excited',
  normal: 'wander',
})

// derivePetState({ mood, blockedCount }) → one of PET_MODES.
// blockedCount > 0 forces 'hide' regardless of mood (the honesty guarantee). Unknown/missing mood
// falls back to 'wander' (steady, neutral) — never to a happy state.
export function derivePetState({ mood, blockedCount = 0 } = {}) {
  if (Number.isFinite(blockedCount) && blockedCount > 0) return PET_MODES.HIDE
  return MOOD_TO_PET[mood] || PET_MODES.WANDER
}

// The pet only roams in the active modes; nap/hide hold position (and pose conveys the signal).
export function petIsMobile(mode) {
  return mode === PET_MODES.WANDER || mode === PET_MODES.EXCITED
}
