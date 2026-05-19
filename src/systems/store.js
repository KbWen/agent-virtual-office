import { create } from 'zustand'
import characters from '../config/characters.json'
import { HOME_POSITIONS, OVERFLOW_POSITIONS, OVERFLOW_SLOT_BY_XY } from './movementSystem.js'
import { randomBubble, setNameResolver, behaviorLabel } from '../i18n'
import { generateContextBubble } from './contextBubble'
import { detectProjectMode } from './platformDetect'
import { STATUS_COLORS } from './constants.js'

export { STATUS_COLORS }

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
  }
  for (const [id, a] of Object.entries(state.agents)) {
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
function mkActivity(entry) {
  return { id: ++_activityId, timestamp: Date.now(), ...entry }
}

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

// Static lookup tables for applyExternalStatus — hoisted to module scope so they
// are NOT reallocated on every update inside the per-update loop. behaviorMap maps
// a work status to its visual behavior/expression; roleItems maps a base role to
// the desk item its growth accumulates. Both are pure constants.
const STATUS_BEHAVIOR_MAP = {
  working: { behavior: { Bash: 'typing', Read: 'reading-screen', Grep: 'research', Glob: 'research' }, expression: 'focused' },
  blocked: { behavior: 'scratch-head', expression: 'confused' },
  done:    { behavior: 'thumbs-up', expression: 'happy' },
}
const ROLE_GROWTH_ITEMS = {
  pm: 'sticky', arch: 'books', dev: 'coffee',
  qa: 'sticky', ops: 'coffee', res: 'books',
  gate: 'sticky', designer: 'sticky',
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
  reducedMotion: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false,
  showWorkflow: false,

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
      return {
        agents: {
          ...s.agents,
          [id]: {
            ...s.agents[id],
            behavior, expression, bubble: bubble || null,
            inGroupEvent: true,
            groupTarget: groupTarget || null,
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

  // Batch version: apply group events to multiple agents in one state update
  setMultipleAgentGroupEvents: (updates) =>
    set((s) => {
      const agents = { ...s.agents }
      for (const { id, behavior, expression, bubble, groupTarget } of updates) {
        if (!agents[id]) continue
        agents[id] = {
          ...agents[id],
          behavior, expression, bubble: bubble || null,
          inGroupEvent: true,
          groupTarget: groupTarget || null,
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

  setAgentArrived: (id) =>
    set((s) => {
      if (!s.agents[id]) return s
      return {
        agents: {
          ...s.agents,
          [id]: { ...s.agents[id], isMoving: false, position: { ...s.agents[id].targetPosition } },
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
        return { ...next, dailyDoneLedger: createDailyDoneLedger(now.getTime()), agents }
      }
      return next
    })
  },

  setActiveEvent: (event) => set((s) => {
    if (!event) return { activeEvent: event }
    const entry = mkActivity({ type: 'event', agentId: null, message: event.id || event.name || 'event' })
    return { activeEvent: event, activityLog: [entry, ...s.activityLog].slice(0, 50) }
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
  triggerWorkflow: () => set({ showWorkflow: true }),
  endWorkflow: () => set({ showWorkflow: false }),

  // ─── External status integration ───
  externalStatus: {},          // { [agentId]: { status, task, label, expiresAt } }
  hasEverReceivedStatus: false, // true once ANY external status has been applied
  statusSource: 'organic',     // 'organic' | 'external' | 'fallback'
  integrationSource: null,     // e.g. claude-cli | codex-cli | codex-app | webhook
  activeWorkflow: null,        // workflow name for banner display
  integrationHealth: {
    state: 'idle',             // idle | online | degraded | offline
    lastSuccessAt: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
  },
  dailyDoneLedger: validatePersistedDailyDoneLedger(_persisted?.dailyDoneLedger) || createDailyDoneLedger(),

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
      const dayChanged = s.dailyDoneLedger.dayKey !== rolledLedger.dayKey
      // `dailyDoneLedger` starts as the rolled ledger (a new object) on a day change, or
      // the existing reference on a same-day update. `ledgerMutated` tracks whether the
      // final returned value differs from s.dailyDoneLedger so an unchanged ledger keeps
      // its identity.
      let dailyDoneLedger = dayChanged ? rolledLedger : s.dailyDoneLedger
      let ledgerMutated = dayChanged
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

      for (const u of updates) {
        const previousStatus = ext[u.agentId]?.status || agents[u.agentId]?.status || 'idle'
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
        }
        ext[u.agentId] = {
          status: u.status,
          task: u.task,
          label: u.label,
          hint: u.hint || null,
          // working/blocked: 5 min expiry — long-running tool calls (build, test suite, npm install)
          // can take >30s with no hook event between PreToolUse and PostToolUse; a shorter
          // expiry caused the workflow banner to flicker off mid-run and then self-heal.
          // done: 10s expiry (brief celebration then back to idle)
          expiresAt: u.status === 'done' ? now + 10000 : now + 300000,
        }
        // Immediately set behavior + expression to match work status. Behavior/
        // expression/bubble are all folded into a SINGLE object spread below —
        // the previous code re-spread agents[u.agentId] up to three times per
        // update (status, then bubble, then deskItemCount), allocating three
        // objects where one suffices.
        const bm = STATUS_BEHAVIOR_MAP[u.status] || {}
        // working maps task→behavior via a sub-table; non-working statuses use a
        // scalar behavior. Default to 'typing' when a working task has no entry.
        const bmBehavior = u.status === 'working'
          ? (bm.behavior[u.task] || 'typing')
          : bm.behavior
        // Don't overwrite behavior/expression during group events (officeLife controls those)
        const prevAgent = agents[u.agentId]
        const inGroup = prevAgent.inGroupEvent
        // Context-aware bubble > status pool fallback
        const bubble = generateContextBubble(u.agentId, u, ext)
          || randomBubble(u.status === 'blocked' ? 'blocked-status' : u.status === 'done' ? 'done-status' : 'working-status')
        const nextAgent = {
          ...prevAgent,
          status: u.status,
          behavior: inGroup ? prevAgent.behavior : (bmBehavior || prevAgent.behavior),
          expression: inGroup ? prevAgent.expression : (bm.expression || prevAgent.expression),
        }
        if (bubble && !inGroup) nextAgent.bubble = bubble
        agents[u.agentId] = nextAgent
        // Log activity inline (single loop instead of two)
        if (u.status === 'done' || u.status === 'blocked' || (u.status === 'working' && u.label)) {
          activities.push(mkActivity({ type: 'status', agentId: u.agentId, status: u.status, message: u.label || u.status }))
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
            // If the inspector had this now-deleted dynamic agent selected, the id would
            // dangle forever: AgentInspector renders nothing (its `agent` lookup is null)
            // but selectedAgent stays set, so a future click on the SAME id toggles the
            // panel off instead of open. Drop the selection when its target is evicted.
            if (s.selectedAgent === id) evictedSelected = true
          }
        }
      }
      const log = activities.length > 0
        ? [...activities, ...s.activityLog].slice(0, 50)
        : s.activityLog
      // Coalesce the integration-channel field writes into THIS single set().
      // applyMessage previously called applyExternalStatus + setStatusSource +
      // setIntegrationSource + setActiveWorkflow as four separate store writes,
      // each waking every subscriber (zustand fires listeners synchronously per
      // set(), independent of React 18 batching). They always change together for
      // one incoming message, so fold them in here — one set(), one wake-up.
      // Each is applied only when meta carries it AND the value actually differs,
      // so an unchanged field is omitted (no spurious invalidation).
      const integrationPatch = {}
      // clearSourceIfEmpty (multi-session empty payload): when this eviction leaves
      // zero external agents, the integration channel went silent — revert to 'organic'
      // here rather than in a follow-up store write. Takes precedence over meta.statusSource.
      const revertToOrganic = meta.clearSourceIfEmpty && Object.keys(ext).length === 0
      if (revertToOrganic) {
        if (s.statusSource !== 'organic') integrationPatch.statusSource = 'organic'
        if (s.integrationSource !== null) integrationPatch.integrationSource = null
      } else {
        if (meta.statusSource !== undefined && meta.statusSource !== s.statusSource) {
          integrationPatch.statusSource = meta.statusSource
        }
        if (meta.integrationSource !== undefined && (meta.integrationSource || null) !== s.integrationSource) {
          integrationPatch.integrationSource = meta.integrationSource || null
        }
      }
      if (meta.hasWorkflow && (meta.workflow ?? null) !== s.activeWorkflow) {
        integrationPatch.activeWorkflow = meta.workflow ?? null
      }
      return {
        externalStatus: ext, agents, activityLog: log, dailyDoneLedger,
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
        if (a.inGroupEvent) return { ...a, status: 'idle' }
        return { ...a, status: 'idle', behavior: 'idle', expression: 'normal', bubble: null }
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
          return { externalStatus: ext, agents, statusSource: 'organic', integrationSource: null, activeWorkflow: null, ...selectionPatch }
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
        ...(evictedSelected ? { selectedAgent: null } : {}),
      }
    }),

  // ─── Mood system ───
  mood: 'normal',  // normal | rushing | frustrated | stuck | smooth | intense | idle (transient, not persisted)
  setMood: (mood) => set({ mood }),

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
  addHandoff: (from, to) =>
    set((s) => {
      const next = [...s.handoffs, { id: ++_handoffId, from, to, startTime: Date.now() }]
      return { handoffs: next.length > 20 ? next.slice(-20) : next }
    }),
  removeHandoff: (id) =>
    set((s) => ({
      handoffs: s.handoffs.filter(h => h.id !== id),
    })),

  // ─── Activity Log (for Activity Feed) ───
  activityLog: [],  // [{ id, timestamp, type, agentId, message }]

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
  })
}

// ─── Cross-tab pause sync ───
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'office-paused') {
      const paused = e.newValue === 'true'
      if (useOfficeStore.getState().isPaused !== paused) {
        useOfficeStore.setState({ isPaused: paused })
      }
    }
  })
}
