import { AGENT_CARRY_FIELDS } from '../utils/statusContract.mjs'

// Build the externalStatus entry for one routed agent update.
//
// This is intentionally renderer-agnostic: no store, React, pixel movement, bubbles, ledgers, or
// i18n. Consumers that render status in another UI can still share the exact truth-maintenance rules:
// - changedAt moves only on status/task signature changes, not on every poll refresh.
// - activeFileAt moves independently when activeFile changes, even if task remains "Edit".
// - done expires quickly; active working/blocked/planning-style states get the longer backstop.
export function buildExternalStatusEntry(prevExt, update, now) {
  const sigChanged = !prevExt || prevExt.status !== update.status || (prevExt.task || '') !== (update.task || '')
  const nextActiveFile = update.activeFile || null
  const fileChanged = !prevExt || (prevExt.activeFile || null) !== nextActiveFile
  const activeFileAt = nextActiveFile == null
    ? null
    : (fileChanged ? now : (Number.isFinite(prevExt.activeFileAt) ? prevExt.activeFileAt : now))
  const carryFields = {}
  for (const field of AGENT_CARRY_FIELDS) {
    if (field === 'activeFile') continue
    carryFields[field] = update[field] || null
  }
  return {
    entry: {
      status: update.status,
      ...carryFields,
      activeFile: nextActiveFile,
      activeFileAt,
      expiresAt: update.status === 'done' ? now + 10000 : now + 300000,
      changedAt: sigChanged ? now : (Number.isFinite(prevExt?.changedAt) ? prevExt.changedAt : now),
    },
    sigChanged,
  }
}

// A dynamic status agent is any live agent that is not part of the active static roster. Session
// agents are always dynamic; null-session fallback/hash agents are dynamic only when absent from the
// injected static roster. Keep the roster injected so this runtime rule does not depend on the pixel
// office's character config.
export function isDynamicStatusAgent(id, agent, staticRosterIds = []) {
  if (!agent) return false
  const roster = staticRosterIds instanceof Set ? staticRosterIds : new Set(staticRosterIds || [])
  return Boolean(agent.session) || !roster.has(id)
}

// Build a dynamic agent from an injected visual/base agent and injected position. This owns only the
// status-lifecycle defaults; the renderer supplies the positioning policy.
export function buildDynamicStatusAgent(baseAgent, { agentId, session = null, position } = {}) {
  if (!baseAgent || !agentId || !position) return null
  const pos = { ...position }
  return {
    ...baseAgent,
    id: agentId,
    session: session || null,
    position: { ...pos },
    targetPosition: { ...pos },
    isMoving: false,
    status: 'idle',
    returnHomeOnIdle: false,
    bubble: null,
    inGroupEvent: false,
    deskItemCount: { coffee: 0, sticky: 0, books: 0 },
    groupTarget: null,
  }
}

// Multi-session payloads are complete snapshots of currently-active session agents. Remove prior
// session-carrying dynamics that disappeared from the new payload; null-session dynamics are left
// alone because single hash/postMessage fallbacks are not part of this snapshot contract.
export function reconcileMultiSessionAgents({ agents = {}, externalStatus = {}, updates = [], selectedAgent = null } = {}) {
  const present = new Set((updates || []).map((u) => u?.agentId).filter(Boolean))
  const evicted = []
  for (const id of Object.keys(agents || {})) {
    const agent = agents[id]
    if (agent && agent.session && !present.has(id)) evicted.push(id)
  }
  if (evicted.length === 0) {
    return {
      agents,
      externalStatus,
      evicted,
      evictedSelected: false,
      changed: false,
    }
  }
  const nextAgents = { ...agents }
  const nextExternalStatus = { ...externalStatus }
  let evictedSelected = false
  for (const id of evicted) {
    delete nextAgents[id]
    delete nextExternalStatus[id]
    if (selectedAgent === id) evictedSelected = true
  }
  return {
    agents: nextAgents,
    externalStatus: nextExternalStatus,
    evicted,
    evictedSelected,
    changed: true,
  }
}

// Build the integration-channel patch for one incoming status message.
//
// This is the renderer/runtime-facing state that says where the status stream came from and which
// workflow is currently active. Omit unchanged fields so subscribers do not invalidate on every poll.
// clearSourceIfEmpty is the authoritative multi-session eviction path: when the merged external
// snapshot is empty, it reverts the source back to organic even if stale meta still says external.
export function assembleIntegrationPatch(state = {}, meta = {}, externalStatus = {}) {
  const patch = {}
  const revertToOrganic = meta.clearSourceIfEmpty && Object.keys(externalStatus || {}).length === 0
  if (revertToOrganic) {
    if (state.statusSource !== 'organic') patch.statusSource = 'organic'
    if (state.integrationSource !== null) patch.integrationSource = null
  } else {
    if (meta.statusSource !== undefined && meta.statusSource !== state.statusSource) {
      patch.statusSource = meta.statusSource
    }
    if (meta.integrationSource !== undefined && (meta.integrationSource || null) !== state.integrationSource) {
      patch.integrationSource = meta.integrationSource || null
    }
  }
  if (meta.hasWorkflow && (meta.workflow ?? null) !== state.activeWorkflow) {
    patch.activeWorkflow = meta.workflow ?? null
  }
  return patch
}
