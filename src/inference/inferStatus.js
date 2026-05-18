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
import { VALID_ROLES, VALID_STATUSES, VALID_MOODS, STATUS_POLL_INTERVAL } from '../systems/constants.js'

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

const CAP = 200  // max string length for untrusted fields from in-browser channels
const SLUG_CAP = 64  // max length for a session slug prefix in a composite role id

function capStr(v) { return typeof v === 'string' ? v.slice(0, CAP) : null }

// A role id is either a bare VALID_ROLE ('dev') or a multi-session composite
// 'slug~role' produced by scanAndMerge (e.g. 'feat-x~dev'). The base role — the
// segment after the LAST '~' — must be a VALID_ROLE. The slug may itself contain
// '~', so split on the last separator only. Returns the canonicalized role id
// (slug capped) or null when the base role is invalid.
function sanitizeRoleId(role) {
  if (typeof role !== 'string' || role.length === 0) return null
  const sep = role.lastIndexOf('~')
  if (sep === -1) {
    return VALID_ROLES.includes(role) ? role : null
  }
  const slug = role.slice(0, sep)
  const base = role.slice(sep + 1)
  if (!slug || !VALID_ROLES.includes(base)) return null
  return `${slug.slice(0, SLUG_CAP)}~${base}`
}

function sanitizeAgent(a) {
  if (!a || typeof a !== 'object') return null
  const role = sanitizeRoleId(a.role)
  if (!role || !VALID_STATUSES.includes(a.status)) return null
  // Preserve session — multi-session merged agents carry their worktree slug here
  // and applyExternalStatus / routeExternalAgents both depend on it. Cap it: the
  // slug originates from a filename and is not fully trusted.
  const session = typeof a.session === 'string' ? a.session.slice(0, SLUG_CAP) : null
  return { role, status: a.status, task: capStr(a.task), label: capStr(a.label), hint: capStr(a.hint), session }
}

/**
 * Normalize any incoming message to the unified office-status format
 */
export function normalizeStatusMessage(raw) {
  if (!raw || typeof raw !== 'object') return null

  // New protocol — validate envelope so untrusted in-browser channels (postMessage,
  // BroadcastChannel, window.__office_status__) cannot inject unbounded strings into the store.
  if (raw.type === 'office-status') {
    const agents = Array.isArray(raw.agents)
      ? raw.agents.map(sanitizeAgent).filter(Boolean)
      : []
    const activeCount = agents.filter(a => a.status === 'working' || a.status === 'blocked').length
    const validated = {
      ...raw,
      agents,
      activeCount,
      workflow: capStr(raw.workflow),
      mood: VALID_MOODS.includes(raw.mood) ? raw.mood : undefined,
    }
    if (validated.mood === undefined) delete validated.mood
    return withStatusEnvelope(validated)
  }

  // Legacy office-vibe → convert (uses agentRouter for command→role mapping).
  // Cap task/workflow here too — office-vibe is reachable from untrusted channels
  // (postMessage, ?command= URL param) and must not bypass the CAP that the
  // office-status branch enforces via sanitizeAgent/capStr.
  if (raw.type === 'office-vibe') {
    return withStatusEnvelope({
      type: 'office-status',
      agents: [{
        role: raw.agent || routeTaskToAgent(raw.command) || null,
        task: capStr(raw.command),
        status: phaseToStatus(raw.phase),
        label: null,
      }],
      workflow: capStr(raw.workflow),
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
    lastBody: null,    // raw JSON text — dedup fallback when ETag is absent (mirrors SSE wire-byte dedup)
    consecutive404: 0,
    skipTick: 0,       // separate tick counter for backoff cadence (not consecutive404)
    inFlight: false,
    idlePolls: 0,      // consecutive polls with no new data (drives adaptive interval)
  }
}

export async function pollFileStatusOnce(fetchImpl, state, callback) {
  if (state.inFlight) return { ok: true, skipped: true, reason: 'in-flight' }
  // Back off when server is unreachable: skip 2 of every 3 ticks after 10 consecutive failures.
  // Uses a separate skipTick counter (incremented on every call including skips) so the
  // recovery poll fires unconditionally every 3rd tick regardless of consecutive404 value.
  // If consecutive404 drove the modulo instead, it would freeze at 11 (11%3=2, never advances)
  // and recovery polls would never run.
  if (state.consecutive404 > 10) {
    state.skipTick = (state.skipTick || 0) + 1
    if (state.skipTick % 3 !== 0) return { ok: false, skipped: true, reason: 'backoff' }
  }

  state.inFlight = true
  try {
    const headers = {}
    if (state.lastEtag) headers['If-None-Match'] = state.lastEtag
    const resp = await fetchImpl('/api/status', { headers })
    if (resp.status === 304) { state.consecutive404 = 0; state.skipTick = 0; return { ok: true, unchanged: true } }
    if (!resp.ok) {
      if (resp.status === 404) {
        state.consecutive404 = Math.min(state.consecutive404 + 1, 30)
      } else {
        // Non-404 errors (401, 500, etc.) — don't back off, just skip this cycle
        state.consecutive404 = 0; state.skipTick = 0
      }
      return { ok: false, status: resp.status }
    }

    state.consecutive404 = 0; state.skipTick = 0
    const prevEtag = state.lastEtag
    state.lastEtag = resp.headers.get('ETag')

    let rawBody, data
    try {
      rawBody = await resp.text()
      data = JSON.parse(rawBody)
    } catch {
      // Restore the previous ETag so a *changed* body (e.g. recovered valid JSON)
      // is re-fetched on the next poll. An unchanged malformed body harmlessly yields
      // 304 — but if the server recovers, the hash differs and no 304 occurs.
      state.lastEtag = prevEtag
      return { ok: false, parseError: true }
    }
    if (!data) return { ok: true, empty: true }
    // Dedup: prefer ETag (server-authoritative), then raw body text (mirrors SSE wire-byte
    // dedup — guards against same-ms _seq collision when ETag is intermittently absent).
    const etagChanged = state.lastEtag && state.lastEtag !== prevEtag
    if (!etagChanged && rawBody === state.lastBody) return { ok: true, duplicate: true }

    state.lastBody = rawBody
    state.lastSeq = data._seq || null
    const msg = normalizeStatusMessage(data)
    // Invoke callback OUTSIDE the main catch so store/rendering exceptions don't
    // masquerade as network failures and trip the consecutive404 backoff counter.
    if (msg) { try { callback(msg) } catch {} }
    return { ok: true, delivered: Boolean(msg) }
  } catch {
    state.consecutive404 = Math.min(state.consecutive404 + 1, 30)
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
      // Idle = unchanged (304/dup/parse-error), active = delivered a new message.
      // parseError counts as idle so a server persistently returning malformed JSON
      // doesn't get hammered at 1s rate indefinitely.
      if (result?.delivered) {
        pollingState.idlePolls = 0
        currentIntervalMs = baseIntervalMs
      } else if (result?.unchanged || result?.duplicate || result?.empty || result?.parseError) {
        pollingState.idlePolls = (pollingState.idlePolls || 0) + 1
        if (pollingState.idlePolls >= 5) {
          currentIntervalMs = Math.min(currentIntervalMs * 2, Math.max(8000, baseIntervalMs))
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
    // Reset wire-dedup on every new connection so the reconnect snapshot is always delivered.
    // Without this, a state that round-trips (working→done→working same labels) during an
    // outage would produce byte-identical wire bytes and be silently dropped.
    lastSseData = null
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
          // Emit success probe so integrationHealth transitions back to 'online'
          // after a quiet reconnect (server alive but no tool calls firing events).
          if (onProbe) onProbe({ ok: true })
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
      // Report failure probe so integrationHealth transitions to degraded/offline.
      // Without this, health stays frozen at 'online' during outages when SSE is active,
      // because the success-only 'status' handler is the only path that called onProbe.
      if (onProbe) onProbe({ ok: false })
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
      // Cap task — the URL hash is fully attacker-controllable and this payload
      // is delivered to applyExternalStatus WITHOUT passing through the
      // sanitizeAgent/capStr path that office-status messages get. Without this
      // cap a crafted #dev=<1MB> hash injects an unbounded string into the store.
      task: isStatus ? null : capStr(val),
      status: isStatus ? val : 'working',
      label: null,
    })
  }

  if (agents.length === 0 && !params.get('workflow') && !params.get('count')) return null

  return {
    type: 'office-status',
    agents,
    activeCount: parseInt(params.get('count'), 10) || 0,
    workflow: capStr(params.get('workflow')),
    source: capStr(params.get('source')) || 'hash-bridge',
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
        const msg = normalizeStatusMessage({
          type: 'office-status',
          agents: [{ role: role || 'dev', task: title, status, label: null }],
          source: 'title',
        })
        if (msg) callback(msg)
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
  let lastAppliedSeq = null  // cross-channel stale-drop: tracks highest numeric _seq applied

  // Only hook-origin sources share a clock (both produced by Date.now() on the same machine).
  // External sources (postMessage, BroadcastChannel, window global, hash/title) have independent
  // clocks and must not poison lastAppliedSeq or be compared against it for stale-drop.
  const HOOK_ORIGIN = new Set(['claude-cli', 'codex-cli', 'multi-session', 'file-watcher'])
  const isHookOrigin = s => HOOK_ORIGIN.has(s)

  function applyMessage(msg) {
    if (torn) return
    // Only track numeric _seq from hook-origin sources as the high-water mark.
    // External sources (window global, hash-bridge, postMessage) have independent clocks
    // and would poison the guard if their _seq were treated as comparable to hook seqs.
    if (msg._seq && /^\d+$/.test(String(msg._seq)) && isHookOrigin(msg.source)) lastAppliedSeq = msg._seq
    const s = store.getState()

    // Set mood override BEFORE feeding events so pushEventBatch's updateStoreMood sees it
    if (msg.mood) {
      setMoodOverride(msg.mood, msg.moodDuration || 60000)
    }

    // Route agents
    const updates = routeExternalAgents(msg.agents || [])

    // "Hooks not installed" signal — keep the setup prompt visible.
    // _hint:'no-hooks' is authoritative: scanAndMerge sets it precisely when EVERY
    // contributing session is file-watcher, surviving the multi-session merge that
    // rewrites source to 'multi-session' (a plain source==='file-watcher' check would
    // miss that case and wrongly dismiss the prompt). The source check still covers
    // file-watcher messages that never pass through scanAndMerge (e.g. direct postMessage).
    const skipHintDismiss = msg._hint === 'no-hooks' || msg.source === 'file-watcher'

    if (updates.length > 0) {
      s.applyExternalStatus(updates, {
        source: msg.source || 'external',
        seq: msg._seq || null,
        skipHintDismiss,
      })
      s.setStatusSource('external')
      s.setIntegrationSource?.(msg.source || 'external')

      // Feed mood engine — batch to recompute mood once instead of once per agent
      pushEventBatch(updates.map(u => ({ role: u.agentId, status: u.status, task: u.task, hint: u.hint || null })))
    } else if (msg.activeCount > 0) {
      const ids = distributeFallbackCount(msg.activeCount)
      const fallbackUpdates = ids.map(id => ({ agentId: id, status: 'working', task: null, label: null }))
      s.applyExternalStatus(fallbackUpdates, { skipHintDismiss })
      s.setStatusSource('fallback')
      s.setIntegrationSource?.(msg.source || 'fallback')

      // Feed mood engine for the count-only path too. A count-only message (e.g. a
      // '#count=8' hash, with no role keys) produces zero routed agents but N active
      // workers — without this the mood engine never sees those events and mood stays
      // permanently 'idle' even while the office shows 8 busy characters.
      pushEventBatch(fallbackUpdates.map(u => ({ role: u.agentId, status: u.status, task: null, hint: null })))
    }

    if ('workflow' in msg) s.setActiveWorkflow(msg.workflow ?? null)

    resetStalenessTimer()
  }

  function handleIncoming(msg) {
    if (torn || !msg) return
    // Drop cross-channel stale deliveries. Compare against both lastAppliedSeq (already
    // committed to the store) AND pendingMsg._seq (queued but not yet applied). Without
    // the pendingMsg check, a burst of 3 messages in the 150ms window lets a stale
    // heartbeat body (lower seq) clobber a fresher SSE push already in the debounce slot,
    // because lastAppliedSeq hasn't been updated until applyMessage actually runs.
    // Stale-drop only applies to hook-origin messages — they share the same clock.
    // External channels (postMessage, BroadcastChannel, window global, hash/title) have
    // independent clocks and must not be stale-dropped against or used to stale-drop hooks.
    const isNumericSeq = s => s && /^\d+$/.test(s)
    const hookOriginMsg = isHookOrigin(msg.source)
    if (isNumericSeq(msg._seq) && hookOriginMsg) {
      // Clock-skew tolerance: if the incoming seq is more than 5 minutes behind the
      // high-water mark, treat it as a clock reset (NTP large correction, manual change,
      // or a new hook process group) and accept the message rather than freezing updates
      // indefinitely. Small backward steps (NTP ±seconds) are still dropped — correct.
      const SKEW_TOLERANCE_MS = 300_000
      if (isNumericSeq(lastAppliedSeq)) {
        const gap = Number(lastAppliedSeq) - Number(msg._seq)
        if (gap > SKEW_TOLERANCE_MS) {
          // Flush the queued pendingMsg before resetting: it was legitimately queued and
          // may be newer than the skew-tripping message (e.g. hook A queued, straggler B
          // trips the reset). Discarding A silently would be a lost update. Apply it now
          // so the office reflects A's state, then accept B as the new pending.
          if (pendingMsg && isHookOrigin(pendingMsg.source)) {
            if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
            applyMessage(pendingMsg)
          }
          lastAppliedSeq = null
          pendingMsg = null
          if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
        } else if (gap > 0) {
          return  // genuine stale drop within tolerance window
        }
      }
      // Only compare against a hook-origin pendingMsg: a non-hook-origin pending (e.g.
      // window global with an independent clock) must not evict a legitimate hook message.
      if (pendingMsg && isHookOrigin(pendingMsg.source) && isNumericSeq(pendingMsg._seq) && Number(msg._seq) < Number(pendingMsg._seq)) return
    }
    // Passive/non-hook-origin messages must not evict a queued hook-origin message from the
    // debounce slot: a hash-change or title-change within the 150ms window would otherwise
    // discard a fresher SSE/file-poll delivery whose seq comparison block was skipped.
    if (!hookOriginMsg && pendingMsg && isHookOrigin(pendingMsg.source) && isNumericSeq(pendingMsg._seq)) return
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
    // Reverting to 'organic' is owned by clearExternalStatus: its single-id branch
    // already sets statusSource:'organic' + activeWorkflow:null + integrationSource:null
    // once it removes the LAST external entry. Re-doing it here would be redundant
    // (the work is done) and incomplete (it never clears integrationSource), leaving
    // an inconsistent state where statusSource flips back but the stale source label
    // lingers. Let clearExternalStatus be the sole owner of the organic transition.
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
    // SSE permanently failed — stop the slow heartbeat poller and restart at fast rate.
    // Guard against teardown races: if the component is already unmounted (torn=true),
    // a concurrent SSE giveup must not spawn a new poller that leaks outside cleanup.
    if (torn) return
    if (polling.cleanup) { polling.cleanup(); polling.active = false }
    startFastPolling()
  })

  if (sseCleanup && !polling.active) {
    polling.active = true
    // Heartbeat failure probe: only treat genuine reachability failures as health-down.
    // parseError (malformed 200) and non-404 HTTP errors (500/401) mean the server answered —
    // they are proof of life and must not drive integrationHealth offline. networkError and
    // 404 are the only cases where the endpoint is truly unreachable.
    const heartbeatProbe = result => {
      if (result.skipped) return
      if (result.networkError || result.status === 404) handleProbe(result)
    }
    polling.cleanup = startFilePolling(handleIncoming, 10_000, heartbeatProbe)
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
