/**
 * #C — Idle-gap inference: close Pixel Agents' admitted heuristic gap.
 *
 * When an agent's status has not received a hook update for a long time,
 * infer one of two non-emitted Claude/Codex states that the office should
 * still visualize:
 *
 *   working + no update for ≥ 45s   →  status = 'thinking'
 *       (Claude is in extended thinking, no PreToolUse fires meanwhile)
 *
 *   blocked + no update for ≥ 90s   →  status = 'awaiting-approval'
 *       (likely sitting at a permission prompt the user hasnt answered)
 *
 * Conservative on purpose: a normal 30-60s Bash test can produce no
 * intermediate events. The 45s threshold catches genuinely stalled work
 * while a 30s threshold (e.g. Pixel Agents-style) would misfire on every
 * test run. 90s for blocked is even more conservative — permission
 * prompts often go unanswered for minutes.
 *
 * Reversibility: any real hook event flows through `applyExternalStatus`
 * which simply overwrites the status; the inferred state has no marker
 * to clean up. To prevent thrashing while inferred, we skip re-inferring
 * agents already in 'thinking' / 'awaiting-approval'.
 *
 * lastUpdatedAt tracking: zustand subscribe captures every state change
 * to `agents`. We stamp the current time whenever an agent's status or
 * task field changes (not on position/behavior — those tick organically).
 *
 * Polling cadence: 10s. Coarser than #8 (5s) since the thresholds are
 * larger (45s / 90s) so fewer chances are needed and we save wakeups.
 */

const WORKING_GAP_MS = 45_000   // 45s → thinking
const BLOCKED_GAP_MS = 90_000   // 90s → awaiting-approval
const POLL_INTERVAL_MS = 10_000

// Map of agentId → last meaningful update timestamp. Survives across
// reactivity because the polling loop keeps a stable reference.
const lastUpdatedAt = new Map()

// Status values produced by inference. We skip re-inferring when the
// current status is already one of these to prevent thrashing.
const INFERRED_STATUSES = new Set(['thinking', 'awaiting-approval'])

function tick(store, opts, now = Date.now) {
  const t0 = now()
  const state = store.getState()
  const agents = state.agents
  const updates = []
  for (const id of Object.keys(agents)) {
    const a = agents[id]
    if (!a) continue
    // Seed lastUpdatedAt for agents we havent seen before.
    if (!lastUpdatedAt.has(id)) {
      lastUpdatedAt.set(id, t0)
      continue
    }
    const elapsed = t0 - lastUpdatedAt.get(id)
    if (a.status === 'working' && elapsed >= opts.workingGapMs) {
      // Skip if already inferred to avoid thrashing.
      if (INFERRED_STATUSES.has(a.status)) continue
      updates.push({ agentId: id, status: 'thinking' })
    } else if (a.status === 'blocked' && elapsed >= opts.blockedGapMs) {
      if (INFERRED_STATUSES.has(a.status)) continue
      updates.push({ agentId: id, status: 'awaiting-approval' })
    }
  }
  if (updates.length > 0) {
    // Route through applyExternalStatus so the inferred state passes through
    // the same pipeline as real hooks: behavior selection (decideBehavior with
    // classifyStatus mapping COGNITION/GATE families), mood engine event, etc.
    // The source marker tells downstream observers this was inferred.
    state.applyExternalStatus(updates, {
      source: 'idle-gap-infer',
      // No mood event for inferred — we dont want classifyStatus 'thinking' to
      // count toward rushing/frustrated/stuck patterns.
      hasWorkflow: false,
    })
    // Reset clocks for the inferred agents so we dont immediately re-infer.
    const t1 = opts.now()
    for (const u of updates) lastUpdatedAt.set(u.agentId, t1)
  }
}

/**
 * Internal: stamp lastUpdatedAt whenever an agent's status or task changes.
 * Subscribing to the FULL agents object would fire on every position tick
 * (movementSystem mutates position 60 times per second). We track only the
 * (status, task) signature.
 */
function computeSig(agents) {
  if (!agents) return ''
  let sig = ''
  for (const id of Object.keys(agents)) {
    const a = agents[id]
    sig += `${id}:${a?.status ?? ''}:${a?.task ?? ''};`
  }
  return sig
}

function subscribeAgentUpdates(store, now = Date.now) {
  // Initialize prevSig to the current state so the FIRST listener call
  // only sees real diffs — without this, every agent in the initial roster
  // would be treated as "newly added" and get stamped on the first store
  // mutation, defeating the gap-detection logic.
  let prevSig = computeSig(store.getState().agents)
  return store.subscribe((state) => {
    const nextSig = computeSig(state.agents)
    if (nextSig === prevSig) return
    // At least one agent's status/task changed. Diff which one and stamp.
    // For simplicity we re-stamp all agents whose signature differs from
    // before; the cost is O(n) per change which is fine for n ≤ ~20.
    const prevMap = parseSig(prevSig)
    const nextMap = parseSig(nextSig)
    const t = now()
    for (const [id, sig] of nextMap.entries()) {
      if (prevMap.get(id) !== sig) lastUpdatedAt.set(id, t)
    }
    prevSig = nextSig
  })
}

function parseSig(sig) {
  const m = new Map()
  if (!sig) return m
  for (const part of sig.split(';')) {
    if (!part) continue
    const colonIdx = part.indexOf(':')
    if (colonIdx <= 0) continue
    m.set(part.slice(0, colonIdx), part.slice(colonIdx + 1))
  }
  return m
}

/**
 * Start idle-gap inference. Returns a stop function that clears both
 * the polling interval and the agent subscription.
 *
 * Options:
 *   workingGapMs   — gap before inferring 'thinking' (default 45000)
 *   blockedGapMs   — gap before inferring 'awaiting-approval' (default 90000)
 *   intervalMs     — polling interval (default 10000)
 *   now            — clock injector for deterministic tests (default Date.now)
 */
export function startIdleGapInference(store, options = {}) {
  const opts = {
    workingGapMs: options.workingGapMs ?? WORKING_GAP_MS,
    blockedGapMs: options.blockedGapMs ?? BLOCKED_GAP_MS,
    intervalMs:   options.intervalMs   ?? POLL_INTERVAL_MS,
    now:          options.now           ?? Date.now,
  }
  if (typeof store?.getState !== 'function' || typeof store?.subscribe !== 'function') {
    return () => {}
  }
  if (typeof setInterval === 'undefined') {
    return () => {}
  }
  const unsubscribe = subscribeAgentUpdates(store, opts.now)
  // Seed lastUpdatedAt for all current agents so the very first tick doesnt
  // immediately fire on the agents that have been sitting idle since app boot.
  const t0 = opts.now()
  const seed = store.getState().agents
  if (seed) for (const id of Object.keys(seed)) lastUpdatedAt.set(id, t0)
  const intervalId = setInterval(() => tick(store, opts, opts.now), opts.intervalMs)
  return function stopIdleGapInference() {
    if (typeof clearInterval !== 'undefined') clearInterval(intervalId)
    if (typeof unsubscribe === 'function') unsubscribe()
    // Prune Map entries for agents no longer present in the store so
    // evicted/worktree agents don't accumulate across spawned instances (fix #3).
    const currentAgents = store.getState?.()?.agents ?? {}
    for (const agentId of lastUpdatedAt.keys()) {
      if (!(agentId in currentAgents)) lastUpdatedAt.delete(agentId)
    }
  }
}

/** Test helper: wipe internal state. */
export function _resetIdleGapState() {
  lastUpdatedAt.clear()
}
