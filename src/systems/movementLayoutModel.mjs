// Node-safe office layout contract for alternate renderers.
//
// This exposes stable geometry and standability semantics without exporting the
// random pathfinding scheduler from movementSystem.js. Renderers can share the
// same rooms, anchors, home seats, and obstacle rules while choosing their own
// animation/runtime strategy.

export const OFFICE_LAYOUT_VERSION = 'office-layout-v1'

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const item of Object.values(value)) deepFreeze(item)
  return value
}

export const OFFICE_CANVAS = deepFreeze({
  width: 800,
  height: 560,
  standableBounds: { xMin: 15, xMax: 785, yMin: 15, yMax: 545 },
})

export const FLOOR_ZONES = deepFreeze([
  { id: 'entrance', x1: 15, y1: 15, x2: 593, y2: 133 },
  { id: 'mainOffice', x1: 15, y1: 168, x2: 593, y2: 394 },
  { id: 'meetingRoom', x1: 628, y1: 15, x2: 785, y2: 413 },
  { id: 'lounge', x1: 15, y1: 424, x2: 451, y2: 545 },
  { id: 'research', x1: 469, y1: 424, x2: 785, y2: 545 },
  { id: 'door-entrance', x1: 90, y1: 133, x2: 138, y2: 168 },
  { id: 'door-lounge', x1: 215, y1: 394, x2: 266, y2: 424 },
  { id: 'door-research', x1: 510, y1: 394, x2: 561, y2: 424 },
  { id: 'door-meeting', x1: 593, y1: 187, x2: 628, y2: 233 },
])

export const OBSTACLE_RECTS = deepFreeze([
  { id: 'pmDesk', x1: 105, y1: 215, x2: 175, y2: 260 },
  { id: 'archDesk', x1: 225, y1: 215, x2: 295, y2: 260 },
  { id: 'qaDesk', x1: 365, y1: 195, x2: 435, y2: 240 },
  { id: 'resDesk', x1: 485, y1: 195, x2: 555, y2: 240 },
  { id: 'devDesk', x1: 305, y1: 315, x2: 375, y2: 360 },
  { id: 'opsDesk', x1: 425, y1: 315, x2: 495, y2: 360 },
  { id: 'designerDesk', x1: 105, y1: 335, x2: 175, y2: 370 },
  { id: 'meetingTable', x1: 650, y1: 128, x2: 760, y2: 195 },
  { id: 'whiteboard', x1: 525, y1: 278, x2: 590, y2: 342 },
  { id: 'wc', x1: 338, y1: 443, x2: 422, y2: 502 },
  { id: 'loungeBookshelves', x1: 278, y1: 438, x2: 412, y2: 458 },
  { id: 'coffeeMachine', x1: 15, y1: 438, x2: 70, y2: 465 },
  { id: 'gateBooth', x1: 84, y1: 88, x2: 101, y2: 114 },
  { id: 'researchBookshelfA', x1: 472, y1: 434, x2: 528, y2: 460 },
  { id: 'researchBookshelfB', x1: 627, y1: 434, x2: 688, y2: 460 },
  { id: 'researchBookshelfC', x1: 702, y1: 434, x2: 763, y2: 460 },
  { id: 'printer', x1: 590, y1: 488, x2: 612, y2: 508 },
])

export const WAYPOINTS = deepFreeze({
  gate: { x: 100, y: 80 },
  pmDesk: { x: 140, y: 240 },
  archDesk: { x: 260, y: 240 },
  devDesk: { x: 340, y: 340 },
  opsDesk: { x: 460, y: 340 },
  qaDesk: { x: 400, y: 220 },
  resDesk: { x: 520, y: 220 },
  coffeeArea: { x: 80, y: 475 },
  waterCooler: { x: 130, y: 475 },
  whiteboard: { x: 560, y: 350 },
  lounge: { x: 180, y: 490 },
  researchLib: { x: 620, y: 490 },
  phone: { x: 755, y: 480 },
  toilet: { x: 380, y: 510 },
  printer: { x: 600, y: 510 },
  window: { x: 340, y: 100 },
  snackArea: { x: 30, y: 520 },
})

export const MEETING_CHAIRS = deepFreeze([
  { x: 660, y: 205 },
  { x: 700, y: 205 },
  { x: 745, y: 205 },
  { x: 660, y: 120 },
  { x: 700, y: 120 },
  { x: 745, y: 120 },
  { x: 645, y: 160 },
  { x: 765, y: 160 },
])

export const OVERFLOW_POSITIONS = deepFreeze([
  { x: 200, y: 80 },
  { x: 370, y: 80 },
  { x: 490, y: 80 },
  { x: 100, y: 55 },
  { x: 540, y: 60 },
  { x: 300, y: 50 },
])

export const HOME_POSITIONS = deepFreeze({
  pm: { x: 140, y: 264 },
  arch: { x: 260, y: 264 },
  dev: { x: 340, y: 364 },
  ops: { x: 460, y: 364 },
  qa: { x: 400, y: 244 },
  res: { x: 520, y: 244 },
  gate: WAYPOINTS.gate,
  designer: { x: 140, y: 384 },
  planner: { x: 200, y: 274 },
  worker: { x: 400, y: 304 },
  checker: { x: 500, y: 254 },
})

const DOOR_SIDES = deepFreeze({
  entranceToMain: {
    entrance: { x: 115, y: 125 },
    mainOffice: { x: 115, y: 176 },
  },
  mainToMeeting: {
    mainOffice: { x: 585, y: 210 },
    meetingRoom: { x: 636, y: 210 },
  },
  mainToLounge: {
    mainOffice: { x: 240, y: 386 },
    lounge: { x: 240, y: 432 },
  },
  mainToResearch: {
    mainOffice: { x: 535, y: 386 },
    research: { x: 535, y: 432 },
  },
})

const MAIN_ROUTE_NODES = deepFreeze([
  { x: 80, y: 290 },
  { x: 300, y: 180 },
  { x: 300, y: 290 },
  { x: 505, y: 290 },
  { x: 300, y: 385 },
  { x: 80, y: 180 },
  { x: 550, y: 180 },
  { x: 80, y: 385 },
  { x: 550, y: 385 },
])

const SPRITE_CLEAR_RX = 32
const SPRITE_CLEAR_RY = 44
const OBSTACLE_PUSH_PX = 6

export const BEHAVIOR_LOCATIONS = deepFreeze({
  'goto-coffee-machine': 'coffeeArea',
  'drink-coffee': 'coffeeArea',
  'drink-water': 'waterCooler',
  whiteboard: 'whiteboard',
  nap: 'lounge',
  'phone-call': 'phone',
  toilet: 'toilet',
  research: 'researchLib',
  meeting: null,
  print: 'printer',
  'look-window': 'window',
  'eat-snack': 'snackArea',
  stretch: 'lounge',
  'check-phone': 'lounge',
})

export const SOCIAL_BEHAVIOR_IDS = deepFreeze(['chat', 'thumbs-up', 'pass-document'])
const SOCIAL_BEHAVIORS = new Set(SOCIAL_BEHAVIOR_IDS)

const ZONES = [
  { id: 'entrance', x1: 0, y1: 0, x2: 598, y2: 148 },
  { id: 'meetingRoom', x1: 598, y1: 0, x2: 800, y2: 420 },
  { id: 'mainOffice', x1: 0, y1: 148, x2: 598, y2: 418 },
  { id: 'lounge', x1: 0, y1: 418, x2: 460, y2: 560 },
  { id: 'research', x1: 460, y1: 418, x2: 800, y2: 560 },
]

function inRect(x, y, rect) {
  return x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2
}

export function isOnFloor(x, y) {
  return FLOOR_ZONES.some((z) => inRect(x, y, z))
}

export function obstacleAt(x, y) {
  return OBSTACLE_RECTS.find((r) => inRect(x, y, r)) || null
}

export function isOnObstacle(x, y) {
  return Boolean(obstacleAt(x, y))
}

export function pushOutOfObstacle(x, y) {
  for (const r of OBSTACLE_RECTS) {
    if (!inRect(x, y, r)) continue
    const toLeft = x - r.x1
    const toRight = r.x2 - x
    const toTop = y - r.y1
    const toBottom = r.y2 - y
    const min = Math.min(toLeft, toRight, toTop, toBottom)
    if (min === toLeft) x = r.x1 - OBSTACLE_PUSH_PX
    else if (min === toRight) x = r.x2 + OBSTACLE_PUSH_PX
    else if (min === toTop) y = r.y1 - OBSTACLE_PUSH_PX
    else y = r.y2 + OBSTACLE_PUSH_PX
  }
  return { x, y }
}

export function clampToFloor(pos) {
  let { x, y } = pos
  if (!isOnFloor(x, y)) {
    let bestDist = Infinity
    for (const z of FLOOR_ZONES) {
      if (z.id.startsWith('door-')) continue
      const cx = Math.max(z.x1 + 5, Math.min(z.x2 - 5, x))
      const cy = Math.max(z.y1 + 5, Math.min(z.y2 - 5, y))
      const d = Math.hypot(x - cx, y - cy)
      if (d < bestDist) {
        bestDist = d
        x = cx
        y = cy
      }
    }
  }
  const pushed = pushOutOfObstacle(x, y)
  x = pushed.x
  y = pushed.y
  x = Math.max(OFFICE_CANVAS.standableBounds.xMin, Math.min(OFFICE_CANVAS.standableBounds.xMax, x))
  y = Math.max(OFFICE_CANVAS.standableBounds.yMin, Math.min(OFFICE_CANVAS.standableBounds.yMax, y))
  return { x, y }
}

export function zoneForPoint(x, y) {
  for (const z of ZONES) {
    if (x >= z.x1 && x < z.x2 && y >= z.y1 && y < z.y2) return z.id
  }
  return null
}

export function needsLocationChange(behaviorId) {
  if (SOCIAL_BEHAVIORS.has(behaviorId)) return true
  return Object.prototype.hasOwnProperty.call(BEHAVIOR_LOCATIONS, behaviorId)
}

export function visuallyOverlapping(a, b, rx = SPRITE_CLEAR_RX, ry = SPRITE_CLEAR_RY) {
  const nx = (a.x - b.x) / rx
  const ny = (a.y - b.y) / ry
  return nx * nx + ny * ny < 1
}

export function calcFacing(fromX, fromY, toX, toY) {
  const dx = toX - fromX
  const dy = toY - fromY
  if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return 'down'
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
}

export function buildMovementLayoutViewModel() {
  return {
    version: OFFICE_LAYOUT_VERSION,
    canvas: OFFICE_CANVAS,
    floorZones: FLOOR_ZONES.map((zone) => ({ ...zone })),
    obstacleRects: OBSTACLE_RECTS.map((rect) => ({ ...rect })),
    waypoints: Object.fromEntries(Object.entries(WAYPOINTS).map(([id, pos]) => [id, { ...pos }])),
    homePositions: Object.fromEntries(Object.entries(HOME_POSITIONS).map(([id, pos]) => [id, { ...pos }])),
    meetingChairs: MEETING_CHAIRS.map((chair) => ({ ...chair })),
    overflowPositions: OVERFLOW_POSITIONS.map((pos, index) => ({ ...pos, slot: index })),
    spriteClearance: { rx: SPRITE_CLEAR_RX, ry: SPRITE_CLEAR_RY },
  }
}
