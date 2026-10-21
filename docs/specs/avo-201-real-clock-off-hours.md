---
title: "AVO-201 — Real-Clock Quiet Night and Weekend Lighting"
status: frozen
approved: 2026-10-19
created: 2026-10-19
primary_domain: ui-rendering
secondary_domains: [office-runtime]
classification: feature
planning_state: implementation-ready
implementation_state: not-started
---

# AVO-201 — Real-Clock Quiet Night and Weekend Lighting

## Goal
Make a confirmed quiet office feel gently settled at real local late-night/weekend times by adapting existing window and lamp treatment. Keep all real work/attention channels visually dominant.

[FROM-SOURCE] Real-clock-only blinds/light polish without desk clutter. [INFERRED] Reuse the existing hourly tint, windows, halos, lighting toggle and AVO-199 quiet state. This is feature, replacing the rough quick-win estimate because it spans clock data, scene state and multiple render components.

## Dependencies and Non-goals
Requires AVO-199's officeCalm.mode and rollout config. No dependency on AVO-198 or planning pod. Do not independently reimplement the all-idle predicate.
No simulated/accelerated clock, timezone assumptions from server, random weather, new music, night-work admonition, notifications, extra furniture, altered movement or forced sleeping. A weekend does not mean a person has finished working.

File Relationship: INDEPENDENT visual refinement of current lighting.js/PixelOffice/WallWindow behavior; ADR-007/008 apply. Existing shipped lighting specs are historical, not current authority.

## Design
DSoT: ../design/office-experience-followups.md, N1-N5 and composition budget. Owner approved the baseline on 2026-10-19; actual rendered captures still require visual acceptance. No new modal/menu/badge; respect existing lightingEnabled, reduced-motion and contrast preferences. No additional full-scene tint rect.

## Real-Clock and Input Contract
Extend the existing updateTime transaction with local weekday (Date.getDay, 0=Sunday) alongside hour/minute; initialize and update using the same Date instance. Reuse officeLife.js's minute timer and the AVO-199 lifecycle-safe visibility refresh; no extra interval or per-frame Date calls. No stale Friday/Saturday rollover. Treat invalid time/day as neutral.
Derive getOffHoursScene({hour,weekday,calmMode,lightingEnabled,reducedMotion,contrastMore}) as a pure helper in lighting.js. Keep getLightingOverlay and MAX_OPACITY=0.38 unchanged. Keep the existing theme+lighting sum cap 0.45.

## Proposed Visual Rules
- Additional quiet treatment requires offHoursEnabled, lightingEnabled and calmMode=quiet; reduced-motion/high-contrast suppress the new treatment. Active/blocked/awaiting-approval/offline/unknown immediately restore the existing baseline lighting, never clear the real signal.
- Local deep-night interval: hour>=22 or hour<6. Weekend: weekday=0 or 6. Weekday daytime gets no additional effect; weekend daytime may show only a 10% closed blind within the existing window. Deep-night quiet uses 22% closed blind. Deep-night takes precedence, so weekend night never stacks two blind layers.
- Use one static window-local slat group clipped inside the existing window interior: existing putty #D8CDBE, opacity <=0.15; leave moon/weather/cross legible. The blind cannot extend over an actor, scene label or adjacent window.
- Existing floor halos/ceiling glows retain their shapes and layers beneath sprites/status. Quiet deep-night scales their current alpha to 0.70; weekend quiet twilight to 0.85. Zero remains zero: do not create midday halos where the baseline has none. Desk monitor/real status colors and global tint curve are unchanged.
- Existing OVERTIME chip currently depends only on hour>=22. Keep it only when at least one fresh, explicit working/planning session is actually present; hide it in quiet, unknown or blocker-only states. Do not invent a new warning or congratulatory label.
- No animation is necessary for MVP. Static changes are applied on the existing clock/mode boundary. Do not introduce infinite shimmer, strobe or a layout shift. Existing windows/weather outside the new effect keep their established behavior.
- offHoursEnabled defaults false until design and capture approval, then enable independently. Existing lighting toggle disables all new light treatment.

## Acceptance Criteria
| AC | Verifiable requirement |
|---|---|
| AC-1 | Pure hour/day matrix handles 21->22, 23->0, 5->6, Friday->Saturday, Sunday->Monday and local clock/timezone changes; invalid inputs are neutral. |
| AC-2 | Effect requires confirmed quiet and feature/lighting enablement; any new work, blocker, offline/unknown or accessibility override removes the added treatment immediately. |
| AC-3 | Night/weekend precedence emits at most one clipped blind group per window, <=22% height and <=0.15 opacity; weather/moon/cross remain readable. |
| AC-4 | Existing tint curve/max0.38 and combined cap0.45 are unchanged; no new global layer, status recolor or above-agent glow. |
| AC-5 | Only existing halo alphas scale as designed; no midday fake light, pose/position/audio/status/mood/ledger change or preference mutation. |
| AC-6 | OVERTIME requires fresh actual work after22; quiet/unknown/blocker-only never claims overtime; planning remains real work, not presumed completion. |
| AC-7 | Clock/weekday update uses the existing timer/Date and visibility path, with no per-frame subscription or second clock; pause/resume/midnight recovers. |
| AC-8 | N1-N5 pass full/panel/roster/narrow, theme and a11y rendered checks; owner approves before flag enablement; disabled feature matches baseline. |
| AC-9 | Focused/full tests, build/budget/smoke/governance pass; an incorrect weekend boundary or removal of quiet gating makes a test fail. |

## Target Files
Modify: src/systems/lighting.js, src/systems/lighting.test.js, src/systems/store.js (weekday in existing clock update only), src/components/PixelOffice.jsx (derived props/existing glows/OVERTIME), src/components/TopDownFurniture.jsx (WallWindow optional clipped slats), src/config/officeExperience.json (owned flag).
New tests: tests/offHoursScene.test.jsx, tests/officeClockCalendar.test.js, scripts/verify-off-hours.mjs (real-browser calendar/layer/capture check).
Regression: tests/theme.test.js and current clock/scene tests. Docs: this spec and DSoT. Do not refactor unrelated furniture or sound.

## Implementation Steps
Split into 2-5 minute independently verifiable edits.
| Step | Change / verification | AC |
|---|---|---|
| S1 | Pure off-hours helper + exhaustive hour/day/quiet/a11y matrix and disabled flag. | 1,2,4 |
| S2 | Extend existing clock transaction with weekday; fake-clock midnight/visibility tests. | 1,7 |
| S3 | Wire clipped optional window slats and scale existing glow alpha; rendered layer/geometry tests. | 2,3,4,5 |
| S4 | Gate existing OVERTIME on fresh actual work; negative and planning/blocker tests. | 6 |
| S5 | Capture N1-N5, themes/accessibility modes, owner approval and rollout flag; full regression/negative controls. | 8,9 |

## Verification
npx vitest run src/systems/lighting.test.js tests/offHoursScene.test.jsx tests/officeClockCalendar.test.js tests/theme.test.js — zero failures. Inject actual Date/timezone fixtures; do not merely rename a test timezone while leaving the process clock unchanged.
npm test; npm run build; node scripts/bundle-budget.mjs; npm run smoke; npm run smoke:panel; pwsh -File .agentcortex/bin/validate.ps1 — zero failures, no new dependencies or weakened budget/contrast tests.
Capture existing baseline and new treatment at the same simulated real local timestamp and identical status/theme; rendering screenshots are for owner approval, not a substitute for logic tests.
node scripts/verify-off-hours.mjs — isolated dev server, existing store module import and transient experienceFlags; verify actual window clipping/layer order, midnight/visibility changes and screenshots. No production debug route/global or jsdom package.

## Risks and Rollback
Weak contrast or misleading rest could hide real work. Keep additions window-local/beneath status, retain existing color budgets and clear effects immediately on signal/health change. Set offHoursEnabled=false to restore baseline; preserve the user's lighting/sound preferences and unrelated dirty/untracked files.

## Domain Decisions
- [DECISION] Clock affects scenery only; quiet truth comes exclusively from AVO-199.
- [CONSTRAINT] Weekend/night never implies task completion, fatigue or a requirement to return.
- [CONSTRAINT] Existing global tint and theme budgets remain unchanged.
- [TRADEOFF] Static small blinds/existing halo scaling provide charm without new scene clutter or animation.
- [CONSTRAINT] OVERTIME needs positive real-work evidence; time alone is insufficient.

## Claude Resume
After AVO-199 merges, bootstrap a dedicated feature branch/log. This spec is frozen and the DSoT baseline is approved; actual rendered acceptance remains pending. The owner authorized limited implementation-time shared-file alignment of ux-vibe-rebalance.md and subagent-helper-huddle.md while preserving controls/helpers; those files are unchanged here. Run implement->review->test->handoff->ship. Do not bundle movement work or art into this unit. Runtime evidence remains pending until implemented.
