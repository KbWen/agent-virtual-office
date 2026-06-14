// ─── Speech-bubble concurrency cap (PURE) ───────────────────────────────────────────────────
// Declutter (expert-panel unanimous #1): N active agents → N simultaneous speech bubbles tiled the
// top wall = the dominant visual noise. This picks at most `cap` bubbles to show at once, by
// priority, so the glance layer stays calm — WITHOUT going dead/static.
//
// HONESTY GUARANTEE: suppressing a bubble hides only TEXT, never STATUS. A suppressed agent still
// renders its status ring + name-pill color + over-head badge (blocked-reason/recurring), so a real
// block is never hidden by the cap — it's just not also shouted as a text bubble. (Mirrors the
// MEMORY rule: status visibility is the core value; the cap must not hide a blocked agent's state.)
//
// LIVELINESS: ordering is priority → recency → a TIME-ROTATED tiebreak. Real activity (distinct
// changedAt) wins by recency, so the visible set tracks "who just acted" — meaningful. But when
// priority + recency genuinely TIE (e.g. several agents holding long-lived ambient bubbles whose
// changedAt is stale), the rotation cycles which agents take the slots every `rotateMs`, so the
// office keeps "talking" in turns instead of freezing on the same low-id agents (the "looks dead"
// failure the owner flagged). Blocked/done are NOT rotated away — you always keep seeing a real block.

const BUBBLE_PRIORITY = {
  blocked: 0,
  'awaiting-approval': 0,
  done: 1,
  working: 2,
  planning: 2,
  thinking: 2,
}

export function bubblePriority(status) {
  const p = BUBBLE_PRIORITY[status]
  return p === undefined ? 3 : p
}

// Max speech bubbles visible at once. 3 = room for a blocked + a done + one ambient, which reads as
// "the office is busy and that one is stuck" without tiling the top wall. Tunable.
export const BUBBLE_VISIBLE_CAP = 3

// How often the tie-break rotation advances (ms). 2.5s reads as a calm hand-off, not a flicker.
export const BUBBLE_ROTATE_MS = 2500

/**
 * @param {object} agents          store agents map { [id]: { bubble, status } }
 * @param {object} externalStatus  { [id]: { status, changedAt } } (authoritative status + recency)
 * @param {number} cap             max concurrent bubbles (default BUBBLE_VISIBLE_CAP)
 * @param {number} now             Date.now() — drives the rotation tiebreak (default 0 = no rotation)
 * @param {number} rotateMs        rotation period (default BUBBLE_ROTATE_MS)
 * @returns {Set<string>}          agent ids permitted to show their bubble this frame
 */
export function selectVisibleBubbles(agents, externalStatus, cap = BUBBLE_VISIBLE_CAP, now = 0, rotateMs = BUBBLE_ROTATE_MS) {
  const ext = externalStatus || {}
  const candidates = []
  for (const id of Object.keys(agents || {})) {
    const a = agents[id]
    if (!a || !a.bubble) continue  // only agents that actually have a bubble compete for a slot
    const status = (ext[id] && ext[id].status) || a.status || 'idle'
    const changedAt = ext[id] && Number.isFinite(ext[id].changedAt) ? ext[id].changedAt : 0
    candidates.push({ id, pri: bubblePriority(status), changedAt })
  }
  if (candidates.length === 0) return new Set()
  // Rotated rank: cycle the id order every rotateMs so equal-priority, equal-recency candidates take
  // turns over time instead of the same low-id ones always winning. Real recency still dominates.
  const ids = candidates.map((c) => c.id).sort()
  const period = rotateMs > 0 ? rotateMs : 1
  const offset = ids.length ? (Math.floor(Math.max(0, now) / period) % ids.length) : 0
  // Precompute id→rank once (O(n)) instead of an O(n) indexOf per comparator call (was O(n²)
  // per sort, run for every agent on every store write). Behavior-identical.
  const rankMap = new Map(ids.map((id, i) => [id, (i - offset + ids.length) % ids.length]))
  const rankOf = (id) => rankMap.get(id) ?? 0
  // tier asc → recency desc → rotated rank asc
  candidates.sort((x, y) => x.pri - y.pri || y.changedAt - x.changedAt || rankOf(x.id) - rankOf(y.id))
  const n = Math.max(0, cap)
  return new Set(candidates.slice(0, n).map((c) => c.id))
}
