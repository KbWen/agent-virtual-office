/**
 * AVO-105 — workflow phase transitions trigger subtle handoff arrows.
 *
 * When `activeWorkflow` flips between specific phase pairs, fire a `addHandoff`
 * between the role pair that semantically owns that transition. The handoff uses
 * the `subtle: true` flag so the existing FlyingDocument renders the calm
 * variant (no sparkle, no scale pulse, reduced rotation) — per AVO-105 design
 * brief "畫面要清楚好懂、不過分花俏".
 *
 * Explicit table, not heuristics. If a workflow combination isnt listed here,
 * no handoff fires. Keeping the table small ensures arrows are meaningful
 * signals, not visual noise.
 *
 * Boot safety: the initial activeWorkflow of `null → /something` is NOT a
 * transition (its first observation) and does not fire. Same for any side
 * of the pair being null.
 */
// Workflow string normaliser — mirrors the same logic in classify.js so
// `/Ship`, `ship`, `/SHIP` all hash to the same key. Inlined to avoid coupling
// AVO-105 to a non-exported internal of classify.js.
function normalizeWorkflow(workflow) {
  if (typeof workflow !== 'string' || workflow.length === 0) return null
  return workflow.replace(/^\/+/, '').toLowerCase()
}

// `from` and `to` keys are the canonical lowercase workflow names (no leading
// slash) so `classifyWorkflow`s normalization matches.
const HANDOFFS = Object.freeze({
  'spec-intake→spec': { from: 'pm',   to: 'arch' },  // requirements → design
  'spec→plan':         { from: 'arch', to: 'pm'   },  // spec → planning
  'plan→implement':    { from: 'arch', to: 'dev'  },  // plan → coding
  'implement→test':    { from: 'dev',  to: 'qa'   },  // code → testing
  'implement→review':  { from: 'dev',  to: 'gate' },  // code → review
  'test→review':       { from: 'qa',   to: 'gate' },  // tests → review
  'review→ship':       { from: 'gate', to: 'ops'  },  // approved → deploy
})

/**
 * Start a subscription to the office store; fire workflow handoffs on
 * recognized phase transitions. Returns an unsubscribe function.
 */
export function startWorkflowHandoffs(store) {
  if (typeof store?.getState !== 'function' || typeof store?.subscribe !== 'function') {
    return () => {}
  }
  let prevWorkflow = store.getState().activeWorkflow ?? null
  return store.subscribe((state) => {
    const next = state.activeWorkflow ?? null
    if (next === prevWorkflow) return
    // CRITICAL: update `prevWorkflow` BEFORE calling addHandoff. Zustand fires
    // listeners synchronously on every setState — addHandoff mutates state,
    // which re-fires this listener; without the early advance, the closure
    // variable still equals the OLD workflow when the re-entrant call observes
    // the SAME `next` and tries to fire the handoff again → infinite loop.
    const prev = prevWorkflow
    prevWorkflow = next
    // No handoff when either side is null — only fire on phase→phase transitions.
    if (prev != null && next != null) {
      const fromKey = normalizeWorkflow(prev)
      const toKey = normalizeWorkflow(next)
      const handoff = fromKey && toKey ? HANDOFFS[`${fromKey}→${toKey}`] : null
      if (handoff) {
        const { agents, addHandoff } = state
        // Both endpoint agents must exist in the current roster; in lightweight
        // mode (planner/worker/checker) the named roles arent present and the
        // handoff is silently skipped.
        if (agents[handoff.from] && agents[handoff.to] && typeof addHandoff === 'function') {
          addHandoff(handoff.from, handoff.to, { subtle: true })
        }
      }
    }
  })
}

// Test-only: expose the table so tests can iterate it without re-declaring.
export const WORKFLOW_HANDOFFS = HANDOFFS
