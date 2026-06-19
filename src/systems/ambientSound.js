/**
 * Ambient Soundscape engine (AVO-122) — 100% procedural Web Audio, ZERO shipped audio bytes.
 *
 * Off-by-default. Every layer maps to a REAL signal; the empty office is honestly SILENT.
 * Designed by a same-genre game-audio expert panel (cozy-sim · Animal Crossing · Gather.town ·
 * management-sim · tech/bundle gatekeeper). Spec: docs/specs/ambient-soundscape.md.
 *
 * v1 layers:
 *   1. Keyboard-clatter bed — Poisson-scheduled grains, tap RATE ∝ teamPulse (the canonical
 *      real-signal density, store.js). teamPulse === 0 ⇒ NO taps (the honesty anchor: no sound
 *      when no one is working).
 *   2. Rain bed — gain follows the EXISTING weather derivation (moodToWeather → rain/thunderstorm),
 *      DOUBLE-GATED on weatherEffects && !reducedMotion so the audio rain can never disagree with
 *      the on-screen rain or become an "always something's wrong" drone.
 *
 * DROPPED (do NOT re-add): coffee gurgle on tea-break (tea-break is a WALL-CLOCK/random scheduler
 * event — officeLife.js:804 — NOT a real agent signal; a sound on it would imply fake activity,
 * violating the #1 honesty law). Same veto applies to any clock/random-scheduled office event.
 *
 * Autoplay-safe BY CONSTRUCTION: the AudioContext is created/resumed ONLY inside a user gesture
 * (the toggle-ON click runs the store subscription synchronously; on a persisted-on reload the
 * engine stays dormant until a one-time pointerdown). No audio node is created before that.
 */
import { moodToWeather } from '../components/TopDownFurniture.jsx'

// ── Tunables (master is HARD-capped; every layer is a fraction of it) ──────────
export const MASTER_CAP = 0.10           // linear, ~-20 dBFS — never exceed
const MASTER_CENTER = 0.05               // breathe LFO oscillates around this
const BREATHE_DEPTH = 0.015
const CLATTER_TAP_GAIN = 0.04
const RAIN_GAIN = 0.05
const STORM_GAIN = 0.08
const MIN_INTERVAL_MS = 280              // mean inter-tap at pulse=1
const MAX_INTERVAL_MS = 2200             // mean inter-tap at pulse≈0+
const RATE_SMOOTH_TC = 4.0               // seconds — audio lags the eye
const ENABLE_RAMP = 1.6
const DISABLE_RAMP = 1.2
const RAIN_RAMP = 2.2

// ── Pure helpers (vitest-testable without an AudioContext) ─────────────────────

/** Rain bed target gain for the current signals. The honesty/double-gate predicate. */
export function rainTargetGain(mood, weatherEffects, reducedMotion) {
  if (reducedMotion || !weatherEffects) return 0
  const w = moodToWeather(mood)
  if (w === 'thunderstorm') return STORM_GAIN
  if (w === 'rain') return RAIN_GAIN
  return 0
}

/** Mean Poisson inter-tap interval (ms) for a 0..1 pulse. pulse<=0 ⇒ Infinity (silence). */
export function meanIntervalForPulse(pulse) {
  const p = Math.max(0, Math.min(1, Number(pulse) || 0))
  if (p <= 0) return Infinity
  return MAX_INTERVAL_MS + (MIN_INTERVAL_MS - MAX_INTERVAL_MS) * p
}

/**
 * Resolve the persisted soundscape preference. Default OFF; force OFF under
 * prefers-reduced-motion regardless of a stale 'on' (audio is more intrusive than motion).
 * Mirrors the lightingEnabled initializer shape. `win` injectable for tests.
 */
export function initSoundscapeEnabled(win = (typeof window !== 'undefined' ? window : undefined)) {
  if (!win) return false
  try {
    const v = win.localStorage?.getItem('avo.sound.enabled')
    if (v === null || v === undefined) return false
    if (win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return false
    return v === 'on'
  } catch {
    return false
  }
}

// ── Web Audio graph state (all null until a gesture builds it) ─────────────────
let ctx = null
let master = null
let clatterBus = null
let noiseBuffer = null
let rainGainNode = null
let rainFilter = null
let breatheLFO = null
let rainSource = null
let rainShimmer = null
let clatterTimer = null
let smoothedPulse = 0
let lastSmoothTs = 0
let graphBuilt = false
let storeRef = null
let unsub = null
let gestureCleanup = null
let visListener = null

function hasWebAudio() {
  return typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
}

function makeNoiseBuffer(audioCtx, seconds, kind) {
  const len = Math.max(1, Math.floor(audioCtx.sampleRate * seconds))
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate)
  const data = buf.getChannelData(0)
  if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99765 * b0 + w * 0.0990460
      b1 = 0.96300 * b1 + w * 0.2965164
      b2 = 0.57000 * b2 + w * 1.0526913
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12
    }
  } else {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }
  return buf
}

function buildGraph(audioCtx) {
  master = audioCtx.createGain()
  master.gain.value = 0
  const comp = audioCtx.createDynamicsCompressor()
  comp.threshold.value = -24; comp.ratio.value = 4; comp.knee.value = 6
  master.connect(comp); comp.connect(audioCtx.destination)

  // Breathing LFO — gain modulation only (NOT a fake activity signal; honesty-neutral).
  breatheLFO = audioCtx.createOscillator()
  breatheLFO.frequency.value = 0.03
  const breatheGain = audioCtx.createGain()
  breatheGain.gain.value = BREATHE_DEPTH
  breatheLFO.connect(breatheGain); breatheGain.connect(master.gain)
  breatheLFO.start()

  clatterBus = audioCtx.createGain()
  clatterBus.gain.value = 1
  clatterBus.connect(master)
  noiseBuffer = makeNoiseBuffer(audioCtx, 0.06, 'white')

  // Rain chain — one persistent looping source, gain-automated (never restarted per tick).
  const pink = makeNoiseBuffer(audioCtx, 2.0, 'pink')
  rainSource = audioCtx.createBufferSource()
  rainSource.buffer = pink; rainSource.loop = true
  rainFilter = audioCtx.createBiquadFilter()
  rainFilter.type = 'lowpass'; rainFilter.frequency.value = 1000
  rainGainNode = audioCtx.createGain(); rainGainNode.gain.value = 0
  rainSource.connect(rainFilter); rainFilter.connect(rainGainNode); rainGainNode.connect(master)
  rainSource.start()
  rainShimmer = audioCtx.createOscillator(); rainShimmer.frequency.value = 0.1
  const shimmerGain = audioCtx.createGain(); shimmerGain.gain.value = 300
  rainShimmer.connect(shimmerGain); shimmerGain.connect(rainFilter.frequency)
  rainShimmer.start()

  graphBuilt = true
}

function clatterTap() {
  if (!graphBuilt || !ctx || ctx.state !== 'running') return
  const when = ctx.currentTime + 0.01
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
  bp.frequency.value = 2200 + (Math.random() * 600 - 300); bp.Q.value = 1.5
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.linearRampToValueAtTime(CLATTER_TAP_GAIN, when + 0.001)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.014)
  src.connect(bp); bp.connect(g); g.connect(clatterBus)
  src.start(when); src.stop(when + 0.05)
  src.onended = () => { try { src.disconnect(); bp.disconnect(); g.disconnect() } catch { /* already gone */ } }
}

function easePulse() {
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const dt = lastSmoothTs ? Math.min(2, (now - lastSmoothTs) / 1000) : 0
  lastSmoothTs = now
  const target = storeRef ? (storeRef.getState().teamPulse || 0) : 0
  const k = dt > 0 ? 1 - Math.exp(-dt / RATE_SMOOTH_TC) : 0
  smoothedPulse += (target - smoothedPulse) * k
  if (smoothedPulse < 0.0005) smoothedPulse = target <= 0 ? 0 : smoothedPulse
}

function scheduleNextTap() {
  if (!graphBuilt || !ctx) return
  easePulse()
  const mean = meanIntervalForPulse(smoothedPulse)
  if (!Number.isFinite(mean)) {
    // Honest silence: no scheduling while the room is empty; re-check soon.
    clatterTimer = setTimeout(scheduleNextTap, 500)
    return
  }
  clatterTap()
  // Poisson: exponential inter-arrival around the mean.
  const interval = -Math.log(1 - Math.random()) * mean
  clatterTimer = setTimeout(scheduleNextTap, Math.max(40, interval))
}

function applyRain() {
  if (!graphBuilt || !ctx) return
  const s = storeRef.getState()
  const target = rainTargetGain(s.mood, s.weatherEffects, s.reducedMotion)
  rainGainNode.gain.cancelScheduledValues(ctx.currentTime)
  rainGainNode.gain.setValueAtTime(rainGainNode.gain.value, ctx.currentTime)
  rainGainNode.gain.linearRampToValueAtTime(target, ctx.currentTime + RAIN_RAMP)
}

function rampMaster(to, seconds) {
  if (!master || !ctx) return
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
  master.gain.linearRampToValueAtTime(to, ctx.currentTime + seconds)
}

/** Build (first time) or resume the audio graph. MUST be called from a user gesture. */
function activate() {
  if (!hasWebAudio()) return
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
  }
  ctx.resume?.()
  if (!graphBuilt) buildGraph(ctx)
  lastSmoothTs = 0
  rampMaster(MASTER_CENTER, ENABLE_RAMP)
  applyRain()
  if (!clatterTimer) scheduleNextTap()
}

/** Ramp to silence and suspend (keep the graph for instant re-enable). */
function deactivate() {
  if (clatterTimer) { clearTimeout(clatterTimer); clatterTimer = null }
  if (!ctx || !graphBuilt) return
  rampMaster(0, DISABLE_RAMP)
  setTimeout(() => { try { if (ctx && ctx.state === 'running') ctx.suspend?.() } catch { /* noop */ } }, (DISABLE_RAMP * 1000) + 80)
}

function shouldRun(state) {
  return !!state.soundscapeEnabled && !state.reducedMotion
}

// `isToggleGesture` = the soundscapeEnabled flag just transitioned false→true. That only ever
// happens via the ControlPanel toggle CLICK, whose onClick runs this subscription synchronously
// — i.e. inside a real user gesture, so creating the AudioContext here is autoplay-allowed.
// Any OTHER change (mood / weather / teamPulse) must NEVER create a context, or a gesture-less
// page mutation would trip the browser autoplay policy. It may only retarget an already-blessed
// context; when none exists yet (persisted-on at load) we stay dormant until the pointerdown listener.
function handleChange(state, isToggleGesture) {
  if (!shouldRun(state)) {
    if (ctx && ctx.state === 'running') deactivate()
    return
  }
  if (ctx) {
    // Context already exists (was created by a gesture) — resume/retarget is autoplay-safe.
    if (ctx.state !== 'running') activate()
    else applyRain()
  } else if (isToggleGesture) {
    activate() // false→true via the toggle click = the user gesture
  }
  // else: enabled but no context and not a gesture → stay dormant (pointerdown listener will start).
}

/**
 * Start the ambient-sound engine. Subscribes to the store; returns a stop() that
 * tears everything down. Creates NO audio until a user gesture enables it.
 * Mirrors startIdleGapInference(store) → stop().
 */
export function startAmbientSound(store) {
  if (typeof store?.getState !== 'function' || typeof store?.subscribe !== 'function') return () => {}
  if (!hasWebAudio()) return () => {}
  storeRef = store

  // React to the signals that matter (cheap signature guard so position ticks don't churn).
  // Track the prior enabled flag so we can tell the toggle-CLICK transition (a user gesture, the
  // only place we may create the AudioContext) apart from mood/weather changes.
  let prevEnabled = !!store.getState().soundscapeEnabled
  let prevSig = ''
  unsub = store.subscribe((state) => {
    const sig = `${state.soundscapeEnabled ? 1 : 0}|${state.reducedMotion ? 1 : 0}|${state.weatherEffects ? 1 : 0}|${state.mood}`
    if (sig === prevSig) return
    prevSig = sig
    const isToggleGesture = !!state.soundscapeEnabled && !prevEnabled
    prevEnabled = !!state.soundscapeEnabled
    handleChange(state, isToggleGesture)
  })

  // Persisted-on at load: stay dormant (no ctx) until the first user gesture, so a
  // gesture-less page load never triggers an autoplay warning.
  if (shouldRun(store.getState())) {
    const onGesture = () => { activate(); removeGesture() }
    const removeGesture = () => {
      if (!gestureCleanup) return
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
      gestureCleanup = null
    }
    window.addEventListener('pointerdown', onGesture, { once: true })  // AVO-182: the fired listener auto-removes even if removeGesture no-ops
    window.addEventListener('keydown', onGesture, { once: true })
    gestureCleanup = removeGesture
  }

  // Suspend on tab blur (≈0 CPU); resume when visible if still enabled.
  visListener = () => {
    if (!ctx) return
    if (document.hidden) { try { ctx.suspend?.() } catch { /* noop */ } }
    else if (shouldRun(store.getState())) activate()
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visListener)

  return function stopAmbientSound() {
    if (unsub) { unsub(); unsub = null }
    if (gestureCleanup) gestureCleanup()
    if (visListener && typeof document !== 'undefined') document.removeEventListener('visibilitychange', visListener)
    visListener = null
    if (clatterTimer) { clearTimeout(clatterTimer); clatterTimer = null }
    try { if (ctx) ctx.close?.() } catch { /* noop */ }
    ctx = master = clatterBus = noiseBuffer = rainGainNode = rainFilter = null
    breatheLFO = rainSource = rainShimmer = null
    graphBuilt = false; smoothedPulse = 0; storeRef = null
  }
}

// HMR: tear the engine down on hot-replacement so orphaned AudioContexts/timers don't leak.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (clatterTimer) clearTimeout(clatterTimer)
    if (unsub) unsub()
    if (gestureCleanup) gestureCleanup()
    if (visListener && typeof document !== 'undefined') document.removeEventListener('visibilitychange', visListener)
    try { if (ctx) ctx.close?.() } catch { /* noop */ }
    ctx = null; graphBuilt = false
  })
}
