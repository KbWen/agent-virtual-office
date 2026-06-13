// AVO-107 — Gate "waiting" derivation (PURE, no React/DOM).
//
// HONEST SCOPE (panel-decided): the only per-agent "waiting" signal AVO owns is
// `status === 'awaiting-approval'`, which idleGapInfer infers from blocked + 90s quiet. So this is a
// "waiting on a human/approval" indicator, NOT a confirmed review-submission queue. We therefore:
//   - count ONLY awaiting-approval agents (never activeWorkflow membership — that's global/transient
//     and already drawn as AVO-105 handoff arrows),
//   - expose at most ONE global phase glyph (review/ship) from activeWorkflow, never a per-agent type
//     (no per-agent phase exists → per-ticket type would be fabrication),
//   - return count 0 / empty names when nobody waits → caller renders nothing (no phantom queue).

const WAITING_STATUS = 'awaiting-approval'

// Single global phase hint from the (string) activeWorkflow. Restricted to review/ship — the only
// phases an approval-gate glyph honestly maps to; anything else (incl. null) → null (no glyph).
export function gatePhaseGlyph(activeWorkflow) {
  if (typeof activeWorkflow !== 'string') return null
  if (/review/i.test(activeWorkflow)) return 'review'
  if (/ship|deploy|release/i.test(activeWorkflow)) return 'ship'
  return null
}

// Derive the gate-waiting view-model from the live agents map + activeWorkflow.
//   agents: { [id]: { status, ... } }   activeWorkflow: string|null
// Returns { count, names, phaseGlyph }. names are the raw agent ids (caller localizes via charName).
export function gateWaiting(agents, activeWorkflow = null) {
  const names = []
  for (const id of Object.keys(agents || {})) {
    if (agents[id] && agents[id].status === WAITING_STATUS) names.push(id)
  }
  return { count: names.length, names, phaseGlyph: gatePhaseGlyph(activeWorkflow) }
}

// Visual sheet cap — N waiters aggregate into at most this many askew sheets (the true N is the count).
export const GATE_SHEET_CAP = 3
