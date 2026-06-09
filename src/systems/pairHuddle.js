/**
 * AVO-106 — Co-editing pair detector (PURE).
 *
 * Honest shared-file correlation: returns the two distinct agents that are BOTH currently
 * co-editing the byte-identical file, or null. The caller (officeLife) turns a non-null result
 * into a pure in-place overlay (a faint desk-to-desk link — NOT a relocating event). This module
 * asserts nothing it cannot prove from the live externalStatus snapshot — see
 * docs/specs/pair-programming-huddle.md §Honesty Contract.
 *
 *   - distinct identities — externalStatus keys are unique agent ids; two events that collapse
 *     to the same role are ONE key, so they can never form a pair (we never invent a 2nd agent).
 *   - byte-identical path — compared on the FULL normalized path, not the basename, so two
 *     different `index.js` in different dirs are NOT "the same file".
 *   - recency — each agent's activeFileAt must be within `window`; a stale file does not huddle.
 *   - not idle — an idle agent is not "working on" anything.
 *   - co-EDITING (not reading) — this detector trusts that `activeFile` is already write-class only.
 *     The Read-exclusion is enforced at the SOLE producer (`activeFileForTool` in the hook): Read
 *     never publishes an activeFile, so a co-read can never reach this snapshot. (The transport
 *     whitelists carry the field verbatim — they don't re-gate by tool, by design; `task` is the
 *     tool name and is display-only. The hook is the single source of the co-edit semantics.)
 */

// Normalize a file path for comparison: unify separators + lower-case (the host is Windows,
// whose FS is case-insensitive). This is a COMPARISON key only — display uses the raw basename.
export function normalizeFilePath(p) {
  if (typeof p !== 'string' || p.length === 0) return null
  return p.replace(/\\/g, '/').toLowerCase()
}

// Basename of a path (display only — language-neutral, honest: it is the real file name).
export function fileBasename(p) {
  if (typeof p !== 'string' || p.length === 0) return ''
  const norm = p.replace(/\\/g, '/').replace(/\/+$/, '')
  const slash = norm.lastIndexOf('/')
  return slash === -1 ? norm : norm.slice(slash + 1)
}

/**
 * Find the best shared-file pair in an externalStatus snapshot.
 * @param {object} externalStatus  { [agentId]: { status, activeFile, activeFileAt, ... } }
 * @param {number} now             Date.now()
 * @param {number} window          recency bound in ms (PAIR_HUDDLE_WINDOW)
 * @returns {[string, string] | null}  [leadId, partnerId] (most-recent first) or null
 */
export function findSharedFilePair(externalStatus, now, window) {
  const ext = externalStatus || {}
  // Bucket live candidates by normalized path.
  const byPath = new Map()
  for (const id of Object.keys(ext)) {
    const es = ext[id]
    if (!es || es.status === 'idle') continue
    const norm = normalizeFilePath(es.activeFile)
    if (!norm) continue
    const at = Number(es.activeFileAt)
    if (!Number.isFinite(at) || now - at > window) continue  // stale or unstamped → not "on it now"
    if (!byPath.has(norm)) byPath.set(norm, [])
    byPath.get(norm).push({ id, at })
  }

  // Among paths with ≥2 distinct agents, pick the pair whose SECOND-most-recent touch is the
  // freshest (the most-recently-co-active file). Within a path, take the 2 most recent agents.
  let best = null      // { pair: [lead, partner], freshness }
  for (const [, agents] of byPath) {
    if (agents.length < 2) continue
    agents.sort((a, b) => b.at - a.at)  // most recent first
    const [a0, a1] = agents
    const freshness = a1.at            // the limiting (older) touch of the chosen pair
    if (!best || freshness > best.freshness) {
      best = { pair: [a0.id, a1.id], freshness }
    }
  }
  return best ? best.pair : null
}
