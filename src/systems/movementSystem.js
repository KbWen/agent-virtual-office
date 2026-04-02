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
]

// Also use desk rects for path line-crossing checks
const DESK_RECTS = OBSTACLE_RECTS.slice(0, 6) // just the 6 desks

// ─── Walkability functions ──────────────────────────────────────────

function isOnFloor(x, y) {
  return FLOOR_ZONES.some(z => x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2)
}

function isOnObstacle(x, y) {
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
function clampToFloor(pos) {
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

// ─── Zones (for pathfinding — which room is a point in?) ────────────
const ZONES = [
  { id: 'entrance',    x1: 0,   y1: 0,   x2: 210, y2: 148 },
  { id: 'meetingRoom', x1: 598, y1: 0,   x2: 800, y2: 420 },
  { id: 'mainOffice',  x1: 0,   y1: 148, x2: 598, y2: 418 },
  { id: 'lounge',      x1: 0,   y1: 418, x2: 460, y2: 560 },
  { id: 'research',    x1: 460, y1: 418, x2: 800, y2: 560 },
]

function getZone(x, y) {
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
  { x: 550, y: 290 },  // right aisle
  { x: 300, y: 385 },  // bottom aisle (below dev/ops desks)
]

// ─── Path calculation ───────────────────────────────────────────────

function lineHitsRect(ax, ay, bx, by, r) {
  const dx = bx - ax, dy = by - ay
  let tMin = 0, tMax = 1
  if (Math.abs(dx) > 0.1) {
    let t1 = (r.x1 - ax) / dx, t2 = (r.x2 - ax) / dx
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2)
    if (tMin > tMax) return false
  } else if (ax < r.x1 || ax > r.x2) return false
  if (Math.abs(dy) > 0.1) {
    let t1 = (r.y1 - ay) / dy, t2 = (r.y2 - ay) / dy
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2)
    if (tMin > tMax) return false
  } else if (ay < r.y1 || ay > r.y2) return false
  return true
}

function lineHitsAnyDesk(ax, ay, bx, by) {
  return DESK_RECTS.some(r => lineHitsRect(ax, ay, bx, by, r))
}

function findBestCorridor(from, to) {
  let best = null, bestDist = Infinity
  for (const c of CORRIDORS) {
    if (lineHitsAnyDesk(from.x, from.y, c.x, c.y)) continue
    if (lineHitsAnyDesk(c.x, c.y, to.x, to.y)) continue
    const d = Math.hypot(from.x - c.x, from.y - c.y) + Math.hypot(c.x - to.x, c.y - to.y)
    if (d < bestDist) { bestDist = d; best = c }
  }
  // Add jitter so multiple agents don't stack on the same corridor pixel
  if (best) return { x: best.x + (Math.random() - 0.5) * CORRIDOR_JITTER, y: best.y + (Math.random() - 0.5) * 12 }
  return best
}

// Find the nearest corridor waypoint to a position (for pre-door routing)
function nearestCorridor(pos) {
  let best = CORRIDORS[2], bestDist = Infinity  // default to center
  for (const c of CORRIDORS) {
    const d = Math.hypot(pos.x - c.x, pos.y - c.y)
    if (d < bestDist) { bestDist = d; best = c }
  }
  return { x: best.x + (Math.random() - 0.5) * 20, y: best.y + (Math.random() - 0.5) * 10 }
}

export function calculatePath(from, to) {
  const fromZone = getZone(from.x, from.y)
  const toZone = getZone(to.x, to.y)

  if (fromZone === toZone) {
    if (fromZone === 'mainOffice' && lineHitsAnyDesk(from.x, from.y, to.x, to.y)) {
      const corridor = findBestCorridor(from, to)
      if (corridor) return [corridor, to]
      const mid = CORRIDORS[2]
      return [mid, to]
    }
    return [to]
  }

  const path = []
  const exitDoor = ROUTE[fromZone]?.[toZone]

  if (exitDoor) {
    const d = DOORS[exitDoor]
    const doorPt = { x: d.x + (Math.random() - 0.5) * DOOR_JITTER, y: d.y + (Math.random() - 0.5) * 8 }

    // If leaving from mainOffice and far from door, add corridor waypoint first
    // This prevents visual straight-line crossing through desks/walls
    if (fromZone === 'mainOffice') {
      const distToDoor = Math.hypot(from.x - d.x, from.y - d.y)
      if (distToDoor > 120) {
        // Route through corridor first to avoid crossing desks
        if (lineHitsAnyDesk(from.x, from.y, doorPt.x, doorPt.y)) {
          const corridor = findBestCorridor(from, doorPt)
          if (corridor) path.push(corridor)
        }
      }
    }

    path.push(doorPt)

    // If entering mainOffice and destination is far from door, add corridor after door
    if (toZone === 'mainOffice') {
      const distFromDoor = Math.hypot(to.x - d.x, to.y - d.y)
      if (distFromDoor > 120 && lineHitsAnyDesk(doorPt.x, doorPt.y, to.x, to.y)) {
        const corridor = findBestCorridor(doorPt, to)
        if (corridor) path.push(corridor)
      }
    }
  }

  // Multi-room transit (e.g., lounge → research goes through mainOffice)
  if (fromZone !== 'mainOffice' && toZone !== 'mainOffice') {
    const entryDoor = ROUTE.mainOffice?.[toZone]
    if (entryDoor && entryDoor !== exitDoor) {
      const d = DOORS[entryDoor]
      const doorPt = { x: d.x + (Math.random() - 0.5) * DOOR_JITTER, y: d.y + (Math.random() - 0.5) * 8 }
      // Add corridor between the two doors if they're far apart
      const prevPt = path[path.length - 1] || from
      if (lineHitsAnyDesk(prevPt.x, prevPt.y, doorPt.x, doorPt.y)) {
        const corridor = findBestCorridor(prevPt, doorPt)
        if (corridor) path.push(corridor)
      }
      path.push(doorPt)
    }
  }

  path.push(to)
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

const SOCIAL_BEHAVIORS = new Set(['chat', 'thumbs-up', 'pass-document'])

// Returns true if this behavior requires the character to walk to a specific location
// (not their desk). Used to defer behavior labels until arrival.
export function needsLocationChange(behaviorId) {
  if (SOCIAL_BEHAVIORS.has(behaviorId)) return true
  const key = BEHAVIOR_LOCATIONS[behaviorId]
  return key !== undefined  // has an entry (even null for meeting)
}

// ─── Anti-overlap system ──────────────────────────────────────────────
import { MIN_AGENT_DIST, OBSTACLE_PUSH_PX, CORRIDOR_JITTER, DOOR_JITTER } from './constants'

// Get all other agents' current and target positions
function getOccupiedPositions(agentId, allAgents) {
  const positions = []
  if (!allAgents) return positions
  for (const [id, agent] of Object.entries(allAgents)) {
    if (id === agentId) continue
    // Use target position if moving, else current position
    const pos = agent.targetPosition || agent.position
    if (pos) positions.push(pos)
  }
  return positions
}

// Push a position away from all occupied positions
function avoidOverlap(pos, occupied, maxAttempts = 8) {
  let { x, y } = pos
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let tooClose = false
    for (const other of occupied) {
      const dx = x - other.x, dy = y - other.y
      const dist = Math.hypot(dx, dy)
      if (dist < MIN_AGENT_DIST) {
        tooClose = true
        // Push away from the other agent
        if (dist < 1) {
          // Nearly identical — push in random direction
          const angle = Math.random() * Math.PI * 2
          x += Math.cos(angle) * MIN_AGENT_DIST
          y += Math.sin(angle) * MIN_AGENT_DIST
        } else {
          // Push along the vector away from the other agent
          const push = (MIN_AGENT_DIST - dist) + 5
          x += (dx / dist) * push
          y += (dy / dist) * push
        }
      }
    }
    if (!tooClose) break
    // Re-clamp after push
    const clamped = clampToFloor({ x, y })
    x = clamped.x; y = clamped.y
  }
  return clampToFloor({ x, y })
}

// Add jitter then clamp to walkable floor
function jitter(pos, amount = 16) {
  return clampToFloor({
    x: pos.x + (Math.random() - 0.5) * amount,
    y: pos.y + (Math.random() - 0.5) * amount,
  })
}

export function getTargetForBehavior(agentId, behaviorId, allAgents) {
  const occupied = getOccupiedPositions(agentId, allAgents)

  // Meeting: pick a random chair around the table
  if (behaviorId === 'meeting') {
    // Pick a chair that's not already occupied
    const shuffled = [...MEETING_CHAIRS].sort(() => Math.random() - 0.5)
    for (const chair of shuffled) {
      const isFree = !occupied.some(o => Math.hypot(o.x - chair.x, o.y - chair.y) < 30)
      if (isFree) return clampToFloor(jitter(chair, 8))
    }
    return clampToFloor(jitter(shuffled[0], 8))
  }

  // Social behaviors: walk toward a random other agent (near them, not on them)
  if (SOCIAL_BEHAVIORS.has(behaviorId) && allAgents) {
    const others = Object.keys(allAgents).filter(id => id !== agentId)
    if (others.length > 0) {
      const targetId = others[Math.floor(Math.random() * others.length)]
      const targetPos = allAgents[targetId]?.position
      if (targetPos) {
        const angle = Math.random() * Math.PI * 2
        const dist = 30 + Math.random() * 15  // stay 30-45px away
        const raw = clampToFloor({
          x: targetPos.x + Math.cos(angle) * dist,
          y: targetPos.y + Math.sin(angle) * dist,
        })
        return avoidOverlap(raw, occupied)
      }
    }
  }

  // Home position — always valid, skip overlap check (it's their seat)
  const waypointKey = BEHAVIOR_LOCATIONS[behaviorId]
  if (waypointKey === undefined) return HOME_POSITIONS[agentId] || null

  const base = WAYPOINTS[waypointKey] || HOME_POSITIONS[agentId]
  if (!base) return null
  const jittered = jitter(base, 24)
  return avoidOverlap(jittered, occupied)
}

export function calcFacing(fromX, fromY, toX, toY) {
  const dx = toX - fromX, dy = toY - fromY
  if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return 'down'
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
}

