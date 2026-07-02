import { create } from 'zustand'
import characters from '../config/characters.json'
import { HOME_POSITIONS, OVERFLOW_POSITIONS, OVERFLOW_SLOT_BY_XY, clampToFloor, avoidOverlap, visuallyOverlapping } from './movementSystem.js'
import { randomBubble, setNameResolver, behaviorLabel, t as i18nT } from '../i18n'
import { generateContextBubble } from './contextBubble'
import { rng } from './rng.js'
import { detectProjectMode } from './platformDetect'
import { STATUS_COLORS } from './constants.js'
import { classifyTask, familyToBehavior, decideBehavior } from './classify.js'
import { FEED_ORIGINS } from './rosterModel.js'
import { PET_TYPES, nextPetType } from './petState.js'
import { pruneRecentPicks } from './behaviorEngine.js'  // AVO-180: prune on eviction
import { isValidTheme, DEFAULT_THEME } from './theme.js'
import { recordEpisode, isNewBlockedEpisode } from './recurringFailure.js'
import { assembleIntegrationPatch, buildExternalStatusEntry } from './statusRuntime.mjs'

export { STATUS_COLORS }

// ─── Store working-bubble fallback (AC-S1b / AC-C1) ───────────────────────────────────────────
// The store's sigChanged path previously called randomBubble('working-status') unconditionally
// on every real status/task change — effectively ~100% emission on every hook event. That is
// the SECOND working-bubble emitter counted by AC-C1. Apply the same 0.20 chance gate + anti-
// repeat as behaviorEngine (AC-S1b) so both paths are gated identically.
// blocked-status and done-status are EXEMPT from the gate (those states deserve voice; honesty).
const _storeRecentPicks = new Map()

function _pickWithAntiRepeat(poolKey, agentId) {
  const pool = i18nT(`bubbles.${poolKey}`)
  if (!Array.isArray(pool) || pool.length === 0) return null
  const recent = _storeRecentPicks.get(agentId) || []
  const filtered = pool.length > recent.length
    ? pool.filter((m) => !recent.includes(m))
    : pool
  return (filtered.length > 0 ? filtered : pool)[Math.floor(rng() * (filtered.length > 0 ? filtered : pool).length)]
}

function _storeFallbackBubble(agentId, status) {
  // blocked and done always emit a bubble (no gate); working is gated at 0.20.
  if (status === 'blocked') return randomBubble('blocked-status')
  if (status === 'done')    return randomBubble('done-status')
  // working: apply 0.20 chance gate (AC-S1b / AC-C1)
  if (rng() >= 0.20) return null
  // Anti-repeat ring (last 2 picks per agent)
  if (!_storeRecentPicks.has(agentId)) _storeRecentPicks.set(agentId, [])
  const picked = _pickWithAntiRepeat('working-status', agentId)
  if (picked !== null && picked !== undefined) {
    const recent = _storeRecentPicks.get(agentId)
    recent.push(picked)
    if (recent.length > 2) recent.shift()
  }
  return picked ?? null
}

// Exported for tests only.
export function __clearStoreFallbackPicks() { _storeRecentPicks.clear() }
export { _storeFallbackBubble as __storeFallbackBubble }

// ─── Persistence helpers ───
const PERSIST_KEY = 'office-state'
let _lastPersistedSnapshot = null

function getLocalDayKey(now = Date.now()) {
  const date = new Date(now)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDailyDoneLedger(now = Date.now(), seed = {}) {
  return {
    dayKey: getLocalDayKey(now),
    counts: seed.counts && typeof seed.counts === 'object' ? { ...seed.counts } : {},
    seenEventKeys: Array.isArray(seed.seenEventKeys) ? [...seed.seenEventKeys] : [],
  }
}

function ensureCurrentDailyDoneLedger(ledger, now = Date.now()) {
  const dayKey = getLocalDayKey(now)
  if (!ledger || ledger.dayKey !== dayKey) return createDailyDoneLedger(now)
  return createDailyDoneLedger(now, ledger)
}

function createDailyBlockedLedger(now = Date.now(), seed = {}) {
  return {
    dayKey: getLocalDayKey(now),
    counts: seed.counts && typeof seed.counts === 'object' ? { ...seed.counts } : {},
  }
}

function ensureCurrentDailyBlockedLedger(ledger, now = Date.now()) {
  const dayKey = getLocalDayKey(now)
  if (!ledger || ledger.dayKey !== dayKey) return createDailyBlockedLedger(now)
  return createDailyBlockedLedger(now, ledger)
}

function buildDoneEventKey(update, meta) {
  if (!update?.agentId) return null
  if (meta?.eventKey) return `${meta.eventKey}:${update.agentId}`
  if (meta?.source && meta?.seq) return `${meta.source}:${meta.seq}:${update.agentId}`
  return null
}

export function createPersistedState(state) {
  const data = {
    _savedAt: Date.now(),
    agents: {},
    // Don't persist transient state (mood, externalStatus, statusSource, activeWorkflow)
    dailyDoneLedger: ensureCurrentDailyDoneLedger(state.dailyDoneLedger),
    dailyBlockedLedger: ensureCurrentDailyBlockedLedger(state.dailyBlockedLedger),
  }
  for (const [id, a] of Object.entries(state.agents)) {
    // Skip session-carrying dynamic worktree agents ('slug~role'). They are
    // ephemeral — created per-session by applyExternalStatus, not present in
    // the static roster, and never restored by initAgents. Persisting them
    // bloats the localStorage snapshot and leaves orphaned entries after short
    // sessions end. The discriminator mirrors applyExternalStatus: a non-null
    // `session` field is ONLY ever set by the dynamic-creation branch.
    if (a.session) continue
    data.agents[id] = {
      // Don't persist status — it's transient, driven only by external hooks
      behavior: a.behavior,
      expression: a.expression,
      deskItemCount: a.deskItemCount,
      position: a.position,
      facing: a.facing,
    }
  }
  return data
}

function loadPersistedState() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    // Discard stale data (older than 4 hours)
    if (Date.now() - (data._savedAt || 0) > 4 * 60 * 60 * 1000) return null
    _lastPersistedSnapshot = raw
    return data
  } catch { return null }
}

function savePersistedState(state) {
  if (typeof window === 'undefined') return
  try {
    const snapshot = JSON.stringify(createPersistedState(state))
    if (snapshot === _lastPersistedSnapshot) return
    localStorage.setItem(PERSIST_KEY, snapshot)
    _lastPersistedSnapshot = snapshot
  } catch { /* quota exceeded — ignore */ }
}

// ─── Validation for persisted data ───
const VALID_FACINGS = new Set(['up', 'down', 'left', 'right'])
const DESK_ITEM_KEYS = ['coffee', 'sticky', 'books']

function isValidPosition(pos) {
  return pos && typeof pos.x === 'number' && typeof pos.y === 'number'
    && isFinite(pos.x) && isFinite(pos.y)
}

// Deep-validate a persisted deskItemCount: localStorage is attacker/corruption-reachable,
// and the value flows straight into the growth math (count[item] = (count[item]||0)+1).
// A string value would string-concat ("lots"+1), a negative would underflow, and unknown
// keys would persist forever. Rebuild a clean {coffee,sticky,books} object with only
// finite non-negative integers, dropping any extra keys.
function validateDeskItemCount(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return undefined
  const clean = {}
  for (const key of DESK_ITEM_KEYS) {
    const v = saved[key]
    clean[key] = (typeof v === 'number' && Number.isFinite(v) && v >= 0) ? Math.floor(v) : 0
  }
  return clean
}

export function validatePersistedAgent(saved) {
  if (!saved) return null
  return {
    // status is NOT persisted — always starts as 'idle', driven by external hooks
    behavior: typeof saved.behavior === 'string' ? saved.behavior : undefined,
    expression: typeof saved.expression === 'string' ? saved.expression : undefined,
    deskItemCount: validateDeskItemCount(saved.deskItemCount),
    position: isValidPosition(saved.position) ? saved.position : undefined,
    facing: VALID_FACINGS.has(saved.facing) ? saved.facing : undefined,
  }
}

export function validatePersistedDailyDoneLedger(saved, now = Date.now()) {
  if (!saved || typeof saved !== 'object') return null
  const dayKey = typeof saved.dayKey === 'string' ? saved.dayKey : null
  if (!dayKey) return null

  // Reconcile the day AT VALIDATION TIME, not via a later tick. loadPersistedState's
  // staleness window is 4 hours, so a ledger saved late yesterday is loaded early today
  // with yesterday's dayKey. Returning it verbatim seeds the store with a stale-day
  // ledger; until updateTime's next 60s rollover runs, PixelOffice's Sprint Kanban
  // (totalDoneToday) and the inspector's "done today" display YESTERDAY's counts.
  // If the persisted day is not today, the counts/event keys belong to a finished day —
  // return a fresh empty ledger for today rather than carrying the stale tally.
  if (dayKey !== getLocalDayKey(now)) return createDailyDoneLedger(now)

  const counts = {}
  for (const [agentId, value] of Object.entries(saved.counts || {})) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      counts[agentId] = value
    }
  }

  const seenEventKeys = Array.isArray(saved.seenEventKeys)
    ? saved.seenEventKeys.filter((value) => typeof value === 'string').slice(-500)
    : []

  return {
    dayKey,
    counts,
    seenEventKeys,
  }
}

export function validatePersistedDailyBlockedLedger(saved, now = Date.now()) {
  if (!saved || typeof saved !== 'object') return null
  const dayKey = typeof saved.dayKey === 'string' ? saved.dayKey : null
  if (!dayKey) return null
  if (dayKey !== getLocalDayKey(now)) return createDailyBlockedLedger(now)

  const counts = {}
  for (const [agentId, value] of Object.entries(saved.counts || {})) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      counts[agentId] = value
    }
  }
  return { dayKey, counts }
}

// ─── Cached init-time computations (avoid redundant calls) ───
const _persisted = loadPersistedState()

const _mode = (() => {
  if (typeof window === 'undefined') return 'agentcortex'
  return detectProjectMode()
})()

// ─── Custom agent profiles (cached — URL params don't change) ───
// Supported via: ?agents=Alice:dev,Bob:qa  OR  window.__office_config__.agents
const _customProfiles = (() => {
  if (typeof window === 'undefined') return {}
  const profiles = {}
  const cfg = window.__office_config__?.agents
  if (cfg && typeof cfg === 'object') {
    for (const [id, override] of Object.entries(cfg)) {
      profiles[id] = { name: override.name, color: override.color }
    }
  }
  const params = new URLSearchParams(window.location.search)
  const agentsParam = params.get('agents')
  if (agentsParam) {
    for (const entry of agentsParam.split(',')) {
      const [name, role] = entry.split(':').map(s => s.trim())
      if (name && role) profiles[role] = { name, ...(profiles[role] || {}) }
    }
  }
  return profiles
})()

// ─── Activity log helpers ───
let _activityId = 0
// `origin` separates REAL hook/workflow events from organic officeLife theater so the activity
// feed can filter out the 8–50 fake behavior entries/min that would otherwise drown (and evict,
// via the 50-cap) the genuine ones. Default 'organic'; real callers override (see call sites).
function mkActivity(entry) {
  return { id: ++_activityId, timestamp: Date.now(), origin: 'organic', ...entry }
}
// The feed reads a SEPARATE `eventFeed` buffer filled at WRITE time with FEED_ORIGINS-only entries
// (the single source of truth, shared with rosterModel) — filtering the shared activityLog only at
// read time let organic events (8-50/min) evict real ones from the 50-slot ring before the feed
// ever saw them (the cap-before-filter bug).
const pushFeed = (eventFeed, entry) =>
  FEED_ORIGINS.has(entry.origin) ? [entry, ...eventFeed].slice(0, 30) : eventFeed

// Monotonic id for handoff animations. MUST NOT be Date.now(): two handoffs added
// in the same millisecond (multiple agents picking 'pass-document' on the same tick,
// or an event handler firing pass-document for several participants) would share an
// id — colliding the React key in <FlyingDocuments> and causing removeHandoff() to
// delete BOTH animations when one completes.
let _handoffId = 0

// Behaviors worth logging to the activity feed (skip mundane ones like idle)
const LOGGABLE_BEHAVIORS = new Set([
  'typing', 'reading-screen', 'writing-notes', 'whiteboard', 'research',
  'deploy-button', 'shield-verify', 'meeting', 'chat', 'pass-document',
  'goto-coffee-machine', 'nap', 'scratch-head', 'desk-slam',
])

// Valid base roles — used by setHelpers to reject unknown parentRole values.
// Inline here to avoid a circular import with movementSystem (which imports store).
const VALID_ROLES = new Set(['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer'])

// Static lookup tables for applyExternalStatus — hoisted to module scope so they
// are NOT reallocated on every update inside the per-update loop. behaviorMap maps
// a work status to its visual behavior/expression; roleItems maps a base role to
// the desk item its growth accumulates. Both are pure constants.
const STATUS_BEHAVIOR_MAP = {
  working:  { behavior: { Bash: 'typing', Read: 'reading-screen', Grep: 'research', Glob: 'research' }, expression: 'focused' },
  blocked:  { behavior: 'scratch-head', expression: 'confused' },
  done:     { behavior: 'thumbs-up', expression: 'happy' },
  planning: { behavior: 'gantt-chart', expression: 'focused' },  // AVO-101: plan mode
}
const ROLE_GROWTH_ITEMS = {
  pm: 'sticky', arch: 'books', dev: 'coffee',
  qa: 'sticky', ops: 'coffee', res: 'books',
  gate: 'sticky', designer: 'sticky',
}

// AVO-184/portable-runtime: externalStatus entry construction lives in statusRuntime.mjs so non-pixel
// consumers can reuse the exact changedAt / activeFileAt / expiry / sigChanged rules.
// AVO-184: resolve an agent's visual (behavior + expression) for ONE update. Pure given the update,
// the active workflow, the prior agent, and the inGroup flag. Byte-identical to the prior inline
// resolution — extraction only.
//
// #A2.1: decideBehavior is the single resolver for animation choice — priority status (blocked/done)
// > workflow phase > role override > family default. For working it gives MCP/verb/role/phase-aware
// results; for blocked/done it returns scratch-head/thumbs-up, so STATUS_BEHAVIOR_MAP supplies only
// the expression for those. During a group event officeLife owns behavior/expression, so the agent's
// current values are preserved (the inGroup guard).
function resolveAgentVisual(u, activeWorkflow, prevAgent, inGroup) {
  const bm = STATUS_BEHAVIOR_MAP[u.status] || {}
  const bmBehavior = decideBehavior({ task: u.task, role: u.agentId, status: u.status, workflow: activeWorkflow })
  const nextBehavior = inGroup ? prevAgent.behavior : (bmBehavior || prevAgent.behavior)
  const nextExpression = inGroup ? prevAgent.expression : (bm.expression || prevAgent.expression)
  return { nextBehavior, nextExpression }
}

// AVO-184/portable-runtime: integration-channel patching lives in statusRuntime.mjs so alternate
// status renderers can share the same source/workflow transition rules.

// Every OTHER agent's claimed standing spot, for group-target deconfliction (AVO-156/157
// follow-up). Resolution mirrors movementSystem.getOccupiedPositions: a walker's journey
// END > a group destination > the current leg target > the standing position. Excluding
// only in-group agents (the old behavior) let event actors be parked on BYSTANDERS.
function collectClaimedSpots(agents, excludeIds) {
  const spots = []
  for (const oid of Object.keys(agents)) {
    if (excludeIds.has(oid)) continue
    const a = agents[oid]
    const pos = a.journeyTarget || a.groupTarget || a.targetPosition || a.position
    if (pos) spots.push(pos)
  }
  return spots
}


const initAgents = (mode) => {
  const roster = characters[mode] || characters.agentcortex
  const agents = {}
  for (const c of roster) {
    const home = HOME_POSITIONS[c.id] || { x: 300, y: 250 }
    const saved = validatePersistedAgent(_persisted?.agents?.[c.id])
    const custom = _customProfiles[c.id]
    agents[c.id] = {
      ...c,
      name: custom?.name || c.name,
      color: custom?.color || c.color,
      behavior: saved?.behavior || 'idle',
      expression: saved?.expression || 'normal',
      bubble: null,
      status: 'idle',  // always start idle — external hooks drive status
      returnHomeOnIdle: false,
      deskItemCount: saved?.deskItemCount || { coffee: 0, sticky: 0, books: 0 },
      position: saved?.position || { ...home },
      targetPosition: saved?.position || { ...home },
      isMoving: false,
      facing: saved?.facing || 'down',
      inGroupEvent: false,
      groupTarget: null,
    }
  }
  return agents
}

export const useOfficeStore = create((set) => ({
  mode: _mode,
  agents: initAgents(_mode),
  hour: new Date().getHours(),
  minute: new Date().getMinutes(),
  activeEvent: null,
  isPaused: typeof window !== 'undefined' && (() => { try { return localStorage.getItem('office-paused') === 'true' } catch { return false } })(),
  // View mode: the OFFICE scene is the primary view at every size; the roster is an OPTIONAL
  // manual toggle (a glanceable list), never an automatic size-based switch. Persisted per user.
  rosterMode: typeof window !== 'undefined' && (() => { try { return localStorage.getItem('office-view') === 'roster' } catch { return false } })(),
  // Subagent helper-huddle: ephemeral helper figures clustered at a parent role's desk when
  // it dispatches subagents. Kept OUT of `agents` (no eviction / overflow / name tag / ring).
  helpers: [],  // [{ id: 'role#hash', parentRole, label, expiresAt }]
  reducedMotion: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false,
  // #45: user toggle to disable the heavy weather animations (rain/cloud drift/lightning) that
  // spike CPU on low-end devices / IDE webviews. Defaults ON; persisted per user via a dedicated
  // localStorage key (same lightweight pattern as isPaused/rosterMode — NOT the main snapshot).
  // When OFF, PixelOffice feeds WallWindow reducedMotion=true so weather degrades to static
  // decoration (the mood signal stays; the per-frame animation stops). prefers-reduced-motion
  // already forces static regardless of this toggle.
  weatherEffects: typeof window === 'undefined' ? true : (() => { try { return localStorage.getItem('office-weather') !== 'off' } catch { return true } })(),
  // AVO-111: time-of-day color-grade tint on/off. Default ON (it's the want-to-open feel); first
  // run defaults OFF under prefers-reduced-motion / prefers-contrast:more (the grade is ambient
  // luminance modulation those users opt out of). Persisted via a dedicated localStorage key (same
  // lightweight pattern as weatherEffects). OFF → PixelOffice renders NO tint rect, pinning the
  // office to the clear midday baseline = maximum status legibility.
  lightingEnabled: typeof window === 'undefined' ? true : (() => {
    try {
      const v = localStorage.getItem('avo.lighting.enabled')
      if (v === null) return !(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        || window.matchMedia?.('(prefers-contrast: more)')?.matches)
      return v !== 'off'
    } catch { return true }
  })(),
  // AVO-122: ambient soundscape on/off. Default OFF (audio is the most intrusive output — opt-in
  // only); forced OFF under prefers-reduced-motion regardless of a stale 'on'. Persisted via a
  // dedicated localStorage key. The ambientSound.js engine subscribes to this flag and creates its
  // AudioContext only inside the toggle-ON user gesture (autoplay-safe). Mirrors initSoundscapeEnabled.
  soundscapeEnabled: typeof window === 'undefined' ? false : (() => {
    try {
      const v = localStorage.getItem('avo.sound.enabled')
      if (v === null) return false
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return false
      return v === 'on'
    } catch { return false }
  })(),
  // #39: ambient office pet (signal-driven barometer). Default ON; persisted via a dedicated
  // localStorage key (same lightweight pattern as weatherEffects). OFF → no pet rendered (zero cost).
  officePet: typeof window === 'undefined' ? true : (() => { try { return localStorage.getItem('office-pet') !== 'off' } catch { return true } })(),
  // #39 types: cosmetic pet skin ('cat' | 'vacuum' | 'dog'). Persisted; cosmetic only (never changes
  // the honest mode logic). Validated against PET_TYPES on read so a junk localStorage value can't
  // select a missing sprite.
  petType: typeof window === 'undefined' ? 'cat' : (() => { try { const v = localStorage.getItem('office-pet-type'); return PET_TYPES.includes(v) ? v : 'cat' } catch { return 'cat' } })(),
  // AVO-123: office theme (lightweight overlay tint). Persisted via a dedicated localStorage key
  // (same pattern as petType/lighting). Validated vs the theme registry; unknown → default.
  theme: typeof window === 'undefined' ? DEFAULT_THEME : (() => { try { const v = localStorage.getItem('avo.theme'); return isValidTheme(v) ? v : DEFAULT_THEME } catch { return DEFAULT_THEME } })(),
  showWorkflow: false,
  // Diagnostic counter: how many times the AgentCharacter RAF watchdog had to restart a
  // stalled walk loop. A silent restart hides the underlying stall; surfacing a count lets
  // dev builds notice if frames are being dropped (tab throttling, HMR, etc.). Transient —
  // never persisted.
  watchdogRestarts: 0,

  // POINT 2: live on-screen scale of the office SVG (the `meet` fit ratio = min(w/800, h/560)).
  // PixelOffice measures it on resize; AgentCharacter reads it to counter-scale name/status
  // labels so glance-text stays readable while the office shrinks. Transient — never persisted
  // (savePersistedState whitelists fields and this is not one), same as watchdogRestarts.
  sceneScale: 1,
  // #47: the ACTIVE office svg viewBox x-bounds in scene units, so BehaviorBubble can clamp speech
  // bubbles to the *visible* edges. Default office = `0 0 800 560` → {minX:0, w:800}; PANEL mode
  // crops to a sub-window (e.g. `80 110 440 440` → {minX:80, w:440}), where a 0..800 clamp would
  // target the wrong edges and let bubbles clip the panel crop. PixelOffice publishes the live
  // bounds; AgentCharacter reads + forwards them. Transient — never persisted.
  sceneBounds: { minX: 0, w: 800 },

  setAgentBehavior: (id, behavior, expression, bubble) =>
    set((s) => {
      const current = s.agents[id]
      if (!current) return s
      const prev = current.behavior
      const nextBubble = bubble || null
      const nextExpression = expression || current.expression
      // Skip the write entirely when behavior + expression + bubble all match the
      // current agent. officeLife's 14:00 drowsiness handler re-sets the SAME
      // behavior (setAgentBehavior(id, s.agents[id].behavior, 'tired', null)) and
      // its 30s revert re-sets behavior again — and the watchdog re-arms behaviors.
      // Without this guard each such call spreads the agent and replaces s.agents,
      // synchronously waking that agent's AgentCharacter subscription for no change.
      if (prev === behavior && current.expression === nextExpression && current.bubble === nextBubble) {
        return s
      }
      // Status is driven only by external integration (hooks), not by organic behaviors
      const agents = {
        ...s.agents,
        [id]: { ...current, behavior, expression: nextExpression, bubble: nextBubble },
      }
      // Log notable behavior changes to activity feed
      if (behavior !== prev && LOGGABLE_BEHAVIORS.has(behavior)) {
        const msg = bubble || behaviorLabel(behavior)
        const entry = mkActivity({ type: 'behavior', agentId: id, message: msg })
        return { agents, activityLog: [entry, ...s.activityLog].slice(0, 50) }
      }
      return { agents }
    }),

  // Group event: lock agent into event behavior + set movement target
  setAgentGroupEvent: (id, { behavior, expression, bubble, groupTarget }) =>
    set((s) => {
      if (!s.agents[id]) return s
      let gt = null
      const claimed = collectClaimedSpots(s.agents, new Set([id]))
      if (groupTarget) {
        // Clamp to floor, then push the target clear of EVERY other agent's claimed
        // standing spot — in-group or not. The old occupied set held only in-group agents,
        // so an event actor could be parked right on a BYSTANDER quietly working at their
        // desk (nightly soak catch 2026-06-10: an event participant standing 23px from a
        // non-participant at dev's chair for the whole event — a full visual stack).
        gt = avoidOverlap(clampToFloor(groupTarget), claimed)
      } else {
        // React-in-place participant (spiller, caller, dog-reactor): if the event happens
        // to FREEZE them mid-transit while visually overlapping someone, give them a short
        // honest side-step instead of locking the stack in for the event's duration.
        // R1-safe: pickParticipants never selects tracked working/blocked agents.
        const myPos = s.agents[id].position
        if (myPos && claimed.some(p => visuallyOverlapping(myPos, p))) {
          gt = avoidOverlap({ x: myPos.x, y: myPos.y }, claimed)
        }
      }
      return {
        agents: {
          ...s.agents,
          [id]: {
            ...s.agents[id],
            behavior, expression, bubble: bubble || null,
            inGroupEvent: true,
            groupTarget: gt,
          },
        },
      }
    }),

  clearAgentGroupEvent: (id) =>
    set((s) => {
      if (!s.agents[id]) return s
      return {
        agents: {
          ...s.agents,
          [id]: { ...s.agents[id], inGroupEvent: false, groupTarget: null },
        },
      }
    }),

  // AVO-106: set/clear the co-editing pair overlay. No-op when unchanged so the renderer doesn't
  // wake on every poll that re-confirms the same pair. Pure overlay — touches nothing but pairLink.
  setPairLink: (link) =>
    set((s) => {
      const cur = s.pairLink
      if (link == null) return cur == null ? s : { pairLink: null }
      if (cur && cur.a === link.a && cur.b === link.b && cur.file === link.file) return s
      return { pairLink: { a: link.a, b: link.b, file: link.file } }
    }),

  clearReturnHomeIntent: (id) =>
    set((s) => {
      const current = s.agents[id]
      if (!current?.returnHomeOnIdle) return s
      return {
        agents: { ...s.agents, [id]: { ...current, returnHomeOnIdle: false } },
      }
    }),

  recordWatchdogRestart: () => set((s) => ({ watchdogRestarts: s.watchdogRestarts + 1 })),

  // POINT 2: store the measured office `meet` scale. No-op when unchanged so resize ticks that
  // re-measure the same value don't wake subscribers (AgentCharacter) for nothing.
  setSceneScale: (scale) => set((s) => (s.sceneScale === scale ? s : { sceneScale: scale })),
  // #47: publish the active viewBox x-bounds; no-op (preserve object identity) when unchanged so
  // subscribers don't re-render on every poll.
  setSceneBounds: (minX, w) => set((s) =>
    (s.sceneBounds.minX === minX && s.sceneBounds.w === w) ? s : { sceneBounds: { minX, w } }),

  // ─── Subagent helper-huddle ───
  // HELPER_TTL = 60s safety window: a missed SubagentStop self-heals via pruneHelpers, so a
  // desk never accumulates stale helpers. The authoritative list is re-sent by the hook each
  // poll (refreshing TTL), so a live SubagentStop removes the helper next tick regardless.
  setHelpers: (list, now = Date.now()) =>
    set(() => {
      // (a) reject entries with an invalid parentRole; (b) de-dupe by id (last wins)
      // so a doubled id never renders twice; (c) cap at 64 after dedup.
      const seen = new Map()
      for (const h of (Array.isArray(list) ? list : [])) {
        if (!h || typeof h.id !== 'string' || typeof h.parentRole !== 'string') continue
        if (!VALID_ROLES.has(h.parentRole)) continue
        seen.set(h.id, h)  // last entry for a given id wins
      }
      const helpers = [...seen.values()]
        .slice(0, 64)  // hard bound — never let a runaway payload balloon the slice
        .map(h => ({
          id: h.id,
          parentRole: h.parentRole,
          label: typeof h.label === 'string' ? h.label : null,
          expiresAt: now + 60_000,
        }))
      return { helpers }
    }),
  pruneHelpers: (now = Date.now()) =>
    set((s) => {
      const kept = s.helpers.filter(h => h.expiresAt > now)
      return kept.length === s.helpers.length ? s : { helpers: kept }
    }),
  clearHelpers: () => set((s) => (s.helpers.length ? { helpers: [] } : s)),

  // Batch version: apply group events to multiple agents in one state update
  setMultipleAgentGroupEvents: (updates) =>
    set((s) => {
      const agents = { ...s.agents }
      // Deconflict gather targets so participants never stack on one cell (the reported "4 agents
      // piled up, one disappeared" — SVG paints opaque sprites in y-order, so an exact overlap fully
      // hides the lower agent). Clamp to floor, then push each target clear of the visual ellipse of
      // (a) every spot already assigned in THIS batch AND (b) every NON-participant's claimed
      // standing spot — the old code seeded `assigned` empty, so a gather formed right on top of a
      // bystander quietly working beside the gather area (same hole as setAgentGroupEvent's, caught
      // by the nightly soak 2026-06-10). One chokepoint covers every gather event.
      const batchIds = new Set(updates.map(u => u.id))
      const assigned = collectClaimedSpots(agents, batchIds)
      for (const { id, behavior, expression, bubble, groupTarget } of updates) {
        if (!agents[id]) continue
        let gt = null
        if (groupTarget) {
          gt = avoidOverlap(clampToFloor(groupTarget), assigned)
          assigned.push(gt)
        } else {
          // React-in-place batch participant: side-step if frozen overlapping someone
          // (mirrors setAgentGroupEvent); either way their spot is CLAIMED so later batch
          // entries can't be assigned on top of them (batch ids are excluded from the
          // outsider seed above — without this push they'd be invisible).
          const myPos = agents[id].position
          if (myPos && assigned.some(p => visuallyOverlapping(myPos, p))) {
            gt = avoidOverlap({ x: myPos.x, y: myPos.y }, assigned)
            assigned.push(gt)
          } else if (myPos) {
            assigned.push(myPos)
          }
        }
        agents[id] = {
          ...agents[id],
          behavior, expression, bubble: bubble || null,
          inGroupEvent: true,
          groupTarget: gt,
        }
      }
      return { agents }
    }),

  clearBubble: (id) =>
    set((s) => {
      const current = s.agents[id]
      if (!current) return s
      // Skip when the bubble is already null. clearBubble is fired from many
      // deferred timers (AgentCharacter's scheduleDeferred, officeLife event
      // cleanup) that often run after the bubble has already been replaced or
      // cleared — an unconditional spread would wake the agent's subscription
      // and replace s.agents for a no-op.
      if (current.bubble === null) return s
      return {
        agents: { ...s.agents, [id]: { ...current, bubble: null } },
      }
    }),

  setAgentTarget: (id, targetPosition, facing) =>
    set((s) => {
      if (!s.agents[id]) return s
      return {
        agents: {
          ...s.agents,
          [id]: { ...s.agents[id], targetPosition, isMoving: true, facing: facing || s.agents[id].facing },
        },
      }
    }),

  // Journey END of a multi-waypoint walk (AVO-156). `targetPosition` only ever holds the
  // CURRENT LEG (a corridor/door node), so other agents' destination pickers were blind to
  // where a walker would actually LAND — two walks could claim the same spot (forensic
  // capture 2026-06-10). AgentCharacter publishes this at every walk start and the abort
  // sites pass null; setAgentArrived clears it on final arrival. Consumed by
  // movementSystem.getOccupiedPositions, never rendered.
  setAgentJourney: (id, journeyTarget) =>
    set((s) => {
      const agent = s.agents[id]
      if (!agent) return s
      // Coordinate-equality no-op guard (NOT reference equality — two {x,y} literals are
      // never ===): repeated publishes of the same dest (e.g. the groupTarget effect
      // re-running) must not re-allocate the agent and wake its subscribers.
      const prev = agent.journeyTarget || null
      const next = journeyTarget || null
      if (prev === next || (prev && next && prev.x === next.x && prev.y === next.y)) return s
      return {
        agents: {
          ...s.agents,
          [id]: { ...agent, journeyTarget: journeyTarget || null },
        },
      }
    }),

  setAgentArrived: (id) =>
    set((s) => {
      if (!s.agents[id]) return s
      return {
        agents: {
          ...s.agents,
          [id]: { ...s.agents[id], isMoving: false, position: { ...s.agents[id].targetPosition }, journeyTarget: null },
        },
      }
    }),

  // Snap the agent onto its current target AND set the next waypoint target in ONE set().
  // A multi-waypoint path fires onWaypointReached on every intermediate point, which used
  // to call setAgentArrived + setAgentTarget back-to-back — two store writes, two full
  // subscriber wake-ups per waypoint. They are a single logical "advance to next leg"
  // transition, so merge them: snap position to the just-reached target, then immediately
  // retarget. One set() spreads the agent once instead of twice.
  advanceAgentWaypoint: (id, nextTarget, facing) =>
    set((s) => {
      const agent = s.agents[id]
      if (!agent) return s
      return {
        agents: {
          ...s.agents,
          [id]: {
            ...agent,
            position: { ...agent.targetPosition },
            targetPosition: nextTarget,
            isMoving: true,
            facing: facing || agent.facing,
          },
        },
      }
    }),

  updateTime: () => {
    set((s) => {
      const now = new Date()
      const next = { hour: now.getHours(), minute: now.getMinutes() }
      // Roll the daily-done ledger over at the local midnight boundary. Without this,
      // the ledger is only rolled inside applyExternalStatus — so if no external status
      // arrives after midnight, PixelOffice's Sprint Kanban (totalDoneToday) and the
      // inspector's "done today" keep summing YESTERDAY's counts until the next hook
      // event. updateTime runs every minute, making the rollover traffic-independent.
      //
      // Detect the rollover by comparing the day KEY directly. ensureCurrentDailyDoneLedger
      // unconditionally allocates a fresh ledger object (it spreads counts + seenEventKeys),
      // so the old `rolled.dayKey !== s.dailyDoneLedger.dayKey` test built and then DISCARDED
      // a full ledger clone every single minute just to read one string off it. getLocalDayKey
      // is a pure string compute — the clone is now built only on the actual day boundary.
      const todayKey = getLocalDayKey(now.getTime())
      if (todayKey !== s.dailyDoneLedger?.dayKey) {
        const agents = {}
        for (const [id, a] of Object.entries(s.agents)) {
          agents[id] = a ? { ...a, deskItemCount: { coffee: 0, sticky: 0, books: 0 } } : a
        }
        return {
          ...next,
          dailyDoneLedger: createDailyDoneLedger(now.getTime()),
          dailyBlockedLedger: createDailyBlockedLedger(now.getTime()),
          agents,
        }
      }
      return next
    })
  },

  setActiveEvent: (event) => set((s) => {
    if (!event) return { activeEvent: event }
    const entry = mkActivity({ type: 'event', agentId: null, message: event.id || event.name || 'event', origin: 'event' })
    return { activeEvent: event, activityLog: [entry, ...s.activityLog].slice(0, 50), eventFeed: pushFeed(s.eventFeed, entry) }
  }),
  // Guard against a no-op clear — clearActiveEvent is called on every officeLife
  // teardown/HMR (releaseAllGroupEvents) and after every event-cleanup timer, often
  // when activeEvent is already null. An unconditional set() still synchronously
  // wakes every activeEvent subscriber (PixelOffice, ControlPanel, ActivityFeed,
  // WhiteboardAnimation). Skip the write when the state would not change.
  clearActiveEvent: () => set((s) => (s.activeEvent === null ? {} : { activeEvent: null })),
  togglePause: () => set((s) => {
    const next = !s.isPaused
    try { if (typeof window !== 'undefined') localStorage.setItem('office-paused', String(next)) } catch {}
    return { isPaused: next }
  }),
  toggleRosterMode: () => set((s) => {
    const next = !s.rosterMode
    try { if (typeof window !== 'undefined') localStorage.setItem('office-view', next ? 'roster' : 'office') } catch {}
    return { rosterMode: next }
  }),
  // #45: flip the weather-animation preference and persist it. 'off' is stored explicitly so the
  // default (no key) reads as ON.
  toggleWeatherEffects: () => set((s) => {
    const next = !s.weatherEffects
    try { if (typeof window !== 'undefined') localStorage.setItem('office-weather', next ? 'on' : 'off') } catch {}
    return { weatherEffects: next }
  }),
  // AVO-111: flip the time-of-day lighting preference and persist it ('off' stored explicitly so a
  // default-absent key reads ON). OFF pins the office to the clear midday baseline (max legibility).
  toggleLighting: () => set((s) => {
    const next = !s.lightingEnabled
    try { if (typeof window !== 'undefined') localStorage.setItem('avo.lighting.enabled', next ? 'on' : 'off') } catch {}
    return { lightingEnabled: next }
  }),
  // AVO-122: flip the ambient-soundscape preference and persist it ('on'/'off'; absent reads OFF).
  // The flag flip runs inside the ControlPanel click handler, so ambientSound.js's store
  // subscription fires synchronously within the user gesture → its AudioContext is autoplay-allowed.
  toggleSoundscape: () => set((s) => {
    const next = !s.soundscapeEnabled
    try { if (typeof window !== 'undefined') localStorage.setItem('avo.sound.enabled', next ? 'on' : 'off') } catch {}
    return { soundscapeEnabled: next }
  }),
  // #39: flip the office-pet preference and persist it ('off' stored explicitly so default reads ON).
  toggleOfficePet: () => set((s) => {
    const next = !s.officePet
    try { if (typeof window !== 'undefined') localStorage.setItem('office-pet', next ? 'on' : 'off') } catch {}
    return { officePet: next }
  }),
  // #39 types: cycle cat → vacuum → dog → cat (cosmetic), persisted.
  cyclePetType: () => set((s) => {
    const next = nextPetType(s.petType)
    try { if (typeof window !== 'undefined') localStorage.setItem('office-pet-type', next) } catch {}
    return { petType: next }
  }),
  // #39 types: select a specific skin (settings popover radiogroup). Validated vs PET_TYPES; persisted.
  setPetType: (type) => set((s) => {
    if (!PET_TYPES.includes(type) || type === s.petType) return s
    try { if (typeof window !== 'undefined') localStorage.setItem('office-pet-type', type) } catch {}
    return { petType: type }
  }),
  // AVO-123: select office theme (settings popover radiogroup). Validated vs the theme registry; persisted.
  setTheme: (id) => set((s) => {
    if (!isValidTheme(id) || id === s.theme) return s
    try { if (typeof window !== 'undefined') localStorage.setItem('avo.theme', id) } catch {}
    return { theme: id }
  }),
  triggerWorkflow: () => set({ showWorkflow: true }),
  endWorkflow: () => set({ showWorkflow: false }),

  // ─── External status integration ───
  externalStatus: {},          // { [agentId]: { status, task, label, expiresAt, reasonCode, activeFile, activeFileAt } }
  // AVO-106: pair-overlay — { a, b, file } when two distinct agents are co-EDITING the byte-identical
  // file (derived by officeLife from externalStatus), else null. PURE OVERLAY: the renderer draws a
  // faint desk-to-desk link; it NEVER moves an agent or touches status/behavior (R1 — a tracked desk
  // is never modulated). Transient (not in the persist whitelist).
  pairLink: null,
  // AVO-117: per-(agentId)(reasonCode) rolling list of blocked-EPISODE timestamps. Transient
  // (savePersistedState whitelists fields and this is not one — like watchdogRestarts/externalStatus);
  // a live-window signal, reset on reload. Drives the recurring-failure sign + notification.
  recurringFailureLog: {},
  hasEverReceivedStatus: false, // true once ANY external status has been applied
  statusSource: 'organic',     // 'organic' | 'external' | 'fallback'
  integrationSource: null,     // e.g. claude-cli | codex-cli | codex-app | webhook
  activeWorkflow: null,        // workflow name for banner display
  tokens: null,                // AVO-108: { ctx, out, model } latest token usage, or null
  effort: null,                // AVO-102: model effort level (low|medium|high|xhigh|max), or null
  integrationHealth: {
    state: 'idle',             // idle | online | degraded | offline
    lastSuccessAt: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
  },
  dailyDoneLedger: validatePersistedDailyDoneLedger(_persisted?.dailyDoneLedger) || createDailyDoneLedger(),
  dailyBlockedLedger: validatePersistedDailyBlockedLedger(_persisted?.dailyBlockedLedger) || createDailyBlockedLedger(),

  applyExternalStatus: (updates, meta = {}) =>
    set((s) => {
      const now = meta.now || Date.now()
      const ext = { ...s.externalStatus }
      const agents = { ...s.agents }
      // Authoritative static roster for the active mode — the SAME source initAgents
      // uses to seed s.agents. This is the only stable way to tell a dynamic worktree
      // agent apart from a static one: dynamic agents may carry session:null (postMessage/
      // hash callers), so the `.session` field cannot be used as the discriminator, and
      // s.agents itself is unreliable because it accumulates dynamic agents from prior calls.
      const staticRosterIds = new Set((characters[s.mode] || characters.agentcortex).map(c => c.id))
      const activities = []
      // Preserve the dailyDoneLedger object identity when this update neither rolls the
      // day nor records a fresh 'done'. ensureCurrentDailyDoneLedger ALWAYS allocates a
      // new object (it spreads counts/seenEventKeys), so the previous unconditional clone
      // gave the store a brand-new `dailyDoneLedger` — and a brand-new `.counts` — on
      // EVERY incoming SSE/poll message, even a pure 'working' tick that touches no
      // counts. That re-fired PixelOffice's `s.dailyDoneLedger?.counts` selector and
      // AgentInspector's `s.dailyDoneLedger` subscription for nothing. Clone-on-write:
      // on a same-day update keep s.dailyDoneLedger by reference until a count is
      // actually about to be incremented (the `if (shouldCount)` branch below clones it).
      const rolledLedger = ensureCurrentDailyDoneLedger(s.dailyDoneLedger, now)
      const rolledBlockedLedger = ensureCurrentDailyBlockedLedger(s.dailyBlockedLedger, now)
      // `dayChanged` triggers when EITHER ledger has rolled (the previously stored
      // dayKey differs from today's). Independent drift defense: if the blocked ledger
      // is somehow stuck on yesterday while done is fresh (or vice versa — only possible
      // via direct setState in tests or future code that touches one without the other),
      // we still roll both atomically and reset desk items. The OR keeps cross-midnight
      // applyExternalStatus correct even when one ledger was touched after midnight
      // before the other had a chance to be updated by updateTime's 60s tick.
      const dayChanged = (
        s.dailyDoneLedger.dayKey !== rolledLedger.dayKey ||
        !s.dailyBlockedLedger || s.dailyBlockedLedger.dayKey !== rolledBlockedLedger.dayKey
      )
      // `dailyDoneLedger` starts as the rolled ledger (a new object) on a day change, or
      // the existing reference on a same-day update. `ledgerMutated` tracks whether the
      // final returned value differs from s.dailyDoneLedger so an unchanged ledger keeps
      // its identity.
      let dailyDoneLedger = dayChanged ? rolledLedger : s.dailyDoneLedger
      let ledgerMutated = dayChanged
      // Parallel clone-on-write for the blocked transition counter. Same `dayChanged`
      // gate above guarantees atomic rollover.
      let dailyBlockedLedger = dayChanged ? rolledBlockedLedger : s.dailyBlockedLedger
      let blockedLedgerMutated = dayChanged
      if (dayChanged) {
        for (const id of Object.keys(agents)) {
          if (agents[id]) agents[id] = { ...agents[id], deskItemCount: { coffee: 0, sticky: 0, books: 0 } }
        }
      }
      // Overflow-slot bookkeeping — computed ONCE before the loop, then maintained
      // incrementally as agents are placed. Recomputing this inside the per-update
      // loop made dynamic-agent creation O(m·n) (m = updates, n = total agents):
      // a multi-session payload of N fresh worktrees was O(N²), scanning every
      // agent N times. A multi-session SSE push with 100 worktrees did 10k inner
      // scans per push. The state below is derived from the SAME `agents` copy the
      // loop mutates, so it stays in sync as each dynamic agent is committed.
      const occupiedSlots = new Set()
      let dynamicAgentCount = 0
      for (const id of Object.keys(agents)) {
        if (staticRosterIds.has(id)) continue
        dynamicAgentCount++
        const a = agents[id]
        // O(1) slot resolution via the prebuilt "x,y"→index map (was an O(slots)
        // findIndex scan per dynamic agent).
        const slot = OVERFLOW_SLOT_BY_XY.get(`${a.position?.x},${a.position?.y}`)
        if (slot !== undefined) occupiedSlots.add(slot)
      }

      // AVO-117: accumulate blocked-episode timestamps across this payload's updates.
      let rfLog = s.recurringFailureLog || {}
      // AVO-143: track whether ANY agent entry was actually reassigned this update.
      // A pure poll re-apply (same status/task on every agent) keeps every per-agent
      // object identity AND the top-level s.agents identity, so per-agent subscribers
      // and Object-level selectors stop re-firing every tick. dayChanged already
      // reassigned every entry above, so it seeds the flag.
      let agentsMutated = dayChanged
      for (const u of updates) {
        const previousStatus = ext[u.agentId]?.status || agents[u.agentId]?.status || 'idle'
        let createdThisUpdate = false
        if (!agents[u.agentId]) {
          // Dynamic worktree agent — clone base role's visual style, place in overflow spot
          const baseRole = u.agentId.includes('~') ? u.agentId.split('~').pop() : u.agentId
          // Visual-style donor: the matching static role, then 'dev', then ANY static
          // roster agent. The final fallback matters for non-agentcortex modes: the
          // 'lightweight' roster is planner/worker/checker, so a fallback-count or hash
          // message routed to a VALID_ROLES id ('dev', 'qa', …) finds neither s.agents
          // [baseRole] nor s.agents['dev'] — without an any-roster fallback the agent was
          // silently dropped and a '#count=N' hash did nothing in lightweight mode.
          const baseAgent = s.agents[baseRole] || s.agents['dev']
            || Object.values(s.agents).find(a => a && !a.session) || null
          if (!baseAgent) continue
          // Place the agent in the LOWEST overflow slot not already occupied by another
          // dynamic agent. `occupiedSlots` is the pre-loop scan kept in sync below, so
          // a position collision is structurally impossible regardless of create/remove
          // order — equivalent to the old per-update rescan but without its O(n²) cost.
          let overflowIdx = 0
          while (overflowIdx < OVERFLOW_POSITIONS.length && occupiedSlots.has(overflowIdx)) overflowIdx++
          // All slots full — wrap deterministically by dynamic-agent count so overflow
          // beyond OVERFLOW_POSITIONS.length still spreads instead of pinning to slot 0.
          if (overflowIdx >= OVERFLOW_POSITIONS.length) {
            overflowIdx = dynamicAgentCount % OVERFLOW_POSITIONS.length
          }
          const pos = { ...OVERFLOW_POSITIONS[overflowIdx] }
          // Commit this placement into the incremental bookkeeping so the NEXT new
          // agent in this same payload sees the slot as taken.
          if (overflowIdx < OVERFLOW_POSITIONS.length) occupiedSlots.add(overflowIdx)
          dynamicAgentCount++
          agents[u.agentId] = {
            ...baseAgent,
            id: u.agentId,
            session: u.session || null,
            position: { ...pos },
            targetPosition: { ...pos },
            isMoving: false,
            status: 'idle',
            returnHomeOnIdle: false,
            bubble: null,
            inGroupEvent: false,
            // Fresh, OWN deskItemCount — `...baseAgent` would otherwise (a) seed the
            // dynamic agent with the base role's accumulated growth (e.g. inherit dev's
            // 5 coffee cups at spawn) and (b) ALIAS the same object reference, so a
            // pre-first-growth mutation of one would silently affect the other. Each
            // worktree agent is a distinct worker and must start its desk empty.
            deskItemCount: { coffee: 0, sticky: 0, books: 0 },
            groupTarget: null,
          }
          createdThisUpdate = true
          agentsMutated = true
        }
        // AVO-184: buildExtEntry owns the externalStatus entry + sigChanged (byte-identical to the
        // prior inline build; full rationale in its module-scope doc). prevExt stays in scope below
        // for isNewBlockedEpisode.
        const prevExt = ext[u.agentId]
        const { entry: extEntry, sigChanged } = buildExternalStatusEntry(prevExt, u, now)
        ext[u.agentId] = extEntry
        // AVO-117: record a blocked EPISODE only on a real edge (pure isNewBlockedEpisode owns the
        // rule: transition INTO blocked from a non-blocked-family state, or a reason-change while
        // blocked, with a SPECIFIC reason). A poll re-read OR an idle-gap blocked↔awaiting-approval
        // flap of the SAME stuck state does NOT increment — no false recurrence (EPISODE-EDGE).
        if (isNewBlockedEpisode(prevExt, { status: u.status, reasonCode: u.reasonCode })) {
          rfLog = recordEpisode(rfLog, { agentId: u.agentId, reasonCode: u.reasonCode, now })
        }
        // Immediately set behavior + expression to match work status. Behavior/
        // expression/bubble are all folded into a SINGLE object spread below —
        // the previous code re-spread agents[u.agentId] up to three times per
        // update (status, then bubble, then deskItemCount), allocating three
        // objects where one suffices.
        // Don't overwrite behavior/expression during group events (officeLife controls those)
        const prevAgent = agents[u.agentId]
        const inGroup = prevAgent.inGroupEvent
        // AVO-184: resolveAgentVisual owns behavior/expression resolution (decideBehavior +
        // STATUS_BEHAVIOR_MAP expression + the inGroup guard); byte-identical, see its module doc.
        // AVO-143: on a pure poll re-apply these resolve to the agent's CURRENT values, so the no-op
        // guard below can skip the re-allocation entirely and keep the agent's identity (no re-render).
        const { nextBehavior, nextExpression } = resolveAgentVisual(u, s.activeWorkflow, prevAgent, inGroup)
        if (
          !createdThisUpdate && !dayChanged && !sigChanged &&
          u.status === prevAgent.status &&
          nextBehavior === prevAgent.behavior &&
          nextExpression === prevAgent.expression
        ) {
          continue
        }
        agentsMutated = true
        const nextAgent = {
          ...prevAgent,
          status: u.status,
          behavior: nextBehavior,
          expression: nextExpression,
        }
        // Bubble fires only on a REAL status/task change (sigChanged) — NOT on every poll re-apply.
        // A status file re-written each tick (changed timestamp/seq/expiry but SAME status+task) passes
        // transport dedup and re-runs this; without the guard, every active agent re-popped a fresh
        // bubble at once → the reported "every character suddenly speaks for no reason / refresh feel".
        // Same principle as `changedAt` above (cf. the earlier 0s-everywhere fix). An unchanged re-apply
        // now keeps the prior bubble, which clears on its own doSchedule timer.
        if (sigChanged && !inGroup) {
          const bubble = generateContextBubble(u.agentId, u, ext)
            || _storeFallbackBubble(u.agentId, u.status)
          if (bubble) nextAgent.bubble = bubble
        }
        agents[u.agentId] = nextAgent
        // Log activity inline (single loop instead of two). Tag origin so the feed can trust it:
        // idle-gap-inferred statuses are heuristic (not real hook events) → 'inferred'.
        // sigChanged guard: only log on a REAL status/task change, not on every poll re-apply — else a
        // persisting `blocked`/`done` (re-written each tick with a new timestamp) floods the feed with
        // duplicate entries (the activity→eventFeed path prepends without dedup). Same class as the bubble fix.
        if (sigChanged && (u.status === 'done' || u.status === 'blocked' || (u.status === 'working' && u.label))) {
          activities.push(mkActivity({
            type: 'status', agentId: u.agentId, status: u.status, message: u.label || u.status,
            origin: meta.source === 'idle-gap-infer' ? 'inferred' : 'hook',
          }))
        }
        if (u.status === 'done') {
          const eventKey = buildDoneEventKey(u, meta)
          const isFreshDoneTransition = previousStatus !== 'done'
          const isUnseenEvent = eventKey ? !dailyDoneLedger.seenEventKeys.includes(eventKey) : true
          const shouldCount = isFreshDoneTransition && isUnseenEvent

          if (shouldCount) {
            // Clone-on-write: the FIRST counted 'done' in this update upgrades
            // `dailyDoneLedger` from the shared s.dailyDoneLedger reference to a fresh
            // object (with fresh `counts`) so the in-place increments below never mutate
            // store state. Subsequent counted dones in the same update reuse the clone.
            if (!ledgerMutated) {
              dailyDoneLedger = {
                dayKey: dailyDoneLedger.dayKey,
                counts: { ...dailyDoneLedger.counts },
                seenEventKeys: [...dailyDoneLedger.seenEventKeys],
              }
              ledgerMutated = true
            }
            dailyDoneLedger.counts[u.agentId] = (dailyDoneLedger.counts[u.agentId] || 0) + 1
            if (eventKey) {
              dailyDoneLedger.seenEventKeys = [...dailyDoneLedger.seenEventKeys, eventKey].slice(-500)
            }
            // Growth system: accumulate desk items on fresh, deduplicated done events.
            // `nextAgent` is the fresh per-update clone created above and is owned by
            // this iteration — mutate its deskItemCount in place instead of re-spreading
            // the whole agent a fourth time.
            const baseRole = u.agentId.includes('~') ? u.agentId.split('~').pop() : u.agentId
            const growthItem = ROLE_GROWTH_ITEMS[baseRole] || 'coffee'
            const count = { ...nextAgent.deskItemCount }
            count[growthItem] = (count[growthItem] || 0) + 1
            nextAgent.deskItemCount = count
          }
        } else if (u.status === 'blocked') {
          // Transition counter: only the first 'blocked' tick in a contiguous run counts.
          // Two consecutive blocked updates from polling/SSE for the same stuck tool call
          // should not double-count. No eventKey dedup — blocked has no PostToolUse-style
          // anchor to key on, and a same-call working↔blocked flap is rare enough that the
          // simpler transition rule is acceptable.
          if (previousStatus !== 'blocked') {
            if (!blockedLedgerMutated) {
              dailyBlockedLedger = {
                dayKey: dailyBlockedLedger.dayKey,
                counts: { ...dailyBlockedLedger.counts },
              }
              blockedLedgerMutated = true
            }
            dailyBlockedLedger.counts[u.agentId] = (dailyBlockedLedger.counts[u.agentId] || 0) + 1
          }
        }
      }
      // Multi-session reconciliation: scanAndMerge emits the COMPLETE set of active
      // worktree agents on every tick. When a worktree session ends, its composite
      // 'slug~role' agent simply stops appearing in the payload — nothing else signals
      // its departure. Without reconciliation, that dynamic agent lingers as a phantom
      // worker for up to its 5-min expiresAt window. So on a multi-session update, drop
      // any dynamic (session-carrying) agent that this payload no longer includes.
      // Scoped to source==='multi-session' only: single-session and external channels
      // legitimately deliver one agent at a time and must NOT evict the others.
      let evictedSelected = false
      if (meta.source === 'multi-session') {
        const present = new Set(updates.map(u => u.agentId))
        const evicted = []
        for (const id of Object.keys(agents)) {
          const a = agents[id]
          // A dynamic agent is identified solely by a non-null `session` slug — only
          // applyExternalStatus's dynamic-creation branch ever sets that field; static
          // roster agents (initAgents) never have it. The agent may have been created in
          // a PRIOR applyExternalStatus call (so it now lives in s.agents too) — that is
          // exactly the case we must reconcile, so do not gate on s.agents membership.
          if (a && a.session && !present.has(id)) {
            delete agents[id]
            delete ext[id]
            agentsMutated = true
            evicted.push(id)
            // If the inspector had this now-deleted dynamic agent selected, the id would
            // dangle forever: AgentInspector renders nothing (its `agent` lookup is null)
            // but selectedAgent stays set, so a future click on the SAME id toggles the
            // panel off instead of open. Drop the selection when its target is evicted.
            if (s.selectedAgent === id) evictedSelected = true
          }
        }
        // AVO-180: prune transient per-agent MODULE state for evicted dynamic agents so these Maps
        // don't grow unbounded across many short-lived worktree sessions (mirrors idleGapInfer's
        // eviction prune). rfLog is cloned before deleting so we never mutate an already-published
        // recurringFailureLog object held by a prior subscriber.
        if (evicted.length > 0) {
          let rfCloned = false
          for (const id of evicted) {
            pruneRecentPicks(id)
            _storeRecentPicks.delete(id)
            if (rfLog[id]) {
              if (!rfCloned) { rfLog = { ...rfLog }; rfCloned = true }
              delete rfLog[id]
            }
          }
        }
      }
      const log = activities.length > 0
        ? [...activities, ...s.activityLog].slice(0, 50)
        : s.activityLog
      // Feed buffer: status activities are all hook/inferred origin (feed-worthy) → keep them in the
      // separate eventFeed where organic theater can't evict them.
      const feedLog = activities.length > 0
        ? [...activities.filter((a) => FEED_ORIGINS.has(a.origin)), ...s.eventFeed].slice(0, 30)
        : s.eventFeed
      // AVO-184: assembleIntegrationPatch owns the integration-channel field writes (statusSource /
      // integrationSource / activeWorkflow), coalesced into THIS single set() so one incoming message
      // wakes subscribers once (zustand fires listeners synchronously per set(), independent of React
      // 18 batching). Byte-identical; full rationale (omit-when-unchanged, clearSourceIfEmpty
      // precedence) lives in its module-scope doc.
      const integrationPatch = assembleIntegrationPatch(s, meta, ext)
      return {
        // AVO-143: when nothing reassigned an agent entry, hand back the ORIGINAL
        // s.agents reference so Object-level subscribers don't re-fire on a pure
        // poll re-apply (the `{ ...s.agents }` working copy is discarded).
        externalStatus: ext, agents: agentsMutated ? agents : s.agents,
        activityLog: log, eventFeed: feedLog, dailyDoneLedger, dailyBlockedLedger,
        recurringFailureLog: rfLog,
        hasEverReceivedStatus: meta.skipHintDismiss ? s.hasEverReceivedStatus : true,
        ...(evictedSelected ? { selectedAgent: null } : {}),
        ...integrationPatch,
      }
    }),

  clearExternalStatus: (agentId) =>
    set((s) => {
      // Reset a static agent to the SAME baseline initAgents seeds: status/behavior 'idle',
      // expression 'normal', no bubble. applyExternalStatus drives behavior+expression from
      // status (typing/scratch-head/thumbs-up + focused/confused/happy); clearing only
      // status/expression left behavior frozen at the work value, producing an inconsistent
      // pair (e.g. behavior:'scratch-head' + expression:'normal') until the next organic
      // tick. It also mirrors applyExternalStatus's inGroup guard: officeLife owns
      // behavior/expression/bubble during a group event, so an external status that
      // expires mid-event must NOT wipe the in-progress meeting animation.
      const resetStaticAgent = (a) => {
        if (a.inGroupEvent) return { ...a, status: 'idle', returnHomeOnIdle: true }
        return { ...a, status: 'idle', behavior: 'idle', expression: 'normal', bubble: null, returnHomeOnIdle: true }
      }
      // Authoritative dynamic/static discriminator — the SAME one applyExternalStatus uses.
      // A `.session` check alone is wrong: a fallback-count or hash message routes to a
      // VALID_ROLES id ('dev', 'qa', …) with session:null, but in a non-agentcortex mode
      // (e.g. 'lightweight' = planner/worker/checker) such an id is NOT in the roster, so
      // applyExternalStatus spawns it as a DYNAMIC overflow agent. If clearExternalStatus
      // keyed only on `.session` it would treat that agent as static and merely idle it —
      // leaving a phantom overflow character lingering forever. Anything outside the static
      // roster is dynamic and must be DELETED on clear, regardless of `.session`.
      const staticRosterIds = new Set((characters[s.mode] || characters.agentcortex).map(c => c.id))
      const isDynamic = (id, a) => Boolean(a && a.session) || !staticRosterIds.has(id)
      // Drop a dangling inspector selection when its target dynamic agent is deleted —
      // a deleted id left in selectedAgent makes a future same-id click toggle the
      // panel off instead of open (see applyExternalStatus reconciliation for the
      // matching guard).
      if (agentId) {
        const ext = { ...s.externalStatus }
        delete ext[agentId]
        const agents = { ...s.agents }
        let evictedSelected = false
        if (agents[agentId]) {
          // Dynamic agents disappear when they expire; static roster agents go idle.
          if (isDynamic(agentId, agents[agentId])) {
            delete agents[agentId]
            if (s.selectedAgent === agentId) evictedSelected = true
          } else {
            agents[agentId] = resetStaticAgent(agents[agentId])
          }
        }
        const selectionPatch = evictedSelected ? { selectedAgent: null } : {}
        if (Object.keys(ext).length === 0) {
          // Office went quiet → reset L2 scalars (updateStoreMood is NOT called on clear, so the
          // anchor would otherwise stay pinned in an idle office).
          return { externalStatus: ext, agents, statusSource: 'organic', integrationSource: null, activeWorkflow: null, teamPulse: 0, focusAnchor: null, reluctant: {}, ...selectionPatch }
        }
        return { externalStatus: ext, agents, ...selectionPatch }
      }
      // Clear all
      const agents = { ...s.agents }
      let evictedSelected = false
      for (const id of Object.keys(s.externalStatus)) {
        if (agents[id]) {
          if (isDynamic(id, agents[id])) {
            delete agents[id]
            if (s.selectedAgent === id) evictedSelected = true
          } else {
            agents[id] = resetStaticAgent(agents[id])
          }
        }
      }
      return {
        externalStatus: {}, agents, statusSource: 'organic', integrationSource: null, activeWorkflow: null,
        teamPulse: 0, focusAnchor: null, reluctant: {},
        ...(evictedSelected ? { selectedAgent: null } : {}),
      }
    }),

  // ─── Mood system ───
  mood: 'normal',  // normal | rushing | frustrated | stuck | smooth | intense | idle (transient, not persisted)
  setMood: (mood) => set({ mood }),

  // ─── L2 derived team-affect (spec living-office-events.md; transient, NOT persisted) ───
  // Set only by moodEngine.updateStoreMood. UNTRACKED agents use these to honestly reflect the
  // 1-2 lit desks' real activity; a TRACKED agent is never modulated by them (enforced at the
  // doSchedule call site, R1). Reset to 0/null when the external-status set empties (below).
  teamPulse: 0,        // 0..1 real-signal density — the room "leans in" proportionally
  focusAnchor: null,   // agentId of the hottest live desk — idle agents orient toward it
  setTeamSignals: ({ teamPulse, focusAnchor }) => set((s) =>
    (s.teamPulse === teamPulse && s.focusAnchor === focusAnchor) ? {} : { teamPulse, focusAnchor }
  ),
  // The ONLY path that sets `facing` without a walk (today facing is a walk side-effect only).
  // Guarded: never fight movement/group events, and no-op when unchanged (idle-only orientation).
  setAgentFacing: (id, dir) => set((s) => {
    const a = s.agents[id]
    if (!a || a.isMoving || a.inGroupEvent || a.facing === dir) return {}
    return { agents: { ...s.agents, [id]: { ...a, facing: dir } } }
  }),

  // ─── L3 reluctant participant (spec living-office-events.md Phase 3; transient, NOT persisted) ───
  // When a set-piece fires, a TRACKED (working/blocked) agent that is NOT in the scene becomes a
  // brief "reluctant participant": a sub-dominant glance/⏳ tell shows the team's life happening
  // AROUND it while it stays heads-down. This is a PURE OVERLAY keyed by a per-agent expiry
  // timestamp — it NEVER touches status/behavior/bubble/position, so it cannot freeze or falsify a
  // real desk (R1). Map: { [agentId]: untilTs }.
  reluctant: {},
  setReluctant: (ids, until) => set((s) => {
    const next = { ...s.reluctant }
    let changed = false
    for (const id of ids) {
      const a = s.agents[id]
      const es = s.externalStatus[id]
      // Only a genuinely-working/blocked, non-group agent can be "reluctant" (it has real work to be
      // torn from). Never an idle/done/untracked agent (nothing to be reluctant about).
      if (a && !a.inGroupEvent && es && (es.status === 'working' || es.status === 'blocked')) {
        next[id] = until
        changed = true
      }
    }
    return changed ? { reluctant: next } : {}
  }),
  clearReluctant: () => set((s) => (Object.keys(s.reluctant).length ? { reluctant: {} } : {})),

  // Same-value guards on the integration-channel setters. setActiveWorkflow is
  // still called standalone from applyMessage's workflow-only branch (a workflow-
  // only hash); a repeated identical workflow string would otherwise wake every
  // activeWorkflow subscriber (PixelOffice banner, AgentInspector) for no change.
  // setStatusSource/setIntegrationSource are folded into applyExternalStatus for
  // the hot SSE/poll path but remain exported for direct callers — guard them too.
  setStatusSource: (source) => set((s) => (s.statusSource === source ? {} : { statusSource: source })),
  setIntegrationSource: (source) =>
    set((s) => {
      const next = source || null
      return s.integrationSource === next ? {} : { integrationSource: next }
    }),
  setActiveWorkflow: (name) =>
    set((s) => {
      const next = name ?? null
      return s.activeWorkflow === next ? {} : { activeWorkflow: next }
    }),
  // AVO-108: presence-update — callers only pass a non-null token object, so a turn with no
  // fresh read (Stop, external channels) leaves the last value intact. No-op on equal values
  // to avoid waking subscribers when ctx/out/model are unchanged.
  setTokens: (t) =>
    set((s) => {
      if (!t) return {}
      const cur = s.tokens
      if (cur && cur.ctx === t.ctx && cur.out === t.out && cur.model === t.model) return {}
      return { tokens: t }
    }),
  // AVO-102: presence-update effort level (no-op on unchanged value to avoid waking subscribers).
  setEffort: (level) =>
    set((s) => (!level || s.effort === level ? {} : { effort: level })),
  markIntegrationProbe: ({ ok }) =>
    set((s) => {
      const h = s.integrationHealth
      // Cap at 3 so once 'offline' is reached, further failures are no-ops (no re-render).
      const failures = ok ? 0 : Math.min(h.consecutiveFailures + 1, 3)
      const nextState = ok ? 'online' : (failures >= 3 ? 'offline' : 'degraded')
      // Skip update when nothing material changed — avoids re-rendering ControlPanel on
      // every SSE event or every failed probe once the server is already offline.
      if (nextState === h.state && failures === h.consecutiveFailures) return {}
      const now = Date.now()
      return {
        integrationHealth: {
          state: nextState,
          lastSuccessAt: ok ? now : h.lastSuccessAt,
          lastErrorAt: ok ? h.lastErrorAt : now,
          consecutiveFailures: failures,
        },
      }
    }),

  // Handoff animation state
  handoffs: [],
  // `opts.subtle: true` — request the calmer visual variant used by AVO-105
  // workflow handoffs (no sparkle trail, reduced rotation, no scale pulse).
  // Organic handoffs (officeLife's pass-document behavior) leave it undefined
  // and keep the original flashier animation.
  addHandoff: (from, to, opts = {}) =>
    set((s) => {
      const entry = {
        id: ++_handoffId,
        from,
        to,
        startTime: Date.now(),
        subtle: !!opts.subtle,
      }
      const next = [...s.handoffs, entry]
      // Also record the handoff in the activity feed — it's the cross-agent "A→B" moment the
      // feed otherwise can't show (handoffs were never logged before). Workflow handoffs
      // (opts.subtle, real phase transitions) are feed-worthy → 'event'; organic pass-document
      // theater stays 'organic' so it doesn't flood the feed.
      const act = mkActivity({
        type: 'handoff', agentId: from, from, to, message: `${from}→${to}`,
        origin: opts.subtle ? 'event' : 'organic',
      })
      return {
        handoffs: next.length > 20 ? next.slice(-20) : next,
        activityLog: [act, ...s.activityLog].slice(0, 50),
        eventFeed: pushFeed(s.eventFeed, act),
      }
    }),
  removeHandoff: (id) =>
    set((s) => ({
      handoffs: s.handoffs.filter(h => h.id !== id),
    })),

  // ─── Activity Log (for Activity Feed) ───
  activityLog: [],  // [{ id, timestamp, type, agentId, message, origin }] — ALL events (incl. organic)
  // Separate bounded buffer of FEED-WORTHY events only (hook/event/inferred). The roster feed reads
  // THIS, so the organic theater flooding activityLog can never evict a real event before it shows.
  eventFeed: [],

  // ─── Selected agent for inspect popover ───
  selectedAgent: null,
  setSelectedAgent: (id) => set((s) => ({ selectedAgent: s.selectedAgent === id ? null : id })),
  clearSelectedAgent: () => set({ selectedAgent: null }),
}))

// ─── Register custom name resolver for i18n ───
setNameResolver((charId) => _customProfiles[charId]?.name || null)

// ─── Auto-persist on state changes (throttled) ───
let _persistTimer = null
const _unsubscribePersist = useOfficeStore.subscribe(() => {
  if (_persistTimer) return
  _persistTimer = setTimeout(() => {
    _persistTimer = null
    savePersistedState(useOfficeStore.getState())
  }, 2000)
})

// HMR: drop the pending persist timer AND the subscription on hot-replacement so an
// orphaned timer doesn't fire against a stale closure and a duplicate subscription
// doesn't accumulate (each HMR cycle would otherwise add another live subscriber).
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null }
    _unsubscribePersist()
    if (_storageHandler && typeof window !== 'undefined') {
      window.removeEventListener('storage', _storageHandler)
      _storageHandler = null
    }
  })
}

// ─── Cross-tab pause sync ───
// Keep a module-scope reference so the HMR dispose path can remove it.
// Without this, each HMR cycle re-registers a NEW listener while the old
// one remains live — duplicate listeners accumulate and fire redundantly.
let _storageHandler = null
if (typeof window !== 'undefined') {
  _storageHandler = (e) => {
    if (e.key === 'office-paused') {
      const paused = e.newValue === 'true'
      if (useOfficeStore.getState().isPaused !== paused) {
        useOfficeStore.setState({ isPaused: paused })
      }
    }
  }
  window.addEventListener('storage', _storageHandler)
}
