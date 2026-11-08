# Event visitors and lounge table — shared-world correctness fix (2026-11-08)

Separate unit from the Pixel appearance; applies to BOTH appearances.

## Reproduction on current source (before)
Hand-authored straight paths sampled at 1% steps against movementSystem's floor and colliders
(feet = drawn origin + sprite foot offset):
- boss-visit: 5/6 segments crossed desks (up to 64% of a segment on furniture).
- dog-visit: 7/8 segments bad: desks, the lounge south wall (27% off-floor) and the round
  coffee table (up to 30%).
- WAYPOINTS.lounge (180,490) sat ON the coffee table, which had no collider, so nap / stretch /
  check-phone employees also stood on it. Visitors were painted over every employee.

## Fix
- Lounge coffee table gets a collider (appended to OBSTACLE_RECTS and LOUNGE_OBSTACLES; fits
  the lounge lane contract y430 / y520); WAYPOINTS.lounge moved beside it (228,488).
- src/systems/visitorRoutes.js: visitor stop lists joined by calculateJourney (the employees'
  doors, corridors and colliders), sampled at constant speed, feet on the route.
- Visitors are painted inside the employee list at their feet depth (keyed, no remounts).
  Start time kept in a ref: React 19 dev StrictMode re-runs effects when a keyed child moves.
- Not included: visitors do not take door claims (short scripted cameo; documented risk of a
  brief overlap at a door with an employee crossing at the same moment).

## Evidence (after)
- tests/visitorRoutes.test.js: 200 randomised builds per visitor, zero floor/collider samples;
  baseline test pins the old paths as failing. tests/movementSystem.test.js: lounge path that
  used to cross the table now detours.
- Live (scripts/visitor-route-verify.mjs, isolated dev server, every animation frame):
  boss 585 / dog 1025 frames in Pixel, 523 / 1031 in Classic: 0 off-floor, 0 on furniture,
  0 depth-order errors (visitor-checks-*.json).
- Recordings: boss-pixel.mp4, dog-pixel.mp4, boss-classic.mp4, dog-classic.mp4.
