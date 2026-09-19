---
title: Dev-server config as native ESM (REV-05)
status: frozen
classification: feature
primary_domain: hook-integration
created: 2026-09-19
source: docs/reviews/2026-09-19-handoff-review.md (REV-05)
signal_tier: none
---

# Dev-server config as native ESM (REV-05)

## Goal

Stop the three warnings every `vite` / `vitest` / `vite build` run prints, by making the dev-server
config a native ES module, without changing what the dev server does:

- `[MIXED_EXPORTS] Entry module "vite.config.js" is using named … and default exports together`
- `ESM syntax in a file loaded as CommonJS (vite.config.js:1:1)`
- `ESM syntax in a file loaded as CommonJS (src/utils/normalizePost.js:10:1)` — reached only because
  the config imports that file.

Re-derived cause (the review blamed Node 22): `package.json` is `"type": "commonjs"`, so Vite 8's
config loader bundles `vite.config.js` as CommonJS. That produces MIXED_EXPORTS (named helpers plus a
default config) and the `configLoader: 'native'` readiness warnings. The warning itself says `native` is
"planned to become the default in a future major version of Vite", at which point this config would stop
loading. F-11 (2026-09-08) recorded this
as deferred because the rename touches tests. A scratch experiment confirmed that the rename alone,
plus importing `statusContract.mjs` directly, clears all three warnings.

## Acceptance Criteria

- **AC-1** — `vite.config.js` is renamed to `vite.config.mjs` (git rename, content otherwise unchanged
  except its one import) and imports `normalizePost`, `VALID_ROLES`, `VALID_STATUSES` from
  `./src/utils/statusContract.mjs` (the single source `normalizePost.js` re-exports).
- **AC-2** — `npx vitest run` and `npm run build` print none of the three warnings above.
- **AC-3** — Every functional reference follows the rename: the `Dockerfile` builder `COPY`, the
  `package.json` `files` whitelist, and the two tests that import or read the config. Comments that
  name the file are updated so a grep finds the real file. Historical records (reviews, shipped logs,
  CHANGELOG, archived ship history) are left as written.
- **AC-4** — A guard test fails if any `Dockerfile` `COPY` source (outside `--from=` stages) or any
  `package.json` `files` entry does not exist in the repo. Both lists are silently lossy today:
  `docker build` is not run in CI, and `npm pack` skips a missing `files` entry without error. The test
  must fail on the pre-rename references once the file is renamed (test-the-test).
- **AC-5** — No behaviour change. The full suite passes; `npm run build`, bundle budget, render-smoke,
  panel smoke and pack-smoke pass. The dev server still serves `/api/status` and
  `OFFICE_STATUS_DIR` (the hermetic staged capture still works).

## Non-goals

- Splitting the named API-auth helpers out of the config. With ESM output, MIXED_EXPORTS no longer
  applies, so moving code would be refactoring for its own sake.
- Changing `"type"` in `package.json`, which would reinterpret every CJS `.js` file (bin, hooks).
- Renaming `src/utils/normalizePost.js`. Its warning only appeared because the config loader bundled
  it; app and test imports go through Vite's transform and are fine.

## File Relationship

INDEPENDENT. It completes the part of F-11 (`fix/audit-2026-09-08`) that was deferred.

## Domain Decisions

- [DECISION] The dev-server config is a native ES module (`vite.config.mjs`) importing the transport contract from `statusContract.mjs` directly; the package stays `"type": "commonjs"` so bin/ and the hooks are untouched.
- [CONSTRAINT] Build/packaging manifests that name repo paths (Dockerfile `COPY`, package.json `files`) are guarded by a test that every named path exists — both consumers drop a missing path silently, so a rename can otherwise ship a broken image or tarball with every gate green.
