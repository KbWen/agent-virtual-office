---
title: AVO-122 Ambient Soundscape (off-by-default)
status: shipped
created: 2026-06-13
signal_tier: none
backlog: AVO-122
---

# AVO-122 — Ambient Soundscape (off-by-default)

## Intent

An OPTIONAL, off-by-default ambient sound bed that makes the office feel *inhabited* after you opt in — the chill+fun → want-to-open value. 100% procedural Web Audio (zero shipped audio bytes). Every grain maps to a REAL signal; the empty office is honestly silent. Designed by a same-genre game-audio expert panel (cozy-sim · Animal Crossing · Gather.town · management-sim · tech/bundle gatekeeper; run wf_bdd578da). This spec is the §4.4 design artifact (audio has no visual DSoT; the only UI is a settings toggle mirroring the existing pattern).

## Scope — v1 ships TWO real-signal layers

**1. Keyboard-clatter bed (the room breathing).** Average key-tap RATE ∝ the real active signal.
- Driver: `teamPulse` (store.js:1206, the canonical 0..1 real-signal density, reset to 0 when `externalStatus` empties → free empty-office-silence). Cross-check: count of `externalStatus[id].status === 'working'` (OfficePet.jsx:52-53 primitive) / `ACTIVE_SESSION_STATUSES` (constants.js:31-33).
- **HARD FLOOR (honesty anchor):** `teamPulse === 0` AND working-count `=== 0` ⇒ scheduler idle ⇒ TRUE SILENCE within ~2s. No taps when no one works.
- Sound: discrete grains, never a drone. Each tap = 6-12ms bandpass noise burst (center ~2.2kHz, Q~1.5, 1ms attack / ~14ms decay) + small per-tap pitch/cutoff jitter (±300Hz). Poisson scheduler (self-rescheduling `setTimeout`, NOT per-rAF), mean inter-onset = `lerp(~2200ms @pulse≈0+, ~280ms @pulse=1)` (≤~3.5 soft taps/s at full). Rate→loudness smoothed with a ~4s time-constant (audio LAGS the eye; the status channel leads). Per-tap gain ~0.04×master; clatter sub-bus capped ≤0.06×master.

**2. Rain bed.** Gain follows the EXISTING weather derivation only (zero new state).
- Audible iff `moodToWeather(s.mood)` family ∈ {RAIN (frustrated), THUNDERSTORM (stuck)} (classify.js:64-65) — you hear rain exactly when the WallWindow shows rain; eyes/ears cannot disagree.
- **MANDATORY DOUBLE-GATE:** rain audio ON only if `family∈{rain,thunderstorm}` AND `s.weatherEffects === true` AND `!reducedMotion`. (Gating on `weatherEffects` means a user who silenced the windows also silences the rain → it can never become an anxious "always something's wrong" drone; it is a thin wash under the keyboard bed.)
- Sound: pink/brown noise → lowpass (cutoff ~800Hz→1.4kHz) → slow 0.1Hz bandpass shimmer. Enter-rain ramp 0→0.05 over 2.0-2.5s (matches the visual fade). Storm 0.07-0.08. NO thunder cracks, NO per-droplet synthesis. One persistent node, gain-automated on mood-family change (never restarted per tick).

## Dropped (with reasons — load-bearing records)

- **Coffee-machine gurgle on tea-break → DROPPED (honesty veto).** Ground truth: `tea-break` is fired by the WALL-CLOCK scheduler (`officeLife.js:804`, hour===10||15) + the random daily scheduler — it is organic time-gated theater, NOT a real agent/work signal. An audio cue on it would imply activity that isn't there (violates the #1 honesty law + the `project_office_events_never_relocate_working_agents` rule). 3/5 experts wrongly assumed a "real tea-break event"; the management-sim lens caught it. **Do NOT re-add a gurgle on `activeEvent.id==='tea-break'`.** Reopen only if hard-gated to a real-signal-seeded event via the `fireSeed` causal path (officeLife.js:670-682). Same veto applies to ANY clock/random-scheduled event (lunch-nap, group-meeting).
- **Sparse desk-clock tick → DROPPED** (REDUCE — invented texture; the honest empty office is SILENCE, not filled).
- **Per-"done" bloop → DROPPED** (STATUS-VISIBILITY-FIRST — a cue landing on a status change is a borderline status-signal/notification, not ambience).

## Architecture

- **`src/systems/ambientSound.js`** — new engine module mirroring the `startIdleGapInference(store) → stop()` pattern (idleGapInfer.js:143) and the moodEngine HMR-dispose shape. Owns the `AudioContext` + persistent nodes (master `GainNode` + `DynamicsCompressor`; clatter noise `BufferSource`+bandpass+Poisson grain gain; rain noise `BufferSource`+lowpass+shimmer LFO; optional 0.03Hz master breathe LFO). Noise buffers generated in-JS at enable (never fetched). Subscribes ONCE to the store with selector-equality no-op guards (mirror idleGapInfer's signature guard) — reacts to `soundscapeEnabled` / `teamPulse` / `mood` / `weatherEffects` / `reducedMotion`. `import.meta.hot.dispose` suspends+closes the ctx, clears the Poisson timer, unsubscribes.
- Wired once in PixelOffice's existing `start*` `useEffect` (alongside startOfficeLife etc.), returning its stop() for cleanup.
- **store.js** — add `soundscapeEnabled` flag + `toggleSoundscape` setter, mirroring `lightingEnabled`/`toggleWeatherEffects` exactly. Initializer: `default OFF` (key absent), force `false` under `prefers-reduced-motion`; localStorage key `avo.sound.enabled`.
- **ControlPanel.jsx** — one `role="switch"` row in the ⚙ settings sheet after the Office-pet block, mirroring the weatherEffects/lightingEnabled markup (label `t('settings.soundscape','Ambient soundscape')`). NO volume slider (the toggle IS the mute — REDUCE).

## Autoplay & lifecycle

`AudioContext` is created/resumed ONLY inside the user gesture: the `soundscapeEnabled` false→true transition fires the store subscription synchronously within the ⚙-click call stack → build graph there. On reload with persisted `'on'`, the engine stays DORMANT (no ctx) and attaches a one-time self-removing `pointerdown` listener that builds the graph on the first user gesture → zero autoplay console warnings, ever. `visibilitychange` hidden ⇒ `ctx.suspend()`; visible+enabled ⇒ resume+ramp. Toggle-OFF / reduced-motion-at-runtime ⇒ ramp master→0 over 1.2s then `ctx.suspend()` (keep graph; `close()` only on unmount).

## Accessibility & limits

- `prefers-reduced-motion` = HARD audio opt-out (force-off init + runtime kill). Master gain HARD-CAP 0.10 linear (~-20 dBFS); every layer is a fraction; `DynamicsCompressor` brick-wall. All transitions are ramps (enable 1.6s, disable 1.2s, weather 2.0-2.5s, rate 4s smoothing) — never an instantaneous set (no zipper/startle). The single toggle is the mute. Suspend on tab blur (≈0 CPU). SSR/no-WebAudio guarded (`typeof window`, `AudioContext||webkitAudioContext`) — the toggle row renders inert where unavailable. Ambience sits low/mid with no sharp 3-5kHz alert transients; sound never accompanies/signals a status change (the on-screen channel stays the sole status source).

## Acceptance Criteria

1. Toggle OFF by default; first-run forced OFF under prefers-reduced-motion.
2. Toggle ON (⚙ click) with NO active agents (teamPulse 0) ⇒ **silence** (no scheduled grains).
3. A real `working` status / rising teamPulse ⇒ clatter rate rises (smoothed).
4. `mood=frustrated` + `weatherEffects` ON ⇒ rain bed fades in; `weatherEffects` OFF ⇒ no rain audio.
5. Toggle OFF ⇒ `ctx.state==='suspended'`; no taps.
6. Reload with persisted `'on'` ⇒ **zero** "AudioContext was not allowed to start" console warnings; ctx stays null until a gesture.
7. Bundle: 0 audio bytes; code-only delta well under the +10% CI gate. Suite green.

## Verification (vitest has no AudioContext)

- Unit-testable (pure): the `soundscapeEnabled` initializer + the rain/clatter GATE logic (extract pure predicates) → vitest.
- Audio lifecycle → headless Playwright with console capture: prove AC 2-6 (silence@0, clatter-rises, rain-gate, suspend-on-off, no-autoplay-warning on persisted reload). Mock the store signals via real control paths.

## Risks & Rollback

- Risk: AudioContext leaks / orphaned timers on HMR or unmount → mitigated by stop() + `import.meta.hot.dispose` (suspend+close+clearTimeout+unsub).
- Risk: a future contributor re-adds a clock-event sound → mitigated by the "Dropped" honesty record above + a code comment at the engine's event-handling site.
- Rollback: revert the implement commit; the feature is also fully gated by `soundscapeEnabled` (default OFF → engine dormant, no ctx).
