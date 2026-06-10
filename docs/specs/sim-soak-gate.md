---
title: Sim-soak gate — nightly world-invariant verification for emergent visual bugs
status: shipped
date: 2026-06-10
backlog_id: AVO-157
classification: quick-win
primary_domain: ci-infra
secondary_domains: [movement, diagnostics]
primary_files:
  - scripts/sim-soak.mjs
  - scripts/soakInvariants.mjs
  - .github/workflows/sim-soak.yml
test_files:
  - tests/soakInvariants.test.js   # test-the-test: every violation class planted + healthy silence
relationship: INDEPENDENT (locks in AVO-104/156 fixes; same test-the-test doctrine as ci-render-smoke)
---

# Sim-soak gate (AVO-157)

## Problem

The owner's emergent-class bugs (standing stacks, teleports, frozen walkers, rushing) exist
only across MINUTES of world state — unit tests and render-smoke structurally cannot see
them, so the owner's eyes were the only detector, one screenshot at a time. Owner approved
turning the one-off forensic tools (zone-audit, overlap-recorder) into a standing machine
gate: "以後可能很多類似的視覺改動也會遇到".

## Acceptance criteria

- AC-1: `npm run soak` runs the office headless N minutes (default 5) and exits 1 on any
  violation of: I1 sustained stationary stack (<30px, both at rest, ≥3s — beyond the
  arrival-nudge recovery window), I2 teleport (>48px between healthy ≤600ms samples),
  I3 off-floor/in-furniture REST (≥2s; transit excluded), I4 frozen walker (store claims
  isMoving while pixels still ≥90s — beyond every recovery layer).
- AC-2: gate logic is PURE (`soakInvariants.mjs`) and unit-tested test-the-test style:
  every violation class is planted and caught; healthy timelines (desk work, 60px/s walks,
  brief pass-bys, recovered stalls, sampler gaps) stay silent.
- AC-3: nightly CI (`sim-soak.yml`, 10 min) + `workflow_dispatch`; report uploaded as an
  artifact. NOT a PR-blocking gate until nightly proves stable.
- AC-4: verified end-to-end on a real run (local 2-min reuse-server PASS + 1-min
  spawn-server PASS with report file).

## Non-goals

- PR-blocking enforcement (latency + shared-runner jank risk; promote later if stable).
- Production-bundle render health (render-smoke owns that; soak needs /src store access
  so it runs against a Vite dev server).

## Domain Decisions

1. **Sampler-gap guard**: a step is only a teleport if the SAMPLE gap was healthy (≤600ms).
   Sampler stalls == page main-thread stalls (same event loop), which legitimately end in a
   GAP_SNAP jump — skipping those deltas kills the false-positive class instead of tuning
   thresholds against it.
2. **Frozen-walker threshold is 90s** — above stall-watchdog recovery (~3s) and a full
   doSchedule abort cycle (≤65s behavior + 15s retries). A stale `isMoving` from an aborted
   walk self-heals inside that budget; only a genuinely dead chain crosses 90s.
3. **Group-event stacks FAIL (re-tightened 2026-06-11).** History: nightly run #2 caught a
   23px group pair → temporarily demoted to `warnings.groupStack` while the arrival
   geometry was open; then BOTH mechanisms were closed at the store chokepoints — event
   targets deconflict against EVERY claimed standing spot (bystanders included; the old
   occupied set held only in-group agents), and react-in-place participants side-step when
   an event would freeze them mid-overlap (R1-safe: pickParticipants never selects tracked
   working agents). A group stack now means a real regression in that machinery; the
   `group` tag remains for triage, the warnings bucket stays in the report shape (empty
   unless re-demoted).
4. **Geometry verdicts are computed in-page** (Vite serves /src; node parses src/*.js as
   CJS). The evaluator consumes a per-sample `offFloor` flag — geometry functions stay
   covered by furnitureObstacleCompleteness.test.js.
