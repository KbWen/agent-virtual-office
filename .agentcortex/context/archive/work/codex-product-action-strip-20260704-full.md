# Work Log: codex-product-action-strip

## Header

- Branch: `codex/product-action-strip`
- Classification: `quick-win`
- Classified by: `codex`
- Frozen: `2026-07-02`
- Created Date: `2026-07-02`
- Owner: `codex`
- Guardrails Mode: `Quick`
- Current Phase: `implement`
- Checkpoint SHA: `b920e1b9d53131e583cb01675b775181b8a2785b`
- Recommended Skills: `verification-before-completion`
- Primary Domain Snapshot: `ui-rendering`
- SSoT Sequence: `100`

---

## Session Info

- Agent: `codex`
- Session: `2026-07-02 product action strip`
- Platform: `codex`
- Files Read: `AGENTS.md, current_state.md, plan.md, implement.md, shared-contracts.md, ControlPanel.jsx, controlPanelLabels.js, NarrowRoster.jsx, ActivityFeed.jsx, activityFeedLabel.js, PixelOffice.jsx, zh-TW/en locales, product audit notes`
- Guardrails loaded: §1, §2, §4, §7, §8.1, §10 (core)

---

## Task Description

Implement the highest-value product/visual audit recommendations approved by the user, then continue with similar-repo and copy/literary research: surface actionable blockers in the persistent UI, close the settings popover after major view switches, translate implementation-shaped activity feed entries into product-readable language, and improve high-visibility visual/copy surfaces.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | complete | 2026-07-02 | Classified as quick-win: contained UI improvement in existing components. |
| plan | complete | 2026-07-02 | Scope locked to ControlPanel helper/rendering and focused tests. |
| implement | complete | 2026-07-02 | Action strip + settings auto-close + activity feed humanization + setup hint/copy polish implemented. |
| review | pending | — | Optional for quick-win; inline review evidence required. |
| test | pending | — | Focused tests + build/smoke as risk allows. |
| handoff | complete | 2026-07-04 | Formal review handoff package added for final AI review. |
| ship | pending | — | Not requested yet. |

---

## Phase Summary

- plan: action strip + settings auto-close; target files 2 plus focused tests; mode Fast Lane | Confidence: 92% — high
- implement: changed `ControlPanel.jsx`, `controlPanelLabels.js`, and `tests/controlPanelLabels.test.js`; focused tests, full tests, build, smoke, and live browser checks passed | Confidence: 94% — high
- implement continuation: researched adjacent agent UI/repos, then changed `ActivityFeed.jsx`, `NarrowRoster.jsx`, `activityFeedLabel.js`, locale files, and focused tests to humanize feed entries while retaining raw filenames in tooltips | Confidence: 93% — high
- implement copy/visual continuation: added more repo and writing/literary references; widened/loosened activity feed rows, changed setup hint into a two-line pill, and removed the most meme-like high-frequency Traditional Chinese bubbles | Confidence: 92% — high
- implement visual-density continuation: bottom rail now shows current-signal agents and folds quiet agents into a localized count; focused/full tests, build, smoke, and browser visual check passed | Confidence: 91% — high
- review: Not Ready — system-level blockers: untracked imported helper/test, over-broad activity-feed classifier, unignored review artifact folder, and weak first-run setup hint — routed back to implement.
- implement review-fix: narrowed activity-feed artifact classification, ignored local audit output, strengthened first-run setup hint, and verified focused/full tests, build, smoke, screenshot, diff check, and secret scan | Confidence: 93% — high
- review: PASS — post-fix system review found no blocking issues; artifact boundary, classifier negatives, setup hint, tests, and security scan verified.
- test: PASS — focused classifier/control/feed tests, production build, render smoke, full Vitest suite, and diff check passed; quick-win adversarial testing n/a.
- ship: PASS — committed `aeea422fcf99a59a2e289745f80e16ff309b6f54`, updated SSoT ship history, archived Work Log to `.agentcortex/context/archive/codex-product-action-strip-20260702.md`, and updated archive index.
- implement PR follow-up: subagent tenth-man review found a ControlPanel render/status mismatch; fixed the rail dot/a11y status to use normalized external status, tightened activity-feed classifiers, and added render/boundary tests | Confidence: 94% — high
- handoff: formal review handoff added at `docs/reviews/2026-07-04-portable-core-review-handoff.md`; branch verified clean, PR #195 checks green, next action is independent final AI review.
- review: Not Ready — P1 classification/gate drift for public package API scope; P1 generic normalizer false-agent inputs; P2 package exports compatibility; P2 snapshot activeCount contract drift; security scan clean — routed back to implement for follow-up AI.
- review deepening: additional consumer probes found sanitized shorthand IDs are dropped/duplicated, movement clamp can return off-floor/on-obstacle points, and manifest `aggregate` semantics are ambiguous relative to actual `status-core` exports.

---

## Gate Evidence

- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-02T00:00:00+08:00
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-02T09:25:00+08:00
- Gate: review | Verdict: NOT READY | Transition: REVIEWED→IMPLEMENTING | Timestamp: 2026-07-02T09:58:50+08:00
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-02T10:13:55+08:00
- Gate: handoff | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-04T11:13:32+08:00
- Gate: review | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-02T10:17:04+08:00
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-02T10:18:27+08:00
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-02T10:20:38+08:00
- Gate: review | Verdict: NOT READY | Transition: REVIEWED→IMPLEMENTING | Timestamp: 2026-07-04T12:42:35+08:00

---

## Design Reference

- Tool: other
- Link: `output/product-audit-2026-07-02/notes.md`; `output/product-audit-2026-07-02/research-notes.md`
- Approved: yes
- Coverage: `02-status-rich.png`, `04-list-view.png`, `05-panel-390.png`, `06-panel-status-rich.png`; implements recommendations 1 and 4.

---

## Risks

- Risk: blocker strip could duplicate existing list-view team strip; mitigation is hide it in roster/list mode and derive from the same statuses.
- Risk: panel mode has little vertical room; mitigation is one-line compact strip only when actionable blockers exist.
- Risk: bottom rail decluttering could hide useful status context; mitigation is keep any non-idle or externally-labeled agent visible and fold only quiet agents into a count.
- Rollback plan: revert the branch or restore changed ControlPanel/helper/test files from checkpoint.

---

## External References

- Agent Quest: `https://github.com/FulAppiOS/Agent-Quest` — spatial metaphor, activity feed, detail panel.
- Agent Flow: `https://github.com/patoles/agent-flow` — timeline/transcript/file-attention visibility.
- Pixel Agents: `https://github.com/pixel-agents-hq/pixel-agents` — pixel office metaphor and characterized agent state.
- Claude Code Agent Monitor: `https://github.com/hoangsonww/Claude-Code-Agent-Monitor` — high-density live monitoring dashboard.
- Mission Control: `https://github.com/builderz-labs/mission-control` — agent fleet/task/cost control dashboard.
- LangGraph Studio: `https://www.langchain.com/blog/langgraph-studio-the-first-agent-ide` — graph/state/runtime visibility for agent flows.
- AutoGen Studio: `https://microsoft.github.io/autogen/dev//user-guide/autogenstudio-user-guide/index.html` — team builder, playground, streaming, and control graph.
- ChatDev: `https://github.com/openbmb/ChatDev` — virtual software company metaphor.
- VoltAgent: `https://github.com/voltagent/voltagent` — agent observability and operational visibility.
- NN/g UX Writing: `https://www.nngroup.com/articles/ux-writing-study-guide/` and `https://www.nngroup.com/topic/ux-writing/` — clear, concise, characterful copy.
- Orwell language essay: `https://www.orwellfoundation.com/the-orwell-foundation/orwell/essays-and-other-works/politics-and-the-english-language/` — clarity and avoiding inflated phrasing.
- Calvino Six Memos references: `https://themillions.com/2010/10/the-sixth-memo-of-italo-calvino.html` — lightness, exactitude, visibility.
- Yu Kwang-chung reference: `https://bdcl.nccu.edu.tw/uploads/chapter_file/file/649abbd7367376274f2e3a55/5%E6%AF%94%E8%BC%83%E8%A6%96%E9%87%8E%E4%B8%8B%E7%9A%84%E4%BF%AE%E8%BE%AD%E6%80%9D%E7%B6%AD__%E4%BD%99%E5%85%89%E4%B8%AD%E8%AB%96%E7%8F%BE%E4%BB%A3%E4%B8%AD%E6%96%87%E7%9A%84%E6%AD%90%E5%8C%96%E7%8F%BE%E8%B1%A1.pdf` — concise, flexible Chinese phrasing.

---

## Known Risk

- UI rendering changes can regress compact panel layout, status legibility, and activity feed clarity; verify with focused tests and browser screenshots.

---

## Conflict Resolution

none

---

## Security Findings

- 2026-07-02 /implement: 0 findings. Secret scan matches were non-secret token metric labels/comments only; no credentials, keys, private keys, or connection strings found.
- 2026-07-02 /implement continuation: 0 findings. Follow-up scan matched Work Log prose that described the secret-scan categories; no actual secret material found.
- 2026-07-02 /implement copy/visual continuation: 0 findings. Scan matches were token-related implementation/test references and fake security test literals; no real credentials, private keys, or connection strings found.
- 2026-07-02 /implement visual-density continuation: 0 findings. Scan matches were token-usage metric labels/comments only; no credentials, private keys, or connection strings found.
- 2026-07-02 /review: 0 security findings. Red-team skill matrix checked; quick-win classification does not trigger Lite/Full Red Team, so review used boundary/error-angle checks only.
- 2026-07-02 /implement review-fix: 0 findings. Secret scan matches were token metric labels/comments only; no credentials, private keys, or connection strings found.
- 2026-07-02 /implement PR follow-up: 0 findings. Secret scan matches were token metric labels/comments/test names only; no credentials, private keys, or connection strings found.
- 2026-07-03 /implement movement-layout portability: 0 findings. A01/A02/A03 checked; touched + untracked secret scan found no credentials, private keys, tokens, or connection strings. No dependency changes.
- 2026-07-03 /implement ambient-appearance portability: 0 findings. A01/A02/A03 checked; touched + untracked secret scan found no credentials, private keys, tokens, or connection strings. No dependency changes.
- 2026-07-04 /review: 0 security findings. Changed-file secret scan PASS (118 changed files); no new dependencies; package manifest change is exports-only. OWASP A01-A03 reviewed against changed headless/package code with no auth, crypto, injection, or credential findings.

---

## Red Team Findings

- 2026-07-04 /review: Not triggered by recorded `quick-win` classification. Review finding below says this scope should be reclassified at least `feature` because it changes public package exports and cross-module package/API boundaries; after reclassification, run the feature-level review/red-team path.

---

## Skill Notes

- verification-before-completion: Scope, Quality, Evidence, Risk, Communication gates must pass before completion claim.

---

## Drift Log

- Scope expanded after user requested continued product/visual optimization and similar-repo research. Kept implementation surgical and documented the added research basis in `output/product-audit-2026-07-02/research-notes.md`.
- Scope expanded again after user requested literary grounding for copy and more visual fixes. Kept changes to copy/helper/rendering surfaces, not product architecture.
- Takeover of ACTIVE Work Log lock on 2026-07-02T01:48:25.782827+00:00; prior_owner=codex; prior_session=2026-07-02-product-action-strip; lock=codex-product-action-strip.lock.json
- User explicitly approved continuing after review. Added a contained visual-density pass on the already-open UI surface; cumulative diff is now beyond ideal quick-win size, so this should be reviewed as an accumulated product polish batch before ship.
- Takeover of ACTIVE Work Log lock on 2026-07-02T01:54:50.583783+00:00; prior_owner=codex; prior_session=2026-07-02 visual-density-implement; lock=codex-product-action-strip.lock.json
- Takeover of ACTIVE Work Log lock on 2026-07-02T01:57:45.083636+00:00; prior_owner=codex; prior_session=2026-07-02 review-error-angle; lock=codex-product-action-strip.lock.json
- Takeover of ACTIVE Work Log lock on 2026-07-02T02:10:21.228086+00:00; prior_owner=codex; prior_session=2026-07-02 system-review; lock=codex-product-action-strip.lock.json
- Takeover of ACTIVE Work Log lock on 2026-07-02T02:16:10.066330+00:00; prior_owner=codex; prior_session=2026-07-02 system-cleanup-implement; lock=codex-product-action-strip.lock.json
- Takeover of ACTIVE Work Log lock on 2026-07-02T02:17:34.127026+00:00; prior_owner=codex; prior_session=2026-07-02 post-fix-review; lock=codex-product-action-strip.lock.json
- Takeover of ACTIVE Work Log lock on 2026-07-02T02:18:47.214367+00:00; prior_owner=codex; prior_session=2026-07-02 post-fix-test; lock=codex-product-action-strip.lock.json
- Takeover of ACTIVE Work Log lock on 2026-07-02T02:19:26.766198+00:00; prior_owner=codex; prior_session=2026-07-02 post-fix-ship; lock=codex-product-action-strip.lock.json
- Takeover of ACTIVE Work Log lock on 2026-07-02T02:20:20.356401+00:00; prior_owner=codex; prior_session=2026-07-02 post-fix-tested; lock=codex-product-action-strip.lock.json
- PR follow-up after subagent review: reopened implementation on the draft PR to fix a render-consumer mismatch not covered by prior pure helper tests; scope kept to UI status honesty and activity-feed classifier hardening.
- Recovered stale Work Log lock on 2026-07-03T14:44:52.408083+00:00; prior_owner=codex; prior_session=2026-07-03-goal-time-event-portability; reason=stale-time; lock=codex-product-action-strip.lock.json
- 2026-07-04 Claude takeover (owner-directed "你接手繼續"): reviewed codex's Phase-2 self-review. Verdict — all 10 findings (G1 + F1–F9) confirmed REAL against code; caveat: F5's first remedy (make clampToFloor guarantee standable) is WRONG for AVO (wall-clipping is a deliberate accepted trade-off per reference_movement_obstacle_clipping_is_accepted / OBSTACLE_RECTS) → doc-only remedy. Surfaced two meta-issues codex under-weighted: (a) the in-repo portability push contradicts the recorded clean-room-NEW-repo/AVO-untouched/deferred decision, (b) AVO is deliberately NOT npm-published so the 34-subpath public API has ZERO consumers (YAGNI/REDUCE). **Owner decision (Option A): park Phase-2, ship Phase-1 only.**
- 2026-07-04 Scope surgery (non-destructive): `aeea422^ == main tip b636b7a`, so Phase-1 (aeea422, 11a887f, 4b16e37) is a clean contiguous prefix on main; Phase-2 = e8247d3..e37b816 (39 commits). Cut `codex/product-action-strip-phase1` at 4b16e37 in an isolated worktree (node_modules junctioned, safely removed). Verified GREEN: `vite build` 488.53 KB, `vitest run` 2251/2251, render-smoke 4 viewports 0 errors. Added ADR-009 (bbfdc6c) recording the park decision + F1–F9 for the future clean-room extraction. `codex/product-action-strip` + PR #195 left UNTOUCHED as the parked Phase-2 reference (foreign work preserved, not deleted).

---

## Evidence

- `npx vitest run tests/controlPanelLabels.test.js tests/controlPanelLabel.test.js`: PASS — Test Files 2 passed; Tests 42 passed.
- `npm run build`: PASS — Vite built production bundle in 529ms; existing warnings only.
- `npm run smoke`: PASS — 4 viewports, 0 pageerrors, 0 console errors.
- `npm test`: PASS — Test Files 106 passed; Tests 2236 passed.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Live browser: desktop action strip showed `等你處理: QA, 門神`; switching to list view closed settings and avoided duplicate action strip; panel mode showed compact `等你處理` strip; console logs empty.
- Similar-repo research: reviewed Agent Quest, Agent Flow, LangGraph Studio, AutoGen Studio, ChatDev, and VoltAgent; conclusion was to preserve the office metaphor while promoting actionable states and humanizing raw log events.
- `npx vitest run tests/activityFeedLabel.test.js tests/activityFeedHonesty.test.jsx tests/narrowRosterOrder.test.jsx tests/controlPanelLabels.test.js`: PASS — Test Files 4 passed; Tests 32 passed.
- `npm run build`: PASS — Vite built production bundle in 346ms; existing warnings only.
- `npm run smoke`: PASS — 4 viewports, 0 pageerrors, 0 console errors.
- `npm test`: PASS — Test Files 107 passed; Tests 2240 passed.
- Live browser continuation: floating feed and roster feed rendered `Agent 狀態已更新` instead of raw `agent-*.jsonl`; raw filename remained available through `title`; console logs empty.
- Additional similar-repo/copy research: reviewed Pixel Agents, Claude Code Agent Monitor, Mission Control, NN/g UX Writing, Orwell, Calvino references, and Yu Kwang-chung reference; documented takeaways in `output/product-audit-2026-07-02/research-notes.md`.
- `npx vitest run tests/activityFeedLabel.test.js tests/activityFeedHonesty.test.jsx tests/narrowRosterOrder.test.jsx tests/controlPanelLabels.test.js`: PASS — Test Files 4 passed; Tests 34 passed.
- `npm run build`: PASS — Vite built production bundle in 331ms; existing warnings only.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1859, 0 pageerrors, 0 console errors.
- `npm test`: PASS — Test Files 107 passed; Tests 2242 passed.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Live browser copy/visual continuation: activity feed showed localized product copy instead of raw filenames; setup hint rendered as two-line pill when no signal; final visible state had no `SO 救我`, no old setup sentence, and no raw `agent-*.jsonl`.
- `npx vitest run tests/controlPanelLabels.test.js tests/activityFeedLabel.test.js tests/activityFeedHonesty.test.jsx`: PASS — Test Files 3 passed; Tests 30 passed.
- `npm run build`: PASS — Vite built production bundle in 434ms; existing warnings only.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1859, 0 pageerrors, 0 console errors.
- `npm test`: PASS — Test Files 107 passed; Tests 2245 passed.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Live browser visual-density continuation: bottom rail rendered `8 位安靜中` instead of listing all idle agents; screenshot saved to `output/product-audit-2026-07-02/16-bottom-rail-declutter.png`.
- `/review` boundary harness: `activityFeedMessage({ message: 'status' })` and `activityFeedMessage({ message: 'feature-status-report.md' })` both return `Status snapshot updated`, confirming the broad `hook|capture|status` classifier can over-label ordinary feed messages.
- `/review` visual check: `output/product-audit-2026-07-02/16-bottom-rail-declutter.png` confirms the bottom rail is cleaner, but the first-run setup hint remains low-contrast and cramped against the top room background.
- `npx vitest run tests/activityFeedLabel.test.js tests/controlPanelLabels.test.js tests/activityFeedHonesty.test.jsx`: PASS — Test Files 3 passed; Tests 31 passed.
- `npm run build`: PASS — Vite built production bundle in 307ms; existing warnings only.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1860, 0 pageerrors, 0 console errors.
- `npm test`: PASS — Test Files 107 passed; Tests 2246 passed.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Playwright screenshot: `output/product-audit-2026-07-02/18-setup-hint-final.png` confirms the first-run setup hint is stronger and audit output remains ignored by `.gitignore`.
- Clean artifact boundary: `git ls-files --others --exclude-standard` shows only `src/utils/activityFeedLabel.js` and `tests/activityFeedLabel.test.js`; `git check-ignore` confirms `output/product-audit-2026-07-02/18-setup-hint-final.png` is ignored.
- `/test`: `npx vitest run tests/activityFeedLabel.test.js tests/controlPanelLabels.test.js tests/activityFeedHonesty.test.jsx` PASS — Test Files 3 passed; Tests 31 passed.
- `/test`: `npm run build` PASS — production bundle built; existing Vite warnings only.
- `/test`: `npm run smoke` PASS — 4 viewports, min SVG descendants 1874, 0 pageerrors, 0 console errors.
- `/test`: `npm test` PASS — Test Files 107 passed; Tests 2246 passed.
- `/test`: `git diff --check` PASS — no whitespace errors; line-ending warnings only.
- PR follow-up subagents: Hume/Carver/Harvey dispatched. Carver found the blocking mismatch where `controlPanelPresenceRows()` normalized external status but `ControlPanel.jsx` rendered `agent.status` for the rail dot and sr-only text.
- `npx vitest run tests/activityFeedLabel.test.js tests/controlPanelLabels.test.js tests/controlPanelLabel.test.js tests/controlPanelPresenceRail.test.jsx tests/activityFeedHonesty.test.jsx`: PASS — Test Files 5 passed; Tests 62 passed.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1860, 0 pageerrors, 0 console errors.
- `npm test`: PASS — Test Files 108 passed; Tests 2251 passed.
- `npm run smoke:pack`: PASS — npm pack/install/setup/idempotency/hook/Quick-Start assertions all passed; 0 vulnerabilities.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — matches were token metric labels/comments/test names only, no credential material.
- Goal loop status-runtime continuation: extracted `assembleIntegrationPatch()` from `store.js` into `src/systems/statusRuntime.mjs` so integration source/workflow patch rules are reusable by alternate renderers and package consumers.
- `npx vitest run tests/statusRuntime.test.js tests/avo184-equivalence.test.js tests/storeReconcile.test.js tests/applyExternalStatusIdentity.test.js`: PASS — Test Files 4 passed; Tests 88 passed.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm test`: PASS — Test Files 111 passed; Tests 2271 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `status-runtime` and verified both `buildExternalStatusEntry()` and `assembleIntegrationPatch()`.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2062, 0 pageerrors, 0 console errors.
- Direct node import: PASS — `statusRuntime.mjs` exposes `assembleIntegrationPatch()` and produces the expected external source patch.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — matches were existing token metric labels/comments only, no credential material.
- Goal loop status-core continuation: added node-safe `rosterModel.mjs`, public `./roster-model`, and aggregate `./status-core` package exports so downstream renderers have a single headless status API path.
- Subagent review: Curie recommended deferring dynamic lifecycle extraction until positioning policy can be injected; Wegener recommended additive `./status-core` before de-emphasizing `./src/*`.
- `npx vitest run tests/rosterModel.test.js tests/statusCore.test.js tests/agentStatusModel.test.js tests/agentStatusSnapshot.test.js tests/statusRuntime.test.js`: PASS — Test Files 5 passed; Tests 43 passed.
- Direct node imports: PASS — `statusCore.mjs` and `rosterModel.mjs` load in bare Node and return expected workflow/feed/order outputs.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm test`: PASS — Test Files 112 passed; Tests 2274 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `status-core` and `roster-model`; setup/idempotency/hook/Quick-Start assertions passed.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2048, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — no matches.
- Goal loop dynamic-lifecycle continuation: extracted dynamic status agent classification/construction and complete multi-session reconciliation into `statusRuntime.mjs`; store now injects the pixel overflow position policy and keeps pruning side effects local.
- `npx vitest run tests/statusRuntime.test.js tests/statusCore.test.js tests/storeReconcile.test.js tests/avo184-equivalence.test.js tests/applyExternalStatusIdentity.test.js`: PASS — Test Files 5 passed; Tests 95 passed.
- Direct node import: PASS — `statusCore.mjs` exposes `reconcileMultiSessionAgents()` and evicts missing session agents as expected.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm run smoke:pack`: PASS — installed tarball imported `status-core`; dynamic lifecycle exports verified.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2044, 0 pageerrors, 0 console errors.
- `npx vitest run tests/controlPanelPresenceRail.test.jsx tests/behaviorEngine.test.js`: PASS — reran the files that timed out during a concurrent heavy run; Test Files 2 passed; Tests 27 passed.
- `npm test`: PASS — rerun sequentially after parallel resource-timeout; Test Files 112 passed; Tests 2279 passed.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — matches were existing token metric labels/comments only, no credential material.
- Goal loop generic-transport continuation: added additive `normalizeAgentStatusUpdates()` and `sanitizeAgentId()` so package consumers can normalize safe generic IDs such as `frontend` / `reviewer-2` into status-runtime-shaped updates without changing legacy AVO-role-strict `normalizePost()`.
- `npx vitest run tests/statusCore.test.js tests/statusRuntime.test.js tests/statusFieldsDriftGuard.test.js tests/normalizePost.server.test.js`: PASS — Test Files 4 passed; Tests 90 passed.
- Direct node import: PASS — `statusCore.mjs` exposes `normalizeAgentStatusUpdates()` and preserves generic `frontend` id.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm run smoke:pack`: PASS — installed tarball imported `status-core`; generic normalization export verified.
- `npx vitest run tests/movementPathingDeep.test.js`: PASS — reran the file that timed out during a concurrent heavy run; Test Files 1 passed; Tests 5 passed.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2044, 0 pageerrors, 0 console errors.
- `npm test`: PASS — rerun sequentially after parallel resource-timeout; Test Files 112 passed; Tests 2282 passed.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — no matches.
- Goal loop integration-health continuation: extracted `healthDotState()` from `controlPanelLabels.js` into node-safe `integrationStatusModel.mjs`, exported it via `./integration-status-model` and aggregate `./status-core`, while keeping the existing UI helper import path as a re-export.
- `npx vitest run tests/integrationStatusModel.test.js tests/statusCore.test.js tests/controlPanelLabels.test.js tests/watchdogDiag.test.js`: PASS — Test Files 4 passed; Tests 38 passed.
- Direct node imports: PASS — `statusCore.mjs` and `integrationStatusModel.mjs` expose health derivation in bare Node.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm test`: PASS — Test Files 113 passed; Tests 2285 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `integration-status-model`; `status-core.healthDotState()` verified.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2062, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — matches were existing token metric labels/comments only, no credential material.
- Goal loop snapshot-health continuation: added additive `snapshot.integration` with `source`, `integrationSource`, `externalCount`, and derived `health` from the node-safe `integrationStatusModel`, so downstream renderers can consume integration health without rebuilding UI-specific label logic.
- `npx vitest run tests/agentStatusSnapshot.test.js tests/statusCore.test.js tests/integrationStatusModel.test.js`: PASS — Test Files 3 passed; Tests 13 passed.
- Direct node import: PASS — `buildAgentStatusSnapshot()` returns `integration.health.level === 'idle'` for a bare Node snapshot consumer.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm test`: PASS — Test Files 113 passed; Tests 2286 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `agent-status-snapshot`; package smoke verified derived snapshot integration health.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2048, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — broad scan only matched non-secret `tokens` metric fields; precise credential scan found no matches.
- Goal loop blocked-reason portability continuation: dispatched two read-only explorers. Nash identified `NarrowRoster` presence rail view-model extraction as the next renderer-facing candidate; Sagan identified blocked reason presentation metadata as the smaller package/API portability win. Implemented Sagan's smaller boundary first and kept Nash's presence rail view-model as the next candidate.
- Added node-safe `src/systems/blockedReasonModel.mjs` with `blockedReasonState()` and legacy `classifyBlockedReason` alias; `classify.js` now re-exports the model so old imports stay compatible while package consumers can import `./blocked-reason-model` or `./status-core`.
- `npx vitest run tests/blockedReasonModel.test.js tests/classify.test.js tests/statusFieldsDriftGuard.test.js tests/statusCore.test.js tests/blockedReasonBadge.test.jsx tests/controlPanelLabels.test.js tests/controlPanelLabel.test.js`: PASS — Test Files 7 passed; Tests 262 passed.
- Direct node import: PASS — `blockedReasonModel.mjs` returns `hourglass` for `api-rate-limit` and neutral unknown metadata for an invalid reason.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm test`: PASS — Test Files 114 passed; Tests 2290 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `blocked-reason-model` and verified both direct subpath and `status-core.blockedReasonState()`.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2062, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — initial loose `sk-` pattern false-hit ordinary prose; bounded credential scan found no matches.
- Goal loop presence-rail portability continuation: extracted `NarrowRoster` data assembly into node-safe `rosterModel.mjs` via `presenceRailSignature()`, `presenceRailRows()`, `scopedRosterFeed()`, `helperCountByParent()`, and `buildPresenceRailViewModel()`. React now keeps the existing subscription/rendering strategy while package consumers can reuse the same rail rows, team summary, focused feed, counts, and quiet state.
- `npx vitest run tests/rosterModel.test.js tests/narrowRosterOrder.test.jsx tests/statusCore.test.js`: PASS — Test Files 3 passed; Tests 39 passed.
- Direct node import: PASS — `buildPresenceRailViewModel()` returns blocked team state and non-dimmed blocked row without importing React/store.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm test`: PASS — Test Files 114 passed; Tests 2295 passed.
- `npm run smoke:pack`: PASS — installed tarball verified `status-core.buildPresenceRailViewModel()`.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2048, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop activity-feed portability continuation: added node-safe `activityFeedModel.mjs` for feed row/view-model semantics (`recent`, `fresh`, `opacity`, `tone`, `iconKey`, scoped entries, unread count) and wired both floating `ActivityFeed` and roster feed rows to consume it while keeping text/i18n supplied by callers.
- `npx vitest run tests/activityFeedModel.test.js tests/activityFeedLabel.test.js tests/activityFeedHonesty.test.jsx tests/rosterModel.test.js tests/narrowRosterOrder.test.jsx tests/statusCore.test.js`: PASS — Test Files 6 passed; Tests 59 passed.
- Direct node import: PASS — `buildActivityFeedViewModel()` returns unread count and danger tone for a blocked status row without importing React/store.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm test`: PASS — Test Files 115 passed; Tests 2299 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `activity-feed-model` and verified both direct subpath and `status-core.buildActivityFeedViewModel()`.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2062, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop status-visual portability continuation: extracted `STATUS_COLORS` into node-safe `statusVisualModel.mjs`, added `statusColor()` / `statusVisualState()`, re-exported the legacy `constants.js` path, and added additive `agent.visual` tokens to reusable status snapshots so alternate renderers can use the same status colors/known-state semantics.
- `npx vitest run tests/statusVisualModel.test.js tests/agentStatusSnapshot.test.js tests/statusCore.test.js tests/theme.test.js tests/agentInspector.test.js`: PASS — Test Files 5 passed; Tests 53 passed.
- Direct node import: PASS — `statusVisualState('blocked')` returns `#E24B4A`; unknown statuses fall back without importing UI/store.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm test`: PASS — Test Files 116 passed; Tests 2302 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `status-visual-model`; package smoke verified direct subpath, `status-core.statusVisualState()`, and snapshot visual tokens.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2044, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop agent-inspector portability continuation: extracted inspector recent activity filtering, moving anchor selection, scaled/clamped panel layout, and Unicode-safe truncation into node-safe `agentInspectorModel.mjs`; exported it via `./agent-inspector-model` and aggregate `./status-core`.
- Subagent review: Planck confirmed the main behavior risks were preserving selected-agent recent rows, target-position anchoring, scaled footprint clamping, and `Array.from` truncation; Parfit confirmed package export, status-core aggregation, and pack-smoke assertions as the key API sync points.
- `npx vitest run tests/agentInspectorModelCore.test.js tests/agentInspector.test.js tests/statusCore.test.js`: PASS — Test Files 3 passed; Tests 44 passed.
- Direct node import: PASS — `agentInspectorModel.mjs` exposes moving anchor selection and Unicode-safe truncation without importing React/store.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm test`: PASS — Test Files 117 passed; Tests 2308 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `agent-inspector-model` and verified both direct subpath and `status-core.inspectorPanelLayout()`.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1943, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop agent-character portability continuation: extracted label scaling, name-tag metrics, status ring/chrome tokens, stationary indicator selection, bubble placement, and bubble message precedence into node-safe `agentCharacterModel.mjs`; exported it via `./agent-character-model` and aggregate `./status-core`.
- Snapshot character tokens: added compact `agent.character` chrome state to `buildAgentStatusSnapshot()` so alternate renderers can draw status/name/ring semantics without importing React or embedding sprite grids.
- Subagent review: McClintock identified status chrome, blocked reason override, and bubble slot decisions as the safest high-value extraction; Laplace confirmed `./agent-character-model`, `status-core`, pack-smoke, and compact snapshot tokens as the package/API sync points.
- `npx vitest run tests/agentCharacterModel.test.js tests/labelScale.test.js tests/agentStatusSnapshot.test.js tests/statusCore.test.js tests/rafWatchdog.test.js tests/socialApproach.test.js`: PASS — Test Files 6 passed; Tests 71 passed.
- Direct node import: PASS — `agentCharacterModel.mjs` exposes blocked ring tokens and label scaling without importing React/store.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm test`: PASS — Test Files 118 passed; Tests 2318 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `agent-character-model` and verified direct subpath, `status-core.characterStatusVisual()`, and snapshot character tokens.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1943, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop behavior-indicator portability continuation: extracted `BehaviorIndicator` semantic icon groups into node-safe `behaviorIndicatorModel.mjs`; aliases such as `goto-coffee-machine` and `desk-slam` now map to stable icon keys while no-icon character behaviors remain explicitly known.
- Snapshot indicator tokens: `agent.character.indicator` now uses `characterIndicatorState()` so blocked reason and walking/none dominance stay consistent with `AgentCharacter`, while behavior icon semantics remain available for alternate renderers.
- Drift guards: `familyToBehavior` now validates against exported `KNOWN_CHARACTER_BEHAVIORS` instead of a hand-written React switch list; behavior-engine emitted behaviors are covered as icon or explicit no-icon; TaskLabel covers `TodoRead`/`TodoWrite`.
- Subagent review: Ohm highlighted alias/no-icon/classifier drift risks; Kepler confirmed `./behavior-indicator-model`, `status-core`, snapshot compact token, and pack-smoke sync points.
- `npx vitest run tests/behaviorIndicatorModel.test.js tests/agentCharacterModel.test.js tests/agentStatusSnapshot.test.js tests/statusCore.test.js tests/classify.test.js tests/taskLabel.test.js`: PASS — Test Files 6 passed; Tests 225 passed.
- Direct node import: PASS — `behaviorIndicatorModel.mjs` maps `goto-coffee-machine` to `coffee` and `desk-slam` to `frustration` without importing React/store.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm test`: PASS — Test Files 119 passed; Tests 2328 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `behavior-indicator-model` and verified direct subpath, `status-core.behaviorIndicatorState()`, and snapshot indicator tokens.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1943, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- CI bundle-budget remediation: split the app-facing behavior icon resolver into `behaviorIndicatorIconKey.mjs` and split pure character chrome/layout helpers into `agentCharacterVisualModel.mjs`, so `AgentCharacter` no longer imports the full public behavior indicator semantic table through top-level model dependencies.
- `npx vitest run tests/behaviorIndicatorModel.test.js tests/agentCharacterModel.test.js tests/agentStatusSnapshot.test.js tests/statusCore.test.js tests/classify.test.js tests/taskLabel.test.js tests/labelScale.test.js`: PASS — Test Files 7 passed; Tests 239 passed.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,839 bytes across 1 js file; baseline 450,069 (+9.95%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 119 passed; Tests 2328 passed.
- `npm run smoke:pack`: PASS — installed tarball imported behavior/package subpaths including `behavior-indicator-model`, `agent-character-model`, and aggregate `status-core` assertions.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1899, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop review-gate/package-surface continuation: promoted the pure gate waiting model to node-safe `reviewGate.mjs`, kept the legacy `reviewGate.js` path as a re-export, and exposed `./review-gate-model` plus aggregate `status-core` exports for alternate renderers.
- Package surface hardening: `smoke:pack` now checks that every explicit public library subpath in `package.json.exports` is represented by the installed-tarball import probe; `./src/*` remains a raw source escape hatch and is intentionally excluded from portable API coverage.
- Subagent review: Russell ranked ControlPanel action strip and AgentInspector semantics as future candidates; Maxwell flagged package export drift and the tight bundle budget, driving this wave to keep app bundle size unchanged while hardening public API checks.
- `npx vitest run tests/reviewGate.test.js tests/statusCore.test.js`: PASS — Test Files 2 passed; Tests 11 passed.
- `node --check scripts/pack-smoke.mjs`: PASS.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,839 bytes across 1 js file; baseline 450,069 (+9.95%); limit 495,075 (+10%).
- `npm run smoke:pack`: PASS — installed tarball imported `review-gate-model`, verified `status-core.gateWaiting()`, and passed export coverage drift check.
- `npm test`: PASS — Test Files 119 passed; Tests 2329 passed.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1830, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop action-strip portability continuation: added node-safe `actionStripModel.mjs` for reusable control-panel/action-strip semantics: compact token formatting, line tokens, attention state, presence rows, and a combined health/attention/presence view-model for alternate renderers.
- Bundle-risk mitigation: React keeps the existing app-local `controlPanelLabels.js` fast path while package consumers import `./action-strip-model`; focused build proved the main app chunk stayed unchanged at 494,839 bytes.
- `npx vitest run tests/actionStripModel.test.js tests/controlPanelLabels.test.js tests/statusCore.test.js`: PASS — Test Files 3 passed; Tests 30 passed.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,839 bytes across 1 js file; baseline 450,069 (+9.95%); limit 495,075 (+10%).
- `npm run smoke:pack`: PASS — installed tarball imported `action-strip-model`, verified `status-core.buildActionStripViewModel()`, and passed export coverage drift check.
- `npm test`: PASS — Test Files 120 passed; Tests 2335 passed.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1830, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop agent-inspector semantic portability continuation: added node-safe task semantic tokens, actionable waiting-duration gating, durable/legacy done-today counting, and inspector metadata builder to `agentInspectorModel.mjs`; exported the semantic helpers through aggregate `status-core`.
- Bundle-risk mitigation: React keeps a local fast path for classifier/i18n display labels and compact waiting-copy formatting while package consumers import the pure `.mjs` helpers; the first build exceeded budget by 67 bytes, then wrapper slimming brought the main app chunk back under the limit.
- `npx vitest run tests/agentInspectorModelCore.test.js tests/agentInspector.test.js tests/statusCore.test.js`: PASS — Test Files 3 passed; Tests 48 passed.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,834 bytes across 1 js file; baseline 450,069 (+9.95%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 120 passed; Tests 2339 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `agent-inspector-model`, verified direct semantic export and `status-core.inspectorTaskToken()`, and passed export coverage drift check.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1830, 0 pageerrors, 0 console errors.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop daily-ledger runtime portability continuation: extracted local day keys, done/blocked daily ledgers, rollover helpers, persisted-ledger sanitization, and done-event keying into node-safe `dailyLedgerModel.mjs`; `store.js` now reuses the model while keeping legacy validation exports compatible.
- Package/API boundary: exposed `./daily-ledger-model` and aggregate `status-core` ledger exports; `smoke:pack` installed-tarball probe now imports and verifies the direct subpath plus `status-core.buildDoneEventKey()`.
- Subagent review: Jason ranked speech bubbles/helper huddle as smaller future candidates and daily status ledger as a valid runtime candidate; Epicurus flagged the new untracked public dependency risk, package/export sync risk, and tight bundle budget, driving explicit staging and package-smoke coverage.
- `npx vitest run tests/dailyLedgerModel.test.js tests/storePersistence.test.js tests/storeBlockedLedger.test.js tests/agentInspector.test.js tests/statusRuntime.test.js tests/statusCore.test.js`: PASS — Test Files 6 passed; Tests 96 passed.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,819 bytes across 1 js file; baseline 450,069 (+9.94%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 121 passed; Tests 2345 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `daily-ledger-model`, verified direct `buildDoneEventKey()` and aggregate `status-core.buildDoneEventKey()`, and passed export coverage drift check.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1828, 0 pageerrors, 0 console errors.
- Direct node import: PASS — `dailyLedgerModel.mjs` imports in bare Node and returns `codex:7:dev` for source/seq done-event keys.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop speech-bubble portability continuation: extracted speech bubble text sanitization, Unicode-safe display truncation, text-width estimation, reusable SVG geometry, and edge-clamp math into node-safe `speechBubbleModel.mjs`; `BehaviorBubble.jsx` now imports the shared text/edge helpers while keeping local render/fade state and a slim geometry fast path for bundle budget.
- Package/API boundary: exposed `./speech-bubble-model` and aggregate `status-core` speech-bubble exports; `smoke:pack` installed-tarball probe now verifies direct `computeBubbleLayout()` and aggregate `status-core.computeBubbleLayout()`.
- Bundle-risk mitigation: the first build with public geometry in the app path exceeded budget at 495,306 bytes; moving the app geometry back to a local fast path and inlining the old layout formula in `computeBubbleLayout()` brought the app chunk back under budget.
- `npx vitest run tests/speechBubbleModel.test.js tests/bubbleEdgeClamp.test.js tests/statusCore.test.js tests/agentCharacterModel.test.js`: PASS — Test Files 4 passed; Tests 27 passed.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,865 bytes across 1 js file; baseline 450,069 (+9.95%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 122 passed; Tests 2350 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `speech-bubble-model`, verified direct `computeBubbleLayout()` and aggregate `status-core.computeBubbleLayout()`, and passed export coverage drift check.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1830, 0 pageerrors, 0 console errors.
- Direct node import: PASS — `speechBubbleModel.mjs` imports in bare Node and returns `abcdefghijklmnop…` / box width 129 for legacy truncation+width behavior.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop helper-huddle portability continuation: added node-safe `helperHuddleModel.mjs` for helper counts, flat huddle signatures, signature parsing, anchored capped layout, overflow/heavy state, and renderer-facing huddle rows with injected anchors.
- Package/API boundary: exposed `./helper-huddle-model` and aggregate `status-core` helper huddle exports; `smoke:pack` installed-tarball probe verifies direct `buildHelperHuddleViewModel()` and aggregate `status-core.buildHelperHuddleViewModel()`.
- Bundle-risk mitigation: an initial app-wired version exceeded bundle budget at 495,550 bytes; React kept its existing app-local fast path while package consumers import the node-safe model, bringing the main app chunk back to 494,865 bytes.
- `npx vitest run tests/helperHuddleModel.test.js tests/helperHuddle.test.js tests/statusCore.test.js tests/agentStatusSnapshot.test.js`: PASS — Test Files 4 passed; Tests 33 passed.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,865 bytes across 1 js file; baseline 450,069 (+9.95%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 123 passed; Tests 2356 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `helper-huddle-model`, verified direct `buildHelperHuddleViewModel()` and aggregate `status-core.buildHelperHuddleViewModel()`, and passed export coverage drift check.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1830, 0 pageerrors, 0 console errors.
- Direct node import: PASS — `helperHuddleModel.mjs` imports in bare Node and returns one sprite for an injected dev anchor.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop pair-huddle portability continuation: added node-safe `pairHuddleModel.mjs` with shared-file pair detection, write-task honesty gating, endpoint position fallback, and renderer-facing pair-link view-model for alternate renderers.
- Honesty hardening: accepted subagent tenth-man P1; explicit `task: "Read"` plus shared `activeFile` now remains on the data path but does not produce a co-edit pair in the public model, legacy detector, or store-driven overlay.
- Package/API boundary: exposed `./pair-huddle-model` and aggregate `status-core` pair huddle exports; `smoke:pack` installed-tarball probe verifies direct import, aggregate import, export coverage drift, and the Read overclaim guard.
- Bundle-risk mitigation: React keeps a slim app-local detector in `pairHuddle.js`; the first public re-export build passed with only 31 bytes of budget margin, so the app path was slimmed back to 494,973 bytes while package consumers use the richer `.mjs` model.
- Subagent review: Mill flagged the public API overclaim risk (`Read` + `activeFile`) plus package/export drift and bundle-margin risks; this wave added the Read gate, package smoke assertions, and focused overlay tests.
- `npx vitest run tests/pairHuddleModel.test.js tests/pairHuddle.test.js tests/pairLinkOverlay.test.js tests/pairHuddleDataPath.test.js tests/officeStatusHook.test.js tests/statusCore.test.js`: PASS — Test Files 6 passed; Tests 165 passed.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,973 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 124 passed; Tests 2364 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `pair-huddle-model`, verified direct/aggregate pair-link model exports, checked Read overclaim guard, and passed export coverage drift check.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1830, 0 pageerrors, 0 console errors.
- Direct node import: PASS — `pairHuddleModel.mjs` imports in bare Node and rejects `Read` activeFile co-edit overclaim.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches.
- Goal loop copy/visibility portability continuation: added node-safe `contextBubbleModel.mjs` for renderer-facing bubble semantic plans (kind/base role/template keys/context/action) without importing i18n, rng, locales, React, or store.
- Subagent-informed low-risk model: accepted Ohm's recommendation to also expose `bubbleVisibilityModel.mjs` for bubble priority, cap, rotation epoch, memoized visible-set selection, and renderer-facing visible id view-models.
- Package/API boundary: exposed `./context-bubble-model` and `./bubble-visibility-model`; aggregate `status-core` now exports both context-bubble semantic helpers and bubble visibility selectors.
- Bundle-risk mitigation: the app keeps existing `contextBubble.js` and `bubbleVisibility.js` paths, while public package consumers use `.mjs`; build confirmed the main app chunk stayed unchanged at 494,973 bytes.
- `npx vitest run tests/contextBubbleModel.test.js tests/contextBubble.test.js tests/bubbleVisibilityModel.test.js tests/bubbleVisibility.test.js src/systems/bubbleVisibility.test.js tests/statusCore.test.js`: PASS — Test Files 6 passed; Tests 70 passed.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,973 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 126 passed; Tests 2374 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `context-bubble-model` and `bubble-visibility-model`, verified direct/aggregate exports, and passed export coverage drift check.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1830, 0 pageerrors, 0 console errors.
- Direct node import: PASS — `contextBubbleModel.mjs` and `bubbleVisibilityModel.mjs` import in bare Node and return expected semantic/visibility outputs.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches across modified and untracked files.
- Goal loop poke-reaction portability continuation: added node-safe `pokeReactionModel.mjs` for honest status-to-quip pool mapping, poke history windows, escalation thresholds, quip index rotation, and renderer-facing reaction view-models.
- Subagent review: Banach found no P1 and flagged P2 timing drift risk; this wave expanded public timing from bob-only fields to include `quipMs`, `bobClearMs`, SVG motion profile (`values`, `keyTimes`, `dur`), and parity tests against current `AgentCharacter.jsx` hardcoded behavior.
- Package/API boundary: exposed `./poke-reaction-model`; aggregate `status-core` exports poke pool, thresholds, history helpers, reaction picker, quip indexer, timing constants, and `buildPokeReactionViewModel()`.
- Bundle-risk mitigation: React keeps the existing app-local `pokeReaction.js` fast path while package consumers import `.mjs`; build confirmed the main app chunk stayed unchanged at 494,973 bytes.
- `npx vitest run tests/pokeReactionModel.test.js src/systems/pokeReaction.test.js tests/statusCore.test.js`: PASS — Test Files 3 passed; Tests 23 passed.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,973 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 127 passed; Tests 2379 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `poke-reaction-model`, verified direct/aggregate exports, timing/motion/quip assertions, and passed export coverage drift check.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1828, 0 pageerrors, 0 console errors.
- Direct node import: PASS — `pokeReactionModel.mjs` imports in bare Node and returns expected timing + motion tokens for turnaway.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches across modified and untracked files.
- Goal loop event-juice portability continuation: added node-safe `eventJuiceModel.mjs` for cosmetic-only one-shot event motion descriptors, reduced-motion gating, desk-shake gating, and renderer-facing particle view-models.
- Subagent review: Franklin found no P1 and flagged P2 drift risk between public anchors/delays/radii and `PixelOffice`; this wave added precise parity tests for animation names, delay steps, confetti anchor, eureka anchor, offset, and radius while keeping the app path unchanged for bundle safety.
- Package/API boundary: exposed `./event-juice-model`; aggregate `status-core` exports `EVENT_JUICE`, `JUICED_EVENT_IDS`, `juiceForEvent()`, `shouldShakeDesk()`, and `buildEventJuiceViewModel()`.
- Bundle-risk mitigation: React keeps the existing app-local `eventJuice.js` fast path while package consumers import `.mjs`; build confirmed the main app chunk stayed unchanged at 494,973 bytes.
- `npx vitest run tests/eventJuiceModel.test.js tests/eventJuice.test.js tests/statusCore.test.js`: PASS — Test Files 3 passed; Tests 16 passed.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,973 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 128 passed; Tests 2384 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `event-juice-model`, verified direct/aggregate exports, reduced-motion gating, and passed export coverage drift check.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1899, 0 pageerrors, 0 console errors.
- Direct node import: PASS — `eventJuiceModel.mjs` imports in bare Node and returns expected cosmetic-only visible/hidden models.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches across modified and untracked files.
- Goal loop event-gate portability continuation: added node-safe `eventGateModel.mjs` for WORK-CLAIM event eligibility, recent real-signal checks, eligible event filtering, deterministic random picking, live floor tick scaling, and renderer-facing event gate view-models.
- Subagent review: Ramanujan flagged untracked public files, duplicate legacy/public gate drift, falsey `changedAt` coercion, event-catalog drift, and tight bundle budget. This wave fixed the falsey timestamp guard, added event-catalog anchoring tests, and kept `officeLife.js` on its app-local path to avoid spending the remaining 102-byte bundle margin.
- Package/API boundary: exposed `./event-gate-model`; aggregate `status-core` exports work-claim constants, eligibility helpers, floor tick helpers, and `buildEventGateViewModel()`. `smoke:pack` verifies direct installed-tarball import plus aggregate export coverage.
- `npx vitest run tests/eventGateModel.test.js tests/eventHonestyGate.test.js tests/teamAffectMeasure.test.js tests/interactiveEventGate.test.js tests/realSeedTriggers.test.js tests/statusCore.test.js`: PASS — Test Files 6 passed; Tests 37 passed.
- Follow-up focused hardening rerun after subagent findings: `npx vitest run tests/eventGateModel.test.js tests/eventHonestyGate.test.js tests/teamAffectMeasure.test.js tests/statusCore.test.js`: PASS — Test Files 4 passed; Tests 25 passed.
- Direct node imports: PASS — `eventGateModel.mjs` imports in bare Node, rejects falsey `changedAt`, rejects ungated deploy claims, and deterministically scales live floor ticks with injected randomness.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,973 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 129 passed; Tests 2391 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `event-gate-model`, verified direct/aggregate event gate exports, floor gate assertions, and passed export coverage drift check.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1899, 0 pageerrors, 0 console errors.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches across modified and untracked files.
- Goal loop event-seed portability continuation: added node-safe `eventSeedModel.mjs` for real-signal seed candidates, explicit fire/block reasons, global/per-event cooldown decisions, immutable cooldown-state updates, first-viable candidate selection, and a compact renderer-facing seed view-model.
- Subagent review: Meitner flagged untracked public files, duplicate legacy/public seed logic, mood/ops overclaim semantics, and thin integration cooldown coverage. This wave kept app behavior unchanged for bundle safety, added true store/subscriber tests for stale `changedAt`, global exact cooldown boundary, per-event 3x boundary, and simultaneous mood+ops ordering, and will stage the new public source/test files explicitly.
- Package/API boundary: exposed `./event-seed-model`; aggregate `status-core` exports seed constants, edge candidate helpers, seed decisions, selector, cooldown normalizer, and `buildSeedEventViewModel()`. `smoke:pack` verifies direct installed-tarball import plus aggregate export coverage.
- `npx vitest run tests/eventSeedModel.test.js tests/realSeedTriggers.test.js tests/eventGateModel.test.js tests/statusCore.test.js`: PASS — Test Files 4 passed; Tests 31 passed.
- Direct node import: PASS — `eventSeedModel.mjs` imports in bare Node, maps a smooth mood edge to `eureka`, and returns a firing seed view-model with injected time/cooldown state.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,973 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 130 passed; Tests 2403 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `event-seed-model`, verified direct/aggregate seed exports, and passed export coverage drift check.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1897, 0 pageerrors, 0 console errors.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches across modified and untracked files.
- Goal loop event-catalog portability continuation: added node-safe `eventCatalogModel.mjs` for catalog flattening, event lookup, cadence/category metadata, participant selector normalization, interactive idle reactions, seed-source mapping, and portability validation without importing JSON, store, React, or i18n.
- Subagent review: Kierkegaard flagged untracked public files, duplicate metadata truth-source risk, and overly permissive external catalog validation. This wave added strict validation options for explicit categories and allowed role arrays, plus tests that fail on uncategorized external events and invalid role-array entries; staging will include the new public source/test files explicitly.
- Package/API boundary: exposed `./event-catalog-model`; aggregate `status-core` exports catalog constants, entry/view builders, category/participant helpers, reaction/seed metadata, and `validateEventCatalogPortability()`. `smoke:pack` verifies direct installed-tarball import plus aggregate export coverage.
- `npx vitest run tests/eventCatalogModel.test.js tests/officeEvents.test.js tests/eventGateModel.test.js tests/eventSeedModel.test.js tests/statusCore.test.js`: PASS — Test Files 5 passed; Tests 32 passed.
- Follow-up focused strict-validation rerun after subagent findings: `npx vitest run tests/eventCatalogModel.test.js tests/officeEvents.test.js tests/statusCore.test.js`: PASS — Test Files 3 passed; Tests 18 passed.
- Direct node import: PASS — `eventCatalogModel.mjs` imports in bare Node, classifies `eureka` as work-claim, and strict validation rejects uncategorized/invalid-role external catalog entries.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,973 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 131 passed; Tests 2410 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `event-catalog-model`, verified direct/aggregate catalog exports, and passed export coverage drift check.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 1899, 0 pageerrors, 0 console errors.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches across modified and untracked files.
- Goal loop movement-layout portability continuation: added node-safe `movementLayoutModel.mjs` as a versioned office layout contract for alternate renderers, exposing frozen layout anchors, cloned renderer view-models, standability helpers, safe `zoneForPoint()` semantics, facing/overlap helpers, and behavior location-change semantics without exporting random pathfinding or target selection.
- Subagent review: Huygens flagged P1 risks around re-exporting browser `.js`, mutable raw structures, and exposing `Math.random` pathing APIs; this wave addressed those by shipping a true `.mjs` model, deep-freezing exported constants, returning mutable clones from `buildMovementLayoutViewModel()`, excluding `calculatePath`/`getTargetForBehavior`, and using `zoneForPoint()` to avoid legacy off-floor mainOffice fallback.
- Package/API boundary: exposed `./movement-layout-model`; aggregate `status-core` exports movement layout helpers and the safe layout view-model. `smoke:pack` verifies direct installed-tarball import, aggregate import, and export coverage drift.
- `npx vitest run tests\movementLayoutModel.test.js tests\statusCore.test.js`: PASS — Test Files 2 passed; Tests 10 passed.
- Direct node import: PASS — `movementLayoutModel.mjs` imports in bare Node, rejects unsafe off-floor zone fallback, returns expected home position, and does not leak `calculatePath`.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts\bundle-budget.mjs`: PASS — 494,973 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm run smoke:pack`: PASS — installed tarball imported `movement-layout-model`, verified direct/aggregate exports, and passed export coverage drift check.
- `npm test`: PASS — Test Files 133 passed; Tests 2425 passed.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2019, 0 pageerrors, 0 console errors.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched + untracked secret scan: PASS — bounded credential scan found no matches across modified and untracked files.
- Goal loop ambient appearance portability continuation: added node-safe `ambientAppearanceModel.mjs` for renderer-facing ambient state: mood-to-weather, time-of-day lighting overlay, theme tint cap, weather animation flags, reduced-motion handling, and a high-level `buildAmbientAppearanceViewModel()`.
- Truth-source cleanup: converted legacy app paths `lighting.js` and `theme.js` into thin wrappers over `ambientAppearanceModel.mjs`, and changed `TopDownFurniture.moodToWeather()` to delegate to the node-safe model, eliminating duplicate appearance tables while preserving existing imports.
- Subagent review: Archimedes flagged export coverage, duplicate truth-source risk, status-core overexposure, no-hour deep-night surprise, node-safe proof, and legibility coverage; this wave added pack-smoke import coverage, narrowed status-core to stable high-level ambient exports, pinned no-hour VM lighting as invisible, used node-safe `statusVisualModel` in contrast tests, and added worst-case theme+lighting contrast/cap assertions.
- Package/API boundary: exposed `./ambient-appearance-model`; aggregate `status-core` exports only `AMBIENT_APPEARANCE_VERSION`, `DEFAULT_THEME`, `THEME_IDS`, `WEATHER_KIND`, `buildAmbientAppearanceViewModel()`, and `moodToWeather()`.
- `npx vitest run tests\ambientAppearanceModel.test.js tests\statusCore.test.js src\systems\lighting.test.js tests\theme.test.js tests\weatherSystem.test.js tests\classifierWiring.test.js tests\classify.test.js`: PASS — Test Files 7 passed; Tests 253 passed.
- Direct node import: PASS — `ambientAppearanceModel.mjs` imports in bare Node, returns expected weather/theme cap, and keeps high-level no-hour lighting invisible.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts\bundle-budget.mjs`: PASS — 494,973 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm run smoke:pack`: PASS — installed tarball imported `ambient-appearance-model`, verified direct/aggregate exports, and passed export coverage drift check.
- `npm test`: PASS — Test Files 134 passed; Tests 2433 passed.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2021, 0 pageerrors, 0 console errors.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched + untracked secret scan: PASS — bounded credential scan found no matches across modified and untracked files.
- Goal loop time-event portability continuation: added node-safe `timeEventModel.mjs` for time-linked office rules, due/blocked decision reasons, once-per-hour marker semantics, Friday 15:00 dual event ordering, lunch-nap/drowsy agent selection, and drowsy release tokens.
- Subagent review: Gibbs flagged Friday 15:00 double-fire, untracked public files, paused/active hour deferral, zero-napper lunch mutex, snapshot-based drowsy release, weak pack-smoke ordering, and tight bundle budget. This wave kept the app path unchanged for bundle safety, added true `startOfficeLife` integration tests for paused/active deferral and zero-napper lunch mutex, and upgraded pack-smoke to assert Friday `tea-break,group-meeting` ordering.
- Package/API boundary: exposed `./time-event-model`; aggregate `status-core` exports time event constants, rule lookup, decision/view-model helpers, lunch/drowsy selectors, and drowsy release helper. `smoke:pack` verifies direct installed-tarball import plus aggregate export coverage and Friday ordering.
- `npx vitest run tests/timeEventModel.test.js tests/officeLife.test.js tests/statusCore.test.js`: PASS — Test Files 3 passed; Tests 40 passed.
- Direct node import: PASS — `timeEventModel.mjs` imports in bare Node and returns Friday 15:00 eventIds `tea-break,group-meeting`.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts/bundle-budget.mjs`: PASS — 494,973 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 132 passed; Tests 2420 passed.
- `npm run smoke:pack`: PASS — installed tarball imported `time-event-model`, verified direct/aggregate time-event exports and Friday ordering, and passed export coverage drift check.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2021, 0 pageerrors, 0 console errors.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — bounded credential scan found no matches across modified and untracked files.
- Ambient follow-up after CI bundle-budget failure: corrected the implementation shape so package consumers use `.mjs` node-safe `weatherModel`, `lightingModel`, and `themeModel`, while the app keeps its existing `.js` lighting/theme/classifier hot paths to avoid paying portable API wrapper cost in the main bundle.
- Correction to earlier ambient truth-source note: `lighting.js` and `theme.js` are no longer thin wrappers over `ambientAppearanceModel.mjs`; Node package semantics (`type: commonjs`) require the public ambient subpath to import `.mjs` modules. Parity tests now guard app `.js` behavior against the package `.mjs` contract.
- CI failure reproduced locally before fix: `node scripts\bundle-budget.mjs` failed at 495,394 / 495,340 / 495,319 / 495,259 bytes during intermediate shapes; final `node scripts\bundle-budget.mjs`: PASS — 494,973 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- Follow-up `npm run smoke:pack`: PASS — installed tarball imported `ambient-appearance-model` and all library subpaths; the prior pack failure (`theme.js` did not provide `DEFAULT_THEME` under CommonJS package semantics) was fixed by restoring `.mjs` package imports.
- Follow-up validation: `npx vitest run tests\ambientAppearanceModel.test.js tests\statusCore.test.js src\systems\lighting.test.js tests\theme.test.js tests\weatherSystem.test.js tests\classifierWiring.test.js tests\classify.test.js`: PASS — Test Files 7 passed; Tests 253 passed.
- Follow-up `npm test`: PASS — Test Files 134 passed; Tests 2433 passed.
- Follow-up `npm run smoke`: PASS — 4 viewports, min SVG descendants 2021, 0 pageerrors, 0 console errors.
- Follow-up node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- Follow-up `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Follow-up touched-files secret scan: initial broad term scan produced classifier taxonomy false positives (`token` / `oauth` words only); refined assignment/private-key/token-shape scan PASS — no credentials found.
- Goal loop ambient sound portability continuation: added node-safe `ambientSoundModel.mjs` for reusable soundscape gating, rain/storm gain mapping, keyboard interval semantics, persisted preference resolution, state signatures, and renderer-facing `buildAmbientSoundViewModel()` without importing Web Audio, React, store, or browser components.
- Bundle-risk mitigation: app `ambientSound.js` keeps its app-local Web Audio/tunable hot path and now imports `classifyMood()` directly instead of `TopDownFurniture.jsx`; package consumers import the `.mjs` model. This removed the React component coupling while keeping the main bundle inside the existing budget.
- Subagent review: Sartre flagged untracked source/test files, status-core overexposure, remaining component import coupling, and signature drift for undefined/null mood. This wave addressed those by staging the new files, narrowing `status-core` to `AMBIENT_SOUND_VERSION`, `AMBIENT_SOUND_MASTER_CAP`, and `buildAmbientSoundViewModel()`, removing the component import, and adding undefined/null/empty signature tests.
- Package/API boundary: exposed `./ambient-sound-model`; aggregate `status-core` exports only the high-level sound view-model and stable sound constants. `smoke:pack` verifies direct installed-tarball import plus aggregate export coverage.
- `npx vitest run tests\ambientSoundModel.test.js src\systems\ambientSound.test.js tests\statusCore.test.js`: PASS — Test Files 3 passed; Tests 20 passed.
- Direct node import: PASS — `ambientSoundModel.mjs` imports in bare Node, returns storm gain `0.08`, keyboard interval `280`, and matches the app signature semantics for undefined mood.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts\bundle-budget.mjs`: PASS — 494,982 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm run smoke:pack`: PASS — installed tarball imported `ambient-sound-model`, verified direct/aggregate sound exports, and passed export coverage drift check.
- `npm test`: PASS — Test Files 135 passed; Tests 2437 passed.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2018, 0 pageerrors, 0 console errors.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched-files secret scan: PASS — assignment/private-key/token-shape scan found no credentials.
- Goal loop pet-state portability continuation: added node-safe `petStateModel.mjs` for reusable companion state semantics, including pet modes, blocked-status attention, mobile/ambient emotes, type rotation, wander targets, motion grammar, readability scaling, and a renderer-facing `buildPetStateViewModel()`.
- Package/API boundary: exposed `./pet-state-model`; aggregate `status-core` exports only `PET_MODES`, `PET_STATE_VERSION`, and `buildPetStateViewModel()` so other renderers get the high-level contract without inheriting lower-level app helpers.
- Boundary rationale: the app keeps the existing `petState.js` hot path because the package is `type: commonjs`; the public `.mjs` model is the Node-safe consumer surface, and parity tests guard drift between the legacy app path and the portable package model.
- Subagent review: Peirce flagged P1 untracked source/test files and a stale explicit `blockedCount: 0` override that could hide real `externalStatus` blockers, plus P2 aggregate overexposure. This wave stages the new files, resolves blockers with `Math.max(blockedCount, statusBlockedCount)`, adds the regression test, and narrows `status-core`.
- `npx vitest run tests\petStateModel.test.js tests\petState.test.js tests\petWander.test.js src\systems\petState.test.js tests\statusCore.test.js`: PASS — Test Files 5 passed; Tests 50 passed.
- Direct node import: PASS — `petStateModel.mjs` imports in bare Node and the blocker override regression returns blocked count `1` with mode `hide`.
- `npm run smoke:pack`: PASS — installed tarball imported `pet-state-model`, verified direct/aggregate pet-state exports, and passed export coverage drift check.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `npm test`: PASS — Test Files 136 passed; Tests 2442 passed.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2018, 0 pageerrors, 0 console errors.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `node scripts\bundle-budget.mjs`: PASS — 494,982 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched + untracked secret scan: PASS — assignment/private-key/token-shape scan found no credentials.
- Goal loop workflow-handoff portability continuation: added node-safe `workflowHandoffModel.mjs` for reusable phase-transition handoff semantics, including workflow normalization, explicit transition keys, semantic handoff lookup, renderability checks, and a renderer-facing `buildWorkflowHandoffViewModel()`.
- Package/API boundary: exposed `./workflow-handoff-model`; aggregate `status-core` exports only `WORKFLOW_HANDOFF_VERSION` and `buildWorkflowHandoffViewModel()` so alternate presentations can render workflow handoffs without depending on the Zustand subscription.
- Bundle-risk mitigation: initial app integration imported the `.mjs` model into `workflowHandoff.js` and pushed the production chunk over budget at 495.69 kB. Final shape keeps the app hot path local while parity tests guard the duplicated transition table, returning bundle-budget to PASS at 494,987 bytes / limit 495,075.
- Subagent review: Herschel flagged P1 untracked public source/test files. This wave stages `src/systems/workflowHandoffModel.mjs` and `tests/workflowHandoffModel.test.js` with the package/status-core/pack-smoke changes; no other P1/P2 found.
- `npx vitest run tests\workflowHandoffModel.test.js tests\workflowHandoff.test.js tests\statusCore.test.js`: PASS — Test Files 3 passed; Tests 31 passed.
- Direct node import: PASS — `workflowHandoffModel.mjs` imports in bare Node and maps whitespace-prefixed `/Review` to `review->ship` with action target `ops`.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts\bundle-budget.mjs`: PASS — 494,987 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm run smoke:pack`: PASS — installed tarball imported `workflow-handoff-model`, verified direct/aggregate workflow exports, and passed export coverage drift check.
- `npm test`: PASS — Test Files 137 passed; Tests 2449 passed.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2018, 0 pageerrors, 0 console errors.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched + untracked secret scan: PASS — assignment/private-key/token-shape scan found no credentials.
- Goal loop portable-core manifest continuation: added node-safe `portableCoreManifest.mjs` as a machine-readable discovery map for all reusable package library subpaths, grouping status transport/runtime/view-model/interaction/event/ambience capabilities by layer and category for alternate renderers.
- Package/API boundary: exposed `./portable-core-manifest`; aggregate `status-core` exports manifest discovery helpers so consumers can either import the map directly or inspect it through the single status-core API.
- Drift protection: `tests\portableCoreManifest.test.js` compares manifest subpaths to `package.json` exports, excluding only CLI/package metadata/wildcard source export; `smoke:pack` now verifies direct installed-tarball manifest import and aggregate `status-core` manifest exports.
- Sidecar review: Hypatia could not complete due usage-limit error, so this wave used local tenth-man checks instead: manifest/export drift script PASS, untracked source/test files identified for staging, and package smoke/bundle/node-safe scans verified.
- `npx vitest run tests\portableCoreManifest.test.js tests\statusCore.test.js`: PASS — Test Files 2 passed; Tests 8 passed.
- Direct node import: PASS — `portableCoreManifest.mjs` imports in bare Node, includes `./portable-core-manifest`, maps `./pet-state-model` to category `companion`, and reports 34 library subpaths.
- Manifest/export drift script: PASS — package export subpaths exactly match manifest subpaths (34).
- `npm run smoke:pack`: PASS — installed tarball imported `portable-core-manifest`, verified direct/aggregate manifest exports, and passed export coverage drift check.
- `npm run build`: PASS — production bundle built; existing Vite mixed-exports and inlineDynamicImports warnings only.
- `node scripts\bundle-budget.mjs`: PASS — 494,987 bytes across 1 js file; baseline 450,069 (+9.98%); limit 495,075 (+10%).
- `npm test`: PASS — Test Files 138 passed; Tests 2452 passed.
- `npm run smoke`: PASS — 4 viewports, min SVG descendants 2018, 0 pageerrors, 0 console errors.
- Node-safe import scan: PASS — public `.mjs` files in `src/systems` and `src/utils` do not import UI/store/i18n `.js` paths.
- `git diff --check`: PASS — no whitespace errors; line-ending warnings only.
- Touched + untracked secret scan: PASS — assignment/private-key/token-shape scan found no credentials.
- `/review` 2026-07-04 targeted package/API tests: `npx vitest run tests/statusCore.test.js tests/portableCoreManifest.test.js tests/statusRuntime.test.js tests/agentStatusSnapshot.test.js` PASS — Test Files 4 passed; Tests 30 passed.
- `/review` 2026-07-04 build/package checks: `npm run build` PASS; `node scripts/bundle-budget.mjs` PASS — 494,987 bytes / 495,075 limit; `npm run smoke:pack` PASS — all pack assertions passed.
- `/review` 2026-07-04 changed-file secret scan: PASS — 118 changed files scanned, no credential/private-key/token-shape hits.
- `/review` 2026-07-04 generic normalizer probe: `normalizeAgentStatusUpdates({ status: 'working' })` returns a fake `agentId: 'status'`; `normalizeAgentStatusUpdates({ agentId: 'frontend', status: 'working' })` returns fake `agentId` and `status` agents.
- `/review` 2026-07-04 package exports probe: package self-resolution reports `ERR_PACKAGE_PATH_NOT_EXPORTED` for `agent-virtual-office/server.mjs`, `agent-virtual-office/bin/cli.js`, and `agent-virtual-office/public/hooks/office-status-hook.js`; `import 'agent-virtual-office/src/systems/store.js'` and `import 'agent-virtual-office/src/utils/normalizePost.js'` fail under Node because `./src/*` exposes ESM-syntax `.js` files inside a `type: commonjs` package.
- `/review` 2026-07-04 deep normalizer probe: shorthand keys that sanitize differently from their raw key are lost or duplicated — `{ ' reviewer-2 ': 'blocked' }` yields `[]`, and `{ 'reviewer-2': 'working', ' reviewer-2 ': 'blocked' }` yields two `reviewer-2` updates, both `working`.
- `/review` 2026-07-04 movement clamp probe: `clampToFloor({ x:15, y:450 })` returns `{ x:15, y:450 }` still inside `coffeeMachine`; `clampToFloor({ x:472, y:450 })` returns `{ x:466, y:450 }`, off-floor.
- `/review` 2026-07-04 aggregate surface probe: dynamic import comparison found `PORTABLE_CORE_CAPABILITIES[*].aggregate === true` does not mean full direct-subpath exports are present in `status-core` (examples: `./ambient-sound-model` 18 missing direct exports, `./pet-state-model` 14, `./workflow-handoff-model` 5).
- `/review` 2026-07-04 minor boundary probes: `activityFeedEntries([{id:1},{id:2}], {max:-1})` returns one row; `buildExternalStatusEntry(null, {agentId:'dev'}, 1000)` returns an entry with `status: undefined`; `timeEventDecision({hour:15}, {day:5,lastTriggeredHour:15})` suppresses Friday 15:00 events.

---

## Review Feedback

- P1: `src/utils/activityFeedLabel.js` and `tests/activityFeedLabel.test.js` are untracked while imported by tracked UI files; include or remove them before ship.
- P1: `output/product-audit-2026-07-02/` is untracked review evidence and is not ignored; keep evidence local or add an ignore rule so product code stays clean.
- P2: `activityFeedMessage` uses an over-broad `hook|capture|status` classifier; replace with explicit known artifact patterns and add negative tests for ordinary `status` / `*-status-report.md` messages.
- P2: first-run setup hint is still visually weak in screenshot `16-bottom-rail-declutter.png`; improve contrast/position/width before product ship.
- Resolution 2026-07-02 /implement review-fix: `.gitignore` now ignores local audit output; `activityFeedMessage` uses explicit artifact classifiers with negative tests for ordinary status text/notes; setup hint contrast/width/opacity improved and verified by Playwright screenshot. Remaining action before commit: include the two new source/test files in the commit scope.
- P1: Classification/gate drift — Work Log still says `quick-win` while the current review target is a public package/API portability surface (`package.json` exports + 34 subpaths + 118 changed files). Reclassify to at least `feature`, run the required review/test/red-team path, and update Work Log gates before merge.
- P1: `src/utils/statusContract.mjs:148` / `:157` — `normalizeAgentStatusUpdates()` treats any non-reserved top-level key as an agent id. Repro: `{ status: 'working' }` fabricates agent `status`; `{ agentId: 'frontend', status: 'working' }` fabricates `agentId` and `status` agents. Reserve metadata keys such as `status`, `agentId`, `id`, `role`, or require the typed `office-status` shape for full objects, then add negative tests.
- P2: `package.json:6` / `:42` — adding an `exports` map hides previously resolvable package subpaths (`server.mjs`, `bin/cli.js`, `public/hooks/office-status-hook.js`), while `./src/*` exposes `.js` ESM sources that fail in bare Node under `type: commonjs`. Decide the supported compatibility contract: explicitly export legacy public assets or remove/narrow the wildcard to node-safe `.mjs` paths.
- P2: `src/systems/agentStatusSnapshot.mjs:82` — reusable snapshot `activeCount` counts every non-idle status, including `done`, but existing transport/session contracts count live statuses only (`working`, `blocked`, `planning`, `awaiting-approval`; see `src/utils/statusContract.mjs:88`, `src/server/scanSessions.mjs:184`, `tests/normalizePost.test.js:25`). Align naming/semantics or expose a separate presence count.
- P2: `src/utils/statusContract.mjs:152` / `:158` — shorthand generic IDs are sanitized before lookup, then looked up with the sanitized id instead of the original raw key. Repro: `{ ' reviewer-2 ': 'blocked' }` drops the update; `{ 'reviewer-2': 'working', ' reviewer-2 ': 'blocked' }` emits duplicate `reviewer-2` rows and loses `blocked`. Keep raw key + sanitized id together and dedupe sanitized IDs.
- P2: `src/systems/movementLayoutModel.mjs:204` — exported `clampToFloor()` does not guarantee the renderer-facing "standable" invariant. Repro: `{x:15,y:450}` remains inside `coffeeMachine`; `{x:472,y:450}` pushes to `{x:466,y:450}`, outside any floor zone. Either fix the clamp/retry order or document/export a stricter safe-standing helper.
- P3: `src/systems/portableCoreManifest.mjs:4` — `aggregate: true` is ambiguous: many direct subpath exports are intentionally absent from `status-core` (e.g. ambient sound constants/helpers, pet helper functions, workflow transition helpers). Rename the flag or add manifest fields that distinguish "has some aggregate exports" from "fully aggregated".
- P3: `src/systems/activityFeedModel.mjs:34` — negative `max` uses raw `Array.slice(0, max)`, so `{max:-1}` returns all but the last row instead of zero rows. Clamp `max` to `>= 0` for public API predictability.
- P3: `src/systems/statusRuntime.mjs:10` — `buildExternalStatusEntry()` accepts missing/invalid `update.status` and emits an entry with `status: undefined`. If this is a public helper, validate/degrade status or state clearly that callers must pass normalized updates.
- P3: `src/systems/timeEventModel.mjs:41` — `lastTriggeredHour` is hour-only, so a consumer that persisted `15` across sleep/day boundaries suppresses Friday 15:00 `tea-break` + `group-meeting`. Consider a day+hour marker or documenting that callers must reset it daily/after sleep.

---

## Resume

- State: SHIPPED — Phase-1 merged to main; Phase-2 parked (ADR-009).
- Decision (2026-07-04, owner Option A): Phase-2 in-repo portability layer does NOT enter AVO; ship Phase-1 UI polish only; reusable core deferred to a clean-room NEW repo when a consumer firms up. Findings F1–F9 need NO fix in AVO (their code is parked); they are preserved in ADR-009 for the future extraction.
- Completed: full review of codex Phase-2 self-review (all findings confirmed real, F5 remedy caveat); `codex/product-action-strip-phase1` cut + verified green (build/2251 tests/smoke); ADR-009 committed; **PR #196 opened, CI 7/7 green, squash-merged to main as `dacb682` (2026-07-04); head branch deleted.** PR #195 left OPEN+draft as the parked Phase-2 reference with an explanatory comment; work log + SSoT ADR Index + memory updated.
- Next: none (task complete). Future: when a real consumer firms up, do the clean-room extraction in a NEW repo per ADR-009, applying F1–F9 fixes; PR #195's `.mjs` decomposition is the starting material.
- Context: The branch is intentionally additive and renderer-agnostic, but the current diff is now a public package/API feature surface rather than a quick-win. App hot paths remain local when importing public `.mjs` package wrappers would risk bundle size or CommonJS/ESM semantics; parity tests guard the duplicated contracts.

### Read Map (for next agent)

Files the next agent MUST read:
- `docs/reviews/2026-07-04-portable-core-review-handoff.md` → full
- `.agentcortex/context/work/codex-product-action-strip.md` → latest goal-loop evidence and Resume
- `package.json` → `exports`
- `src/systems/portableCoreManifest.mjs` → full
- `src/systems/statusCore.mjs` → public aggregate exports
- `scripts/pack-smoke.mjs` → library import assertion and export drift check

### Skip List

Files the next agent can SKIP:
- `output/product-audit-2026-07-02/` — local audit evidence is ignored and not part of final package/API review.
- Historical shipped specs outside package/API portability — useful for provenance only, not needed for final review.
- Generated tarballs/temp pack-smoke directories — not part of the worktree.

### Context Snapshot (≤ 200 tokens)

PR #195 is green but NOT READY after 2026-07-04 review. Main blockers: stale quick-win classification for public package/API scope; `normalizeAgentStatusUpdates()` can fabricate agents from metadata keys and drops/duplicates sanitized shorthand ids; package exports compatibility needs a decision; snapshot `activeCount` includes `done`; movement `clampToFloor()` can return off-floor/on-obstacle points. Bundle headroom is tight.

### Backlog Status

- Active Backlog: `docs/specs/_product-backlog.md`
- Current Feature: portable core/API extraction for final review
- Remaining: fix P1/P2 review findings before another final review
- Next Recommended: review PR #195, then merge if no P1/P2 findings remain
