// ─── Speech-bubble concurrency cap (PURE) ───────────────────────────────────────────────────
// Declutter (expert-panel unanimous #1): N active agents → N simultaneous speech bubbles tiled the
// top wall = the dominant visual noise. This picks at most `cap` bubbles to show at once, by
// priority, so the glance layer stays calm.
//
// HONESTY GUARANTEE: suppressing a bubble hides only TEXT, never STATUS. A suppressed agent still
// renders its status ring + name-pill color + over-head badge (blocked-reason/recurring), so a real
// block is never hidden by the cap — it's just not also shouted as a text bubble. (Mirrors the
// MEMORY rule: status visibility is the core value; the cap must not hide a blocked agent's state.)
//
// Priority: blocked/awaiting-approval (a human is needed) > done (a real completion beat) >
// working/planning/thinking (ambient chatter) > everything else. Ties broken by most-recent change
// (changedAt desc), then a stable id order so the visible set never jitters frame-to-frame.

// Max speech bubbles visible at once. 3 = room for a blocked + a done + one ambient, which reads as
// "the office is busy and that one is stuck" without tiling the top wall. Tunable.
export const BUBBLE_VISIBLE_CAP = 3

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

/**
 * @param {object} agents          store agents map { [id]: { bubble, status } }
 * @param {object} externalStatus  { [id]: { status, changedAt } } (authoritative status + recency)
 * @param {number} cap             max concurrent bubbles (default 3)
 * @returns {Set<string>}          agent ids permitted to show their bubble this frame
 */
export function selectVisibleBubbles(agents, externalStatus, cap = 3) {
  const ext = externalStatus || {}
  const candidates = []
  for (const id of Object.keys(agents || {})) {
    const a = agents[id]
    if (!a || !a.bubble) continue  // only agents that actually have a bubble compete for a slot
    const status = (ext[id] && ext[id].status) || a.status || 'idle'
    const changedAt = ext[id] && Number.isFinite(ext[id].changedAt) ? ext[id].changedAt : 0
    candidates.push({ id, pri: bubblePriority(status), changedAt })
  }
  // tier asc → recency desc → stable id
  candidates.sort((x, y) =>
    x.pri - y.pri || y.changedAt - x.changedAt || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
  const n = Math.max(0, cap)
  return new Set(candidates.slice(0, n).map((c) => c.id))
}
