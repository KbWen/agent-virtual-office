// stepWalkFrame — the pure per-frame walk math extracted from AgentCharacter's RAF loop so
// the hidden-tab/jank fast-forward semantics are unit-testable (the rAF loop itself cannot
// run under vitest: no browser frames in node).
//
// Hidden-tab fast-forward (owner bug 2026-06-11: "8人只看到6人"): rAF never fires in a
// hidden tab, so when the user tabs back the FIRST frame arrives with a huge timestamp gap.
// The dt clamp alone made frozen walkers resume as a slow glide — the user literally watched
// the pile separate. A gap above GAP_SNAP_MS instead snaps the leg to its target, so by the
// user's first visible frame every walker is already at its own (de-stacked) waypoint.
//
// Mutates vp in place (it is the live position ref) and returns true when the leg ARRIVED
// (caller advances the waypoint chain).

export const GAP_SNAP_MS = 1500
export const ARRIVE_EPSILON = 1.5

export function stepWalkFrame(vp, tp, dtSeconds, gapMs, walkSpeed) {
  // Fast-forward: a frozen/janked leg resumes AT its target, not gliding from the pile.
  if (gapMs > GAP_SNAP_MS) {
    vp.x = tp.x
    vp.y = tp.y
    return true
  }
  const dx = tp.x - vp.x
  const dy = tp.y - vp.y
  const dist = Math.hypot(dx, dy)
  if (dist <= ARRIVE_EPSILON) {
    vp.x = tp.x
    vp.y = tp.y
    return true
  }
  const step = walkSpeed * dtSeconds
  if (step >= dist) {
    vp.x = tp.x
    vp.y = tp.y
    return true
  }
  vp.x += (dx / dist) * step
  vp.y += (dy / dist) * step
  return false
}
