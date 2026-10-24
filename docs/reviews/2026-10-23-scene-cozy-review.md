# AVO-206 Scene Interaction Amendment — Independent Review

Date: 2026-10-23; finalized 2026-10-24 (Asia/Taipei). Classification: feature. Reviewed against the amended `docs/specs/cozy-interactions.md` and `docs/design/cozy-interactions.md`. Fresh reviewer context excluded implementation discussion. Prior AVO-206 source was a dirty baseline; this review focuses on the scene amendment and preservation of the existing feature. No source, inherited document, or shared Work Log was edited.

## Findings

### [P1 / HIGH — RESOLVED] Production CSP blocks every postcard preview

- **Original pre-fix location:** `src/components/CozyCardPreview.jsx:21`; incompatible production policy at `server.mjs:597`; publication as ready at `src/components/cozyCardPreview.js:19`.
- **Pre-fix trigger:** Serve the production build through `server.mjs`, open the pinned postcard, and wait for rendering. The former component assigned a `blob:` object URL to the preview image, but production `img-src 'self' data:` does not permit that scheme.
- **Expected / actual:** The generated postcard must be visible before download. Instead the panel reports ready and enables Download while the image is broken; no image-load error enters the retry path. The underlying PNG can still download successfully, so download validity does not prove preview compatibility.
- **Evidence:** Source inspection confirms the URL/policy mismatch. Inspected `output/playwright/2026-10-24-cozy-merge/card-ready.png` visibly shows the broken-image icon and preview alt text. The primary's production CUA measurement reports `naturalWidth=0`; downloaded PNG independently remains760x820.
- **Fix requirement:** Publish a CSP-compatible local preview representation without relaxing server CSP. Preserve latest-request/dispose fencing across any asynchronous Blob-to-data-URL conversion, and add focused compatibility/race tests plus actual production-server visual proof.
- **Latest split fix independently reviewed:** `CozyCardPreview.jsx:22` creates a CSP-safe image data URL, while `:21` retains a Blob URL for local download. The primary observed no download event/file when the intermediate data-URL-only fix was clicked in IAB, so that intermediate design is superseded. `cozyCardPreview.js:20` awaits image conversion and `:21` rechecks revision/disposal BEFORE download-URL allocation at `:22`; stale/closed image conversion therefore allocates no Blob URL. The existing second fence at `:23` revokes a generic asynchronous URL allocation if it finishes stale. `CozyCardPreview.jsx:65` reads imageUrl and `:39` downloads url; image errors remain retryable and object-identity-fenced at `:68`, including identical data URLs. Production CSP remains unchanged. Independent latest focused verification passed5files/28tests. No new actionable source defect was identified.
- **New production gate:** `scripts/render-smoke.mjs:245` opens the actual scene postcard against `server.mjs`, waits for a decoded760px image, then verifies Escape dismissal and restored scene focus at all4viewports. Directly inspected final-split `render-smoke-green-main.log`:4viewports PASS,0page/console errors. The prior-dist RED run is retained by the primary.
- **Additional inspected evidence:** Final-split `card-final.png` visibly paints the production postcard with Cat decoration. Inspected `download-cat-fixed.png` is the valid760x820 exported postcard; the primary measured an actual fresh Blob download file of80561bytes before copying it into the evidence folder. SHA-256 checks confirm the five latest reviewed helper/component/test/smoke files exactly match the detached main candidate; its server and dependency manifest/lockfile have no diff. Directly inspected final-split candidate build and budget535204<=546154bytes, plus completed main-candidate full169files/2972tests PASS with3skips. The concrete CSP defect and separate download behavior are proven resolved.

The previous PASS is superseded by this concrete production finding. The earlier dev-server image and passing unit/render checks did not cover the actual production CSP. No unrelated movement/state or duration-star defect was identified.

**Earlier verification failures resolved by later checks.** Evidence in `output/playwright/2026-10-23-scene-cozy/` preserves a full-suite watcher timeout (`tests/antigravityWatcher.test.js:594`), subsequent hook-write-lock failure (`tests/hookWriteLock.test.js:511`), panel navigation timeout (`scripts/panel-features-verify.mjs:191`), and governance gate-order failure. Independently inspected later results: `full-duration-final.log` passes167files/2876tests with3skips, `build-final.log` passes, `budget-final.log` passes527918<=546154bytes, `panel-final.log` passes with0errors/scoped cyan ring and pill/correct inspector durations, and `governance-final.log` passes115/warn5/fail0/skip5. The primary reports a single-worker full rerun, isolated panel server and receipt-order correction without source/test-threshold changes. No failing attempt was silently reclassified as passing.

**Visual acceptance [NEEDS_HUMAN].** Owner approval of the actual scene feedback remains outstanding. `star-short.png`, `star-medium.png`, `star-long.png` and `star-long-release.png` show three distinct squash/hint states and long-release glints at normal scene size. Latest production `card-final.png` visibly paints the final split-source postcard and the actual exported `download-cat-fixed.png` was inspected successfully. Physical saved-file success is now evidenced for this production path; final owner aesthetic judgment is separate and is not claimed.

## Burden of Proof

| AC | Verdict | Specific evidence and limits |
|---|---|---|
| C1 | PROVEN | `cozyPreferences.js:4` retains default-off Boolean persistence outside Zustand; preference tests pass. `PixelOffice.jsx:1170` / `:1268` mount both scene props independently of that preference. `sceneCozy.test.jsx` renders the actual full scene with preference off and the actual Settings popover with both rejected actions absent. `ControlPanel.jsx:376` retains only the preference. New scene modules import no state writer. |
| C2 | PROVEN in preserved source/tests; owner visibility [NEEDS_HUMAN] | `TopDownFurniture.jsx:136` / `:149` / `:155` retain the existing pot and geometry, expose the 28x34 hit area, and animate only leaves. `cozySceneReactions.test.jsx` proves baseline-off footprint, keyboard input, a single replaceable bounded timer, reduced motion and preference-disable cleanup. No amendment changes this implementation. |
| C3 | PROVEN | `OfficePet.jsx:108` gates cosmetic reaction on genuine calm modes and zero blockers; `petSprites.jsx:343` independently suppresses it for attention/celebration poses. Tests prove unchanged root transform/mode, retained baseline heart, supported species, reduced motion and immediate blocked/awaiting-approval cancellation. No amendment changes this implementation. |
| C4 | PROVEN | `AgentCharacter.jsx:1540` gates wave on actual idle/stationary state; `:1544` consumes an interrupted wave; `:1704` gates its render. Independent wave eligibility/grid/sprite tests prove no walking overlay and preserved head/body/feet/footprint. Existing poke/inspector path remains in place. |
| C5 | PROVEN in latest source/handler tests and captures; owner feel [NEEDS_HUMAN] | `ScenePaperStar.jsx:123` retains anchor175,487; `:130` accepts/captures primary pointer only. `:41` starts two bounded450/1200ms thresholds; `:73` classifies release from monotonic elapsed time. `:65` clears input/capture/timers; `:102` cleans blur/unmount; `:152` owns Space/Enter with repeat suppression. Poses/faces/hints differ by tier at `:6`, `:27`, `:171`, `:180`, `:195`. Twenty-two actual-handler tests pass, including exact449/450/1199/1200ms boundaries, long saturation, delayed timer classification, reduced-motion500ms feedback, replay, capture failures, outside release, cancellation, lost capture, blur and cleanup. `:172` uses240/460/680ms art-only animations from `index.css:150`; `:189` limits long-release glints to three fixed motifs and suppresses them for reduced motion. Latest four duration captures visibly differ as specified; owner final acceptance remains outstanding. |
| C6 | PROVEN — production fix verified; owner aesthetic acceptance [NEEDS_HUMAN] | `CozyCardPreview.jsx:22` produces a CSP-allowed image data URL; `:21` retains a separate Blob download URL. Helper `:20-27` fences image conversion before allocation and revokes stale allocations. Image-error retry uses object identity at component `:68`. Independent focused tests pass28. Final split production smoke passes decoded760px image, Escape and restored scene focus at all4viewports. Inspected `card-final.png` and actual exported760x820 `download-cat-fixed.png`; primary reports fresh80561byte file. |
| C7 | PARTIAL — [NEEDS_HUMAN] | Geometry/hint counter-scaling and media/prop reduced-motion paths are present; new localizations exist in both locales. Preview uses `useCozyPopover.js:4` viewport height/scroll/bottom100px constraints and `CozyCardPreview.jsx:52` viewport width. Actual English click/ready-image DOM and Traditional Chinese desktop captures were checked. Later synthetic390px captures show the English star hint/visible footer and Traditional Chinese painted postcard with decoration controls under reduced motion; the fixture measurement reports44x44px targets. Complete attention/footer coexistence in the card view and final visual acceptance are not yet independently proven by the current capture set. Root CUA reports successful Escape focus restoration; independent connector session ended before reliable return-focus measurement, so that narrower runtime result is attributed rather than independently asserted. |
| C8 | PROVEN | Independent latest fix-focused run passes5files/28tests; candidate focused log passes14files/113tests. Final main-candidate full169files/2972tests PASS with3skips in neutral temp; build/budget535204<=546154passes; diff-check passes. Final split production smoke passes4viewports including decoded-image/close/focus assertions. Review governance passes114/warn6/fail0/skip5. Earlier panel smoke passes0errors, scoped cyan ring/pill and correct inspector durations; final preview change does not alter panel mode. Earlier temporary-directory classifier failures and controlled12/12 parity result are preserved below; no source/test/threshold was changed to obtain the final full pass. The primary owns post-receipt phase checks. |

## Design Compliance

Reviewing with frontend-patterns, verification-before-completion, and Full Red Team checklists applied.

| Element | DSoT section | Implementation / evidence | Verdict |
|---|---|---|---|
| Settings and optionality | Settings and Optionality | Actual Settings render test removes toy/card actions; `ControlPanel.jsx:376` retains preference only; actual full/panel render tests prove scene inclusion/exclusion | Match |
| Tabletop star placement and input | Tabletop Paper Star | `PixelOffice.jsx:1267` preserves RoundTable; `ScenePaperStar.jsx:9` / `:123` default anchor175,487, art26units, expressive primary-pointer/Space/Enter control | Match in structure and tested state |
| Star touch target and duration-dependent rebound | Tabletop Paper Star; Duration-sensitive star refinement | `ScenePaperStar.jsx:24` computes44px target at required390px viewport scale; `:4`/`:6`/`:73` define exact tiers/poses and monotonic classification; `:172`240/460/680ms; reduced motion retains distinct static500ms responses without transform/long glints; capture-failure tests verify outside release | Match in source; actual owner three-tier feel [NEEDS_HUMAN] |
| Pinned postcard | Pinned Scene Postcard | `ScenePostcard.jsx:14` anchor256,73; small paper/scene motif and red pin; `index.css:144` hover/focus lift; full-only placement adjacent to existing board notes | Match in structure; final rendered acceptance [NEEDS_HUMAN] |
| Preview and focus | Postcard Preview | Final-split source uses data image/Blob download plus identity-fenced retry without changing CSP; final production smoke, painted capture and actual exported PNG inspected | Match; concrete CSP defect resolved |
| Narrow/localized/attention views | Verification Views | Scoped styling and source guards exist; complete current capture set remains incomplete | PARTIAL; no structural HIGH mismatch established |

The design link is valid and inspectable. The original production postcard failure is resolved in the final artifact, demonstrated by production smoke, painted capture and actual exported PNG. Owner visual acceptance remains separate from these functional checks.

## Security

**Security verdict: no concrete finding in the reviewed amendment.** A01/A02/A03 always-on inspection found no new authorization, credential, cryptography, HTML/command injection or untrusted URL surface. C4/C5 use only local component state, existing source-backed scalars and client-side canvas/Blob resources. Existing renderer sanitizes counts in `dailyCard.js:110`; decoration is restricted to known choices and a reserved image corner. No upload/share/fetch/auth flow or dependency change was added. Error paths log coarse operation context without user card content and expose retry/download feedback. `console.warn` is retained by the ordinary release build; no build stripping rule was identified. This is scoped static/security review, not a fresh dependency vulnerability audit.

## Full Red Team

**Verdict: no concrete exploit or resource leak found.**

Production compatibility re-audit found the concrete CSP/image-scheme failure above. It is a blocking correctness/design defect, not an authorization exploit or a reason to weaken CSP. Async data-URL conversion in the fix requires renewed stale-completion/disposal review.

Latest split re-review completed: async stale/disposal guards and identical-data-URL image-error identity guards are present and focused tests pass. The image data string is released by clearing references; the separate Blob download URL is allocated only after current image conversion, then revoked on replacement/unmount or stale asynchronous allocation. No network, HTML injection, authentication, dependency or CSP-policy surface was added by the fix.

| Area | Adversarial evidence | Result / boundary |
|---|---|---|
| Attack surface and authorization | Scene controls consume gestures only; card snapshot reads existing store without a writer; no new transport/auth boundary | No bypass path introduced |
| Pointer/timing boundary | Secondary/multiple pointers, mismatched release, cancel, lost capture, failed capture, outside release, blur and failed release covered by actual star handlers; elapsed449/450/1199/1200/12000ms and delayed threshold callbacks verified | Tests pass; input owner, fallback listeners and threshold/release timers clear; long hold saturates |
| Keyboard boundary | Repeated/wrong key release covered; consumed events remain isolated from pause; native Close/Retry/Download Space remains protected by existing App handler test | Tests pass |
| Async/resource race | Out-of-order renders, stale failure, replacement, repeated disposal, close before completion, synchronous render/URL failure and retry | Tests pass; only current revision allocates/publishes URL |
| Data/sticker boundary | Snapshot primitives remain unchanged by later source mutations; invalid/unsupported stickers draw nothing; malformed count handling remains in existing model | Tests pass; no user-controlled HTML path |
| Dependency chain | Manifest/lockfile diff unchanged; existing local React/SVG/canvas APIs only | No new dependency supply-chain surface |

Extreme arbitrary malformed `sceneScale` is not an external input boundary: current production callers supply the measured scale. Star additionally normalizes non-finite/non-positive values. No unrelated hardening/refactor is requested.

## Scope and Compatibility

Reviewed amendment: new `ScenePaperStar.jsx`, `ScenePostcard.jsx`, `sceneCozy.js`; integration hunks in `PixelOffice.jsx`, `ControlPanel.jsx`, `CozyCardPreview.jsx`, `src/index.css`, and both locales; three scene test files. Existing preview/model/preference/scene-reaction/wave/global-keyboard code and tests were inspected and exercised for preservation. Removed `CozyToyTray` has no remaining source/test import. Dirty inherited planning, SSoT, backlog, temp, ignored and untracked state was preserved.

| API/function | Callers | Compatibility |
|---|---|---|
| ScenePaperStar / ScenePostcard | Full PixelOffice SVG | New props only; full scene viewBox/furniture/walk geometry unchanged; absent from compact panel/roster |
| captureSceneCardInput | PixelOffice openSceneCard | New snapshot helper; existing source/model semantics preserved |
| PixelOffice preview ownership | ScenePostcard onOpen; CozyCardPreview onClose; roster/panel effect | Ownership moves from Settings to full scene intentionally; existing work runtime effects retained |
| CozyCardPreview | PixelOffice | Optional reducedMotion prop; prior preview/resource/download API retained |
| ControlPanel | App full/panel | Rejected action entries removed intentionally; remaining preference and footer/attention paths retained |
| Existing reaction/preferences/model helpers | Existing components/tests | No amendment behavior change identified; regression tests pass |

The diff exceeds100lines; it was reviewed in scene input, snapshot/integration, preview/resources, and style/localization units. No unsolicited refactor or dependency was found. Rollback remains reversal of the exact amendment hunks, preserving the dirty baseline; preference OFF only disables C1-C3 and intentionally does not hide the new scene props.

## Reproducible Verification

Independent commands ran with TEMP/TMP set to workspace `.tmp-scene-review`:

```text
npm test -- tests/sceneCozy.test.jsx tests/scenePaperStar.test.jsx tests/scenePostcardInput.test.jsx tests/cozyCardControls.test.jsx src/components/cozyCardPreview.test.js tests/cozyCardSticker.test.js
Test Files6passed; Tests40passed (latest duration refinement,23:02 run)
npm test -- tests/cozyPreferences.test.js tests/cozySceneReactions.test.jsx tests/idleWaveSprite.test.jsx tests/cozyKeyboardIsolation.test.jsx src/systems/idleWave.test.js src/systems/dailyCard.test.js
Test Files6passed; Tests38passed
git diff --check -- src: PASS (locale line-ending notices only)
python .agentcortex/tools/lint_spec_drift.py --spec docs/specs/cozy-interactions.md --base 3d8ae35599a2b72eb05e1049d2c290412180428d --head HEAD
Spec drift advisory:0warnings
```

The initial linter `--worklog` invocation could not infer a spec reference from this log; explicit `--spec` completed. The advisory compares committed base/head and does not substitute for manual review of uncommitted/untracked amendment files. No external references were required for a new integration/API; existing local contracts were reviewed directly.

Independent CSP-fix re-review command (2026-10-24,09:45 local):

```text
npm test -- src/components/cozyCardPreview.test.js tests/cozyCardControls.test.jsx tests/cozyCardSticker.test.js tests/sceneCozy.test.jsx tests/scenePostcardInput.test.jsx
Test Files5passed; Tests24passed (intermediate data-URL-only fix)
git diff --check -- src/components/cozyCardPreview.js src/components/CozyCardPreview.jsx src/components/cozyCardPreview.test.js tests/cozyCardControls.test.jsx scripts/render-smoke.mjs: PASS
```

Independent real-browser pointer activation at `http://127.0.0.1:5187/?lang=en` produced ready-image DOM (`naturalWidth=760`) and Close focus before the duration refinement. Escape removed the panel, but the connector context subsequently closed before reliable return-focus or motion/geometry probes; no product defect is inferred from that tool-session failure. Probes were stopped at the primary's request; no browser control was used for the duration re-review. Inspected captures: `star-pressed.png`, `star-pressed-final.png`, `card-from-board.png`, corrected `card-from-board-ready.png`, `narrow-star-en-reduced.png`, `narrow-card-zh-reduced.png`, `star-short.png`, `star-medium.png`, `star-long.png`, `star-long-release.png`. Narrow captures are explicitly synthetic local fixtures, not live work evidence. Primary CUA measurements are distinguished above from independent results. No claim is made that screenshots prove cancellation, state isolation or resource cleanup; those claims use source/handler tests.

### Duration refinement re-review

The owner-selected appended duration section supersedes the original single460ms star description. Independent source/handler review found no defect: timing starts with `performance.now()`, both pointer and keyboard share `begin`/`finish`, release recomputes the tier instead of trusting delayed callbacks, and input identity prevents callbacks from changing a later gesture. `clearTimers` runs on every begin/finish/unmount; blur/cancel clear thresholds and release feedback; animation completion and the bounded fallback timer both settle to idle. Short, medium and long held poses, faces, colors, hints and release keyframes differ. Reduced motion retains distinct static tier responses for500ms and omits deformation, animation and long-release glints. No additional tests were added because the existing22star tests directly cover the identified timing/input risks. The independent latest six-file run passed40tests; the preserved six-file regression run passed38tests. Also inspected `narrow-long-reduced.png`: a localized static long-release hint remains visible on the390px fixture with footer controls below. The primary's CUA measurements report distinct hints for100/800/1700ms Space gestures and an unchanged baseline core-state snapshot; those timing/state measurements are attributed to the primary rather than inferred from the still image.

### Final split-source re-review

The same five-file focused command was rerun independently at10:07 on2026-10-24 after the separate Blob download was restored:5files/28tests PASS. New tests prove distinct image/download sources, no download-URL allocation for stale/closed/failed image conversion, and preserved generic asynchronous allocation cleanup. All five reviewed source/test/smoke files SHA-256-match the main candidate.

Candidate build and budget logs were directly inspected:535204bytes, below546154. Candidate focused suite:14files/113tests PASS. `candidate-full-main-rerun.log` records2966pass/2fail/3skip; both failures expect dev status from fallback file edits. Inspection of unchanged `vite.config.mjs:731` confirms `/tests?[/\\]/` matches the suffix `test/` in `.tmp-cozy-vitest/`, classifying those scratch-file paths as QA. `vite-parity-controlledtmp.log` passes12/12 with neutral `.tmp-cozy-run`, without source/test/threshold changes. The required subsequent clean full run is now directly verified in `full-main-final.log`:169files/2972tests PASS,3skips, duration118.05s. The prior incomplete/nested-candidate attempts remain diagnostic only. Final-split production smoke, build, budget and root review-governance logs were also directly inspected; governance summary114pass/6warn/0fail/5skip. `star-long-release-final.png` provides a clear production lounge crop of the long-release star and fixed glints. Owner aesthetic acceptance is still separate.

## Verdict

**PASS — CSP defect resolved; no unresolved actionable source finding.** This new receipt supersedes the intervening NOT READY after the independently inspected split-source fix, focused race/input tests, production4viewport decode/close/focus smoke, painted capture, actual exported PNG, candidate full169files/2972tests PASS/3skips, build/budget and governance results. The duration-star review remains clean. Failed/intermediate attempts and their causal limits remain preserved above. Owner final subjective visual acceptance remains **[NEEDS_HUMAN] before ship**. This PASS authorizes the next phase, not shipment; the primary owns Work Log receipts and final post-write test/handoff checks.

Suggested receipt for the primary to record with its actual current timestamp: `Gate: review | Verdict: PASS | Classification: feature | Timestamp: <ISO>`.

⚡ ACX

## Delivery Authorization Addendum

On 2026-10-24, after the verified candidate was presented, the owner authorized closeout based on agent verification and requested normal project startup. The source-review PASS above is unchanged. The prior subjective-acceptance hold is resolved by that explicit delegation, not by a claim that the owner performed an independent manual trial. Final local/CI/merge results are recorded in the delivery Work Log.
