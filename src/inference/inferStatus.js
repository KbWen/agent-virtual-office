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

import { routeExternalAgents, distributeFallbackCount, routeTaskToAgent } from './agentRouter.js'
import { pushEventBatch, setMoodOverride, resetMood } from '../systems/moodEngine.js'
import { VALID_ROLES, VALID_STATUSES, STATUS_POLL_INTERVAL } from '../systems/constants.js'

// ─── Message normalization ─────────────────────────────────────────────

function phaseToStatus(phase) {
  if (!phase) return 'working'
  if (/done|complete|finish/i.test(phase)) return 'done'
  if (/block|stuck|error|fail/i.test(phase)) return 'blocked'
  return 'working'
}

function withStatusEnvelope(raw, fallbackSource = 'external') {
  return {
    ...raw,
    source: raw.source || fallbackSource,
    _seq: raw._seq || String(Date.now()),
  }
}

/**
 * Normalize any incoming message to the unified office-status format
 */
export function normalizeStatusMessage(raw) {
  if (!raw || typeof raw !== 'object') return null

  // New protocol
  if (raw.type === 'office-status') return withStatusEnvelope(raw)

  // Legacy office-vibe → convert (uses agentRouter for command→role mapping)
  if (raw.type === 'office-vibe') {
    return withStatusEnvelope({
      type: 'office-status',
      agents: [{
        role: raw.agent || routeTaskToAgent(raw.command) || null,
        task: raw.command || null,
        status: phaseToStatus(raw.phase),
        label: null,
      }],
      workflow: raw.workflow || null,
    }, raw.source || 'legacy')
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

export function createFilePollingState() {
  return {
    lastEtag: null,
    lastSeq: null,
    consecutive404: 0,
    inFlight: false,
    idlePolls: 0,      // consecutive polls with no new data (drives adaptive interval)
  }
}

export async function pollFileStatusOnce(fetchImpl, state, callback) {
  if (state.inFlight) return { ok: true, skipped: true, reason: 'in-flight' }
  // Back off when server is unreachable (skip every other poll after 10 failures)
  if (state.consecutive404 > 10 && state.consecutive404 % 3 !== 0) {
    return { ok: false, skipped: true, reason: 'backoff' }
  }

  state.inFlight = true
  try {
    const headers = {}
    if (state.lastEtag) headers['If-None-Match'] = state.lastEtag
    const resp = await fetchImpl('/api/status', { headers })
    if (resp.status === 304) { state.consecutive404 = 0; return { ok: true, unchanged: true } }
    if (!resp.ok) {
      if (resp.status === 404) {
        state.consecutive404++
      } else {
        // Non-404 errors (401, 500, etc.) — don't back off, just skip this cycle
        state.consecutive404 = 0
      }
      return { ok: false, status: resp.status }
    }

    state.consecutive404 = 0
    const prevEtag = state.lastEtag
    state.lastEtag = resp.headers.get('ETag')

    let data
    try {
      data = await resp.json()
    } catch {
      return { ok: false, parseError: true }
    }
    if (!data) return { ok: true, empty: true }
    // Skip _seq dedup when ETag proves the body changed (200 + new ETag is authoritative).
    // Only fall back to _seq dedup for ETag-less servers where 200 can repeat unchanged content.
    const etagChanged = state.lastEtag && state.lastEtag !== prevEtag
    if (!etagChanged && data._seq && data._seq === state.lastSeq) return { ok: true, duplicate: true }

    state.lastSeq = data._seq || null
    const msg = normalizeStatusMessage(data)
    if (msg) callback(msg)
    return { ok: true, delivered: Boolean(msg) }
  } catch {
    state.consecutive404++
    return { ok: false, networkError: true }
  } finally {
    state.inFlight = false
  }
}

function startFilePolling(callback, baseIntervalMs = 1000, onProbe = null) {
  // Skip file polling when /api/status can't work:
  // - file:// protocol (no server)
  // - HTTPS page can't fetch HTTP localhost (mixed content)
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol
    if (proto === 'file:') {
      console.info('[Office] Skipping API polling (file:// protocol). Use URL hash or postMessage instead.')
      return () => {}
    }
    if (proto === 'https:' && window.location.hostname !== 'localhost') {
      console.info('[Office] Skipping API polling (HTTPS page cannot reach HTTP API). Use postMessage or hash instead.')
      return () => {}
    }
  }

  const pollingState = createFilePollingState()
  let currentIntervalMs = baseIntervalMs
  let timer = null
  let stopped = false

  function schedulePoll() {
    if (stopped) return
    timer = setTimeout(async () => {
      const result = await pollFileStatusOnce(fetch, pollingState, (m) => { if (!stopped) callback(m) })
      if (onProbe && result) onProbe(result)
      // Adaptive interval: double after 5 consecutive idle polls, reset on activity.
      // Idle = unchanged (304/dup), active = delivered a new message.
      if (result?.delivered) {
        pollingState.idlePolls = 0
        currentIntervalMs = baseIntervalMs
      } else if (result?.unchanged || result?.duplicate || result?.empty) {
        pollingState.idlePolls = (pollingState.idlePolls || 0) + 1
        if (pollingState.idlePolls >= 5) {
          currentIntervalMs = Math.min(currentIntervalMs * 2, 8000)
        }
      }
      schedulePoll()
    }, currentIntervalMs)
  }

  schedulePoll()
  return () => { stopped = true; clearTimeout(timer) }
}

// SSE listener for /api/status/stream — receives push updates instead of polling.
// Falls back to HTTP polling if EventSource is unavailable or the endpoint errors.
// onGiveUp is called with no arguments when the SSE connection permanently fails
// (5 consecutive errors with no successful event), so the caller can restore fast polling.
function startSSEListening(callback, onProbe = null, onGiveUp = null) {
  if (typeof EventSource === 'undefined') return null
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol
    if (proto === 'file:' || (proto === 'https:' && window.location.hostname !== 'localhost')) return null
  }

  let es = null
  let reconnectTimer = null
  let stabilityTimer = null  // hoisted so cleanup can always cancel it
  let reconnectDelay = 2000
  let stopped = false
  let consecutiveErrors = 0
  let lastSseData = null  // dedup on exact wire bytes; _seq is not unique across same-ms processes
  const MAX_CONSECUTIVE_ERRORS = 5
  // After this many ms of uptime the error streak resets, even if no events arrived.
  // Fixes the R24 regression where quiet servers (no tool calls) never sent a 'status'
  // event after the initial snapshot, so consecutiveErrors could never decay.
  const MIN_STABLE_MS = 10_000

  function connect() {
    if (stopped) return
    es = new EventSource('/api/status/stream')

    es.addEventListener('open', () => {
      // Schedule streak reset after MIN_STABLE_MS of connection uptime.
      // Fires regardless of whether the server has sent any events — covers quiet
      // servers where no tool calls are in flight for extended periods.
      clearTimeout(stabilityTimer)
      stabilityTimer = setTimeout(() => {
        if (!stopped && es) {
          consecutiveErrors = 0
          reconnectDelay = 2000
        }
      }, MIN_STABLE_MS)
    })

    es.addEventListener('status', (e) => {
      try {
        // Dedup: server fires broadcastSSE on both POST and file-watcher; the same
        // merged payload can arrive twice with identical wire bytes. Dedup on the raw
        // data string (not _seq) so two distinct events that share a _seq due to
        // same-millisecond hook writes are both delivered.
        if (e.data === lastSseData) return
        lastSseData = e.data
        const data = JSON.parse(e.data)
        const msg = normalizeStatusMessage(data)
        if (msg) callback(msg)
        if (onProbe) onProbe({ ok: true, delivered: Boolean(msg) })
      } catch {}
    })

    es.onerror = () => {
      clearTimeout(stabilityTimer)
      // Capture and null-out es before closing — onerror can fire multiple times
      // for the same connection; calling .close() on a nulled variable throws TypeError.
      const dead = es
      es = null
      if (dead) { try { dead.close() } catch {} }
      if (stopped) return
      consecutiveErrors++
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        // Endpoint is permanently unavailable — stop reconnecting and signal caller
        stopped = true
        if (onGiveUp) onGiveUp()
        return
      }
      // Exponential backoff: 2s → 4s → 8s → 16s → cap at 30s
      reconnectTimer = setTimeout(connect, reconnectDelay)
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
    }
  }

  connect()

  return () => {
    stopped = true
    clearTimeout(reconnectTimer)
    clearTimeout(stabilityTimer)
    if (es) { es.close(); es = null }
  }
}

// ─── URL hash monitoring (passive, no platform cooperation needed) ──────
// Platforms or users can set: #dev=working&workflow=Build+Feature&qa=testing
// This works in artifacts, iframes, and direct browser — no postMessage required

export function buildHashStatusMessage(hash) {
  const rawHash = typeof hash === 'string' ? hash.replace(/^#/, '') : ''
  if (!rawHash) return null

  const params = new URLSearchParams(rawHash)
  const agents = []
  for (const role of VALID_ROLES) {
    const val = params.get(role)
    if (!val) continue
    const isStatus = VALID_STATUSES.includes(val)
    agents.push({
      role,
      task: isStatus ? null : val,
      status: isStatus ? val : 'working',
      label: null,
    })
  }

  if (agents.length === 0 && !params.get('workflow') && !params.get('count')) return null

  return {
    type: 'office-status',
    agents,
    activeCount: parseInt(params.get('count')) || 0,
    workflow: params.get('workflow') || null,
    source: params.get('source') || 'hash-bridge',
    _seq: `hash:${rawHash}`,
  }
}

function listenHashChanges(callback) {
  function parseHash() {
    return buildHashStatusMessage(window.location.hash)
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
const DEBOUNCE_MS = 150  // keep low — tool calls are 1-2s apart, debounce must not eat them

/**
 * Start all status integration channels
 * @param {object} store - Zustand store (useOfficeStore)
 * @returns {Function} cleanup function
 */
export function startStatusIntegration(store) {
  // Reset mood state in case of HMR or React Strict Mode double-invoke
  resetMood()
  let torn = false  // set on cleanup; guards late callbacks after teardown
  let debounceTimer = null
  let stalenessTimer = null
  let pendingMsg = null

  function applyMessage(msg) {
    if (torn) return
    const s = store.getState()

    // Set mood override BEFORE feeding events so pushEventBatch's updateStoreMood sees it
    if (msg.mood) {
      setMoodOverride(msg.mood, msg.moodDuration || 60000)
    }

    // Route agents
    const updates = routeExternalAgents(msg.agents || [])

    if (updates.length > 0) {
      s.applyExternalStatus(updates, {
        source: msg.source || 'external',
        seq: msg._seq || null,
        skipHintDismiss: msg.source === 'file-watcher',
      })
      s.setStatusSource('external')
      s.setIntegrationSource?.(msg.source || 'external')

      // Feed mood engine — batch to recompute mood once instead of once per agent
      pushEventBatch(updates.map(u => ({ role: u.agentId, status: u.status, task: u.task, hint: u.hint || null })))
    } else if (msg.activeCount > 0) {
      const ids = distributeFallbackCount(msg.activeCount)
      s.applyExternalStatus(
        ids.map(id => ({ agentId: id, status: 'working', task: null, label: null })),
        { skipHintDismiss: msg.source === 'file-watcher' }
      )
      s.setStatusSource('fallback')
      s.setIntegrationSource?.(msg.source || 'fallback')
    }

    if (msg.workflow) s.setActiveWorkflow(msg.workflow)

    resetStalenessTimer()
  }

  function handleIncoming(msg) {
    if (torn || !msg) return
    pendingMsg = msg
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (pendingMsg) {
        applyMessage(pendingMsg)
        pendingMsg = null
      }
    }, DEBOUNCE_MS)
  }

  function handleProbe(result) {
    if (result.skipped) return
    store.getState().markIntegrationProbe({ ok: Boolean(result.ok) })
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
        // Re-read fresh state: a new applyExternalStatus call may have renewed
        // expiresAt between the snapshot above and this clear — don't clobber it.
        const current = store.getState().externalStatus[id]
        if (current && now > current.expiresAt) {
          store.getState().clearExternalStatus(id)
        }
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

  // Try SSE first; fall back to 1s polling if SSE isn't available.
  // When SSE is active, reduce HTTP polling to a 10s heartbeat (catches missed pushes).
  // If SSE permanently gives up (5 consecutive errors), restart file polling at the fast rate.
  // Object ref so the onGiveUp closure always sees the current cleanup function,
  // regardless of when SSE gives up relative to polling startup.
  const polling = { cleanup: null, active: false }

  function startFastPolling() {
    if (polling.active) return
    polling.active = true
    polling.cleanup = startFilePolling(handleIncoming, STATUS_POLL_INTERVAL, handleProbe)
  }

  const sseCleanup = startSSEListening(handleIncoming, handleProbe, () => {
    // SSE permanently failed — stop the slow heartbeat poller and restart at fast rate
    if (polling.cleanup) { polling.cleanup(); polling.active = false }
    startFastPolling()
  })

  if (sseCleanup && !polling.active) {
    polling.active = true
    // null onProbe: when SSE is active it already feeds handleProbe; the 10s
    // heartbeat poller is just a catch-all for missed pushes, not a health signal.
    polling.cleanup = startFilePolling(handleIncoming, 10_000, null)
  } else {
    startFastPolling()
  }

  // Start all listeners (active + passive channels)
  const cleanups = [
    listenForStatusUpdates(handleIncoming),           // postMessage (artifact/embedded)
    listenBroadcastChannel(handleIncoming),           // cross-tab (CLI opens browser)
    startPolling(handleIncoming),                     // window global (CLI injection)
    listenHashChanges(handleIncoming),                // URL hash (passive, any platform)
    listenTitleChanges(handleIncoming),               // title monitoring (heuristic)
    () => { if (polling.cleanup) polling.cleanup() }, // /api/status fallback
    ...(sseCleanup ? [sseCleanup] : []),              // SSE push channel
  ]

  return () => {
    torn = true
    cleanups.forEach(fn => fn())
    if (debounceTimer) clearTimeout(debounceTimer)
    if (stalenessTimer) clearTimeout(stalenessTimer)
    clearInterval(expiryInterval)
    resetMood()
  }
}
