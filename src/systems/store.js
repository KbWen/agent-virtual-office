import { create } from 'zustand'
import characters from '../config/characters.json'
import { HOME_POSITIONS, OVERFLOW_POSITIONS } from './movementSystem'
import { randomBubble, setNameResolver, behaviorLabel } from '../i18n'
import { generateContextBubble } from './contextBubble'
import { detectProjectMode } from './platformDetect'
import { STATUS_COLORS } from './constants'

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

function isValidPosition(pos) {
  return pos && typeof pos.x === 'number' && typeof pos.y === 'number'
    && isFinite(pos.x) && isFinite(pos.y)
}

function validatePersistedAgent(saved) {
  if (!saved) return null
  return {
    // status is NOT persisted — always starts as 'idle', driven by external hooks
    behavior: typeof saved.behavior === 'string' ? saved.behavior : undefined,
    expression: typeof saved.expression === 'string' ? saved.expression : undefined,
    deskItemCount: saved.deskItemCount && typeof saved.deskItemCount === 'object' ? saved.deskItemCount : undefined,
    position: isValidPosition(saved.position) ? saved.position : undefined,
    facing: VALID_FACINGS.has(saved.facing) ? saved.facing : undefined,
  }
}

function validatePersistedDailyDoneLedger(saved) {
  if (!saved || typeof saved !== 'object') return null
  const dayKey = typeof saved.dayKey === 'string' ? saved.dayKey : null
  if (!dayKey) return null

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

// Behaviors worth logging to the activity feed (skip mundane ones like idle)
const LOGGABLE_BEHAVIORS = new Set([
  'typing', 'reading-screen', 'writing-notes', 'whiteboard', 'research',
  'deploy-button', 'shield-verify', 'meeting', 'chat', 'pass-document',
  'goto-coffee-machine', 'nap', 'scratch-head', 'desk-slam',
])


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
      weightOverride: null,
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
  isPaused: typeof window !== 'undefined' && localStorage.getItem('office-paused') === 'true',
  showWorkflow: false,

  setAgentBehavior: (id, behavior, expression, bubble) =>
    set((s) => {
      if (!s.agents[id]) return s
      const prev = s.agents[id].behavior
      // Status is driven only by external integration (hooks), not by organic behaviors
      const agents = {
        ...s.agents,
        [id]: { ...s.agents[id], behavior, expression: expression || s.agents[id].expression, bubble: bubble || null },
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
      if (!s.agents[id]) return s
      return {
        agents: { ...s.agents, [id]: { ...s.agents[id], bubble: null } },
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

  incrementDeskItem: (id, item) =>
    set((s) => {
      const agent = s.agents[id]
      if (!agent) return s
      const count = { ...agent.deskItemCount }
      count[item] = ((count[item] || 0) + 1) % 6
      return { agents: { ...s.agents, [id]: { ...agent, deskItemCount: count } } }
    }),

  updateTime: () => {
    const now = new Date()
    set({ hour: now.getHours(), minute: now.getMinutes() })
  },

  setActiveEvent: (event) => set((s) => {
    if (!event) return { activeEvent: event }
    const entry = mkActivity({ type: 'event', agentId: null, message: event.id || event.name || 'event' })
    return { activeEvent: event, activityLog: [entry, ...s.activityLog].slice(0, 50) }
  }),
  clearActiveEvent: () => set({ activeEvent: null }),
  togglePause: () => set((s) => {
    const next = !s.isPaused
    if (typeof window !== 'undefined') localStorage.setItem('office-paused', String(next))
    return { isPaused: next }
  }),
  triggerWorkflow: () => set({ showWorkflow: true }),
  endWorkflow: () => set({ showWorkflow: false }),

  // ─── External status integration ───
  externalStatus: {},          // { [agentId]: { status, task, label, expiresAt } }
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
      const activities = []
      const dailyDoneLedger = ensureCurrentDailyDoneLedger(s.dailyDoneLedger, now)
      for (const u of updates) {
        const previousStatus = ext[u.agentId]?.status || agents[u.agentId]?.status || 'idle'
        if (!agents[u.agentId]) {
          // Dynamic worktree agent — clone base role's visual style, place in overflow spot
          const baseRole = u.agentId.includes('~') ? u.agentId.split('~')[1] : u.agentId
          const baseAgent = s.agents[baseRole] || s.agents['dev']
          if (!baseAgent) continue
          const overflowIdx = Object.values(agents).filter(a => a.session).length
          const pos = { ...OVERFLOW_POSITIONS[overflowIdx % OVERFLOW_POSITIONS.length] }
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
          }
        }
        ext[u.agentId] = {
          status: u.status,
          task: u.task,
          label: u.label,
          hint: u.hint || null,
          // working/blocked: 15s expiry (hook re-sends on each tool call to keep alive)
          // done: 10s expiry (brief celebration then back to idle)
          expiresAt: u.status === 'done' ? now + 10000 : now + 15000,
        }
        // Immediately set behavior + expression to match work status
        const behaviorMap = {
          working: { behavior: u.task === 'Bash' ? 'typing' : u.task === 'Read' ? 'reading-screen' : u.task === 'Grep' || u.task === 'Glob' ? 'research' : 'typing', expression: 'focused' },
          blocked: { behavior: 'scratch-head', expression: 'confused' },
          done:    { behavior: 'thumbs-up', expression: 'happy' },
        }
        const bm = behaviorMap[u.status] || {}
        // Don't overwrite behavior/expression during group events (officeLife controls those)
        const inGroup = agents[u.agentId].inGroupEvent
        agents[u.agentId] = {
          ...agents[u.agentId],
          status: u.status,
          behavior: inGroup ? agents[u.agentId].behavior : (bm.behavior || agents[u.agentId].behavior),
          expression: inGroup ? agents[u.agentId].expression : (bm.expression || agents[u.agentId].expression),
        }
        // Context-aware bubble > status pool fallback
        const bubble = generateContextBubble(u.agentId, u, ext)
          || randomBubble(u.status === 'blocked' ? 'blocked-status' : u.status === 'done' ? 'done-status' : 'working-status')
        if (bubble) agents[u.agentId] = { ...agents[u.agentId], bubble }
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
            dailyDoneLedger.counts[u.agentId] = (dailyDoneLedger.counts[u.agentId] || 0) + 1
            if (eventKey) {
              dailyDoneLedger.seenEventKeys = [...dailyDoneLedger.seenEventKeys, eventKey].slice(-500)
            }
          }
          // Growth system: accumulate desk items on done events
          const roleItems = {
            pm: 'sticky', arch: 'books', dev: 'coffee',
            qa: 'sticky', ops: 'coffee', res: 'books',
            gate: 'sticky', designer: 'sticky',
          }
          const baseRole = u.agentId.includes('~') ? u.agentId.split('~')[1] : u.agentId
          const growthItem = roleItems[baseRole] || 'coffee'
          const agent = agents[u.agentId]
          if (agent) {
            const count = { ...agent.deskItemCount }
            count[growthItem] = ((count[growthItem] || 0) + 1) % 4
            agents[u.agentId] = { ...agent, deskItemCount: count }
          }
        }
      }
      const log = activities.length > 0
        ? [...activities, ...s.activityLog].slice(0, 50)
        : s.activityLog
      return { externalStatus: ext, agents, activityLog: log, dailyDoneLedger }
    }),

  clearExternalStatus: (agentId) =>
    set((s) => {
      if (agentId) {
        const ext = { ...s.externalStatus }
        delete ext[agentId]
        const agents = { ...s.agents }
        if (agents[agentId]) {
          // Dynamic session agents disappear when they expire; base agents go idle
          if (agents[agentId].session) delete agents[agentId]
          else agents[agentId] = { ...agents[agentId], status: 'idle' }
        }
        if (Object.keys(ext).length === 0) {
          return { externalStatus: ext, agents, statusSource: 'organic', integrationSource: null, activeWorkflow: null }
        }
        return { externalStatus: ext, agents }
      }
      // Clear all
      const agents = { ...s.agents }
      for (const id of Object.keys(s.externalStatus)) {
        if (agents[id]) {
          if (agents[id].session) delete agents[id]
          else agents[id] = { ...agents[id], status: 'idle' }
        }
      }
      return { externalStatus: {}, agents, statusSource: 'organic', integrationSource: null, activeWorkflow: null }
    }),

  // ─── Mood system ───
  mood: 'normal',  // normal | rushing | frustrated | stuck | smooth | intense | idle (transient, not persisted)
  setMood: (mood) => set({ mood }),

  setStatusSource: (source) => set({ statusSource: source }),
  setIntegrationSource: (source) => set({ integrationSource: source || null }),
  setActiveWorkflow: (name) => set({ activeWorkflow: name }),
  markIntegrationProbe: ({ ok }) =>
    set((s) => {
      const now = Date.now()
      const failures = ok ? 0 : s.integrationHealth.consecutiveFailures + 1
      return {
        integrationHealth: {
          state: ok ? 'online' : (failures >= 3 ? 'offline' : 'degraded'),
          lastSuccessAt: ok ? now : s.integrationHealth.lastSuccessAt,
          lastErrorAt: ok ? s.integrationHealth.lastErrorAt : now,
          consecutiveFailures: failures,
        },
      }
    }),

  // Handoff animation state
  handoffs: [],
  addHandoff: (from, to) =>
    set((s) => ({
      handoffs: [...s.handoffs, { id: Date.now(), from, to, startTime: Date.now() }],
    })),
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
useOfficeStore.subscribe(() => {
  if (_persistTimer) return
  _persistTimer = setTimeout(() => {
    _persistTimer = null
    savePersistedState(useOfficeStore.getState())
  }, 2000)
})
