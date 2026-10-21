---
title: "Office Follow-up Plan Confirmation"
date: 2026-10-19
status: draft
---
# Office Follow-up Plan Confirmation

## Scope and Verdict
Owner requested a second substantive confirmation and extension assessment. This is planning verification within /plan, not the post-implementation /review phase. No runtime code or review/test/ship receipt is claimed.

Disposition: the owner explicitly approved a narrow AVO-199 amendment after the two counterexamples below were established. The amended plan covers the missing input contract and sound lifecycle; AVO-200/201 and the DSoT remain unchanged. Runtime implementation and acceptance remain UNPROVEN. The previous structural/governance PASS did not prove source-contract reachability.

## Findings
| ID | Severity | Evidence and failure mode | Proposed action |
|---|---|---|---|
| F-01 | P1 | src/server/scanSessions.mjs:210-232 excludes idle from multi-session representatives; :256 emits agents=[] for two idle sessions. src/inference/inferStatus.js:774-790 reconciles empty representatives and returns the store channel to organic. AVO-199 requires at least one external idle entry/statusSource=external, so multi-session all-idle cannot reach quiet. | Amend AVO-199 with a small server-derived, expiring observed-idle summary, independent of representative rendering. Never infer quiet from activeCount=0 or empty agents alone. |
| F-02 | P2 | src/systems/ambientSound.js:125-130 connects an LFO into master.gain; :226-230 ramps then schedules an uncancelled suspend. Ramping the master base to0 alone is not a complete silence guarantee, and reactivation before the old timeout can still be suspended. AVO-199 AC-6 lacks this reversal/teardown proof. | Specify a cancellable epoch-fenced quiet lifecycle, actual silence/suspend proof and rapid quiet->active->quiet/unmount tests. Preference/autoplay guards remain binding. |
| F-03 | P2 handoff | The planned specs, DSoT and ADR are untracked in this checkout. Creating a Claude worktree from a clean remote ref would omit them, despite instructions to use isolated branches. | Add a concrete preflight to the Claude roadmap: persist the approved planning bundle in the chosen base or explicitly carry the exact approved files into the implementation checkout; verify presence/hashes before implementation. No automatic commit/push in this confirmation pass. |

## Reproduction
A structure-only Node probe calls the actual scanAndMerge against a temporary directory containing synthetic same-project idle PM and idle Architect session files:
- One file: one idle agent passes through.
- Two files: source=multi-session, sessionCount=2, activeCount=0, agents=[].
No raw user files/logs/commands are read. Temporary synthetic files are individually removed after the probe.

## Proposed Narrow Amendment
Owner approved limited unfreeze on 2026-10-19. The AVO-199 amendment specifies:
- Server-derived observedActivity={state:all-idle|not-idle|unknown,expiresAt}, calculated from validated project-scoped source sessions before representative selection. At least one well-formed session and all relevant source agents explicitly idle are required. Done/active is not-idle; malformed/missing/stale/ambiguous source data is unknown.
- Expiry derives from the oldest contributing source sequence plus existing source TTL, never response/poll time. Do not add idle sprites, move agents, change representative urgency or treat no files as proof of idle.
- Carry summary only on trusted same-origin polling/SSE paths; postMessage/BroadcastChannel/manual POST fields cannot forge it. Schema/safe-expiry validation and source reset/old-server fallback keep quiet unknown when unavailable.
- Store summary transiently alongside existing externalStatus, without changing source health or counters. The quiet resolver can consume that trustworthy summary even when zero visible representatives remain. Existing single-session clients remain compatible. Missing/old-server metadata is unknown; a 304 cannot renew proof; trusted request/receipt generations prevent an old poll from overriding a newer SSE observation.
- Cancellable/epoch-fenced sound fade/suspend, no LFO residual output, no old timer suspending resumed work; stop clears pending operations.
- Focused end-to-end multi-session and audio reversal negative controls. AVO-201 continues consuming officeCalm.mode unchanged.

Additional implementation targets include scanSessions, statusContract, the client status normalizer/transport path and their tests. The revised AC-9 requires actual scanner-to-client, provenance, expiry and ordering counterexamples; AC-6 now covers audio LFO/suspend reversal and teardown. No new endpoint, dashboard, metrics, dependency or user-facing control is proposed.

F-03 is covered by the backlog's implementation-checkout preflight and docs/reviews/2026-10-19-office-plan-manifest.json. The manifest fingerprints the three frozen specs, DSoT and accepted ADR so an isolated Claude checkout can prove it has the intended bundle; this session performs no commit/push.

## Extension Assessment
| Candidate | Value / decision |
|---|---|
| E-01 Deterministic shared scene fixtures | Worth considering as implementation-support work after the first concrete scene driver exists: reuse idle/working/planning/blocker/offline, clock and theme fixtures across the three planned scripts. Require at least two real consumers before extracting a shared helper. No separate product feature/ticket is needed yet. |
| E-02 More atmosphere/automatic sleep/celebrations | Do not add now: existing lighting/audio plus the three selected features already cover atmosphere; fabricated rest/completion and extra chrome risk the honesty contract. |
| E-03 Sprite art and accessories | Existing AVO-160/124 already cover this useful future direction. Owner excluded it from this batch; no duplicate ticket or implied commitment. |

Recommended next action: Claude implements the amended AVO-199 first, then runs its real scanner/client/audio negative tests before AVO-201. Existing product priorities and delivery order 199->201->200 remain appropriate. No new product extension is selected; reusable scene fixtures are the most useful implementation-support opportunity once concrete consumers exist.

## Validation Boundary
A mapping from AC to step plus a green governance validator is necessary but insufficient. The revised plan needs real scanner/client-path counterexamples and sound lifecycle reasoning; actual runtime implementation evidence remains Claude's responsibility.
