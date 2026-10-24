---
title: "AVO-206 — Optional Cozy Interactions"
status: shipped
created: 2026-10-23
approved: 2026-10-23
primary_domain: ui-rendering
secondary_domains: [office-runtime]
classification: feature
implementation_state: shipped
---

# Optional Cozy Interactions

## Goal and Approval

Delivery authorization (2026-10-24): the owner requested thorough verified closeout and normal project startup. This accepts the agent-verified rendered outcome; it does not claim a separate manual aesthetic trial.


The owner selected all C1-C5 candidates in `docs/reviews/2026-10-23-cozy-interaction-options.md` and authorized proceeding. Implement them as one optional, presentation-only feature without changing work signals, movement or event cadence. Scope approval is the owner's 2026-10-23 message selecting all five and delegating advancement. Final rendered visual acceptance remains separate. The owner subsequently rejected Settings-based toy/card actions and explicitly required playful, directly operable scene objects; this amendment supersedes the C4/C5 entry design.

File Relationship: INDEPENDENT optional extension of existing plant/pet/poke/postcard surfaces. It preserves the frozen UX demotion/helper contracts and does not implement AVO-202/203 or the existing AVO-199/200/201 plans. ADR-007/008 remain binding. No existing frozen spec is amended.

## Design

Link: docs/design/cozy-interactions.md. Approved: owner selected all described concepts; implementation uses the dimensions/states below and existing visual language. No new default toolbar control, furniture or walk geometry. C4/C5 are small props on existing surfaces, directly operable without opening Settings or enabling a preference. The owner authorized closeout on 2026-10-24 based on agent verification and requested normal project launch. Rendered verification and export proof passed; no separate manual trial is claimed.

## Functional Contract

- One `Small interactions` preference for enhanced plant/pet/agent reactions (C1-C3), default OFF, stored locally with an ephemeral fallback if storage is unavailable. Direct star/card scene props (C4/C5) are always available in full scene mode; deliberate input is their opt-in. No Zustand agent schema/status/transport change. Disabled behavior is byte-equivalent in intent to the current interaction behavior; current pet heart and poke/inspector remain available.
- C1: click/Enter/Space on an existing plant sways its leaves once for <=800ms; pot and anchors unchanged. Re-click replaces rather than stacks the effect. Reduced motion shows a short static leaf highlight. Preserve the current plant count and pointer keep-out space (the existing density test permits up to nine framing/dead-zone plants).
- C2: extend click-to-pet with a short type-appropriate local reaction; no pet position, mode or feeding state. Cat blink/ear twitch, dog tail wag, vacuum brush turn; other species retain the existing heart acknowledgement. A blocker/approval wait cancels the new overlay immediately. Disabled preference retains the old heart only.
- C3: an idle, stationary character's existing poke can add a short hand wave within the existing sprite footprint. Status change or walking cancels it; no target/position/facing/task/bubble-pool change. Inspector click and keyboard behavior stay intact. Implement the minimal reusable wave grid transform now; AVO-203 can consume it later instead of requiring the larger unimplemented pose feature first.
- C4: a small paper star lies on the existing lounge round table at (175,487). Direct primary-pointer or Space/Enter press visibly compresses it and changes its expression; release gives one bounded rebound. Hover/focus reveals a contextual hint. Cancel/blur/unmount clear the press; reduced motion uses expression/color feedback. No standalone toy drawer/panel, score, reward, sound or new furniture.
- C5: a pinned postcard on the existing notice board at (256,73) lifts a corner on hover/focus; click/Enter/Space opens its larger preview with None/Plant/Cat decoration and local PNG download, returning focus to the pinned card on close. Snapshot source-backed card inputs at opening. No sticker may cover source-backed text or modify `buildCardModel`'s counts/date/weather/caption. Remove the postcard/toy actions from Settings; the scene postcard remains usable regardless of the C1-C3 preference. No automatic upload or sharing is added.
- All new async preview renders fence stale completions; object URLs are revoked on replacement/unmount; error paths log coarse observable context and show an actionable retry state. No silent catches.
- Production PNG preview must work under the existing CSP via a local data URL, with no server-policy relaxation. Fence delayed conversion/close/selection races; image decode failure exposes retry and disables download. Verify actual painted production pixels and the saved PNG.

## Acceptance Criteria

| AC | Criterion |
|---|---|
| C1 | C1-C3 preference defaults off and safely persists; C4/C5 scene objects work directly without Settings; no agent state writes |
| C2 | Plant pot, layout and count unchanged; leaves respond once, cancel cleanly and support keyboard/reduced motion |
| C3 | Pet response never changes genuine mode/position; real blockers preempt it; disabled preference preserves baseline heart |
| C4 | Wave appears only while idle/stationary; changing status/walking cancels it; existing inspector/poke behavior preserved |
| C5 | Star is physically on the existing lounge table, responds directly to press/release/cancel/blur with an expressive bounded rebound; no toy popup or score |
| C6 | Pinned scene postcard has hover/keyboard affordance and opens None/Plant/Cat preview/export; close restores its focus; source model, stale fencing and URL cleanup remain intact |
| C7 | Narrow/desktop, both locales and reduced-motion states remain usable; popovers do not cover attention/footer controls |
| C8 | Focused tests, full test suite, build, bundle budget, render/panel smoke and governance pass; no new dependencies |

## Targets and Steps

1. Preference helper/hook and tests; off-by-default integration preserves old behavior.
2. Independent plant/pet and idle-wave render extensions with red/green tests.
3. Toy and card-preview components with loading/error/retry/close/cleanup states.
4. Move toy/card actions out of Settings to small scene props; add contextual input/hover feedback and preserve postcard-only sticker drawing.
5. Integrated isolated-browser before/after state snapshots, gestures, reduction and edge cases; full regression and review.

Planned targets: src/components/{TopDownFurniture,OfficePet,petSprites,AgentCharacter,ControlPanel}.jsx; CozyCardPreview.jsx, useCozyInteractions.js and popover/preview helpers; replace standalone CozyToyTray with ScenePaperStar.jsx; add ScenePostcard.jsx and sceneCozy.js; PixelOffice.jsx owns card opening; new src/systems/{cozyPreferences,idleWave}.js; src/systems/dailyCard.js; src/index.css; both locales; focused tests and verification script. Integration scope update: src/App.jsx must respect already-handled keyboard events so interacting with the toy, plant or pet does not also toggle global pause. The owner additionally required clearly visible normal-size feedback; plant hit area and brief outline are specified in DSoT. No unrelated source changes.

## Non-goals, Risk and Rollback

No boss/dog route repair in this unit, new world furniture, altered actor scale/coordinates, mood/status/task inference, automatic engagement/audio/notifications, hunger/growth/streaks, new network calls, cosmetics marketplace or broad scene refactor. No new permanent toolbar entry.

Rollback: turn the optional preference off or reverse this feature's exact hunks. Preserve every baseline dirty/untracked/ignored planning file. Do not reset/clean. Risks: tiny plant targets, async image races, extra timers and blocker precedence; verify those explicitly rather than relying on screenshots alone.

## Domain Decisions

- [DECISION] One off-by-default local preference isolates optional interactions from the work visualization.
- [CONSTRAINT] Actual user gestures are the only trigger; no fake need, progress or rewards.
- [DECISION] Extend existing plant/pet/poke surfaces; star and postcard belong on existing scene surfaces with direct contextual feedback. Settings contains preferences only.
- [DECISION] Use a minimal idle-wave grid helper independently of the larger AVO-203 pose work.
- [CONSTRAINT] No agent/transport schema, movement, event cadence or honest postcard data changes.
- [CONSTRAINT] Rendered verification and owner authorization are required before ship. The owner delegated validation and authorized closeout on 2026-10-24 after the verified candidate was presented.

### Duration-sensitive star refinement (owner selected)
Short press (<450ms): shallow squash, small240ms pop. Medium hold (450-1199ms): deeper squash, squeezed eyes, one460ms wobble. Long hold (>=1200ms, saturated): deepest squash, puffed cheeks, one680ms tall spring and three fixed glints. During holding, two thresholds update pose/expression and contextual hint. Release tier is computed from elapsed monotonic time, so delayed timers do not downgrade a gesture. Pointer/Space/Enter share timing. Cancellation, blur and unmount clear both threshold timers and the bounded release timer. Reduced motion uses three distinct static expression/color/hint acknowledgements for500ms without transforms/particles. Repeated input restarts only its own local presentation; no score, sound, office state or movement writes.
