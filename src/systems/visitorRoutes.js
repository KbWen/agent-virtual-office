// Event visitors (boss-visit / dog-visit) walk the SAME navigation model as the employees.
//
// 2026-11-08 reproduction on current source: the old hand-authored straight-line paths crossed
// desks on 5/6 boss segments and 7/8 dog segments (one through the lounge's south wall, three
// over the coffee table), and visitors painted over every employee. This module replaces those
// paths with stop lists routed by movementSystem.calculateJourney (doors, corridors, furniture
// colliders), sampled at constant walking speed. Coordinates are FEET (same convention as
// employees); the renderer offsets each sprite so its shadow sits on the route point.
// Visitors do not take part in door claims (they are short scripted cameos); see spec.
import { calculateJourney } from './movementSystem.js'

// Stops are floor points; consecutive stops are joined by calculateJourney.
export const VISITOR_STOPS = Object.freeze({
  boss: Object.freeze([
    { x: 115, y: 115 }, // entrance hall, in front of the entrance door
    { x: 300, y: 290 }, // mid aisle between the desk rows
    { x: 505, y: 290 }, // right aisle, left of the whiteboard
    { x: 115, y: 115 }, // back out (the 10 s event allows one aisle walk-by)
  ]),
  dog: Object.freeze([
    { x: 115, y: 115 },
    { x: 300, y: 290 },
    { x: 505, y: 290 },
    { x: 300, y: 385 },
    { x: 228, y: 488 }, // lounge, beside the coffee table (WAYPOINTS.lounge)
    { x: 120, y: 520 }, // lounge south lane, in front of the couch
    { x: 240, y: 520 },
    { x: 300, y: 290 },
    { x: 115, y: 115 },
  ]),
})

// Sprite-local offset from the visitor's drawn origin to its feet/shadow (world units).
export const VISITOR_FEET_OFFSET = Object.freeze({ boss: 12 * 1.35, dog: 6 * 1.35 })

export function buildVisitorRoute(stops, journey = calculateJourney) {
  const pts = [{ x: stops[0].x, y: stops[0].y }]
  for (let i = 0; i < stops.length - 1; i++) {
    const { waypoints } = journey(pts[pts.length - 1], stops[i + 1])
    for (const p of waypoints) {
      const last = pts[pts.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) > 0.01) pts.push({ x: p.x, y: p.y })
    }
  }
  return pts
}

// Cumulative arc lengths for constant-speed sampling.
export function measureRoute(points) {
  const cum = [0]
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  return { points, cum, length: cum[cum.length - 1] }
}

// t in [0,1] → { x, y, dx } at constant speed (dx = horizontal heading sign for sprite flip).
export function sampleRoute(measured, t) {
  const { points, cum, length } = measured
  if (points.length === 1 || length === 0) return { x: points[0].x, y: points[0].y, dx: 1 }
  const d = Math.max(0, Math.min(1, t)) * length
  let i = 1
  while (i < cum.length - 1 && cum[i] < d) i++
  const segLen = cum[i] - cum[i - 1] || 1
  const k = (d - cum[i - 1]) / segLen
  const a = points[i - 1], b = points[i]
  // Vertical segments keep the most recent horizontal heading (no snap back to facing right).
  let dx = Math.sign(b.x - a.x)
  for (let j = i - 1; dx === 0 && j >= 1; j--) dx = Math.sign(points[j].x - points[j - 1].x)
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx: dx || 1 }
}

// Paint order: how many employees stand above (smaller feet y than) the visitor's feet.
// The visitor is drawn right after them so nearer employees occlude it and farther ones don't.
export function visitorDepthIndex(sortedAgentYs, feetY) {
  let n = 0
  while (n < sortedAgentYs.length && sortedAgentYs[n] <= feetY) n++
  return n
}
