---
status: shipped
title: AVO-145 — CI render-smoke gate (load-the-page in CI)
created: 2026-06-10
last_updated: 2026-06-10
---

# AVO-145 — CI Render-Smoke Gate

## Problem

The node test environment has no jsdom: **nothing in CI ever renders a component**. PR #71
shipped an app-killing `ReferenceError` (ControlPanel render crash → whole app fell back to the
ErrorBoundary on every load) while tests (1338 green), build, and CI were ALL green. The defense
since then is a manual habit ("load the page after editing a rendered component") backed by ~12
ad-hoc, gitignored local Playwright scripts (`scripts/*-shot.mjs`). A habit is not a gate.

## Goal

One tracked headless-Playwright smoke harness that CI runs on every PR: if the built app does not
actually render the office, the PR goes red. This is hardening-wave H1; structural root-fix for
the green-CI/dead-app failure class.

## Acceptance Criteria

- **AC-1 Tracked harness** — `scripts/render-smoke.mjs` (committed) starts the production server
  against the already-built `dist/` (prefer `node server.mjs` — the real deployment artifact, which
  also serves `/api/*` so status polling doesn't 404; document the choice in the file header),
  loads the page in headless Chromium, and exits non-zero if ANY of:
  - the office `<svg>` does not appear within 15s;
  - the ErrorBoundary fallback is rendered (assert on its stable marker/text);
  - any `pageerror` (uncaught exception) occurs;
  - any console message of type `error` occurs. **No blind allowlisting**: if a console error
    shows up (e.g. a 404 asset), fix the cause or document a 1-line justified allowlist entry in
    the harness — each entry needs a comment saying why it is provably benign.
- **AC-2 Render-richness floor** — assert the office svg has a non-trivial element count
  (descendants ≥ 100) so a silently-blank svg cannot pass. Documented as a heuristic floor.
- **AC-3 CI job** — `.github/workflows/ci.yml` gains a `render-smoke` job (ubuntu, Node 22):
  `npm install` → `npm run build` → `npx playwright install --with-deps chromium` →
  `node scripts/render-smoke.mjs`. Same triggers as the test job; a failure blocks the PR.
- **AC-4 Local entrypoint** — `npm run smoke` runs the same harness locally (Windows + ubuntu both
  work; assumes `npm run build` was run, with a clear error message if `dist/` is missing).
- **AC-5 Scope** — zero `src/` behavior changes. `package.json` changes limited to: `playwright`
  devDependency + `smoke` script. `scripts/render-smoke.mjs` must NOT be added to the npm `files`
  whitelist (not shipped).
- **AC-6 Test-the-test** — prove the gate catches the PR #71 class: with a deliberately broken
  build (e.g. temporarily inject a top-of-module `throw` into a rendered component, rebuild),
  the harness exits non-zero with a diagnostic message. Record the evidence (command + output) in
  the work log, then revert the injection. This MUST be demonstrated, not assumed.

## Non-Goals

- Screenshots / visual regression (pixel correctness stays owner-only per Protected Surfaces).
- Store-level assertions (the prod bundle cannot import `/src/...` modules; DOM-level only).
- Replacing the local `*-shot.mjs` convenience scripts (they stay gitignored local tooling).
- Dev-server smoke (prod `dist/` is the artifact users run; dev-only crashes are out of scope).

## Risks & Rollback

- **CI flake** (browser download, port conflict, slow cold start): strict port + readiness poll +
  generous single timeout; chromium download is the accepted cost (~30s, cacheable later).
- **Rollback**: delete the `render-smoke` job block; harness is standalone and inert.
