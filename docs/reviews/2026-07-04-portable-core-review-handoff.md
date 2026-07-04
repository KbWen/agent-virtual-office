# Portable Core Review Handoff

Date: 2026-07-04
Branch: `codex/product-action-strip`
PR: `#195`
Last reviewed code commit before this handoff artifact: `b920e1b9d53131e583cb01675b775181b8a2785b`
Current PR head: use `gh pr checks 195` / GitHub PR #195 as the authoritative current commit after this handoff file.
Work log: `.agentcortex/context/work/codex-product-action-strip.md`

## Context

This branch began as product/status surface polish and then expanded, by user direction, into a portability push for `agent-virtual-office`. The current review target is the reusable package/API surface for alternate renderers: status transport, runtime helpers, renderer-agnostic view-models, and package subpath boundaries.

The implementation is intentionally additive. Existing React/Zustand app hot paths remain in place when importing the public `.mjs` package model would increase bundle size or cross CommonJS/ESM package semantics. Parity tests cover those duplicated app/public contracts.

## Scope To Review

High-attention API boundary files:

- `package.json` exports for public package subpaths.
- `src/systems/statusCore.mjs` aggregate headless API.
- `src/systems/portableCoreManifest.mjs` machine-readable library capability map.
- `scripts/pack-smoke.mjs` installed-package import coverage and export drift check.

Representative portable model files:

- `src/systems/statusRuntime.mjs`
- `src/systems/agentStatusSnapshot.mjs`
- `src/systems/statusVisualModel.mjs`
- `src/systems/movementLayoutModel.mjs`
- `src/systems/ambientAppearanceModel.mjs`
- `src/systems/ambientSoundModel.mjs`
- `src/systems/petStateModel.mjs`
- `src/systems/workflowHandoffModel.mjs`

Representative tests:

- `tests/statusCore.test.js`
- `tests/portableCoreManifest.test.js`
- `tests/petStateModel.test.js`
- `tests/workflowHandoffModel.test.js`
- `tests/movementLayoutModel.test.js`
- `tests/ambientAppearanceModel.test.js`
- `tests/ambientSoundModel.test.js`

## Validation Evidence

Latest local verification before this handoff:

- `npm test`: PASS - 138 files, 2452 tests.
- `npm run smoke:pack`: PASS - tarball install, all library subpath imports, setup/idempotency/hook/boot checks.
- `npm run build`: PASS.
- `node scripts\bundle-budget.mjs`: PASS - 494,987 / 495,075 bytes.
- `npm run smoke`: PASS - 4 viewports, 0 page errors, 0 console errors.
- Manifest/export drift script: PASS - 34 library subpaths match `package.json` exports.
- Node-safe public `.mjs` scan: PASS - no public `.mjs` imports UI/store/i18n `.js`.
- `git diff --check`: PASS.
- Secret scan over modified/untracked files: PASS.
- PR #195 checks: PASS - test Node 22/24, pack-smoke, render-smoke, npm audit, Semgrep, TruffleHog.

## Reviewer Focus

1. Confirm `portableCoreManifest.mjs` categories and layers are useful for alternate renderers, not merely a mirror of `package.json`.
2. Confirm `statusCore.mjs` exposes stable high-level APIs without locking too many low-level implementation knobs.
3. Check app hot-path/public model duplication and parity tests, especially for pet state, ambient models, workflow handoff, and layout.
4. Inspect bundle budget risk. The app chunk is close to the configured limit; avoid importing public `.mjs` wrappers into app runtime unless the budget is deliberately raised.
5. Verify package consumer ergonomics by reading `scripts/pack-smoke.mjs` and `tests/portableCoreManifest.test.js`.

## Known Risks

- Bundle headroom is intentionally tight: 494,987 bytes against a 495,075-byte limit.
- Some app/public model contracts duplicate tables because this package uses CommonJS semantics while the public package API is `.mjs`. Existing parity tests mitigate drift.
- `statusCore.mjs` is broad by design. Future additions should prefer high-level view-models and versioned constants over raw app internals.

## Closure Recommendation

Open for final AI review, then merge if no P1/P2 findings are found. The branch is verified and the worktree was clean at handoff creation.

## Read Map

Must read:

- `docs/reviews/2026-07-04-portable-core-review-handoff.md` — full.
- `.agentcortex/context/work/codex-product-action-strip.md` — latest goal-loop evidence and Resume block.
- `package.json` — `exports`.
- `src/systems/portableCoreManifest.mjs` — full.
- `src/systems/statusCore.mjs` — public aggregate exports.
- `scripts/pack-smoke.mjs` — library import assertion and export coverage drift section.

Optional spot checks:

- `src/systems/petStateModel.mjs` with `tests/petStateModel.test.js`.
- `src/systems/workflowHandoffModel.mjs` with `tests/workflowHandoffModel.test.js`.
- `src/systems/ambientAppearanceModel.mjs` and `src/systems/ambientSoundModel.mjs`.
- `src/systems/movementLayoutModel.mjs`.

## Skip List

Can skip unless reviewing UI regressions:

- Product copy/layout work from the earlier action-strip phase; it is covered by earlier tests and render smoke.
- Historical shipped specs unrelated to package/API portability.
- Generated tarballs and temp pack-smoke directories; they are not part of the worktree.
