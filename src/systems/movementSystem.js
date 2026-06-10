// ═══════════════════════════════════════════════════════════════════════
// Movement System — with proper walkable area constraints
//
// Architecture:
//   FLOOR_ZONES   = where characters CAN walk (rooms, door passages)
//   OBSTACLE_RECTS = furniture characters must NOT stand on
//   clampToFloor() = enforces both constraints on every generated position
//   Every function that produces a position runs through clampToFloor().
// ═══════════════════════════════════════════════════════════════════════

// ─── Floor zones (walkable areas matching thick-wall layout) ────────
// These match the PixelOffice.jsx visual floor rects, inset from walls
const FLOOR_ZONES = [
  // Entrance + Hallway (above north wall)
  { id: 'entrance',    x1: 15, y1: 15,  x2: 593, y2: 133 },
  // Main Office (between north and south thick walls)
  { id: 'mainOffice',  x1: 15, y1: 168, x2: 593, y2: 394 },
  // Meeting Room (east of east thick wall)
  { id: 'meetingRoom', x1: 628, y1: 15,  x2: 785, y2: 413 },
  // Lounge (south-west, below south wall, left of divider)
  { id: 'lounge',      x1: 15, y1: 424, x2: 451, y2: 545 },
  // Research (south-east, below south wall, right of divider)
  { id: 'research',    x1: 469, y1: 424, x2: 785, y2: 545 },
  // Door passages (walkable corridors through thick walls)
  { id: 'door-entrance', x1: 90,  y1: 133, x2: 138, y2: 168 },
  { id: 'door-lounge',   x1: 215, y1: 394, x2: 266, y2: 424 },
  { id: 'door-research', x1: 510, y1: 394, x2: 561, y2: 424 },
  { id: 'door-meeting',  x1: 593, y1: 187, x2: 628, y2: 233 },
]

// ─── Obstacle rects (furniture characters must not stand ON) ────────
const OBSTACLE_RECTS = [
  // Desks (with margin so characters don't clip edges)
  { x1: 105, y1: 215, x2: 175, y2: 260 },  // PM desk
  { x1: 225, y1: 215, x2: 295, y2: 260 },  // Arch desk
  { x1: 365, y1: 195, x2: 435, y2: 240 },  // QA desk
  { x1: 485, y1: 195, x2: 555, y2: 240 },  // Res desk
  { x1: 305, y1: 315, x2: 375, y2: 360 },  // Dev desk
  { x1: 425, y1: 315, x2: 495, y2: 360 },  // Ops desk
  { x1: 105, y1: 335, x2: 175, y2: 370 },  // Designer desk (design corner below PM)
  // Meeting table
  { x1: 650, y1: 128, x2: 760, y2: 195 },
  // Whiteboard area
  { x1: 525, y1: 278, x2: 590, y2: 342 },
  // WC area (lounge)
  { x1: 338, y1: 443, x2: 422, y2: 502 },
  // Bookshelves in lounge
  { x1: 278, y1: 438, x2: 412, y2: 458 },
  // Coffee machine area
  { x1: 15,  y1: 438, x2: 70,  y2: 465 },
  // ─ Furniture-clipping completion (owner screenshot 2026-06-11: designer standing
  //   INSIDE the gate booth). These rooms' furniture was never in this list, so
  //   clampToFloor/isOnObstacle (placement + the pet's segmentWalkable) happily put
  //   characters inside the graphics. NOT included on purpose: the phone booth (the
  //   `phone` waypoint (755,480) stands INSIDE it by design — you enter a booth) and
  //   the entrance barrier arms (3px-thin gate arms; making them solid would wall off
  //   the entrance). Index-based zone slices above (0-9, 9-12) are unaffected because
  //   these append at the END.
  // Gate booth: LEFT 2/3 only — the right strip stays walkable as the gate agent's exit
  // lane (home (100,80) → entrance door (115,125) crosses x≈103–111 between y 88–114; a
  // full-width rect walls the agent behind its own counter). Sprites can still slightly
  // clip the booth's right edge — accepted over trapping the gate.
  { x1: 84,  y1: 88,  x2: 101, y2: 114 },
  { x1: 472, y1: 434, x2: 528, y2: 460 },  // research bookshelf A (x2<535 keeps the research door side clear)
  { x1: 627, y1: 434, x2: 688, y2: 460 },  // research bookshelf B
  { x1: 702, y1: 434, x2: 763, y2: 460 },  // research bookshelf C
  // (server rack deliberately NOT an obstacle: flush against the right wall, so
  //  pushOutOfObstacle has no clean escape direction — and no waypoint places agents there)
  { x1: 590, y1: 488, x2: 612, y2: 508 },  // printer (researchLib waypoint (620,490) stays clear right)
]

// Main-office obstacles for path line-crossing checks.
const MAIN_OFFICE_OBSTACLES = OBSTACLE_RECTS.slice(0, 9) // 7 desks + meeting-side whiteboard
const LOUNGE_OBSTACLES = OBSTACLE_RECTS.slice(9, 12) // WC, bookshelves, coffee machine
// Research-zone furniture (3 bookshelves + printer), selected by GEOMETRY (inside the
// research floor band) so the list survives OBSTACLE_RECTS reordering. First soak-gate CI
// run (2026-06-10) caught designer resting INSIDE bookshelf B: research had no in-zone
// obstacle routing — straight segments crossed the shelves and any mid-walk pause parked
// the character inside the graphic (the agent version of the pet wall-phase bug).
const RESEARCH_OBSTACLES = OBSTACLE_RECTS.filter(r => r.x1 >= 460 && r.y1 >= 424)
const MEETING_TABLE = OBSTACLE_RECTS[7]

// ─── Walkability functions ──────────────────────────────────────────

export function isOnFloor(x, y) {
  return FLOOR_ZONES.some(z => x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2)
}

export function isOnObstacle(x, y) {
  return OBSTACLE_RECTS.some(r => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2)
}

// Push position out of an obstacle by moving to the nearest edge
function pushOutOfObstacle(x, y) {
  for (const r of OBSTACLE_RECTS) {
    if (x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) {
      // Find nearest edge and push 6px past it
      const toLeft = x - r.x1, toRight = r.x2 - x
      const toTop = y - r.y1, toBottom = r.y2 - y
      const min = Math.min(toLeft, toRight, toTop, toBottom)
      if (min === toLeft) x = r.x1 - OBSTACLE_PUSH_PX
      else if (min === toRight) x = r.x2 + OBSTACLE_PUSH_PX
      else if (min === toTop) y = r.y1 - OBSTACLE_PUSH_PX
      else y = r.y2 + OBSTACLE_PUSH_PX
    }
  }
  return { x, y }
}

// Master clamping function: snap to nearest floor, push off obstacles
export function clampToFloor(pos) {
  let { x, y } = pos

  // Step 1: If not on any floor zone, snap to nearest one
  if (!isOnFloor(x, y)) {
    let bestDist = Infinity
    for (const z of FLOOR_ZONES) {
      if (z.id.startsWith('door-')) continue // skip door passages for snapping
      const cx = Math.max(z.x1 + 5, Math.min(z.x2 - 5, x))
      const cy = Math.max(z.y1 + 5, Math.min(z.y2 - 5, y))
      const d = Math.hypot(x - cx, y - cy)
      if (d < bestDist) { bestDist = d; x = cx; y = cy }
    }
  }

  // Step 2: Push out of any obstacle
  const pushed = pushOutOfObstacle(x, y)
  x = pushed.x; y = pushed.y

  // Step 3: Final bounds safety
  x = Math.max(15, Math.min(785, x))
  y = Math.max(15, Math.min(545, y))

  return { x, y }
}

// ─── Waypoints ──────────────────────────────────────────────────────
export const WAYPOINTS = {
  gate:         { x: 100, y: 80 },
  // Desk positions (centers, for furniture rendering)
  pmDesk:       { x: 140, y: 240 },
  archDesk:     { x: 260, y: 240 },
  devDesk:      { x: 340, y: 340 },
  opsDesk:      { x: 460, y: 340 },
  qaDesk:       { x: 400, y: 220 },
  resDesk:      { x: 520, y: 220 },
  // Destinations (all validated to be on walkable floor)
  coffeeArea:   { x: 80,  y: 475 },
  waterCooler:  { x: 130, y: 475 },
  whiteboard:   { x: 560, y: 350 },  // below whiteboard, not on it
  lounge:       { x: 180, y: 490 },
  researchLib:  { x: 620, y: 490 },
  phone:        { x: 755, y: 480 },
  toilet:       { x: 380, y: 510 },  // below WC area
  printer:      { x: 600, y: 510 },
  window:       { x: 340, y: 100 },  // hallway near windows
  snackArea:    { x: 30,  y: 520 },  // near vending machine
}

// Meeting chair positions AROUND the table (not on it)
export const MEETING_CHAIRS = [
  { x: 660, y: 205 }, { x: 700, y: 205 }, { x: 745, y: 205 },  // below table
  { x: 660, y: 120 }, { x: 700, y: 120 }, { x: 745, y: 120 },  // above table
  { x: 645, y: 160 }, { x: 765, y: 160 },                       // sides
]

// Overflow positions for dynamically spawned worktree agents (entrance hallway)
// Agents from other sessions appear here — feels like a "visiting team"
export const OVERFLOW_POSITIONS = [
  { x: 200, y: 80 },
  { x: 370, y: 80 },
  { x: 490, y: 80 },
  { x: 100, y: 55 },
  { x: 540, y: 60 },
  { x: 300, y: 50 },
]

// "x,y" → slot index, built once. applyExternalStatus's overflow bookkeeping needs to
// know which slot an existing dynamic agent occupies; a per-agent OVERFLOW_POSITIONS
// .findIndex() is an O(slots) scan, so resolve it to an O(1) lookup instead.
export const OVERFLOW_SLOT_BY_XY = (() => {
  const map = new Map()
  OVERFLOW_POSITIONS.forEach((p, i) => map.set(`${p.x},${p.y}`, i))
  return map
})()

// Home = chair position (behind desk, y+24), NOT desk center
export const HOME_POSITIONS = {
  pm:   { x: 140, y: 264 },
  arch: { x: 260, y: 264 },
  dev:  { x: 340, y: 364 },
  ops:  { x: 460, y: 364 },
  qa:   { x: 400, y: 244 },
  res:  { x: 520, y: 244 },
  gate: WAYPOINTS.gate,
  designer: { x: 140, y: 384 },
  planner: { x: 200, y: 274 }, worker: { x: 400, y: 304 }, checker: { x: 500, y: 254 },
}

// ─── Subagent helper-huddle placement ───────────────────────────────
// Small downward fan around the parent's chair. HARD-CAP at 3 visible + a tight ±15px clamp,
// so helpers never overlap an adjacent desk (desks are ≥80px apart) or pile on each other;
// any surplus collapses into a single "+N" glyph. Heavy fan-out (Claude firing 10+ subagents)
// renders 3 sprites + "+N", never N bodies.
export const HELPER_MAX_VISIBLE = 3
export const HELPER_OFFSETS = [
  { dx: -15, dy: 16 },
  { dx: 15, dy: 16 },
  { dx: 0, dy: 27 },
]
export const HELPER_BADGE_OFFSET = { dx: 25, dy: 25 }
// Lightweight roster colors (planner / worker / checker), cycled across helper figures.
export const HELPER_COLORS = ['#378ADD', '#1D9E75', '#BA7517']
// A parent with this many active helpers shows a "swamped / heavy load" cue.
export const HELPER_HEAVY_THRESHOLD = 4

// Pure resolver: up to HELPER_MAX_VISIBLE helper screen positions for a parent role + the
// overflow count + whether the load is "heavy". Easy to unit-test; the render is a thin shell.
export function resolveHelperLayout(parentRole, count, anchor = HOME_POSITIONS[parentRole]) {
  const n = Math.max(0, count | 0)
  if (!anchor || n === 0) return { sprites: [], overflow: 0, heavy: false, anchor: null }
  const visible = Math.min(n, HELPER_MAX_VISIBLE)
  const sprites = []
  for (let i = 0; i < visible; i++) {
    const off = HELPER_OFFSETS[i]
    sprites.push({ x: anchor.x + off.dx, y: anchor.y + off.dy })
  }
  return { sprites, overflow: Math.max(0, n - HELPER_MAX_VISIBLE), heavy: n >= HELPER_HEAVY_THRESHOLD, anchor }
}

// ─── Zones (for pathfinding — which room is a point in?) ────────────
const ZONES = [
  { id: 'entrance',    x1: 0,   y1: 0,   x2: 598, y2: 148 },
  { id: 'meetingRoom', x1: 598, y1: 0,   x2: 800, y2: 420 },
  { id: 'mainOffice',  x1: 0,   y1: 148, x2: 598, y2: 418 },
  { id: 'lounge',      x1: 0,   y1: 418, x2: 460, y2: 560 },
  { id: 'research',    x1: 460, y1: 418, x2: 800, y2: 560 },
]

export function getZone(x, y) {
  for (const z of ZONES) {
    if (x >= z.x1 && x < z.x2 && y >= z.y1 && y < z.y2) return z.id
  }
  return 'mainOffice'
}

const DOORS = {
  entranceToMain: { x: 115, y: 150 },
  mainToMeeting:  { x: 610, y: 210 },
  mainToLounge:   { x: 240, y: 410 },
  mainToResearch: { x: 535, y: 410 },
}

const ROUTE = {
  entrance:    { mainOffice: 'entranceToMain', lounge: 'entranceToMain', meetingRoom: 'entranceToMain', research: 'entranceToMain' },
  mainOffice:  { entrance: 'entranceToMain', lounge: 'mainToLounge', meetingRoom: 'mainToMeeting', research: 'mainToResearch' },
  meetingRoom: { mainOffice: 'mainToMeeting', entrance: 'mainToMeeting', lounge: 'mainToMeeting', research: 'mainToMeeting' },
  lounge:      { mainOffice: 'mainToLounge', entrance: 'mainToLounge', meetingRoom: 'mainToLounge', research: 'mainToLounge' },
  research:    { mainOffice: 'mainToResearch', entrance: 'mainToResearch', lounge: 'mainToResearch', meetingRoom: 'mainToResearch' },
}

// ─── Corridor waypoints (open aisles in mainOffice) ─────────────────
const CORRIDORS = [
  { x: 80,  y: 290 },  // left aisle
  { x: 300, y: 180 },  // top aisle center
  { x: 300, y: 290 },  // mid aisle center (between desk rows)
  { x: 505, y: 290 },  // right aisle — kept left of the whiteboard obstacle (x≥525)
  { x: 300, y: 385 },  // bottom aisle (below dev/ops desks)
]

export const MAIN_ROUTE_NODES = [
  ...CORRIDORS,
  { x: 80,  y: 180 },
  { x: 550, y: 180 },
  { x: 80,  y: 385 },
  { x: 550, y: 385 },
]

// ─── Path calculation ───────────────────────────────────────────────

function lineHitsRect(ax, ay, bx, by, r) {
  const dx = bx - ax, dy = by - ay
  let tMin = 0, tMax = 1
  // Order the slab intersection bounds with a scalar temp instead of a destructuring
  // swap `[t1, t2] = [t2, t1]` — the latter allocates a 2-element array literal each
  // time the line runs backward through a slab. lineHitsRect is called per desk per
  // line-segment inside calculatePath's corridor routing.
  if (Math.abs(dx) > 0.1) {
    let t1 = (r.x1 - ax) / dx, t2 = (r.x2 - ax) / dx
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp }
    tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2)
    if (tMin > tMax) return false
  } else if (ax < r.x1 || ax > r.x2) return false
  if (Math.abs(dy) > 0.1) {
    let t1 = (r.y1 - ay) / dy, t2 = (r.y2 - ay) / dy
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp }
    tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2)
    if (tMin > tMax) return false
  } else if (ay < r.y1 || ay > r.y2) return false
  return true
}

function lineHitsAnyDesk(ax, ay, bx, by) {
  return MAIN_OFFICE_OBSTACLES.some(r => lineHitsRect(ax, ay, bx, by, r))
}

function lineHitsAnyRect(ax, ay, bx, by, rects) {
  return rects.some(r => lineHitsRect(ax, ay, bx, by, r))
}

function findBestCorridor(from, to) {
  let best = null, bestDist = Infinity
  for (const c of CORRIDORS) {
    if (lineHitsAnyDesk(from.x, from.y, c.x, c.y)) continue
    if (lineHitsAnyDesk(c.x, c.y, to.x, to.y)) continue
    const d = Math.hypot(from.x - c.x, from.y - c.y) + Math.hypot(c.x - to.x, c.y - to.y)
    if (d < bestDist) { bestDist = d; best = c }
  }
  if (!best) return null
  // Anti-stack jitter, VALIDATED: the corridor point was chosen because BOTH its segments
  // clear the desks — an unvalidated jitter (the old code) could push it just enough for a
  // segment to clip a desk/whiteboard corner (fuzz-observed: "crosses opsDesk", "crosses
  // whiteboard" — the routeWithinMainOffice fallback's known rare hole). Accept a jittered
  // candidate only when it keeps the floor, avoids furniture, and BOTH segments stay
  // clear; otherwise fall back to the exact validated point (never worse than validated).
  for (let attempt = 0; attempt < 4; attempt++) {
    const cand = { x: best.x + (Math.random() - 0.5) * CORRIDOR_JITTER, y: best.y + (Math.random() - 0.5) * 12 }
    if (!isOnFloor(cand.x, cand.y) || isOnObstacle(cand.x, cand.y)) continue
    if (lineHitsAnyDesk(from.x, from.y, cand.x, cand.y)) continue
    if (lineHitsAnyDesk(cand.x, cand.y, to.x, to.y)) continue
    return cand
  }
  return { x: best.x, y: best.y }
}

function findSafePolyline(from, to, nodes, obstacles) {
  const pts = [from, to, ...nodes]
  const n = pts.length
  const dist = Array(n).fill(Infinity)
  const prev = Array(n).fill(-1)
  const visited = Array(n).fill(false)
  dist[0] = 0

  for (let iter = 0; iter < n; iter++) {
    let u = -1, best = Infinity
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i] < best) { u = i; best = dist[i] }
    }
    if (u === -1 || u === 1) break
    visited[u] = true

    for (let v = 1; v < n; v++) {
      if (visited[v] || v === u) continue
      if (lineHitsAnyRect(pts[u].x, pts[u].y, pts[v].x, pts[v].y, obstacles)) continue
      const edge = Math.hypot(pts[u].x - pts[v].x, pts[u].y - pts[v].y)
      if (dist[u] + edge < dist[v]) {
        dist[v] = dist[u] + edge
        prev[v] = u
      }
    }
  }

  if (!Number.isFinite(dist[1])) return null
  const idxRoute = []
  for (let cur = 1; cur !== 0 && cur !== -1; cur = prev[cur]) idxRoute.push(cur)
  idxRoute.reverse()
  // Anti-stacking jitter (owner bug 2026-06-11: "研究員跟不知道誰疊在一起"): the Dijkstra
  // nodes are EXACT shared coordinates — two agents traversing the same aisle at the same
  // moment landed on the SAME pixel (live-captured: pm and dev both at (300,180), dist 0).
  // findBestCorridor already jitters (validated, see above); this graph path did not. Offset each
  // INTERMEDIATE node (never the destination), accepting a candidate only when it stays on
  // the floor, off furniture, AND both adjacent segments stay obstacle-free — otherwise
  // fall back to the exact node, so a path is NEVER worse than today's. Chain validation:
  // segment (out[i] → out[i+1]) is checked when processing i+1 with both FINAL positions
  // (prev = already-jittered output; next = exact node now, re-checked at its own turn).
  // Also stop pushing the SHARED node objects into paths (latent aliasing) — copies only.
  const out = []
  for (let i = 0; i < idxRoute.length; i++) {
    const idx = idxRoute[i]
    const node = pts[idx]
    if (idx === 1) { out.push({ x: node.x, y: node.y }); continue }  // destination — exact
    const prevPt = out.length > 0 ? out[out.length - 1] : pts[0]
    const nextPt = pts[idxRoute[i + 1]]  // exact next (or the destination)
    let placed = null
    for (let attempt = 0; attempt < 4 && !placed; attempt++) {
      const cand = {
        x: node.x + (Math.random() - 0.5) * CORRIDOR_JITTER,
        y: node.y + (Math.random() - 0.5) * 12,
      }
      if (!isOnFloor(cand.x, cand.y) || isOnObstacle(cand.x, cand.y)) continue
      if (lineHitsAnyRect(prevPt.x, prevPt.y, cand.x, cand.y, obstacles)) continue
      if (nextPt && lineHitsAnyRect(cand.x, cand.y, nextPt.x, nextPt.y, obstacles)) continue
      placed = cand
    }
    out.push(placed || { x: node.x, y: node.y })
  }
  return out
}

export const DOOR_SIDES = {
  entranceToMain: {
    entrance:   { x: 115, y: 125 },
    mainOffice: { x: 115, y: 176 },
  },
  mainToMeeting: {
    mainOffice:  { x: 585, y: 210 },
    meetingRoom: { x: 636, y: 210 },
  },
  mainToLounge: {
    mainOffice: { x: 240, y: 386 },
    lounge:     { x: 240, y: 432 },
  },
  mainToResearch: {
    mainOffice: { x: 535, y: 386 },
    research:   { x: 535, y: 432 },
  },
}

function pushPoint(path, pt) {
  const last = path[path.length - 1]
  if (!last || Math.hypot(last.x - pt.x, last.y - pt.y) > 2) path.push(pt)
}

// Per-transit door-anchor jitter (forensic capture 2026-06-10: 10/12 standing-stack events
// sat at the LITERAL coordinate (240,386) = mainToLounge's raw anchor — every cross-zone
// walk funneled through the same pixel, so any pause/freeze there stacked agents at 0px).
// One shared offset is applied to BOTH sides of a crossing, PERPENDICULAR to the travel
// axis (i.e. along the wall opening), keeping the crossing segment parallel to the raw one
// — it cannot clip the door frame as long as the offset stays inside the passage, which the
// per-endpoint floor/obstacle validation guarantees (door passages are FLOOR_ZONES). Falls
// back to the raw anchors when a jittered endpoint would leave the floor.
function jitterDoorCrossing(fromSide, toSide) {
  const travelX = Math.abs(toSide.x - fromSide.x) >= Math.abs(toSide.y - fromSide.y)
  for (let attempt = 0; attempt < 4; attempt++) {
    const off = (Math.random() - 0.5) * DOOR_JITTER // ±10px along the opening
    const a = travelX ? { x: fromSide.x, y: fromSide.y + off } : { x: fromSide.x + off, y: fromSide.y }
    const b = travelX ? { x: toSide.x, y: toSide.y + off } : { x: toSide.x + off, y: toSide.y }
    if (isOnFloor(a.x, a.y) && !isOnObstacle(a.x, a.y) && isOnFloor(b.x, b.y) && !isOnObstacle(b.x, b.y)) {
      return [a, b]
    }
  }
  return [fromSide, toSide]
}

function routeWithinMeetingRoom(from, to) {
  if (!lineHitsRect(from.x, from.y, to.x, to.y, MEETING_TABLE)) return [to]

  const candidates = [
    [{ x: 640, y: from.y }, { x: 640, y: to.y }],
    [{ x: 770, y: from.y }, { x: 770, y: to.y }],
    [{ x: from.x, y: 120 }, { x: to.x, y: 120 }],
    [{ x: from.x, y: 205 }, { x: to.x, y: 205 }],
  ]
  let best = null, bestDist = Infinity
  for (const candidate of candidates) {
    const pts = [...candidate, to]
    let cursor = from, ok = true, dist = 0
    for (const pt of pts) {
      if (lineHitsRect(cursor.x, cursor.y, pt.x, pt.y, MEETING_TABLE)) { ok = false; break }
      dist += Math.hypot(cursor.x - pt.x, cursor.y - pt.y)
      cursor = pt
    }
    if (ok && dist < bestDist) { best = pts; bestDist = dist }
  }
  return best || [{ x: 640, y: from.y }, { x: 640, y: to.y }, to]
}

function routeWithinLounge(from, to) {
  if (!lineHitsAnyRect(from.x, from.y, to.x, to.y, LOUNGE_OBSTACLES)) return [to]
  const y = 520
  const pts = [
    clampToFloor({ x: from.x, y }),
    clampToFloor({ x: to.x, y }),
    to,
  ]
  return pts
}

function routeWithinResearch(from, to) {
  if (!lineHitsAnyRect(from.x, from.y, to.x, to.y, RESEARCH_OBSTACLES)) return [to]
  // Clear horizontal lane between the bookshelves' bottom (y=460) and the printer's top
  // (y=488) — mirrors routeWithinLounge's corridor approach. The DESCENT column out of
  // the lane is obstacle-aware: targets adjacent to furniture (the printer stand spot sits
  // 2px below the printer body) would otherwise be approached straight through the rect —
  // shift the column sideways and finish with a horizontal approach at the target's y.
  const y = 472
  // Column picker: a vertical column at `cand` between the lane and `targetY` must be
  // furniture-free AND stay on the research floor — a column shifted past the zone's west
  // edge (x<469) would be yanked across the office by clampToFloor's zone snapping.
  const clearColumn = (baseX, targetY) => {
    for (const dx of [0, -28, 28, -45, 45]) {
      const cand = baseX + dx
      if (!isOnFloor(cand, y) || !isOnFloor(cand, targetY)) continue
      if (getZone(cand, y) !== 'research') continue
      if (!lineHitsAnyRect(cand, y, cand, targetY, RESEARCH_OBSTACLES)) return cand
    }
    return baseX // degraded: direct column (pre-fix behavior)
  }
  const pts = []
  const upX = clearColumn(from.x, from.y)
  if (upX !== from.x) pts.push(clampToFloor({ x: upX, y: from.y }))
  pts.push(clampToFloor({ x: upX, y }))
  const dropX = clearColumn(to.x, to.y)
  if (dropX !== upX) pts.push(clampToFloor({ x: dropX, y }))
  if (dropX !== to.x) pts.push(clampToFloor({ x: dropX, y: to.y }))
  pts.push(to)
  return pts
}

function routeWithinMainOffice(from, to) {
  if (!lineHitsAnyDesk(from.x, from.y, to.x, to.y)) return [to]
  const graphPath = findSafePolyline(from, to, MAIN_ROUTE_NODES, MAIN_OFFICE_OBSTACLES)
  if (graphPath) return graphPath
  const corridor = findBestCorridor(from, to)
  if (corridor) return [corridor, to]
  // Last resort — findSafePolyline AND every single-corridor relay failed, meaning the
  // target is wedged against furniture with no clean route by construction (see the fuzz
  // test's MARGIN rationale). Relay via the center corridor as before — but as a COPY
  // (pushing the shared CORRIDORS[2] object into paths was latent aliasing).
  const mid = CORRIDORS[2]
  return [{ x: mid.x, y: mid.y }, to]
}

function routeWithinZone(from, to, zone) {
  if (zone === 'mainOffice') return routeWithinMainOffice(from, to)
  if (zone === 'meetingRoom') return routeWithinMeetingRoom(from, to)
  if (zone === 'lounge') return routeWithinLounge(from, to)
  if (zone === 'research') return routeWithinResearch(from, to)
  return [to]
}

function appendZoneRoute(path, from, to, zone) {
  for (const pt of routeWithinZone(from, to, zone)) pushPoint(path, pt)
}

export function calculatePath(from, to) {
  const fromZone = getZone(from.x, from.y)
  const toZone = getZone(to.x, to.y)

  if (fromZone === toZone) {
    return routeWithinZone(from, to, fromZone)
  }

  const path = []
  const exitDoor = ROUTE[fromZone]?.[toZone]

  if (exitDoor) {
    const sides = DOOR_SIDES[exitDoor]
    const rawFromSide = sides?.[fromZone] || DOORS[exitDoor]
    const exitToZone = toZone === 'mainOffice' || fromZone === 'mainOffice' ? toZone : 'mainOffice'
    const rawToSide = sides?.[exitToZone] || DOORS[exitDoor]
    const [fromSide, toSide] = jitterDoorCrossing(rawFromSide, rawToSide)
    appendZoneRoute(path, from, fromSide, fromZone)
    pushPoint(path, toSide)
  }

  // Multi-room transit (e.g., lounge → research goes through mainOffice)
  if (fromZone !== 'mainOffice' && toZone !== 'mainOffice') {
    const entryDoor = ROUTE.mainOffice?.[toZone]
    if (entryDoor && entryDoor !== exitDoor) {
      const sides = DOOR_SIDES[entryDoor]
      const rawMainSide = sides?.mainOffice || DOORS[entryDoor]
      const rawToSide = sides?.[toZone] || DOORS[entryDoor]
      const [mainSide, toSide] = jitterDoorCrossing(rawMainSide, rawToSide)
      const prevPt = path[path.length - 1] || from
      appendZoneRoute(path, prevPt, mainSide, 'mainOffice')
      pushPoint(path, toSide)
    }
  }

  const last = path[path.length - 1] || from
  appendZoneRoute(path, last, to, toZone)
  return path
}

// ─── Behavior → destination mapping ─────────────────────────────────
const BEHAVIOR_LOCATIONS = {
  'goto-coffee-machine': 'coffeeArea',
  'drink-coffee':        'coffeeArea',
  'drink-water':         'waterCooler',
  'whiteboard':          'whiteboard',
  'nap':                 'lounge',
  'phone-call':          'phone',
  'toilet':              'toilet',
  'research':            'researchLib',
  'meeting':             null,  // handled specially with MEETING_CHAIRS
  'print':               'printer',
  'look-window':         'window',
  'eat-snack':           'snackArea',
  'stretch':             'lounge',
  'check-phone':         'lounge',
}

export const SOCIAL_BEHAVIORS = new Set(['chat', 'thumbs-up', 'pass-document'])

// Returns true if this behavior requires the character to walk to a specific location
// (not their desk). Used to defer behavior labels until arrival.
export function needsLocationChange(behaviorId) {
  if (SOCIAL_BEHAVIORS.has(behaviorId)) return true
  const key = BEHAVIOR_LOCATIONS[behaviorId]
  return key !== undefined  // has an entry (even null for meeting)
}

// ─── Anti-overlap system ──────────────────────────────────────────────
// (MIN_AGENT_DIST no longer consumed here — the separation contract is the visual ellipse
// below; the constant stays in constants.js for external readers.)
import { OBSTACLE_PUSH_PX, CORRIDOR_JITTER, DOOR_JITTER } from './constants.js'

// Get all other agents' claimed standing spots. Resolution order matters (forensic
// capture 2026-06-10, RC-3 "leg-target blindness"): `targetPosition` is only the CURRENT
// LEG of a multi-waypoint walk (a corridor/door node) — while A crosses the office, a
// picker that read targetPosition saw A "at the corridor" and happily claimed A's actual
// landing spot. `journeyTarget` (published by AgentCharacter at walk start, cleared on
// arrival/abort) is the walk's END — the spot A will actually occupy.
function getOccupiedPositions(agentId, allAgents) {
  const positions = []
  if (!allAgents) return positions
  // Iterate keys directly — Object.entries() allocates an array of [id,agent]
  // pair arrays; only the value is needed and the id is read in place.
  for (const id of Object.keys(allAgents)) {
    if (id === agentId) continue
    const agent = allAgents[id]
    const pos = agent.journeyTarget || agent.targetPosition || agent.position
    if (pos) positions.push(pos)
  }
  return positions
}

// Visual-footprint overlap predicate. Sprites are ANISOTROPIC in the 3/4 view — ~32px wide
// but ~44px tall (body + head + label) — so the old circular MIN_AGENT_DIST=35 check let two
// agents stand 35px apart VERTICALLY and still read as a full stack (the PR #103 gate-stack
// geometry lesson, previously applied only to the social branch). Elliptical metric: overlap
// iff (dx/rx)² + (dy/ry)² < 1 with rx=32, ry=44. Pure → unit-testable.
export const SPRITE_CLEAR_RX = 32
export const SPRITE_CLEAR_RY = 44
export function visuallyOverlapping(a, b, rx = SPRITE_CLEAR_RX, ry = SPRITE_CLEAR_RY) {
  const nx = (a.x - b.x) / rx
  const ny = (a.y - b.y) / ry
  return nx * nx + ny * ny < 1
}

// Push a position away from all occupied positions until it clears the visual ellipse of
// every one of them. The push is RADIAL and CUMULATIVE — the current offset from the
// pusher is SCALED out to the ellipse boundary (+5-9px margin), preserving its direction,
// so pushes from multiple occupants COMPOSE the way the old circular code did. (A first
// draft SET x relative to whichever pusher it overlapped; with two standers in the same
// horizontal band — coffee machine + water cooler — it oscillated between them and
// returned a still-overlapping spot 12.4% of the time. Fresh review 2026-06-10, HIGH.)
export function avoidOverlap(pos, occupied, maxAttempts = 8) {
  let { x, y } = pos
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let pushed = false
    for (const other of occupied) {
      if (!visuallyOverlapping({ x, y }, other)) continue
      pushed = true
      let dx = x - other.x, dy = y - other.y
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        // Nearly identical — pick a random escape direction, horizontally weighted
        // (sideways needs less distance AND reads naturally, 並肩).
        dx = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random())
        dy = (Math.random() - 0.5)
      }
      // Current elliptical radius (<1 means inside); scale the offset to land on the
      // boundary plus margin. One step fully escapes THIS pusher along the existing
      // direction — cumulative across pushers, no teleport-oscillation.
      const k = Math.hypot(dx / SPRITE_CLEAR_RX, dy / SPRITE_CLEAR_RY)
      const grow = (1 + (5 + Math.random() * 4) / SPRITE_CLEAR_RX) / Math.max(k, 0.05)
      x = other.x + dx * grow
      y = other.y + dy * grow
    }
    const clamped = clampToFloor({ x, y })
    x = clamped.x; y = clamped.y
    if (!pushed && !occupied.some(o => visuallyOverlapping({ x, y }, o))) return { x, y }
  }
  // Iterations exhausted (dense cluster / clamp keeps re-entering an ellipse): ring search
  // around the SEED for the nearest spot clear of EVERYONE — horizontal directions first.
  const ANGLES = [0, Math.PI, Math.PI / 6, Math.PI - Math.PI / 6, -Math.PI / 6, Math.PI + Math.PI / 6, Math.PI / 2, -Math.PI / 2]
  for (const r of [SPRITE_CLEAR_RX + 8, SPRITE_CLEAR_RX + 22, SPRITE_CLEAR_RX + 38]) {
    for (const a of ANGLES) {
      const cand = clampToFloor({ x: pos.x + Math.cos(a) * r, y: pos.y + Math.sin(a) * r * 0.8 })
      if (!occupied.some(o => visuallyOverlapping(cand, o))) return cand
    }
  }
  return clampToFloor({ x, y })  // degraded fallback (matches the old code's last-resort behavior)
}

// Add jitter then clamp to walkable floor
function jitter(pos, amount = 16) {
  return clampToFloor({
    x: pos.x + (Math.random() - 0.5) * amount,
    y: pos.y + (Math.random() - 0.5) * amount,
  })
}

// Exported helper: picks a social walk target for agentId from allAgents.
// Returns { targetId, position } or null when no valid target exists.
// Separated from getTargetForBehavior so callers (e.g. doSchedule in AgentCharacter)
// can capture the chosen targetId for facing-on-arrival without a second random pick.
export function pickSocialTarget(agentId, allAgents) {
  if (!allAgents) return null
  const others = Object.keys(allAgents).filter(id => id !== agentId)
  if (others.length === 0) return null
  const targetId = others[Math.floor(Math.random() * others.length)]
  const position = allAgents[targetId]?.position
  if (!position) return null
  return { targetId, position }
}

export function getTargetForBehavior(agentId, behaviorId, allAgents, socialTargetOverride = null) {
  // Lazily resolve the occupied-positions list — getOccupiedPositions scans every
  // agent and allocates an array. The MOST common case is a desk/work behavior
  // (the `work` category carries 65% of the weight in behaviorEngine, and all of
  // its behaviors map to HOME_POSITIONS via the `waypointKey === undefined`
  // early-return below), which never reads `occupied`. Building it unconditionally
  // meant an all-agents scan + array allocation per agent per behavior cycle that
  // was discarded for the majority path. Compute it only when a branch needs it.
  let _occupied = null
  const occupiedPositions = () => {
    if (_occupied === null) _occupied = getOccupiedPositions(agentId, allAgents)
    return _occupied
  }

  // Meeting: pick a random chair around the table
  if (behaviorId === 'meeting') {
    const occupied = occupiedPositions()
    // Pick a chair that's not already occupied
    const shuffled = [...MEETING_CHAIRS].sort(() => Math.random() - 0.5)
    for (const chair of shuffled) {
      const isFree = !occupied.some(o => Math.hypot(o.x - chair.x, o.y - chair.y) < 30)
      if (isFree) return clampToFloor(jitter(chair, 8))
    }
    return clampToFloor(jitter(shuffled[0], 8))
  }

  // Social behaviors: walk toward a random other agent (near them, not on them).
  // `socialTargetOverride` (optional 4th param) lets the caller pre-pick the peer and
  // pass it in, so the WALK destination and the FACE-toward-on-arrival peer are the
  // SAME agent — two independent random picks would walk to B while facing A.
  if (SOCIAL_BEHAVIORS.has(behaviorId) && allAgents) {
    const picked = socialTargetOverride || pickSocialTarget(agentId, allAgents)
    if (picked) {
      // Lateral-bias (owner screenshot 2026-06-11: THREE sprites stacked at the gate —
      // gate + two social visitors): sprites are ~40px TALL in the 3/4 view, so a visitor
      // landing directly above/below the peer overlaps visually even at the full 70px ring.
      // Sample the approach angle from two ±45° cones around horizontal (stand BESIDE the
      // peer — 並肩聊天) instead of uniform 0–2π; the horizontal offset always ≥ the
      // vertical one by construction, so the tall sprites can never stack into a vertical
      // column while the distance ring stays 50–70px.
      const side = Math.random() < 0.5 ? 0 : Math.PI
      const angle = side + (Math.random() - 0.5) * (Math.PI / 2)
      // Owner-approved 2026-06-10: dist widened 30–45 → 50–70px.
      // Sprite effective width ~35-40px → 1.4–1.8 sprite-widths = "walked up to you"
      // rather than "standing on you". Addresses measured 40–70% rate of pairs under
      // 30px in the organic proximity audit (anyUnder30 408/705, 495/705 across runs).
      const dist = 50 + Math.random() * 20  // stay 50-70px away
      const raw = clampToFloor({
        x: picked.position.x + Math.cos(angle) * dist,
        y: picked.position.y + Math.sin(angle) * dist,
      })
      return avoidOverlap(raw, occupiedPositions())
    }
  }

  // Home position — always valid, skip overlap check (it's their seat)
  const waypointKey = BEHAVIOR_LOCATIONS[behaviorId]
  if (waypointKey === undefined) return HOME_POSITIONS[agentId] || null

  const base = WAYPOINTS[waypointKey] || HOME_POSITIONS[agentId]
  if (!base) return null
  const jittered = jitter(base, 24)
  return avoidOverlap(jittered, occupiedPositions())
}

export function calcFacing(fromX, fromY, toX, toY) {
  const dx = toX - fromX, dy = toY - fromY
  if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return 'down'
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
}

// living-office L2 (focusAnchor): the facing an UNTRACKED, stationary agent should adopt to orient
// toward the hottest live desk — or null if it must NOT orient. Pure + exported so AC-4 is testable
// without the doSchedule component loop. Honesty guards baked in:
//   - tracked agent (has a live externalStatus entry) → null (R1: never modulate a real desk)
//   - no anchor / self / stale anchor (missing or idle) → null (stale-pointer bail)
//   - slug~role worktree anchor falls back to its base-role rendered agent
export function resolveFocusFacing(state, id, fromX, fromY) {
  if (!state || !id) return null
  if (state.externalStatus && state.externalStatus[id]) return null // tracked → never (R1)
  const anchorId = state.focusAnchor
  if (!anchorId || anchorId === id) return null
  const agents = state.agents || {}
  let anchor = agents[anchorId]
  if (!anchor && anchorId.includes('~')) anchor = agents[anchorId.slice(anchorId.lastIndexOf('~') + 1)]
  if (!anchor || !anchor.position || anchor.status === 'idle') return null // stale/missing/idle bail
  return calcFacing(fromX, fromY, anchor.position.x, anchor.position.y)
}

