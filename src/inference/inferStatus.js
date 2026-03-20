/**
 * Status Integration — connects external platforms to the office visualization
 *
 * Supported channels:
 * 1. URL params — ?command=/implement&phase=implementing&active=dev (initial state)
 * 2. postMessage — from parent frame (artifact/embedded mode)
 * 3. BroadcastChannel — cross-tab same-origin (CLI opens browser)
 * 4. window.__office_status__ polling — CLI/Antigravity global injection
 *
 * Protocol: { type: 'office-status', agents: [...], activeCount, workflow, source }
 * Legacy:   { type: 'office-vibe', agent, command, phase } (auto-converted)
 */

import { routeExternalAgents, distributeFallbackCount, routeTaskToAgent } from './agentRouter'
import { pushEventBatch, setMoodOverride, resetMood } from '../systems/moodEngine'

// ─── Message normalization ─────────────────────────────────────────────

function phaseToStatus(phase) {
  if (!phase) return 'working'
  if (/done|complete|finish/i.test(phase)) return 'done'
  if (/block|stuck|error|fail/i.test(phase)) return 'blocked'
  return 'working'
}

/**
 * Normalize any incoming message to the unified office-status format
 */
export function normalizeStatusMessage(raw) {
  if (!raw || typeof raw !== 'object') return null

  // New protocol
  if (raw.type === 'office-status') return raw

  // Legacy office-vibe → convert (uses agentRouter for command→role mapping)
  if (raw.type === 'office-vibe') {
    return {
      type: 'office-status',
      agents: [{
        role: raw.agent || routeTaskToAgent(raw.command) || null,
        task: raw.command || null,
        status: phaseToStatus(raw.phase),
        label: null,
      }],
      source: raw.source || null,
      workflow: raw.workflow || null,
    }
  }

  return null
}

// ─── URL params (one-time on load) ─────────────────────────────────────

export function inferFromParams() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const command = params.get('command') || params.get('cmd')
  const phase = params.get('phase')
  const active = params.get('active')
  const workflow = params.get('workflow')

  if (!command && !phase && !active) return null

  return normalizeStatusMessage({
    type: 'office-vibe',
    agent: active || null,
    command: command || null,
    phase: phase || null,
    source: params.get('source') || null,
    workflow,
  })
}

// ─── postMessage listener (artifact/embedded) ──────────────────────────

function listenForStatusUpdates(callback) {
  const handler = (event) => {
    // Accept same-origin messages (any source) or messages from parent frame (for embedded/artifact mode).
    // Note: cross-origin parent frames CAN send status updates — this is intentional for embedding,
    // and the impact is limited to visual changes (character animations/mood). No sensitive data exposed.
    const sameOrigin = event.origin === window.location.origin
    const fromParent = event.source === window.parent
    if (!sameOrigin && !fromParent) return
    const msg = normalizeStatusMessage(event.data)
    if (msg) callback(msg)
  }
  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}

// ─── BroadcastChannel (cross-tab same-origin) ──────────────────────────

function listenBroadcastChannel(callback) {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const bc = new BroadcastChannel('agent-office')
  bc.onmessage = (e) => {
    const msg = normalizeStatusMessage(e.data)
    if (msg) callback(msg)
  }
  return () => bc.close()
}

// ─── Global polling (CLI injects window.__office_status__) ─────────────

function startPolling(callback, intervalMs = 2000) {
  let lastSeq = null
  const timer = setInterval(() => {
    const data = window.__office_status__
    if (data && data._seq !== lastSeq) {
      lastSeq = data._seq
      const msg = normalizeStatusMessage(data)
      if (msg) callback(msg)
    }
  }, intervalMs)
  return () => clearInterval(timer)
}

// ─── File polling via /api/status (CLI hook writes ~/.claude/office-status.json)
// This is the primary channel for real CLI integration

function startFilePolling(callback, intervalMs = 2000) {
  let lastEtag = null
  let consecutive404 = 0
  const timer = setInterval(async () => {
    try {
      const headers = {}
      if (lastEtag) headers['If-None-Match'] = lastEtag
      const resp = await fetch('/api/status', { headers })
      if (resp.status === 304) return // Not modified — skip processing
      if (!resp.ok) { consecutive404++; return }
      consecutive404 = 0
      lastEtag = resp.headers.get('ETag')
      let data
      try { data = await resp.json() } catch { return } // malformed JSON — skip without counting as 404
      if (!data) return
      const msg = normalizeStatusMessage(data)
      if (msg) callback(msg)
    } catch {
      consecutive404++
    }
    // Stop polling if server seems down
    if (consecutive404 > 15) clearInterval(timer)
  }, intervalMs)
  return () => clearInterval(timer)
}

// ─── URL hash monitoring (passive, no platform cooperation needed) ──────
// Platforms or users can set: #dev=working&workflow=Build+Feature&qa=testing
// This works in artifacts, iframes, and direct browser — no postMessage required

function listenHashChanges(callback) {
  function parseHash() {
    const hash = window.location.hash.slice(1)
    if (!hash) return null
    const params = new URLSearchParams(hash)
    const agents = []
    const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate']
    for (const role of VALID_ROLES) {
      const val = params.get(role)
      if (val) {
        // value can be: "working", "blocked", "done", or "task-name"
        const isStatus = ['working', 'blocked', 'done', 'idle'].includes(val)
        agents.push({
          role,
          task: isStatus ? null : val,
          status: isStatus ? val : 'working',
          label: null,
        })
      }
    }
    if (agents.length === 0 && !params.get('workflow') && !params.get('count')) return null
    return {
      type: 'office-status',
      agents,
      activeCount: parseInt(params.get('count')) || 0,
      workflow: params.get('workflow') || null,
    }
  }

  // Check initial hash
  const initial = parseHash()
  if (initial) callback(initial)

  const handler = () => {
    const msg = parseHash()
    if (msg) callback(msg)
  }
  window.addEventListener('hashchange', handler)
  return () => window.removeEventListener('hashchange', handler)
}

// ─── Document title inference (heuristic) ──────────────────────────────
// Some platforms put task info in the title. We look for patterns like:
// "Implementing auth..." or "Testing: unit tests" or "[building] feature X"

function listenTitleChanges(callback) {
  let lastTitle = document.title
  const TITLE_PATTERNS = [
    { pattern: /implement|coding|writing code|building/i, role: 'dev', status: 'working' },
    { pattern: /testing|reviewing|linting/i, role: 'qa', status: 'working' },
    { pattern: /planning|spec|bootstrap/i, role: 'pm', status: 'working' },
    { pattern: /deploy|shipping|release/i, role: 'ops', status: 'working' },
    { pattern: /research|analyzing|exploring/i, role: 'res', status: 'working' },
    { pattern: /design|architect|brainstorm/i, role: 'arch', status: 'working' },
    { pattern: /error|failed|blocked|stuck/i, role: null, status: 'blocked' },
    { pattern: /done|complete|success|finished/i, role: null, status: 'done' },
  ]

  const observer = new MutationObserver(() => {
    const title = document.title
    if (title === lastTitle) return
    lastTitle = title

    for (const { pattern, role, status } of TITLE_PATTERNS) {
      if (pattern.test(title)) {
        callback({
          type: 'office-status',
          agents: [{ role: role || 'dev', task: title, status, label: null }],
        })
        return
      }
    }
  })

  const titleEl = document.querySelector('title')
  if (titleEl) {
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true })
  }
  return () => observer.disconnect()
}

// ─── Master integration orchestrator ───────────────────────────────────

const STALENESS_TIMEOUT = 120000 // 2 minutes
const DEBOUNCE_MS = 500

/**
 * Start all status integration channels
 * @param {object} store - Zustand store (useOfficeStore)
 * @returns {Function} cleanup function
 */
export function startStatusIntegration(store) {
  // Reset mood state in case of HMR or React Strict Mode double-invoke
  resetMood()
  let lastUpdateTime = 0
  let debounceTimer = null
  let stalenessTimer = null
  let pendingMsg = null

  function applyMessage(msg) {
    const s = store.getState()

    // Route agents
    const updates = routeExternalAgents(msg.agents || [])

    if (updates.length > 0) {
      s.applyExternalStatus(updates)
      s.setStatusSource('external')

      // Feed mood engine — batch to recompute mood once instead of once per agent
      pushEventBatch(updates.map(u => ({ role: u.agentId, status: u.status, task: u.task, hint: u.hint || null })))
    } else if (msg.activeCount > 0) {
      const ids = distributeFallbackCount(msg.activeCount)
      s.applyExternalStatus(ids.map(id => ({ agentId: id, status: 'working', task: null, label: null })))
      s.setStatusSource('fallback')
    }

    // Handle explicit mood override from API
    if (msg.mood) {
      setMoodOverride(msg.mood, msg.moodDuration || 60000)
    }

    if (msg.workflow) s.setActiveWorkflow(msg.workflow)

    lastUpdateTime = Date.now()
    resetStalenessTimer()
  }

  function handleIncoming(msg) {
    pendingMsg = msg
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (pendingMsg) {
        applyMessage(pendingMsg)
        pendingMsg = null
      }
    }, DEBOUNCE_MS)
  }

  function resetStalenessTimer() {
    if (stalenessTimer) clearTimeout(stalenessTimer)
    stalenessTimer = setTimeout(() => {
      const s = store.getState()
      if (s.statusSource !== 'organic') {
        s.clearExternalStatus()
      }
    }, STALENESS_TIMEOUT)
  }

  // Expiry checker — clears 'done' agents after their expiresAt
  const expiryInterval = setInterval(() => {
    const s = store.getState()
    const now = Date.now()
    for (const [id, ext] of Object.entries(s.externalStatus)) {
      if (ext.expiresAt && now > ext.expiresAt) {
        store.getState().clearExternalStatus(id)
      }
    }
    // If all external entries cleared, revert to organic
    if (Object.keys(store.getState().externalStatus).length === 0 && store.getState().statusSource !== 'organic') {
      store.getState().setStatusSource('organic')
      store.getState().setActiveWorkflow(null)
    }
  }, 5000)

  // Apply initial state from URL params
  const initial = inferFromParams()
  if (initial) applyMessage(initial)

  // Start all listeners (active + passive channels)
  const cleanups = [
    listenForStatusUpdates(handleIncoming),   // postMessage (artifact/embedded)
    listenBroadcastChannel(handleIncoming),   // cross-tab (CLI opens browser)
    startPolling(handleIncoming),             // window global (CLI injection)
    startFilePolling(handleIncoming),         // /api/status (CLI hook → file → vite)
    listenHashChanges(handleIncoming),        // URL hash (passive, any platform)
    listenTitleChanges(handleIncoming),       // title monitoring (heuristic)
  ]

  return () => {
    cleanups.forEach(fn => fn())
    if (debounceTimer) clearTimeout(debounceTimer)
    if (stalenessTimer) clearTimeout(stalenessTimer)
    clearInterval(expiryInterval)
    resetMood()
  }
}
