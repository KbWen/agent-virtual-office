// Seated-at-desk presentation (owner R1 decision 2026-11-08: option C, back view seated).
// Presentation only, shared by Classic and Pixel: it never moves an agent, never changes a
// route/collider, and is derived purely from existing truth (position, motion, event lock,
// live status). Geometry is in actor-LOCAL units (world / 1.35) relative to the world feet.
import { HOME_POSITIONS } from './movementSystem.js'

// Roles that own a desk + chair in the main office (gate works at the lobby booth, no chair).
export const DESK_ROLES = new Set(['pm', 'arch', 'qa', 'res', 'dev', 'ops', 'designer'])

// The chair seat starts ~4 world px above the home foot point (desk y + 20, feet at desk y + 24).
// Body drawn this much lower puts the hips on the seat; everything below SEAT_CLIP_Y is hidden so
// the chair painted underneath shows instead of legs.
export const SEAT_SHIFT = 8
export const SEAT_CLIP_Y = -2.5

// Back view only while REALLY working (owner 2026-11-08: mostly-backs felt distant). Idle, done,
// blocked and awaiting-approval stand and face the viewer. `thinking` is the derived quiet-working
// state (idle-gap inference), so it still counts as working.
const WORKING_STATUSES = new Set(['working', 'planning', 'thinking'])
const AT_HOME_EPSILON = 2

export function baseRoleOf(id) {
  return typeof id === 'string' && id.includes('~') ? id.split('~').pop() : id
}

export function isSeatedAtDesk({ id, position, isWalking = false, isMoving = false, inGroupEvent = false, status = 'idle' }) {
  if (isWalking || isMoving || inGroupEvent) return false
  if (!WORKING_STATUSES.has(status)) return false
  const role = baseRoleOf(id)
  if (!DESK_ROLES.has(role)) return false
  const home = HOME_POSITIONS[id] || HOME_POSITIONS[role]
  if (!home || !position) return false
  return Math.abs(position.x - home.x) <= AT_HOME_EPSILON && Math.abs(position.y - home.y) <= AT_HOME_EPSILON
}
