// ─── Office pet state — a HONEST barometer of real aggregate office state ──────────────────────
// The pet is NOT decoration with a fake emotional life. Its mode is derived from real signals the
// office already computes (the mood enum + the live blocked count), mirroring the honest
// `moodToWeather(mood)` pattern. Pure + frozen table → unit-testable in isolation.
//
// Honesty guarantee: `hide` ALWAYS wins when an agent is actually blocked — the pet must never look
// happy/asleep while someone needs a human. That single rule is what keeps the toy truthful.

export const PET_MODES = Object.freeze({
  HIDE: 'hide',         // a real blocker, or a rough team mood — the pet crouches/hides
  NAP: 'nap',           // the team is idle/resting — the pet curls up
  EXCITED: 'excited',   // momentum (smooth/rushing/intense) — the pet trots, tail up
  WANDER: 'wander',     // ordinary steady activity — the pet ambles
  // ── transient event-edge overlays (v2) — never part of the base table; resolved on top of it ──
  ALERT: 'alert',       // a NEW blocker just appeared — ears up, then settles into hide
  CELEBRATE: 'celebrate', // a real positive event (eureka / deploy-success) — only when not hiding
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

// The pet only roams in the active base modes; nap/hide and the transient reaction poses
// (alert/celebrate) hold position so the pose itself conveys the signal.
export function petIsMobile(mode) {
  return mode === PET_MODES.WANDER || mode === PET_MODES.EXCITED
}

// resolvePetMode — fold the two transient event-edge overlays onto the honest base mode (v2). Pure
// so the precedence is unit-testable. CRITICAL: `alert` only fires on a NEW-blocker edge (so its
// base is already `hide` — alert is a louder "new blocker!" beat that settles back into hide), and
// `celebrate` NEVER shows while hiding. Neither can make the pet look happy during a real blocker.
export function resolvePetMode({ base, alert = false, celebrate = false }) {
  if (alert) return PET_MODES.ALERT
  if (celebrate && base !== PET_MODES.HIDE) return PET_MODES.CELEBRATE
  return base
}

// ─── Pet types (cosmetic skins) ────────────────────────────────────────────────────────────────
// COSMETIC ONLY. A type changes the sprite + motion GRAMMAR (how it moves), NEVER the state logic —
// every type derives its mode from the same `derivePetState`/`resolvePetMode` and obeys the same
// hide-on-blocker honesty guarantee. Capped at 3 (calm-tech guardrail: personalization, not a zoo).
export const PET_TYPES = Object.freeze(['cat', 'vacuum', 'dog'])

export function nextPetType(type) {
  const i = PET_TYPES.indexOf(type)
  return PET_TYPES[(i + 1) % PET_TYPES.length] // unknown → index -1 → wraps to PET_TYPES[0]
}

// petMotionGrammar — per-type movement feel so types aren't just reskins (a Roomba moves like a
// machine, a dog like a dog). Pure → unit-testable. `cadenceMul` scales the wander interval
// (smaller = more often), `bob`/`bobAmp` the idle hop, `easing` the glide, `turnInPlace` reserved
// for the vacuum's mechanical pivot.
const MOTION = Object.freeze({
  cat:    { cadenceMul: 1.0, bob: true,  bobAmp: 1.5, easing: 'ease-in-out', turnInPlace: false },
  dog:    { cadenceMul: 0.7, bob: true,  bobAmp: 2.5, easing: 'ease-in-out', turnInPlace: false },
  vacuum: { cadenceMul: 1.1, bob: false, bobAmp: 0,   easing: 'linear',      turnInPlace: true  },
})
export function petMotionGrammar(type) {
  return MOTION[type] || MOTION.cat
}

// petReadabilityScale — keep the pet legible when the office is docked small WITHOUT lying about
// size. Partial (√) counter-scale of the live sceneScale, floored at 1 and capped at 1.6, so the
// pet shrinks WITH the room (stays a believable inhabitant, not a HUD sticker) but never becomes an
// unreadable speck. sceneScale ≥ 1 (office at/above native) → factor 1 (unchanged). Pure.
export function petReadabilityScale(sceneScale) {
  if (!(sceneScale > 0)) return 1
  return Math.min(1.6, Math.max(1, 1 / Math.sqrt(Math.min(sceneScale, 1))))
}
