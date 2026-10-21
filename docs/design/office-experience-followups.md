---
title: "Office Experience Follow-ups — Visual and State Contract"
status: frozen
approved: 2026-10-19
created: 2026-10-19
---
# Office Experience Follow-ups — Design Source of Truth

Owner-selected scope: AVO-199, AVO-200, AVO-201. Visual baseline approved on 2026-10-19; actual implemented captures still need owner visual acceptance. Each spec is the semantic authority for its feature; this file owns layout, states, tokens and rendering comparison. No application implementation or image assets are produced here.

## Existing Layout
```text
viewBox 0 0 800 560 (unchanged)
+------------------------------------------------------+
| windows / existing clock / existing scene labels     |
| main office desks                   meeting room     |
|                                     existing table  |
|                                     seat (700,205) P |
| main-office whiteboard (535,300)                      |
| lounge / research / existing ambient furnishings    |
+------------------------------------------------------+
control bar: existing connection-health button + controls
```
The existing whiteboard is outside the meeting room. P marks an EXISTING chair for documentation, not a new rendered marker/furniture. No room/table/door/desk is moved.

## Shared Rendering and Accessibility
Back-to-front: room/furniture -> existing light/theme tint and new window-local treatment -> existing lamp glows -> pets/helpers/agents -> status/ring/name/bubble -> existing controls/inspector. No tint, blind or glow above the status channel. Keep current theme sum cap 0.45 and lighting ceiling 0.38; no new scene tint.

Full view, dock/panel crop, roster and narrow viewport retain their existing layouts. Do not force hidden actors into view or reposition bubbles for these features. Status text/rings retain existing contrast and accessible semantics. High contrast suppresses new calm lighting; reduced motion suppresses new travel and treatment. No autoplay, blinking success, timed rewards or ambient alerts.

## C — AVO-199 Calm States
| ID | Input | Required appearance |
|---|---|---|
| C1 | Healthy fresh observed sessions all idle for less than30s | Existing scene; existing health detail unchanged; no countdown or settling badge. |
| C2 | Same evidence for at least30s | Existing health detail appends "Observed sessions idle" / "目前觀察到的工作階段皆閒置"; no success color or extra scene text. Existing authorized sound fades to silence. |
| C3 | New work/planning/done/blocked/approval | Quiet detail and audio override disappear immediately; original signal presentation wins. |
| C4 | No source/expired/offline/fallback/demo/pause | Existing unknown/trouble explanation remains; no "all caught up", reassuring green dot or fabricated rest pose. |

No new typography scale: reuse existing health tooltip/button styles. No forced reading/lean-back/nap pose or collective journey; this keeps the quietness honest and visually small.

## P — AVO-200 Planning Seat
| ID | State | Required appearance |
|---|---|---|
| P1 | No qualifying planning / first5s | Actor stays put with real current status. |
| P2 | One owner, route queued | Actor remains at current safe anchor; existing planning status stays legible; no walking-in-place or doorway queue. |
| P3 | Route granted, walking | Existing walk animation along legal path; status retained; no meeting bubble or destination pose before arrival. |
| P4 | Matching final arrival | Existing planning/gantt-chart presentation at validated existing chair (700,205); no audience or new sign. |
| P5 | Second planner/occupied seat | Other planner remains at own desk/slot, unchanged; one global seat owner maximum. |
| P6 | Blocker/end/expiry/group/pause/disable | New true status appears immediately. Cancel/return uses rendered position and legal claims; blocked owner is not dragged away. No ghost occupancy or stale planning glyph. |

The coordinate is the proposed anchor, not permission to bypass floor/obstacle/separation checks. If it fails current geometry, stop for a DSoT revision rather than changing collision constants or silently selecting another location. No whiteboard/room relocation.

## N — AVO-201 Off-hours
| ID | Input | Required appearance |
|---|---|---|
| N1 | Weekday daylight / not quiet | Baseline existing lighting/windows. |
| N2 | Quiet, local22:00-05:59 | Window-local blind covers top22%, existing putty #D8CDBE opacity<=0.15; existing floor/ceiling glow alpha x0.70. |
| N3 | Quiet weekend daytime | Top10% blind only; existing twilight glow alpha x0.85 if baseline already has glow; no midday light invented. |
| N4 | Weekend night | N2 wins; one slat layer, no summed dimming. |
| N5 | Work/blocker/unknown/lighting off/reduced-motion/high-contrast | Added treatment removed; existing status/lighting preferences retained. |

Blinds clip to the window interior, never cover actor/name/scene label. Existing moon, weather and window cross stay readable. Keep global tint hue/alpha unchanged and no new animation. Existing OVERTIME chip appears only after22 with fresh actual working/planning evidence; quiet/no-source is never labeled overtime.

## Review and Capture Matrix
For each feature capture baseline vs new at identical time/status/theme: full800x560, existing panel wide/tall crops, roster and narrow view; normal/reduced-motion/high-contrast; default/winter/autumn where lighting changes. Include idle, active, blocked, awaiting-approval, disconnected and unknown. Planning also needs walking/door contention/abort frame sequences, not just a still image.

Owner reviews visual fidelity and feel. Automated checks prove state truth, unchanged status channels, layer ordering, bounding boxes/clip geometry and lifecycle wiring. A static mockup or green soak does not prove real movement works.

## Approval Scope
The owner approved this baseline and ADR-011 on 2026-10-19, and authorized limited implementation-time unfreeze of shared specifications ux-vibe-rebalance.md and subagent-helper-huddle.md for the new features' shared-file alignment only. Preserve control demotion/deletion and helper semantics; re-freeze after alignment. Those files are unchanged in this planning session. No broad rewrite or already-shipped behavior change is authorized. Actual implemented visual/movement capture approval remains a separate acceptance step.


## Implemented Acceptance — AVO-199
The owner accepted AVO-199 C1-C4 captures on 2026-10-21 (7 views, 45 captures) and authorized enabling calm. Existing health detail carries the quiet wording with no new badge or pose. This acceptance applies only to AVO-199; AVO-200 movement and AVO-201 lighting captures remain separate gates.
