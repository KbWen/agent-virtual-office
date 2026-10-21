---
title: "AVO-199 — Honest All-Quiet Office"
status: shipped
amended: 2026-10-19
approved: 2026-10-19
created: 2026-10-19
primary_domain: office-runtime
secondary_domains: [ui-rendering, hook-integration]
classification: feature
planning_state: implementation-ready
implementation_state: completed
---

# AVO-199 — Honest All-Quiet Office

## Goal
Make a genuinely quiet observed office feel intentionally restful without claiming that all work is complete. Preserve the distinction between fresh idle signals and absent/broken integration. This is the foundation for AVO-201; it does not depend on AVO-198.

## Scope and Non-goals
[FROM-SOURCE] AVO-199/AVO-164: an honest, low-pressure resting office. [INFERRED] Minimal MVP: a derived quiet state, existing health-detail text and audio quieting. No new badge, floating success banner, pose, reward, notification, automatic reading/nap assignment or task-completion claim. No movement, ambient event-frequency retuning or user-preference reset. Unknown/no-source may look neutral but must never announce all caught up.

File Relationship: INDEPENDENT new feature; realizes the AVO-164 candidate without duplicating it. ADR-007/008 govern truth and attention. Existing ambientSound already silences keyboard grains at teamPulse=0, so do not describe this as adding sound support or background music.

## Design
DSoT: ../design/office-experience-followups.md, C1-C4 and shared layer/accessibility rules. Design baseline approved by the owner on 2026-10-19; implemented C1-C4 captures accepted by the owner on 2026-10-21. Existing health button/detail carries the explanation; no scene text or new persistent control. Existing sound and lighting preferences retain authority.

## State Contract
Add a pure resolver plus a single start/stop controller in src/systems/officeCalm.js. Store only transient officeCalm={mode:"unknown"|"active"|"settling"|"quiet", eligibleSince:null|number}; do not persist it or modify statuses, mood, changedAt, workflow, ledgers or source health.

- Known evidence requires a validated, trusted, nonexpired server observedActivity summary with state=all-idle, integrationHealth.state=online and lastSuccessAt no older than 30s. This summary may prove observed idleness even when multi-session rendering intentionally has zero representatives and statusSource=organic; never force that channel to external/green. A fresh visible active/done entry or a conflicting snapshot prevents quiet; malformed/expired/unknown evidence yields unknown.
- Any fresh working/planning/thinking/blocked/awaiting-approval/done status prevents quiet; blocked and awaiting-approval always take precedence. Done is not equivalent to idle.
- [INFERRED] Require 30 continuous seconds of eligible evidence. First eligible evidence starts settling; a meaningful invalidation resets it. Duplicate idle polls do not restart the delay.
- Exit quiet immediately on any active signal, integration failure, expiry, source replacement, pause or disable. No exit debounce. Reconnect requires a fresh full qualifying interval; persisted quiet is forbidden.
- Use one reschedulable timeout for the earliest settling/freshness/entry-expiry deadline and a cheap relevant-state signature; no per-frame scan. Visibility resume recomputes from current time rather than replaying missed timers and invokes the existing updateTime action once. The current clock timer is owned by officeLife.js; no visibility clock refresh exists there today, so add only this lifecycle-safe resume hook, not another interval. stop is idempotent and prevents queued updates.
- Paused/demo/fallback/offline or missing trusted observation are unknown and do not prove tasks are finished. Organic with no observation is unknown; organic after an authoritative all-idle multi-session snapshot is permitted. Empty representatives or activeCount=0 alone are never evidence. The summary describes observed sessions, not a complete task inventory.

## Server Observation Contract (approved narrow amendment)
The 2026-10-19 confirmation probe of the real scanAndMerge proved that one idle session retains its idle agent, while two idle sessions emit agents=[] and return the client channel to organic. Preserve this intentional renderer behavior; do not add idle sprites to solve the quiet predicate.

- Add optional server-only observedActivity={state:"all-idle"|"not-idle"|"unknown",expiresAt:number}. No session counts, root paths or IDs are exposed. Absence is unknown, never a backwards-compatible default to all-idle.
- Compute it in scanSessions from the validated, explicitly project-scoped source sessions BEFORE representative selection, for both single and multi-session branches. all-idle requires at least one well-formed contributing session, each with nonempty valid agent data and every relevant source agent exactly idle. Explicit active/done is not-idle; malformed, missing, unscoped legacy, fallback/file-watcher, ambiguous or stale evidence cannot prove all-idle. Nonempty helper activity also prevents an all-idle conclusion. Do not change urgency sorting, dedup, representative visibility or TTL.
- Derive expiresAt from the oldest contributing source _seq plus existing STALE_MS, not Date.now at HTTP delivery. Reject invalid/future sequences for quiet proof; a 304/heartbeat may refresh connection health but never extend observation expiry or restart settling. No eligible files means no idle proof.
- Define the optional schema/sanitizer in src/utils/statusContract.mjs. Reject unknown enum, extra/unbounded object shapes and expiry outside the current finite source-TTL bound. normalizePost must continue ignoring a client-supplied observedActivity field: callers cannot POST an all-idle claim into the authoritative summary.
- normalizeStatusMessage must remove any raw observedActivity from general browser-channel payloads, including spread-through unknown fields. Attach the sanitized server summary only using an internal callback context on the actual same-origin file-poll/SSE path, never a payload source string or forgeable _trusted property. window global, URL hash, postMessage and BroadcastChannel cannot establish observation authority.
- Carry the summary and its internal transport provenance together through dedup/debounce/store application, even for empty agents. Include observation state/expiry in relevant content signatures so summary-only changes are not dropped. On an old server, absent/invalid summary, no-data response, source reset or browser-channel override, clear the observation to unknown rather than carrying a prior positive.
- Prevent late polling responses from overwriting a newer SSE observation: allocate internal monotonic request/receipt generations at poll start and SSE delivery, and reject outdated observation commits. This ordering is independent of merged max _seq, which can legitimately fall when a source disappears. A 304 retains the prior observation with its ORIGINAL expiry; it does not recreate proof.
- Store observedActivity transiently, independently of externalStatus representative reconciliation. Its expiry deadline participates in the same officeCalm controller timeout. Keep source health, statusSource, agent state and ledgers unchanged. Conflicting visible work always wins over an idle summary.

## Presentation and Sound
- Proposed English detail: "Observed sessions idle"; zh-TW: "目前觀察到的工作階段皆閒置". Add locale keys with parity; no all caught up/finished/celebration wording.
- Keep healthDotState severity/color semantics. Only append the quiet description to the existing focus/hover detail and accessible name when health is otherwise normal; never replace offline/degraded/fallback explanations. Announce at most one mode edge through an existing live region, without countdown announcements.
- If a user already enabled sound, quiet uses the existing deactivate shape: cancel clatter, ramp down over 1.2s, then ensure silence by suspending the existing graph after its existing 80ms grace. The breathing LFO is connected to master.gain, so setting only its base value to zero is NOT proof of silence. Do not create/resume a context on quiet entry, alter soundscapeEnabled or reset the user's preference. Exit may resume only an already authorized graph under the current visibility/accessibility policy.
- Own one cancellable suspend timer and a graph/lifecycle epoch. Reactivation, another quiet edge, toggle changes, visibility changes, stop/HMR/unmount cancel or invalidate older callbacks; an old timer/resume promise must never suspend or recreate a newer active graph. Clear node/timer references on teardown and never wake audio while hidden/disabled. Rapid reversal tests are required, not just a steady-state gain assertion.
- Add quiet to the sound subscription signature; otherwise an unchanged mood could leave the graph audible. Test the real controller-to-audio subscription, not only a pure helper. No new audio assets or music.
- Introduce src/config/officeExperience.json with calmEnabled, offHoursEnabled and planningPodEnabled initially false. Each feature owns only its flag. Enable calm only after its design/visual acceptance; rollback is setting it false.
- Initialize a transient experienceFlags store snapshot from that config; controllers/renderers read it reactively. Real-browser verification can set only these flags via the existing dev-server store module import and setState, then reset them. No production debug endpoint, window global or persisted preference is added.

## Acceptance Criteria
| AC | Verifiable requirement |
|---|---|
| AC-1 | Idle enters settling and quiet at exactly 30s; 29999ms remains settling, duplicate polls do not restart; any interruption resets. |
| AC-2 | Absent/expired/unknown/inferred-active/fallback/offline/demo/paused/done input never yields quiet; blocked/awaiting-approval exit immediately. One and multiple explicitly idle source sessions can qualify without changing representative rendering. |
| AC-3 | Expiry without store traffic, hidden-tab resume, reconnect, source change and stop/unmount cancel/recompute correctly; only one deadline timer exists. |
| AC-4 | Every existing status/position/mood/workflow/ledger and health priority is unchanged; no new success/feed/notification edge. |
| AC-5 | Existing health detail and a11y text show the two translated strings only when justified; no added badge/canvas clutter; locale parity holds. |
| AC-6 | Quiet fades then truly silences/suspends an existing graph within the 1.2s+80ms policy, accounting for its LFO; quiet->active before suspension cannot be suspended by an old callback; repeated quiet/active, toggle, hidden/resume and teardown preserve autoplay/preferences. |
| AC-7 | Feature disabled reproduces baseline; C1-C4 render in full/panel/roster/narrow views and reduced-motion/high-contrast, with owner approval of captures. |
| AC-8 | Focused/full tests, build, bundle budget, smoke and governance pass; removing controller startup or the audio signature input makes a focused test fail. |
| AC-9 | Actual scanner->normalizer->transport->store tests cover one/two idle sessions, idle+working/done/unknown/helper, no source, expiry/304, summary-only changes, old-server fallback, forged browser/POST summaries and late poll after newer SSE. Empty representatives and activeCount0 alone never qualify. |

## Target Files
New: src/systems/officeCalm.js, src/config/officeExperience.json, tests/officeCalm.test.js, scripts/verify-office-calm.mjs (existing Playwright style; no new dependency).
Modify: src/systems/store.js, src/components/PixelOffice.jsx (single controller lifecycle), src/components/controlPanelLabels.js and src/components/ControlPanel.jsx (existing detail only), src/systems/ambientSound.js, src/locales/en.json, src/locales/zh-TW.json, src/systems/ambientSound.test.js; focused existing control-panel tests when present.
Additional data targets approved in the narrow amendment: src/server/scanSessions.mjs, src/utils/statusContract.mjs, src/inference/inferStatus.js; tests/scanSessions.test.js, tests/normalizeStatusMessage.test.js, tests/normalizePost.server.test.js, tests/inferStatusPolling.test.js. Extend/create focused SSE transport tests only if the existing polling suite cannot exercise its actual callback path; no API endpoint or producer change.
Docs: this spec, DSoT and README feature description if needed (respect pinned phrases).
No movementSystem/AgentCharacter/officeLife/classifier or source-producer edits. Existing transport statuses and agent carry fields remain unchanged; only the optional server-owned observation metadata is new.

## Implementation Steps
Each checkpoint is split into 2-5 minute independently verifiable edits.
| Step | Change / verification | AC |
|---|---|---|
| S1 | Source summary/schema tests and pure quiet resolver/disabled flag; prove actual one/two-session scanner behavior and unknown/terminal counterexamples. | 1,2,4,9 |
| S2 | Trusted transport provenance/ordering and transient observation/controller wiring; expiry, 304, forgery, late-response and summary-only tests. | 3,4,8,9 |
| S3 | Append locale-safe quiet detail to existing health presentation; render/a11y and priority tests. | 4,5 |
| S4 | Audio graph/epoch/cancellable suspend policy + subscription signature; reversal/LFO/silence/teardown integration proves no autoplay/preference mutation. | 6,8 |
| S5 | Capture C1-C4 and accessibility/view modes, owner visual signoff, enable flag, run full verification. | 7,8 |

## Verification
npx vitest run tests/officeCalm.test.js src/systems/ambientSound.test.js — zero failures; tests exercise mounted/subscribed boundaries.
npx vitest run tests/scanSessions.test.js tests/normalizeStatusMessage.test.js tests/normalizePost.server.test.js tests/inferStatusPolling.test.js — zero failures; include true scanner-to-client multi-idle and trusted/untrusted callback integration, not independently mocked halves.
node scripts/verify-office-calm.mjs — real-browser startup wiring, health-detail and audio lifecycle/capture checks against an isolated dev server; use the existing import('/src/systems/store.js') technique from panel-features-verify.mjs. Vitest's pure/fake-audio tests alone do not prove React effects run. No new jsdom dependency is needed.
npm test; npm run build; node scripts/bundle-budget.mjs; npm run smoke; npm run smoke:panel; pwsh -File .agentcortex/bin/validate.ps1 — zero failures, no relaxed assertions/skips. Use isolated status and disable live source observers for deterministic visual captures. Record raw check summaries only, never source text.
Delivery evidence: docs/reviews/2026-10-21-avo-199-review.md and the archived work log. Local browser verification uses synthetic status files, not authenticated CLI workload claims.

## Risks and Rollback
Biggest risk is confusing no data with idle. Default unknown, conservative evidence gates and immediate exit prevent that. Reuse existing audio ramps; do not rebuild the graph per mode. Rollback calmEnabled=false; revert only feature hunks, preserve inherited dirty files and user localStorage/preferences. On 2026-10-19 the owner authorized limited implementation-time unfreeze of ux-vibe-rebalance.md and subagent-helper-huddle.md for shared-file alignment only; preserve control demotion/helper semantics and re-freeze after alignment. Those shared files remain unchanged by this implementation.

## Domain Decisions
- [DECISION] Quiet describes observed session idleness, never task completion.
- [CONSTRAINT] Unknown/disconnected/blocked inputs cannot be promoted to a reassuring positive.
- [TRADEOFF] Thirty-second entry and immediate exit favor calm without hiding new work.
- [CONSTRAINT] One derived state owns downstream audio/night decisions; no independent conflicting idle heuristics.
- [CONSTRAINT] No movement, fake rest poses, rewards or engagement prompts.
- [DECISION] Server-derived expiring observation metadata is independent of the renderer's active-only representatives; zero sprites never proves idle by itself.
- [CONSTRAINT] Only actual API polling/SSE callback provenance may establish the summary; browser payload claims and heartbeat freshness cannot forge/extend it.
- [CONSTRAINT] Quiet audio uses a cancellable, epoch-fenced graph lifecycle; zero base gain with a connected LFO is not a silence proof.

## Claude Resume
AVO-199 delivery is complete on codex/avo-199-all-quiet; owner accepted actual C1-C4 captures and calmEnabled=true. Review/test/handoff/ship evidence is archived. PR merge is separate from this delivery checkpoint. Next: AVO-201 consumes the shared state without copying its predicate; its runtime and AVO-200 remain unimplemented.
