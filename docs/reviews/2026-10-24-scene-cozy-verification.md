# AVO-206 Scene Interaction Verification and Handoff

The owner rejected Settings-only toy/card actions, requested direct scene interactions, then selected distinct short/medium/long star feedback. Scope remains local presentation: existing work signals, agent status, movement, event cadence and furniture geometry are preserved. Canonical requirements: `docs/specs/cozy-interactions.md`; design: `docs/design/cozy-interactions.md`. Independent review: `docs/reviews/2026-10-23-scene-cozy-review.md`. Final independent re-review PASS resolves the production CSP preview defect; latest-main full2972PASS/3skip,113focusedPASS, production paint/export/focus verified. Only owner aesthetic acceptance remains before ship.

## Test Blueprint

| Acceptance | Behavior / level | Evidence |
|---|---|---|
| C1 | Default-off enhanced reactions; always-direct scene props; no rejected Settings actions — integration | `cozyPreferences.test.js`, `sceneCozy.test.jsx`; actual full/Settings/panel renders |
| C2-C4 | Plant/pet/wave behavior and attention/idle cancellation remain intact — component/unit | `cozySceneReactions.test.jsx`, `idleWaveSprite.test.jsx`, `idleWave.test.js` |
| C5 | Star pointer/key ownership;449/450/1199/1200ms boundaries; delayed callbacks; saturation; cancel/capture failure/blur/unmount; reduced-motion tiers — actual handlers/runtime | `scenePaperStar.test.jsx`22cases; CUA short/medium/long and release captures |
| C6 | Pinned card snapshot, preview lifecycle, stickers, focus and download controls — unit/integration/runtime | `scenePostcardInput.test.jsx`, `sceneCozy.test.jsx`, `cozyCardPreview.test.js`, `cozyCardControls.test.jsx`, `cozyCardSticker.test.js`; actual ready760px preview and Escape trigger focus |
| C7 | Narrow44px targets, localized hints, reduced motion, core-state invariance and footer coexistence — rendered | Synthetic390x844 fixture captures/measurement; desktop actual scene; panel smoke |
| C8 | Full regression, build/budget, render/panel smoke, scope/governance — integration | Logs listed below; main compatibility candidate is separately qualified |

## Reproducible Results

All paths below are relative to `output/playwright/2026-10-23-scene-cozy/`. Final test-phase runs are recorded in the Work Log after they execute; do not infer a PASS from a filename alone.

- Independent latest component coverage:12files78tests PASS. Root duration regression:6files37tests PASS after8expected RED cases. `full-duration-final.log`:167files2876tests PASS,3existing skips, single worker. Earlier concurrent watcher timeout and lock-test interference are retained in failed-attempt logs; isolated lock27PASS and the complete serial run pass without changing source/assertions/timeouts.
- `build-final.log` and `budget-final.log`: build PASS;527918JSbytes <=546154 (+6.33% baseline). The ordinary Vite large-chunk advisory remains; no dependency/budget change.
- `panel-final.log`: isolated5196 PASS,0errors, scoped attention ring/pill and inspector duration proof. `governance-final.log`:115PASS/5WARN/0FAIL/5SKIP. Earlier panel navigation timeout and receipt-order error were corrected and retained honestly.
- Final post-review test-phase run locations: `test-phase-full.log`, `test-phase-build.log`, `test-phase-budget.log`, `test-phase-render.log`, `test-phase-panel.log`, `test-phase-governance.log`. TEMP/TMP point to workspace `.tmp-scene-cozy`; full command `npx vitest run --maxWorkers=1`. Run the browser smokes sequentially after full suite/build to avoid local-port/CPU contention; panel uses isolated status directory, watcher disabled and Antigravity off. No assertions, coverage or timeouts are relaxed.

## Actual Rendered Evidence

- `star-short.png`, `star-medium.png`, `star-long.png`: actual main scene pointer holds, distinct squash depth and localized hints. `star-long-release.png`: actual long release with tall spring and three fixed glints. DOM observations identify short/medium/long release and bounded return to idle; screenshots alone do not prove duration/cancellation.
- `card-from-board-ready.png`: actual fully painted760px postcard opened from the notice board, not Settings. Escape restored focus to `[data-scene-cozy=postcard]`. Earlier loading/blank captures are not accepted ready-state evidence.
- `narrow-long-reduced.png` and previous narrow card/star captures: synthetic390x844 fixture, not live-agent evidence.100/800/1700ms Space produced three distinct static release hints; fixture core-state comparison PASS unchanged. Actual rendered star/card targets measured44x44px. English and Traditional Chinese paths were exercised. Remaining subjective visual/download acceptance belongs to the owner.

## Historical Pre-delivery Boundary and Resume

Current latest-main checkpoint: detached worktree at the writable visualization root `cozy-main-compat`, base564b96a. Preview uses local PNG data URL under unchanged CSP; download retains the existing Blob URL resource with revision/disposal cleanup. CUA verified760px painted Cat, fresh80561byte saved PNG, and Escape focus to the pinned card. The failed watcher cases were caused by `.tmp-cozy-vitest` matching the unchanged absolute-path role classifier; neutral `.tmp-cozy-run` yielded12/12 isolated and2972/3skip full PASS with identical assertions. Failed logs remain diagnostic history. Build535204<=546154; production smoke4viewports0errors. Exact32file inventory/hashes and logs: `output/playwright/2026-10-24-cozy-merge/integration-report.md` and `merge-file-manifest.json`.

Post-write test-phase run: final full/build/budget/render/panel logs use prefix `test-closeout-` in `output/playwright/2026-10-24-cozy-merge/`; the Work Log records actual results after execution. These are the final receipt inputs, not an inference from filenames.

No shipment, commit, push or merge is claimed. Root branch/checkpoint remains `feat/antigravity-gemini-hook` / `3d8ae35599a2b72eb05e1049d2c290412180428d`. Original planning, SSoT, untracked and ignored state is preserved. Latest `origin/main` includes AVO-199 calm behavior and1.6.12, so a separately exported candidate checks coexistence without switching the user's branch. The owner requested lower-tier implementation: `gpt-6-luna` completed the port and preview/smoke fixes; root owns review/browser verification. Candidate evidence is at `output/playwright/2026-10-24-cozy-merge/integration-report.md` when produced; no unverified candidate claim is implied here.

- Code: `src/components/ScenePaperStar.jsx`, `ScenePostcard.jsx`, `PixelOffice.jsx`; preview/snapshot helpers and focused tests above.
- Work Log: `.agentcortex/context/work/codex-scene-cozy-feat-antigravity-gemini-hook.md`; prior full-feature history remains in its referenced cozy log/archive.
- Rollback: reverse only the reviewed AVO-206 amendment hunks/new files, preserving inherited work and all temp/untracked/ignored state. No reset/clean/recursive deletion.
- Next: finish post-write closeout checks; obtain owner aesthetic scene acceptance before ship/merge. Actual local file save was verified by the primary. AVO-202 boss route/size and AVO-203 action readability remain planned separate work, not part of this feature's completion claim.

## Authorized Delivery

The owner authorized verified closeout and normal project launch on 2026-10-24. This resolves the earlier aesthetic-acceptance hold by delegation; automated and actual production paint/export proofs remain required and passed. Delivery branch: codex/cozy-scene-interactions, based on main564b96a. Canonical32file SHA inventory: docs/reviews/2026-10-24-cozy-source-manifest.json. Canonical delivery log on ship: .agentcortex/context/archive/codex-cozy-scene-interactions-20261024.md. Earlier output paths and local logs above are pre-delivery diagnostic history, not claims of additional committed artifacts.

## Normal Project Launch Verified

The normal documented CLI was launched from the original invoking project directory: `node <installation>/bin/cli.js serve --port=5187 --no-open`. The CLI forwarded that project identity and used the real default status directory, with no isolated status/watcher overrides. The primary verified `/api/health` ok with1hook session, root-scoped Codex ops status, and the real UI changing working -> idle with a live connection; the setup banner disappeared. Codex App has no automatic host-tool emitter in this repository; the existing helper wrapped actual closeout commands only, with success returning idle (not artificial task completion), no raw command or UUID in the visible workflow. No global hook/security setting was changed.

Authoritative local delivery: source commit5a08b584b0513f6f35351a33653eab469b0d7185; branch codex/cozy-scene-interactions; shipped spec and archived delivery log. GitHub PR/merge state for that branch is authoritative for external delivery; earlier pending/historical checkpoints above do not override it.
