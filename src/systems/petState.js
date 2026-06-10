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

// A clear, TYPE-INDEPENDENT emote glyph floated above the pet per mode, so the state is legible at a
// glance for ANY skin (the poses alone are subtle at ~30px). `wander` (neutral default) shows none;
// `celebrate` shows none here because its rising ✦ confetti IS the indicator. Pure → testable.
export const MODE_EMOTE = Object.freeze({
  hide: '⚠',       // something needs a human / rough patch
  nap: '💤',       // resting
  excited: '⚡',   // momentum
  alert: '❗',     // a NEW blocker — go look
  wander: null,
  celebrate: null, // the confetti is the tell
})
export function modeEmote(mode) {
  return MODE_EMOTE[mode] || null
}

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
export const PET_TYPES = Object.freeze(['cat', 'vacuum', 'dog', 'rabbit', 'bird', 'hamster'])

export function nextPetType(type) {
  const i = PET_TYPES.indexOf(type)
  return PET_TYPES[(i + 1) % PET_TYPES.length] // unknown → index -1 → wraps to PET_TYPES[0]
}

// petMotionGrammar — per-type movement feel so types aren't just reskins (a Roomba moves like a
// machine, a dog like a dog). Pure → unit-testable. `cadenceMul` scales the wander interval
// (smaller = more often), `bob`/`bobAmp` the idle hop (`bobKeyframe` names the CSS animation so the
// choice is explicit, not a numeric guess), `easing` the glide.
const MOTION = Object.freeze({
  cat:     { cadenceMul: 1.0, bob: true,  bobAmp: 1.5, bobKeyframe: 'pet-bob',    easing: 'ease-in-out' },
  dog:     { cadenceMul: 0.7, bob: true,  bobAmp: 2.5, bobKeyframe: 'pet-bob-lg', easing: 'ease-in-out' },
  vacuum:  { cadenceMul: 1.1, bob: false, bobAmp: 0,   bobKeyframe: 'pet-bob',    easing: 'linear' },
  rabbit:  { cadenceMul: 0.6, bob: true,  bobAmp: 2.5, bobKeyframe: 'pet-bob-lg', easing: 'ease-out' },     // hops, often
  bird:    { cadenceMul: 0.5, bob: true,  bobAmp: 1.5, bobKeyframe: 'pet-bob',    easing: 'ease-out' },     // quick little flits
  hamster: { cadenceMul: 0.55, bob: true, bobAmp: 1.5, bobKeyframe: 'pet-bob',    easing: 'ease-in-out' },  // scurries
})
export function petMotionGrammar(type) {
  return MOTION[type] || MOTION.cat
}

// runTarget — where the pet should trot to "point at" a blocked agent: just below its desk, on the
// floor. Makes a real blocker MORE legible (motion = information). Pure → unit-testable; returns null
// when no position is known. It consumes a position the store ALREADY publishes (agent.position) —
// the caller must read that read-only, never HOME_POSITIONS / movementSystem internals, and must
// clampToFloor the result (kept out of here so this stays a pure, dependency-free picker).
export function runTarget(pos) {
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null
  return { x: pos.x, y: pos.y + 18 }
}

// segmentWalkable / pickWanderTarget — wall-phase fix (owner bug 2026-06-11: "寵物一直穿牆").
// The pet glides in a STRAIGHT LINE between wander points; clampToFloor validates only the
// ENDPOINTS, and the wander band (x 80–750) spans several rooms — so a hop could cross walls
// and furniture mid-glide. A hop is now accepted only when EVERY ~stepPx sample along the
// segment passes the injected walkability check (the same sampling technique the movement
// pathing tests use). Dependency-injected so these stay pure and unit-testable.
export function segmentWalkable(from, to, isWalkable, stepPx = 4) {
  if (!from || !to || typeof isWalkable !== 'function') return false
  const dx = to.x - from.x
  const dy = to.y - from.y
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / stepPx))
  for (let i = 0; i <= steps; i++) {
    if (!isWalkable(from.x + (dx * i) / steps, from.y + (dy * i) / steps)) return false
  }
  return true
}

// Try up to `attempts` candidate targets; return the first whose straight segment from `from`
// is fully walkable, or null when none qualifies — the caller then SKIPS this wander tick
// (the pet pauses in place: calmer AND more honest than phasing through a wall).
export function pickWanderTarget(from, sampleTarget, isWalkable, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    const t = sampleTarget()
    if (t && segmentWalkable(from, t, isWalkable)) return t
  }
  return null
}

// petReadabilityScale — keep the pet legible when the office is docked small WITHOUT lying about
// size. Partial (√) counter-scale of the live sceneScale, floored at 1 and capped at 1.6, so the
// pet shrinks WITH the room (stays a believable inhabitant, not a HUD sticker) but never becomes an
// unreadable speck. sceneScale ≥ 1 (office at/above native) → factor 1 (unchanged). Pure.
export function petReadabilityScale(sceneScale) {
  if (!(sceneScale > 0)) return 1
  return Math.min(1.6, Math.max(1, 1 / Math.sqrt(Math.min(sceneScale, 1))))
}
