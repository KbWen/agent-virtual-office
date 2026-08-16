---
title: "ADR-009 — Portable status-core extraction stays OUT of AVO (deferred to a clean-room new repo)"
date: 2026-07-04
status: accepted
# applies_to: intentionally absent — this ADR keeps a portable status-core OUT of this repo. Its subject is a
# structure that deliberately does not exist here, so there is no path to declare.
# Enforced by review, not by path.
lifecycle:
  owner: KbWen
  review_cadence: on-event
  review_trigger: "a concrete external consumer project firms up AND is ready to depend on a reusable status core"
  supersedes: null
  superseded_by: null
---

# ADR-009: Portable status-core extraction stays OUT of AVO (deferred to a clean-room new repo)

- **Status**: Accepted (2026-07-04)
- **Context**: The `codex/product-action-strip` branch (PR #195) started as Phase-1 product/UI
  polish (action strip, activity-feed humanization, honest rail status) and then expanded into a
  large **in-repo "portable core" push** — ~39 commits that added a public `package.json` `exports`
  map with **34 library subpaths**, `.mjs` mirror view-models for most `src/systems/*` logic, an
  aggregate `statusCore.mjs`, a `portableCoreManifest.mjs` capability map, and `pack-smoke` API
  assertions. The stated goal was to let *alternate renderers* consume AVO's status transport /
  runtime / view-models as a library. This collides with two standing facts:
  1. The reuse of AVO's status-transport architecture was already **decided as a clean-room
     extraction into a NEW repo, with AVO left untouched, DEFERRED** until the consuming project
     firms up. The in-repo push does the opposite (now, inside AVO).
  2. **AVO is deliberately not published to npm** (see release process: "NO npm publish"). A public
     package API with 34 subpaths therefore has **zero real consumers** today.

## Decision

**The reusable/portable status-core does NOT live in AVO.** AVO stays a single-purpose, locally-run
app (CLI + dev server, unpublished). When a real consuming project firms up, the reusable core is
extracted **clean-room into its own new repo** — AVO is not retrofitted into a library.

- **Phase-1** of PR #195 (product/UI polish) ships to `main` via the `codex/product-action-strip-phase1`
  branch (main + 3 commits: `aeea422`, `11a887f`, `4b16e37`).
- **Phase-2** (the in-repo portability layer, `e8247d3..e37b816`) is **parked on PR #195 as a
  reference, not merged**. It is preserved, not deleted, so the future clean-room extraction can mine it.

## Rationale

- **YAGNI** (`engineering_guardrails.md §5.4`): no speculative library/abstraction layer without 3+
  concrete consumers — there are currently zero.
- **REDUCE-not-add** (core product principle): the push adds a large public surface to AVO rather than
  removing noise.
- **No consumer**: unpublished package ⇒ the `exports` map / manifest / `.mjs` API cannot be imported by
  anyone downstream.
- **Bundle headroom**: Phase-2 left the app chunk at 494,987 / 495,075 bytes (**88 bytes of budget**).
  That dead-weight API would constrain every future app change. Phase-1 alone builds at ~488.5 KB.
- **Drift risk**: the layer forces `.js` (app hot path) ↔ `.mjs` (package) duplication of
  honesty-critical logic (status contract, movement, pet/blocker state), guarded only by parity tests.

## Consequences (preserved for the future extraction)

Phase-2's self-review found real defects. They are **NOT fixed in AVO** (the code is parked), but are
recorded here + in the PR #195 work log so the future clean-room extraction starts pre-informed:

- **F1 (honesty-critical)**: the additive `normalizeAgentStatusUpdates()` treats any non-reserved
  top-level key (`status`, `agentId`, `id`, `role`) as an agent id ⇒ fabricates agents from metadata.
- **F4**: shorthand IDs are sanitized before lookup then read with the sanitized key ⇒ whitespace keys
  drop the update; collisions emit duplicate rows and lose a status.
- **F3**: reusable snapshot `activeCount` counts `done` as active, diverging from the transport
  contract's live-status `countActive`.
- **F2**: adding an `exports` map hides previously resolvable subpaths and exposes ESM `./src/*.js`
  that fails in bare Node under `type: commonjs`.
- **F5**: exported `clampToFloor()` is best-effort in-bounds only — it does NOT guarantee an
  obstacle-free / on-floor point. (Do **not** "fix" it to guarantee standable: wall-adjacent clipping
  is a deliberate accepted trade-off; forcing obstacle-free would trap agents / wall off doors. The
  correct action is to document the contract, not change behavior.)
- **F6–F9** (footguns): manifest `aggregate:true` over-claims full re-export; `activityFeedEntries`
  negative `max` uses raw slice; `buildExternalStatusEntry` emits `status: undefined`; `timeEventModel`
  `lastTriggeredHour` is hour-only and can suppress Friday events across a day boundary.

## Re-open conditions

Re-open only when a **concrete external consumer project exists and is ready to depend on a reusable
status core**. At that point, perform the extraction **clean-room in the new repo** (copy-as-needed,
strip AVO domain), applying the F1–F9 fixes above — do **not** re-introduce the in-repo package API.
