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
import { VALID_ROLES, VALID_STATUSES, VALID_MOODS, EFFORT_LEVELS, STATUS_POLL_INTERVAL } from '../systems/constants.js'
import { sanitizeCarryFields } from '../utils/statusFields.js'

// ─── Message normalization ─────────────────────────────────────────────

function phaseToStatus(phase) {
  if (!phase) return 'working'
  if (/done|complete|finish/i.test(phase)) return 'done'
  if (/block|stuck|error|fail/i.test(phase)) return 'blocked'
  return 'working'
}

// Stamp `source` + `_seq` defaults onto a message object. Both call sites
// (normalizeStatusMessage's office-status and office-vibe branches) pass an
// object they JUST allocated and exclusively own — the office-status branch
// builds `validated` via a spread, the office-vibe branch passes an inline
// literal. Re-spreading here (`{ ...raw, ... }`) allocated a SECOND full object
// per incoming SSE/poll message on top of the one the caller already built.
// Mutate the caller-owned object in place instead: same result, one allocation.
function withStatusEnvelope(raw, fallbackSource = 'external') {
  if (raw.source == null) raw.source = fallbackSource
  if (raw._seq == null) raw._seq = String(Date.now())
  return raw
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
  // AVO-146: iterate AGENT_CARRY_FIELDS via sanitizeCarryFields — semantics identical to the
  // prior inline logic (capStr for task/label/hint/activeFile; enum-validate for reasonCode).
  const carry = sanitizeCarryFields(a)
  return { role, status: a.status, session, ...carry }
}

// AVO-108: validate a token-usage object from any channel. Returns {ctx,out,model} with
// non-negative integer counts and a capped model string, or undefined for anything malformed.
export function sanitizeTokens(t) {
  if (!t || typeof t !== 'object') return undefined
  const ctx = Number(t.ctx), out = Number(t.out)
  if (!Number.isFinite(ctx) || !Number.isFinite(out)) return undefined
  return {
    ctx: Math.max(0, Math.floor(ctx)),
    out: Math.max(0, Math.floor(out)),
    model: typeof t.model === 'string' ? t.model.slice(0, 40) : null,
  }
}

// Subagent helper-huddle: validate a helpers array from untrusted channels.
// Each entry must have string id + string parentRole (must be one of the 8 VALID_ROLES) +
// optional string label. Caps at 64 entries. Returns the validated array (may be empty),
// or undefined when the field is absent (not an array at all).
export function sanitizeHelpers(raw) {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) return undefined
  return raw
    .filter(h => h && typeof h === 'object'
      && typeof h.id === 'string' && h.id.length > 0
      && typeof h.parentRole === 'string' && VALID_ROLES.includes(h.parentRole))
    .slice(0, 64)
    .map(h => ({
      id: h.id.slice(0, CAP),
      parentRole: h.parentRole,
      label: typeof h.label === 'string' ? h.label.slice(0, CAP) : undefined,
    }))
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
    // Count active agents with a plain loop — `.filter(...).length` allocates a
    // throwaway intermediate array on every SSE message just to read its length.
    let activeCount = 0
    for (const a of agents) {
      if (a.status === 'working' || a.status === 'blocked') activeCount++
    }
    const validated = {
      ...raw,
      agents,
      activeCount,
      workflow: capStr(raw.workflow),
      // Cap `source` — it is spread uncapped from `raw` and untrusted in-browser
      // channels (postMessage, BroadcastChannel, window.__office_status__) reach this
      // branch directly. Without the cap a crafted office-status message injects an
      // unbounded `source` string into the store (setIntegrationSource) and into every
      // isHookOrigin() comparison. Mirrors the agent/task/workflow capping already done
      // here and the slug capping R79 added for office-vibe. capStr falls back to null
      // when `source` is absent so withStatusEnvelope still applies its fallbackSource.
      source: capStr(raw.source) || undefined,
      mood: VALID_MOODS.includes(raw.mood) ? raw.mood : undefined,
      // AVO-108: validate the token-usage object — untrusted channels reach this branch, so
      // a crafted `tokens` must not inject unbounded strings / non-numbers into the store.
      tokens: sanitizeTokens(raw.tokens),
      // AVO-102: effort level — only the 5 known ordinal values pass.
      effort: EFFORT_LEVELS.includes(raw.effort) ? raw.effort : undefined,
      // Subagent helper-huddle: validate helpers array — each entry must have string id,
      // string parentRole (one of the 8 base roles), and optional string label.
      // Capped at 64 entries; malformed array or wrong parentRole → omit the field entirely.
      helpers: sanitizeHelpers(raw.helpers),
    }
    if (validated.source === undefined) delete validated.source
    if (validated.mood === undefined) delete validated.mood
    if (validated.tokens === undefined) delete validated.tokens
    if (validated.effort === undefined) delete validated.effort
    if (validated.helpers === undefined) delete validated.helpers
    return withStatusEnvelope(validated)
  }

  // Legacy office-vibe → convert (uses agentRouter for command→role mapping).
  // Cap task/workflow here too — office-vibe is reachable from untrusted channels
  // (postMessage, ?command= URL param) and must not bypass the CAP that the
  // office-status branch enforces via sanitizeAgent/capStr.
  if (raw.type === 'office-vibe') {
    // Sanitize raw.agent through the SAME sanitizeRoleId the office-status branch uses.
    // Without this, a crafted office-vibe { agent: '<8KB>~dev' } passes a bare slug~role
    // composite straight into the store as an unbounded dynamic agent id (used as a React
    // key, persisted in dailyDoneLedger). sanitizeRoleId caps the slug at SLUG_CAP and
    // rejects invalid bare roles (which then correctly fall through to command routing).
    const sanitizedRole = sanitizeRoleId(raw.agent)
    return withStatusEnvelope({
      type: 'office-status',
      agents: [{
        role: sanitizedRole || routeTaskToAgent(raw.command) || null,
        task: capStr(raw.command),
        status: phaseToStatus(raw.phase),
        label: null,
      }],
      workflow: capStr(raw.workflow),
      // Cap the fallback source: office-vibe is reachable from untrusted channels
      // (postMessage, ?source= URL param via inferFromParams) and raw.source flows
      // straight into withStatusEnvelope's `source` field uncapped otherwise.
    }, capStr(raw.source) || 'legacy')
  }

  return null
}

// ─── applyMessage decision helpers (pure — extracted for direct testing) ──
// These encode the routing/skip decisions made inside startStatusIntegration's
// applyMessage/handleIncoming. They are pure (no DOM, no store) so they can be
// unit-tested without an EventSource/window mocking harness.

// Only hook-origin sources share a clock (both produced by Date.now() on the same
// machine). External sources (postMessage, BroadcastChannel, window global, hash/
// title) have independent clocks and must not poison the stale-drop high-water mark.
const HOOK_ORIGIN = new Set(['claude-cli', 'codex-cli', 'multi-session', 'file-watcher'])

export function isHookOrigin(source) {
  return HOOK_ORIGIN.has(source)
}

// Which of `updates` represent a REAL status/task change vs the prior externalStatus snapshot.
// Used to gate the moodEngine feed: a poll/heartbeat that re-delivers unchanged statuses (new ETag
// from a cosmetic re-write) must not push repeated events into the sliding-window mood/teamPulse
// (false 'rushing'/'intense' + pinned teamPulse → bad weather/lean-in cascade). Mirrors the
// sigChanged gate in store.applyExternalStatus. Pure → directly testable.
export function changedUpdates(prevExt, updates) {
  const prev = prevExt || {}
  return (updates || []).filter((u) => {
    const p = prev[u.agentId]
    return !p || p.status !== u.status || (p.task || '') !== (u.task || '')
  })
}

// A 'multi-session' payload is an AUTHORITATIVE full snapshot produced by scanAndMerge from
// ALL active worktree sessions. Its `_seq` is the MAX of the contributing sessions' seqs —
// NOT a monotonic clock. When the session holding the highest seq exits, the merged `_seq`
// legitimately DROPS, so the normal hook-origin seq stale-drop would wrongly discard that
// exit-reconcile and leave the departed worktree's agent on screen until its 5-min expiry.
// These payloads are deduped by content (SSE wire-bytes / poll ETag+body) at the transport
// layer, so exempting them from the seq stale-drop is safe — they always apply, but identical
// content still can't spam. (It stays hook-origin for the non-hook-origin eviction guard.)
export function isAuthoritativeSnapshotSource(source) {
  return source === 'multi-session'
}

/**
 * "Hooks not installed" signal — when true, applyExternalStatus must NOT dismiss the
 * setup prompt (hasEverReceivedStatus stays false).
 *
 * _hint:'no-hooks' is authoritative: scanAndMerge sets it precisely when EVERY
 * contributing session is file-watcher, surviving the multi-session merge that
 * rewrites source to 'multi-session' (a plain source==='file-watcher' check would
 * miss that case). The source check still covers file-watcher messages that never
 * pass through scanAndMerge (e.g. direct postMessage).
 */
export function shouldSkipHintDismiss(msg) {
  if (!msg || typeof msg !== 'object') return false
  return msg._hint === 'no-hooks' || msg.source === 'file-watcher'
}

// A numeric _seq is a same-machine monotonic clock value. Colon-joined or otherwise
// non-numeric seqs (external channels, hash-bridge) must fail this guard so they are
// never compared against hook-origin seqs for stale-drop.
export function isNumericSeq(seq) {
  return typeof seq === 'string' && /^\d+$/.test(seq)
}

// What the staleness sweep should do after STALENESS_TIMEOUT of no updates.
// - 'clear-external': an external source is showing → clear external status (which also
//   resets activeWorkflow + statusSource back to organic).
// - 'clear-workflow': statusSource is already organic but an activeWorkflow lingers. This
//   happens when a workflow-only message (e.g. a `#workflow=Build+Feature` hash with no role
//   keys) calls setActiveWorkflow WITHOUT any external agents — statusSource never left
//   'organic', so the external-clear path is skipped and the green banner would otherwise
//   stay pinned over an idle office forever. Clear just the orphaned workflow.
// - 'noop': nothing stale to clear.
export function stalenessSweepAction(statusSource, activeWorkflow) {
  if (statusSource !== 'organic') return 'clear-external'
  if (activeWorkflow != null) return 'clear-workflow'
  return 'noop'
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

// Compute a content signature for the window global payload. The documented
// window.__office_status__ shape has no _seq field; the CLI mutates the object
// in place so data._seq never changes and raw-_seq dedup delivers only once.
// Dedupe on a JSON signature of the fields that actually change: agents,
// workflow, helpers, tokens, effort, and mood. Agents is the primary signal;
// the rest are secondary but must also trigger delivery when they change alone
// (e.g. a helpers-only SubagentStart delta where agents + workflow are the same).
// We operate on a shallow copy so we never mutate the externally-owned global.
export function _globalPayloadSig(data) {
  try {
    return JSON.stringify({
      agents: data.agents,
      workflow: data.workflow ?? null,
      helpers: data.helpers ?? null,
      tokens: data.tokens ?? null,
      effort: data.effort ?? null,
      mood: data.mood ?? null,
    })
  } catch {
    return String(data._seq ?? '')
  }
}

function startPolling(callback, intervalMs = 2000) {
  let lastSig = null
  const timer = setInterval(() => {
    const data = window.__office_status__
    if (!data) return
    // Work on a shallow copy so normalizeStatusMessage (and withStatusEnvelope)
    // never mutate the externally-owned global object.
    const copy = { ...data }
    const sig = _globalPayloadSig(copy)
    if (sig !== lastSig) {
      lastSig = sig
      const msg = normalizeStatusMessage(copy)
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

  // Parse the count ONCE. A literal '#count=0' yields the string '0' — truthy, so a
  // raw `!params.get('count')` guard would treat it as a valid count message. parseInt
  // gives 0 (= "no active agents"), which makes the message inert: applyMessage's
  // `activeCount > 0` branch is skipped. An inert message must not be delivered at all —
  // delivering it still triggers resetStalenessTimer(), so a stray '#count=0' would keep
  // a stale external status alive for another 2 minutes. Only treat count as present
  // when it parses to a positive integer.
  const parsedCount = parseInt(params.get('count'), 10)
  const hasCount = Number.isFinite(parsedCount) && parsedCount > 0

  if (agents.length === 0 && !params.get('workflow') && !hasCount) return null

  return {
    type: 'office-status',
    agents,
    activeCount: hasCount ? parsedCount : 0,
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

// AVO-174: heuristic role-hint patterns ONLY. The conclusive/alarming `blocked` and `done` mappings
// were REMOVED — a weak page-title match (a browser tab titled "build failed" or "all done") must
// never fabricate the most-alarming (blocked) or a completion (done) state; those require a real hook
// signal, not a title heuristic. The title channel can only HINT that a role is working.
const TITLE_PATTERNS = [
  { pattern: /implement|coding|writing code|building/i, role: 'dev', status: 'working' },
  { pattern: /testing|reviewing|linting/i, role: 'qa', status: 'working' },
  { pattern: /planning|spec|bootstrap/i, role: 'pm', status: 'working' },
  { pattern: /deploy|shipping|release/i, role: 'ops', status: 'working' },
  { pattern: /research|analyzing|exploring/i, role: 'res', status: 'working' },
  { pattern: /design|architect|brainstorm/i, role: 'arch', status: 'working' },
]

// Exported for testing. Returns a heuristic { role, status } hint for a document title, or null.
// By construction it can only ever return status: 'working' (AVO-174 honesty floor).
export function classifyTitle(title) {
  if (typeof title !== 'string') return null
  for (const { pattern, role, status } of TITLE_PATTERNS) {
    if (pattern.test(title)) return { role: role || 'dev', status }
  }
  return null
}

function listenTitleChanges(callback) {
  let lastTitle = document.title

  const observer = new MutationObserver(() => {
    const title = document.title
    if (title === lastTitle) return
    lastTitle = title

    const hint = classifyTitle(title)
    if (!hint) return
    const msg = normalizeStatusMessage({
      type: 'office-status',
      agents: [{ role: hint.role, task: title, status: hint.status, label: null }],
      source: 'title',
    })
    if (msg) callback(msg)
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

  function applyMessage(msg) {
    if (torn) return
    // Only track numeric _seq from hook-origin sources as the high-water mark.
    // External sources (window global, hash-bridge, postMessage) have independent clocks
    // and would poison the guard if their _seq were treated as comparable to hook seqs.
    if (msg._seq && /^\d+$/.test(String(msg._seq)) && isHookOrigin(msg.source) && !isAuthoritativeSnapshotSource(msg.source)) lastAppliedSeq = msg._seq
    const s = store.getState()

    // Set mood override BEFORE feeding events so pushEventBatch's updateStoreMood sees it
    if (msg.mood) {
      setMoodOverride(msg.mood, msg.moodDuration || 60000)
    }

    // AVO-108: token usage is session-level (independent of agent routing). Apply it directly
    // — presence semantics in setTokens preserve the last value when a message carries none.
    if (msg.tokens) s.setTokens(msg.tokens)
    // AVO-102: effort level (also session-level) drives the thinking aura.
    if (msg.effort) s.setEffort(msg.effort)
    // Subagent helper-huddle: helpers is present-or-absent (not presence-semantic like tokens).
    // Explicit helpers:[] (empty array) must clear the slice — a stopped turn removes helpers.
    // When the field is absent (undefined after normalizeStatusMessage deleted it), do NOT
    // clear — the hook re-sends the authoritative list each poll, and store TTL self-heals.
    if (msg.helpers !== undefined) s.setHelpers(msg.helpers)

    // Route agents
    const updates = routeExternalAgents(msg.agents || [])

    // "Hooks not installed" signal — keep the setup prompt visible (see shouldSkipHintDismiss).
    const skipHintDismiss = shouldSkipHintDismiss(msg)

    // The integration-channel fields (statusSource, integrationSource, activeWorkflow)
    // are passed through applyExternalStatus's meta so the whole update lands in ONE
    // store set() instead of four. `hasWorkflow` is a separate flag because `workflow`
    // can legitimately be null — `'workflow' in msg` is the presence test, distinct
    // from a workflow value of null.
    const hasWorkflow = 'workflow' in msg

    if (updates.length > 0) {
      const prevExt = s.externalStatus // pre-apply snapshot (s captured at top, before this set())
      s.applyExternalStatus(updates, {
        source: msg.source || 'external',
        seq: msg._seq || null,
        skipHintDismiss,
        statusSource: 'external',
        integrationSource: msg.source || 'external',
        hasWorkflow,
        workflow: msg.workflow ?? null,
      })

      // Feed mood engine ONLY for agents whose status/task ACTUALLY changed. A poll/heartbeat that
      // re-delivers the same statuses (new ETag from a cosmetic re-write) must NOT push repeated
      // events into the sliding-window mood/teamPulse — that falsely trips 'rushing'/'intense' and
      // pins teamPulse high, cascading to weather + the L2 lean-in + real-seed. Same change-gate as
      // the bubble/feed/changedAt guards in applyExternalStatus.
      const changed = changedUpdates(prevExt, updates)
      if (changed.length) {
        pushEventBatch(changed.map(u => ({ role: u.agentId, status: u.status, task: u.task, hint: u.hint || null })))
      }
    } else if (msg.activeCount > 0) {
      const prevExt = s.externalStatus
      const ids = distributeFallbackCount(msg.activeCount)
      const fallbackUpdates = ids.map(id => ({ agentId: id, status: 'working', task: null, label: null }))
      s.applyExternalStatus(fallbackUpdates, {
        skipHintDismiss,
        statusSource: 'fallback',
        integrationSource: msg.source || 'fallback',
        hasWorkflow,
        workflow: msg.workflow ?? null,
      })

      // Feed mood engine for the count-only path too. A count-only message (e.g. a
      // '#count=8' hash, with no role keys) produces zero routed agents but N active
      // workers — without this the mood engine never sees those events and mood stays
      // permanently 'idle' even while the office shows 8 busy characters.
      const changedFallback = changedUpdates(prevExt, fallbackUpdates)
      if (changedFallback.length) {
        pushEventBatch(changedFallback.map(u => ({ role: u.agentId, status: u.status, task: null, hint: null })))
      }
    } else if (msg.source === 'multi-session') {
      // Empty multi-session payload — every worktree session's agents are all 'done'
      // (or idle), so scanAndMerge's merge produced zero working/blocked representatives.
      // applyExternalStatus's reconciliation block (gated on source==='multi-session')
      // must still run: it evicts the dynamic 'slug~role' agents spawned by prior ticks.
      // Without this call, those phantom workers linger with their stale 'working' status
      // and 5-min expiresAt — the office shows finished worktree sessions as still busy.
      // updates is empty → `present` is empty → ALL session-carrying agents are evicted,
      // which is correct: an all-done multi-session payload means none are active.
      // If the eviction leaves zero external agents, transition statusSource back to
      // 'organic' immediately. Otherwise the store keeps statusSource:'external' (a green
      // "live" dot) over an empty office for up to STALENESS_TIMEOUT (2 min) until the
      // staleness timer fires clearExternalStatus. clearExternalStatus only flips to
      // 'organic' when it itself empties externalStatus — here applyExternalStatus does the
      // emptying. `clearSourceIfEmpty` makes applyExternalStatus decide this INSIDE its own
      // reducer (it knows the post-eviction externalStatus), so the source/workflow reset
      // lands in the SAME set() — no second store write, no extra subscriber wake-up.
      s.applyExternalStatus([], {
        source: 'multi-session',
        seq: msg._seq || null,
        skipHintDismiss,
        clearSourceIfEmpty: true,
        hasWorkflow,
        workflow: msg.workflow ?? null,
      })
    } else if (hasWorkflow) {
      // No agent updates and no fallback count, but the message still carries a
      // workflow field (e.g. a workflow-only hash). Apply it as a standalone single
      // set() — the prior code reached this via the trailing setActiveWorkflow call.
      s.setActiveWorkflow(msg.workflow ?? null)
    }

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
        } else if (gap > 0 && !isAuthoritativeSnapshotSource(msg.source)) {
          return  // genuine stale drop within tolerance window
          // (multi-session snapshots are exempt — their merged _seq drops legitimately on
          //  session exit; see isAuthoritativeSnapshotSource. Content-dedup prevents spam.)
        }
      }
      // Only compare against a hook-origin pendingMsg: a non-hook-origin pending (e.g.
      // window global with an independent clock) must not evict a legitimate hook message.
      if (pendingMsg && isHookOrigin(pendingMsg.source) && isNumericSeq(pendingMsg._seq) && Number(msg._seq) < Number(pendingMsg._seq) && !isAuthoritativeSnapshotSource(msg.source)) return
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
      const action = stalenessSweepAction(s.statusSource, s.activeWorkflow)
      if (action === 'clear-external') {
        s.clearExternalStatus()
      } else if (action === 'clear-workflow') {
        // Orphaned workflow-only banner (e.g. a `#workflow=X` hash) — statusSource stayed
        // 'organic' so clearExternalStatus never ran; clear the lingering banner directly.
        s.setActiveWorkflow(null)
      }
    }, STALENESS_TIMEOUT)
  }

  // Expiry checker — clears 'done' agents after their expiresAt + prunes stale helpers
  const expiryInterval = setInterval(() => {
    const s = store.getState()
    const now = Date.now()
    // Prune helpers whose TTL has expired (60s safety window). A missed SubagentStop
    // self-heals here rather than accumulating stale helper figures at the desk.
    s.pruneHelpers()
    // Iterate keys directly — Object.entries() allocates a [id,ext] pairs array
    // on every 5s expiry tick. Both id and ext are read in place below.
    const ext0 = s.externalStatus
    for (const id of Object.keys(ext0)) {
      const ext = ext0[id]
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
