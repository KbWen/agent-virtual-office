# Project Current State (vNext)

- **Project Name**: Agent Virtual Office
- **Project Intent**: Build a self-managed Agent OS for Codex Web / Codex App / Google Antigravity to reduce human procedural burden and continuously lower token costs.
- **Core Guardrails**:
  - Correctness first: No claim of completion without evidence.
  - Small & reversible: Prioritize small, reversible changes; avoid unauthorized refactoring.
  - Document-first: Core logic or structural changes require a Spec/ADR first.
  - Handoff gate: Non-`tiny-fix` tasks must produce a traceable handoff summary.
- **System Map**:
  - Global SSoT: `.agentcortex/context/current_state.md`
  - Task Isolation: `.agentcortex/context/work/<worklog-key>.md`
  - Active Work Log Path: derive <worklog-key> from the raw branch name using filesystem-safe normalization before any gate checks.
  - Workflows & Policies: `.agent/workflows/*.md`, `.agent/rules/*.md`
- **Last Updated**: 2026-06-13T08:30:00Z
- **Update Sequence**: 88
- **ADR Index**:
  - docs/adr/ADR-001-vnext-self-managed-architecture.md — vNext self-managed AI architecture
  - docs/adr/ADR-002-multi-worktree-session-design.md — multi-worktree session isolation design
  - docs/adr/ADR-003-status-source-parity-for-codex.md — status-source parity for Codex
  - docs/adr/ADR-004-no-per-frame-agent-separation.md — AVO-144 resolved by decision: per-frame separation rejected (3-lens panel); re-open conditions recorded
  - docs/adr/ADR-005-no-user-drag-to-move-agents.md — AVO-142 rejected by decision: user drag-to-move rejected (4-lens panel unanimous); position=state honesty; interaction redirected to AVO-158 Poke; re-open conditions recorded
  - .agentcortex/adr/ADR-001-vnext-self-managed-architecture.md — framework scaffold mirror of ADR-001
- **Active Backlog**: `docs/specs/_product-backlog.md`
  - 15 features across 5 themes: 辦公室生命感、資訊密度、互動性、整合延伸、視覺升級
  - **Done (branch `fix/agent-inspector-hooks-crash`, 2026-04-02)**:
    - #10 smart file routing (fileToRole in hook)
    - #11 multi-worktree (session slug files, 1-per-session merge)
    - #12 webhook endpoint (/api/event, 11 events + custom)
    - Designer character (pink female, design corner, poetic bubbles)
    - Skill-aware hooks: Stop/UserPromptSubmit/subagent skill context
    - Compound skill routing (eng_review→arch, ceo-review→gate, etc.)
    - Review P0/P1 fixes (event validation, project scoping, dead cache)
    - AgentCortex upgraded to v5.4.0
  - **Done (branch `claude/condescending-raman-1e48a0`, 2026-05-16)**:
    - #1 角色成長系統 — deskItemCount daily reset, 4-level growthLevel(), % 6 bug fixed, shouldCount gate
    - #7 可點擊辦公室物件 — all three objects clickable (coffee machine→tea-break, whiteboard→eureka, deploy button→deploy-success); shipped in v0.10 (5b79616), closure-documented 2026-05-16
  - **Done (branch `main`, 2026-05-29)**:
    - #6 底部效能指標 — `dailyBlockedLedger` transition counter parallel to `dailyDoneLedger`; ControlPanel Full + Panel chip `✓N / ✗M` with i18n + sr-only + tooltip
    - #14 天氣系統 — `moodToWeather()` pure mapping + `WeatherOverlay` SVG (rain/cloudy/thunderstorm); WallWindow weather prop wired to `store.mood`; reducedMotion drops animations; lightning capped 0.35/5s for photosensitivity safety
    - #15 白板手寫動畫 — confirmed pre-existing (`PixelOffice.jsx:146` `WhiteboardAnimation`); closure-documented at #14 ship time (similar to #7 pattern)
    - **#A1 classifier foundation** — pure module `src/systems/classify.js` (Tier 0 builtin + Tier 3 W3C verb + Tier 4 MCP namespace + Tier 5 unknown) with 90 unit tests; standards-aligned (W3C Activity Streams 2.0 / OpenTelemetry GenAI / MCP spec per panel discussion). Foundation only — downstream wiring is #A2.
    - **#A2 classifier wiring** — `store.applyExternalStatus` now falls back to `familyToBehavior(classifyTask(task).family)` for non-built-in tasks; `moodToWeather` delegates to `classifyMood(mood).family`. Bash/Read/Grep/Glob keep byte-identical behavior (regression-tested); MCP / verb-classified / unknown tasks now get family-appropriate animations (`writeFile`→writing-notes, `authenticate`→shield-verify, `dispatchJob`→gantt-chart, etc.). Bundle +6 KB raw / +2.4 KB gzip.
    - **#A2.1 role-aware classifier** — added `classifyRole`, `classifyWorkflow`, `decideBehavior` 4-priority resolver (status > workflow > role > family-default). Drove `store.applyExternalStatus` to use it. Same tool now produces different animations based on role + active workflow phase: `qa+Bash`→magnifier, `ops+Bash`→deploy-button, `gate+Bash`→shield-verify, `designer+Edit`→whiteboard, `pm+Write`→gantt-chart, `dev+Bash` during `/test`→magnifier, `dev+Bash` during `/ship`→deploy-button. dev role keeps zero overrides → all prior tests stay green. Driven by feedback "don't classify too casually" (saved as memory).
    - **#A3 unknownLog (self-improving classifier)** — `src/systems/unknownLog.js` aggregates Tier 5 unknown task/status/mood/role/workflow raws into dev-mode buckets (capped 200/kind). Exposes `window.__office_unknownLog` + `window.__office_logUnknowns()` for DevTools inspection. Production: zero-cost via `import.meta.env.PROD` gate. LangSmith-style — high-frequency unknowns reveal what needs Tier 0 promotion.
    - **#8 桌面通知** — `src/inference/desktopNotifier.js` 5s-poll loop; fires browser Notification when an agent stays blocked ≥30s + tab hidden + permission granted. Per-episode dedupe via `office-blocked-<id>` tag; transition out of blocked resets dedupe. ControlPanel 🔔 button requests permission on user gesture. Full i18n in en + zh-TW.
    - **#C idle-gap inference** — `src/inference/idleGapInfer.js` closes Pixel Agents' admitted heuristic gap. Conservative thresholds (working+45s gap → thinking; blocked+90s gap → awaiting-approval) injected back through `applyExternalStatus(source: 'idle-gap-infer')` so they pass through `decideBehavior` + `classifyStatus`. Inferred statuses already pre-registered in classify.js STATUS_TABLE since #A1. lastUpdatedAt stamped via zustand subscription on status/task signature changes only (not position ticks).
    - **2 follow-up fixes from spawned chips** — (a) moodEngine `pushEventBatch([])` now strict no-op (`if (added > 0)` gate) so empty batches can't accidentally flip mood→idle; (b) classifyTask Tier 4 (MCP namespace) now bubbles the inner verb's family up — `mcp__notion__create_page` → CREATE → writing-notes, `mcp__notion__delete_page` → DELETE (high severity), `mcp__atlassian__search_*` → SEARCH → research. EXTERNAL fallback retained for MCP tools with no inner verb match.
    - **#27 CSP compatibility** — weather `@keyframes` moved from inline `<style>` (CSP violation under strict `style-src 'self'`) to bundled `src/index.css`. Production JS now has 0 `@keyframes`. README troubleshooting expanded with CSP guidance.
    - **Session wrap-up** — backlog rotated (73 shipped items moved to `docs/specs/_shipped-log.md`); fresh backlog with 15 new AVO-101..AVO-115 items (Plan-mode viz, handoff arrows, token meter, MCP tool inventory, OT GenAI export, etc.); `CHANGELOG.md` summarising the whole session; README architecture tree + tech highlights refreshed with new modules (classifier, desktopNotifier, idleGapInfer, weather overlay); WeatherOverlay clipPath `<defs>` wrappers removed (12→1 DOM nodes saved during active weather).
    - **AVO-105 handoff arrows** — `src/inference/workflowHandoff.js` watches `activeWorkflow`; on 7 mapped phase transitions (`/spec-intake→/spec`, `/spec→/plan`, `/plan→/implement`, `/implement→/test`, `/implement→/review`, `/test→/review`, `/review→/ship`) fires `addHandoff(from, to, {subtle: true})`. `FlyingDocument` gained `subtle` prop — workflow handoffs render the calm variant (no sparkle, 60° rotation, no scale pulse) per "畫面清楚好懂、不過分花俏" brief; organic officeLife handoffs (subtle: false) keep the original flashier 360° + sparkle. Re-entrant bug caught in live preview (zustand sync subscription) and pinned as test.
    - **AVO-103 tool inventory label** — `AgentCharacter.jsx` `TaskLabel` SVG component subscribes per-agent to `externalStatus[id]?.task` and renders `classifyTask(task).visualLabel` in a 7px monospace pill at y=-29 (below name tag, above head). Built-ins show concise names (`Bash`, `Read`, `Edit`, `Notebook`, `Plan`); MCP tools collapse via inner-verb bubble-up (`mcp__notion__create_page` → `notion::create`). Live-verified during implementation against real Claude Code hook events: dev showed `Claude_Preview::preview_eval` for an MCP tool call, ops showed `Bash` for shell commands, qa/designer showed `Edit` for file edits.
    - **Session closure** — final retro at `docs/reviews/2026-05-29-session-retro.md` (snapshot, not authoritative). 27 commits ahead of `origin/main`, 0 behind. `main` branch is the canonical state; `_product-backlog.md` lean (14 items: AVO-101..AVO-115 minus done + #20 deferred); `_shipped-log.md` holds 73 prior shipped rows; vitest 960/960; build 887ms clean. All work-log archives in place + INDEX.jsonl up to date. Push to origin pending human confirmation.
  - **Branch status**: All feature branches closed/merged. main is HEAD.
- **Spec Index**:
  - [maintenance] docs/specs/engineering-audit-remediation.md [Draft]
  - [feature] docs/specs/agent-inspector-info-enhancement.md [Shipped]
  - [architecture] docs/specs/codex-status-parity-and-done-count.md [Shipped]
  - [feature] docs/specs/character-growth-system.md [Shipped]
  - [feature] docs/specs/clickable-office-objects.md [Shipped]
  - [v1.1.0 classifier] docs/specs/classifier-foundation.md [Shipped]  *(#A1)*
  - [v1.1.0 classifier] docs/specs/classifier-wiring.md [Shipped]  *(#A2 + #A2.1)*
  - [v1.1.0 classifier] docs/specs/classifier-unknown-log.md [Shipped]  *(#A3)*
  - [v1.1.0 classifier] docs/specs/mcp-inner-verb-fix.md [Shipped]  *(MCP follow-up)*
  - [v1.1.0 visual] docs/specs/perf-metrics-chip.md [Shipped]  *(#6)*
  - [v1.1.0 visual] docs/specs/weather-system.md [Shipped]  *(#14 + #15 closure)*
  - [v1.1.0 visual] docs/specs/tool-inventory-label.md [Shipped]  *(AVO-103)*
  - [v1.1.0 visual] docs/specs/workflow-handoff-arrows.md [Shipped]  *(AVO-105)*
  - [v1.1.0 inference] docs/specs/desktop-notifications.md [Shipped]  *(#8)*
  - [v1.1.0 inference] docs/specs/idle-gap-inference.md [Shipped]  *(#C)*
  - [v1.1.0 compatibility] docs/specs/csp-compatibility.md [Shipped]  *(#27)*
  - [vibe-rebalance] docs/specs/ux-vibe-rebalance.md [Frozen]  *(AVO-126/127/128/129/131/132 — branch feat/ux-vibe-rebalance, not yet merged)*
  - [living-office] docs/specs/living-office-events.md [DRAFT, review-gated]  *(P1-P4 shipped to branch feat/ux-vibe-rebalance, not merged; AC-3 pixel-dominance pending owner visual confirm)*
  - [subagent] docs/specs/subagent-helper-huddle.md [Frozen]  *(SubagentStart→helper sprites; shipped)*
  - [vibe-rebalance] docs/specs/control-bar-reduction.md [Shipped]  *(AVO-130 / #116 — 4 health pills→1 expandable health dot; lang/run/view/help/platform demoted into ⚙ menu / info popover)*
  - [real-ai-behavior] docs/specs/skill-activation-badge.md [Shipped]  *(AVO-104 / #30 — transient skill bubble on SubagentStart via existing bubble cap (working-tier); panel Option B, honest no-over-head-element)*
  - [game-feel] docs/specs/event-juice-pass.md [Shipped]  *(AVO-136 / #117 — rare-event juice: deploy confetti + eureka sparkle + desk-slam local shake; pure juiceForEvent resolver, reduced-motion-safe, never occludes status)*
  - [multi-agent] docs/specs/review-gate-waiting.md [Shipped]  *(AVO-107 / #112 — honest reframe: gate-desk "waiting" in-tray driven by awaiting-approval only; no queue/type fabrication; complements AVO-105 arrows; panel-decided)*
  - [brand] docs/specs/office-theme-selector.md [Shipped]  *(AVO-123 / #41 — lightweight overlay-grade theme tint beneath status layer; Default/Winter/Autumn light tints; contrast-guarded; Dark/Retro/Cyberpunk deferred)*
  - [ci-infra] docs/specs/sim-soak-gate.md [Shipped]  *(AVO-157 — nightly world-invariant soak: teleport/stack/frozen/off-floor; test-the-test 11 pins)*
  - [office-runtime] docs/specs/standing-overlap-deconfliction.md [Shipped]  *(AVO-156 — standing-stack五層根因: isWalking lifecycle + door jitter + journeyTarget + ellipse spacing + arrival nudge; live A/B 12→0 events)*
  - [game-feel] docs/specs/office-pet-barometer.md [Shipped]  *(#39 / AVO-121 — signal-driven office pet)*
  - [office-runtime] docs/specs/blocked-reason-tags.md [Shipped]  *(AVO-110 / #29 — honest-narrow blocked-reason badge; reasonCode contract)*
  - [office-runtime] docs/specs/recurring-failure-detection.md [Shipped]  *(AVO-117 — recurring blocked-reason detection; downstream of AVO-110)*
  - [multi-agent] docs/specs/pair-programming-huddle.md [Shipped]  *(AVO-106 — co-editing pair OVERLAY (desk-to-desk link); per-agent activeFile, edit-only; redesigned from a huddle per expert panel)*
  - [ci-infra] docs/specs/ci-render-smoke.md [Shipped]  *(AVO-145 / hardening-wave H1 — blocking render-smoke gate; AC-6 test-the-test proven)*
  - [data-path] docs/specs/status-field-schema-unification.md [Shipped]  *(AVO-146 / hardening-wave H2 — AGENT_CARRY_FIELDS canonical schema; 9-site map; drift-guarded)*
  - [hook-io] docs/specs/hook-status-write-lock.md [Shipped]  *(#20 / hardening-wave H3 — bounded-wait RMW lock; multi-process proof)*
  - [office-runtime] docs/specs/structured-error-reasons.md [Shipped]  *(AVO-148 / hardening-wave H5 — event-driven permission-denied / api-rate-limit / api-auth-failed)*
  - [ci-infra] docs/specs/npm-pack-install-smoke.md [Shipped]  *(AVO-151 / stability-wave W3 — pack→install→setup/hook/boot smoke gate)*
  - [ci-infra] docs/specs/transport-spine-e2e.md [Shipped]  *(AVO-150 / stability-wave W2 — 19-case real-server API e2e; HOME-override isolation)*
  - [hook-io] docs/specs/hook-runtime-contract.md [Shipped]  *(AVO-153 / stability-wave W4 — live-captured fixtures + 143 contract tests; found the tool_response/tool_result divergence → AVO-154)*
  - [game-feel] docs/specs/cozy-micro-interactions.md [Shipped]  *(AVO-125 / chill-fun wave — night desk-lamp halos beneath the status layer; status-tinted monitor glow DROPPED on honesty (desk-fixed glow vs walking agents))*
  - [game-feel] docs/specs/ambient-soundscape.md [Shipped]  *(AVO-122 / chill-fun wave — off-by-default 0-KB procedural Web Audio; clatter∝teamPulse (silent@0) + double-gated rain; coffee gurgle DROPPED on honesty (tea-break is a clock event))*
  - When reading specs: only open files tagged with the current task's module.
- **Canonical Commands**:
  - `/spec-intake`: Import external specs (from other LLMs, documents, or natural language). Handles large product specs via decomposition. Runs before `/bootstrap`.
  - `/bootstrap`: Task initialization & classification freeze.
  - `/plan`: Define target files, steps, risks, and rollback.
  - `/implement`: Execute implementation only when `IMPLEMENTABLE`.
  - `/review`: Check AC alignment & scope creep.
  - `/test`: Report test coverage via Test Skeleton.
  - `/handoff`: Output resumable state summary (mandatory for non-tiny-fix).
  - `/decide`: Record key decisions with reasoning to prevent cross-session re-derivation.
  - `/test-classify`: Auto-select test depth and evidence format based on task classification.
  - `/ship`: Consolidate evidence and update/archive state.
  - `ask-openrouter`: [OPTIONAL] External model delegation (natural language or `/or-*` commands). See `.agent/workflows/ask-openrouter.md`.
  - `codex-cli`: [OPTIONAL] Codex CLI delegation. See `.agent/workflows/codex-cli.md`.
- **References**:
  - `AGENTS.md`
  - `.agent/rules/engineering_guardrails.md`
  - `.agent/rules/state_machine.md`
  - `.agentcortex/docs/CODEX_PLATFORM_GUIDE.md`
  - `.agentcortex/docs/guides/token-governance.md` *(manual-only — do NOT auto-read during bootstrap or phase entry)*
  - `.agentcortex/docs/guides/context-budget.md` *(manual-only — do NOT auto-read during bootstrap or phase entry)*

> [!NOTE]
> This file is the Single Source of Truth for global project context only.
> Do not store per-task progress here; write progress to `.agentcortex/context/work/<worklog-key>.md`.

## Global Lessons (AI Error Pattern Registry)
>
> Structured format:
> `- [Category: <tag>][Severity: <HIGH|MEDIUM|LOW>][Trigger: <normalized-trigger>] <lesson>`
>
> `/implement` reviews active HIGH-severity lessons before code changes. `/retro` may append new structured entries via guarded write.

- [Category: global-memory][Severity: MEDIUM][Trigger: archive-handoff][prev: GENESIS] Branch-local lessons are lost after archival. Use the Global Lessons registry for repeatable patterns that should survive work log rotation.
- [Category: format-safety][Severity: HIGH][Trigger: apply-patch-line-numbers][prev: 80ca8332] Do not copy line numbers from view tools into edits; they corrupt file patches.
- [Category: path-safety][Severity: HIGH][Trigger: bulk-rename][prev: fdff36cc] Validate for accidental double-prefix replacements like `agentcortex/agentcortex/...` immediately after bulk path rewrites.
- [Category: wrapper-validation][Severity: MEDIUM][Trigger: wrapper-validation][prev: b02467e3] Wrapper checks should assert behaviorally equivalent path construction, not only one literal path string.
- [Category: shell-portability][Severity: MEDIUM][Trigger: cross-platform-validation][prev: c093febc] Cross-platform validation entrypoints should prefer portable `grep`-style checks over environment-specific `rg` assumptions.
- [Category: worklog-contract][Severity: HIGH][Trigger: branch-normalization][prev: 7d3ebcee] Resolve filesystem-safe work log keys from raw branch names before gate checks; missing active logs are recoverable, but missing evidence is not.
- [Category: patch-fallback][Severity: LOW][Trigger: apply-patch-instability][prev: 0d81c21e] When `apply_patch` is unstable on this Windows workspace, use tightly scoped whole-file rewrites only for new or text-only files, then immediately re-verify with `git diff --check`.
- [Category: detector-validation][Severity: MEDIUM][Trigger: integrity-baseline][prev: bcf3b211] Validate new integrity checks against real repo bytes before baselining, or pure-LF files may be misclassified as mixed EOL.
- [Category: shell-dependency][Severity: HIGH][Trigger: validation-runtime-dependency][prev: 18be92af] Cross-platform validation entrypoints must not add new hard runtime dependencies unless the migration path is documented.
- [Category: path-separation][Severity: HIGH][Trigger: framework-path-migration][prev: b8dcf50e] Downstream-facing artifacts such as specs and ADRs must stay in project-visible `docs/` paths, not hidden framework directories.
- [Category: review-process][Severity: LOW][Trigger: multi-role-review][prev: a9f0a54f] Different reviewer personas catch different failure classes; multi-role review is useful for high-risk template changes.
- [Category: guard-placement][Severity: HIGH][Trigger: write-path-guard][prev: d5689fc7] Place guardrail rules where all relevant classifications read them, not only in documents that some tiers skip.
- [Category: packaging][Severity: MEDIUM][Trigger: dependency-presence-check][prev: 9da72f26] An installed package's CLI launcher must detect its own runtime deps via `require.resolve(dep, {paths:[root]})` (honors npm hoisting to a parent node_modules), not `fs.existsSync(root/node_modules/<dep>)` — the latter always misses hoisted deps and re-runs `npm install` on every launch.

- [Category: verification][Severity: HIGH][Trigger: green-tests-hide-defects][prev: 0d9a1cd6] A full green suite + clean build can still hide HIGH correctness/honesty defects: a fresh adversarial reviewer (review.md freshness invariant — diff+spec only, no implementer rationale) caught a regex word-boundary that leaked colon/dot-suffixed inputs AND a 4th/5th data-path whitelist silently dropping a new field, both invisible to 1385 passing tests. For truth/data features: a fresh reviewer is mandatory, and 'trace the new field through EVERY normalizer/whitelist' must be an explicit review item.
- [Category: honesty-design][Severity: MEDIUM][Trigger: adversarial-reason-taxonomy][prev: 6dcab086] When designing a classifier/taxonomy that asserts meaning to users, run an adversarial honesty audit per proposed category BEFORE building — it refuted 6 of 7 candidate reasons here (over-claiming a specific cause from a coincidental signal). Default every category to refuted/unknown until a real observable signal proves it; ship the honest 'unknown' floor as the load-bearing default (mirrors the pet hide-on-blocker guarantee).
## Protected Surfaces (layout/movement/scale-critical — DO NOT casually edit)

> These have caused repeated visual regressions. `preview_screenshot` is BROKEN here and `preview_eval`
> CANNOT reach the running app's store (module duplication) — so an AI **cannot see pixels**. Before
> changing ANY of these, verify by `getBoundingClientRect`/computed-font measurement across window
> sizes AND get OWNER VISUAL CONFIRMATION. Never claim a visual change "works" from code/tests alone.

- **Office viewBox `0 0 800 560` + width-fill layer** (`PixelOffice.jsx` svgElement: `aspect-ratio:800/560`, center, clip) — the responsive proportion. Owner requires fill-width, no L/R whitespace, no crop of agents. Changing risks re-breaking proportions.
- **`movementSystem.js` agent coordinates / HOME_POSITIONS / MEETING_CHAIRS / event gather spots** (`officeLife.js` EVENT_HANDLERS) — hardcoded. Tight gather spots caused an all-agent pile-up (sprites stack → SVG occlusion hides the lower one). NOW the store (`setMultipleAgentGroupEvents`/`setAgentGroupEvent`) runs every `groupTarget` through `clampToFloor` + `avoidOverlap` (≥`MIN_AGENT_DIST`) so participants can't stack — guarded by `tests/agentSeparationInvariants.test.js`. Keep that deconfliction; don't bypass it by writing `groupTarget`/`position` directly elsewhere. NOTE: there is still NO per-frame separation in free movement (agents pass through each other in transit — AVO-144).
- **`LABEL_SCALE_MAX = 1.5`** (`AgentCharacter.jsx`) — POINT-2-tuned so active name tags don't collide. Raising it improves small-dock readability but risks label collision — owner's call, verify collisions by measuring label rects at a small window.
- **`officeLife.js` event cadence** — real-seed triggers are GLOBAL-cooldown-gated to stay rare (calm-tech); do NOT seed all-gather events (e.g. `standup`) off frequent signals (SubagentStart) — that froze the office in perpetual gathering.
- **Verification reality**: behavioral correctness = the **test suite** (vitest = real modules, no dup). Pixel/visual correctness = **owner only**. `preview_screenshot` must NOT be relied on (hangs).

## Ship History

### Ship-fix-line-hits-rect-epsilon-2026-06-11 (chip task_4be9264a — lineHitsRect 軸向 epsilon 洞)

- Branch `fix/line-hits-rect-epsilon`, quick-win。Chip 由 owner 回貼主對話執行(zone-mouth review 的 reviewer 自行開的 chip)。**既有精度洞**:`lineHitsRect` 對 |dx|≤0.1(或 |dy|≤0.1)的近軸線段只用**起點**做 slab 檢查——x 漂移 <0.1px 跨過家具邊緣平面的近垂直線段被誤判為 miss;jittered Dijkstra 節點據此產生 0.005–0.3px 真實擦邊(隨機 in-rect 對 ~0.3% 率,reviewer 於 main 復現)。視覺上 sub-pixel,但屬種子化尋路 oracle 的潛在 flake 源。
- **修(2 行,保守方向)**:近軸分支改測**兩端點座標範圍**(min/max vs slab)——絕不漏報真相交;≤0.1px 級過度標記只會讓 jitter 候選退回精確節點(該鏈本有的 fallback)。函數 export 供直接單元釘。
- **Tests: 1913 → 1920**:7 釘含兩個 pre-fix 必敗的洞釘(漂移方向不對稱與機制吻合:起點在內側的方向 pre-fix 本來就過)+ 楔形峽谷類「必須仍為 miss」防回歸釘;全部種子化尋路套件(deep 484 對/fuzz 1000 對/楔形矩陣/門廊網格)在更嚴格偵測下全綠。2 分鐘 soak PASS。Tests: Pass

### Ship-chore-semgrep-baseline-gate-2026-06-11 (#126 — Semgrep ERROR 級轉阻擋,baseline 三角化)

- Branch `chore/semgrep-baseline-gate`, quick-win。**確認先行**(semgrep 無法在 Windows 跑):從 main 最新 SAST log 抽出完整 baseline——20 findings = 13 rule×file 組:ERROR×2、WARNING×10 組(全屬設計接受:localhost 傳輸契約、操作者自選路徑、bundled 翻譯表、opt-in CORS allowlist、範例 nginx)、INFO×1。
- **兩個 ERROR 當場解決**:sim-soak.yml dispatch input 改走 `env: SOAK_MINUTES` 間接化(真修);sim-soak.mjs `spawn shell:true` 範圍化 nosemgrep + 理由(Windows npx .cmd shim 需 shell;PORT 為 parseInt 驗證的模組常數)。
- **閘門語意**:security.yml 全掃描維持 report-only + 新增 `--severity ERROR --error` 阻擋 pass;新 ERROR(程式碼或 `--config auto` registry 漂移)按設計 FAIL CI,註解明示「三角化、不放鬆」。Baseline 快照:`docs/reviews/2026-06-11-semgrep-baseline.md`(doc_state: snapshot,13 組處置表)。
- **Evidence**:PR #136 SAST 自證——report pass 18 findings(20→18,兩 ERROR 消失)、**阻擋 pass 0 findings(172 條 ERROR 級規則/407 檔)**;7/7 checks 綠;audit/TruffleHog 未動仍綠。合併後 `gh workflow run sim-soak -f minutes=1` 驗 dispatch 路徑。Tests: Pass

### Ship-chore-dependency-wave-minor-2026-06-11 (#125 依賴維護波 — patch/minor 車道)

- Branch `chore/dependency-wave-minor`, quick-win。依 #125 自身 AC「patch/minor 與 major 分開落地」只做小版本:react/react-dom 19.2.4→**19.2.7**、tailwindcss + @tailwindcss/vite 4.2.1→**4.3.0**、zustand 5.0.12→**5.0.14**。
- **驗收電池全綠**:`npm test` 1913/1913;bundle-budget PASS 455,872 bytes(+1.29% vs 基線;更新本身僅 +1,059 bytes ≈ +0.23pp,基線不動);`npm audit --audit-level=high` 0 漏洞;render-smoke 4-viewport PASS;pack-smoke 全斷言 PASS。
- **Major 拆出**:Vite 8 / Vitest 4 / plugin-react 6 → issue **#134**(三件一起版本配套,遷移指南逐項核對)。#125 於合併時關閉。Tests: Pass

### Ship-fix-door-strip-floor-routing-2026-06-11 (門廊帶地板路由洞關閉 — #27 review Finding 2 後續)

- Branch `fix/door-strip-floor-routing`, quick-win。Chip task_2b246e48 由 owner 回貼主對話執行(驗證無 spawned worktree)。**既有洞**(早於 #132):zone router 的 early-return `[to]` 不驗證線段內部的地板歸屬——`getZone` 把門洞地板點劃進相鄰區(如 door-lounge y 418–424 → lounge),無家具阻擋的斜線直接切穿牆帶(量測 130/720 對 off-floor);五個區全有同型 strip。
- **修(單一接點)**:`ZONE_FLOOR_RECTS` + `zoneMouth` —— on-floor 但在區凸地板矩形外的端點(⇒必在門洞地板上)先走「mouth」(夾至矩形的投影,沿門洞軸、構造上必在門洞地板),內部 router 只在凸矩形內運作(其「家具矩形驗證即足夠」的凸性假設恢復成立)。in-rect 與 off-floor 輸入 byte-identical 保留。
- **Fresh review PASS(窮舉級)**:0.25px 全畫布網格 101,332 個矩形外地板點 → 0 個壞 stub、0 個真實地板雙軸 clamp;1,537 對 in-rect 差分探針與 HEAD byte-identical;门側錨點 ±jitter 全數在矩形內(mouth 絕不在跨區腿觸發);496k 對 fuzz 僅 1 命中＝**既有** `lineHitsRect` 軸向 epsilon 洞(~0.3px 擦邊,main 上可復現)→ chip task_4be9264a。
- **Tests: 1913**(門廊帶網格解除 Finding-2 守衛恢復全配對 + 六區 strip 釘;修復前 2 測試 FAIL 四個區證敏感度)。2 分鐘 soak PASS(471 樣本 0 違規)。Tests: Pass

### Ship-fix-wedged-endpoint-routing-2026-06-11 (issue #27 — 楔形端點路由加固,fuzz 盲區帶關閉)

- Branch `fix/wedged-endpoint-routing`, quick-win。Owner:「先確認問題→再處理」。**確認先行**:種子化探針證實 #27 是真缺陷且觸及日常路徑——楔形距 1–7px 穩定產生 ~5% 穿桌路徑(52/880 @d=1),**含 d=6 = `OBSTACLE_PUSH_PX`(`clampToFloor` 的日常輸出距離)**;fuzz MARGIN=8 剛好全帶排除(#27 所述盲區屬實)。根因:桌間峽谷端點從 9 個固定 Dijkstra 節點全部不可達 → `findSafePolyline` null → `routeWithinMainOffice` 最後一招 `[CORRIDORS[2], to]`(自註已知洞)直接穿桌;lounge 單 lane 降柱同型洞。
- **修(永不變差構造)**:(A) `wedgeEscapeNodes` —— 貼身家具四邊法向投影 10px 的逃逸候選,floor/obstacle 過濾後**純增量**加入 Dijkstra 節點集(每條邊仍走原驗證);(B) lounge 改雙 lane(南 520 / 北 430)全驗證圖路由 + **凸地板矩形閘門**,門廊帶端點與圖失敗一律退回原 lane 路徑逐字保留。
- **Fresh review(無實作者敘事)抓到 1 HIGH**:lounge 圖對門廊帶端點(y 418–424,getZone=lounge 但地板僅門洞)發穿南牆斜線,量測 104/720 對新增 off-floor——按 reviewer 最小修法加閘,反例 (218,418.5)→(430,470) ×25 釘住。Reviewer 獨立復現敏感度:HEAD 154/3516 fail → 修後 0/3516。Finding 2(**既有** early-return 門廊帶洞,130/720,新舊相同)→ chip task_2b246e48 追蹤。
- **Tests: 1905 → 1912**(楔形矩陣 d∈{1,2,4,6,7} 修復前 5/5 FAIL 證敏感度 + 門廊帶閘門 2 測試);探針全矩陣 0 違規;2 分鐘 soak PASS(469 樣本 0 違規)。Issue #27 三項 asks 全數回應後關閉。Tests: Pass

### Ship-fix-tech-debt-remediation-2026-06-11 (Codex tech-debt 波接手收尾 — viewport fit + bridge 加固 + routing docs)

- Branch `fix/tech-debt-remediation`, quick-win。**Codex session 實作（額度耗盡）、claude-fable-5 接手收尾**：兩個 commit 落錯分支（local main + 他人分支）→ cherry-pick（保留 Codex 署名）到合法分支重出。
- **`72ff117`（app code）**：#120 `prepublishOnly` 改 build-before-test；#123 bridge UI 自 inline script 抽出為 CSP 相容 `public/bridge-ui.js`（DOM node 取代 innerHTML、移除 inline handlers）+ `tests/bridgeHtmlSafety.test.js` 回歸釘；**full-mode viewport fit 修復**（`preserveAspectRatio="xMidYMid meet"`，800×560 完整入框；owner 截圖回報的裁切回歸）；render-smoke 升級 4-viewport 矩陣 + 垂直裁切斷言。
- **`706cc88`（docs）**：#121 monolith extraction map、#124 silent-catch policy、#127 ARCHITECTURE.md 現況更新、#128 routing_actions 全數 merged。
- **接手修正（`e28b166`）**：audit 檔 frontmatter `status: review` 非法（validator routing_actions 檢查掃全檔 status: 行，僅容 pending|merged|rejected）→ 改 `doc_state: snapshot`（比照 2026-06-05 audit 慣例）。bash validator 此 FAIL 消除。
- **Issue 帳務**：#120/#121/#123/#124/#127/#128 已由 Codex 關閉，本 ship 使其成立；#122/#125/#126 留待後續。研究/issue 整併（#48/#49/#51 併入 #40/#31/#41、新增 #112–#119）為 GitHub 端操作、已 live。
- Evidence: takeover 分支上 `npm test` 1905/1905 綠、build 5.79s 乾淨、routing_actions 掃描零違規；Codex 原 4-viewport smoke + bridge-smoke 證據保留於 work log。Tests: Pass

### Ship-chore-github-seo-aeo-2026-06-11 (GitHub 曝光度 — SEO / AEO / 描述與 topics 優化)

- Branch `chore/github-seo-aeo`, quick-win, docs/metadata-only（README ×2 + package.json + GitHub repo 中繼資料，零 app code）。
- **README en/zh AEO**：各加 6 題直接回答式 FAQ（What is / 怎麼接 Claude Code / 支援 Codex·Gemini CLI·CI / 不是儀表板·不追蹤 token 成本 / 資料不外傳 / 免安裝）＋導覽列 FAQ 連結＋截圖 alt text 關鍵字化。FAQ 措辭全部對齊已出貨行為（signal-driven 誠實、零後端、`--no-host`、Node ≥ 22），守住「不是 cost dashboard」定位。
- **package.json**：description 重寫（關鍵字前置：AI coding agents / Claude Code / Codex / Gemini CLI / pure SVG / zero backend）；keywords 9 → 18（補 claude-code、claude-code-hooks、gemini-cli、ai-agents、coding-agent、llm、developer-tools、svg、react）。
- **GitHub repo（gh repo edit，立即生效、git 外）**：description 換新（🏢 開頭、關鍵字密度提高）；topics 10 → 18（+claude、codex、gemini-cli、anthropic、llm、svg、coding-agents、developer-tools）；`gh repo view` 回讀複驗。舊值已記錄於 work log Evidence 供回滾。
- **留給 owner（UI-only，API 做不到）**：Settings → Social preview 上傳 `docs/screenshot.png`（1280×640）— 社群分享卡片是 GitHub SEO 最大單一槓桿之一。
- Evidence: package.json JSON parse OK；gh 回讀確認 18 topics；diff 僅 3 檔零程式碼。Tests: Pass（docs-only，無程式碼路徑變更）

### Ship-chore-upgrade-agentic-os-v1.5.1-2026-06-11 (governance brain 升級 v1.2.0 → v1.5.1)

- Branch `chore/upgrade-agentic-os-v1.5.1`, quick-win, governance-only（53 檔 +2685/−645，零 app code）。`.agentcortex-manifest` `1.2.0` → `1.5.1`（canonical upstream `KbWen/agentic-os` tag v1.5.1 / `0a75067`）。
- **5 個 upstream-retired skills 刪除**（writing-plans、executing-plans、finishing-a-development-branch、requesting/receiving-code-review；邏輯已內聯進 plan/implement/ship/handoff/review workflows）— git 史證明全部 stock（#32 後零團隊 commit），`.agent/skills/` + `.agents/skills/` 兩處共 10 路徑；operational configs 無懸空引用。GEMINI.md 平台入口新增。
- **Sidecar 處置**：4 個框架持有 skip（AGENTS.md/CLAUDE.md/.gitattributes/.githooks sample）轉正（live 證明為 stock v1.2.0）＋二次 deploy 收斂 manifest hash（`186 updated / 2 skipped / 0 new / 0 removed`）；2 個團隊持有檔保留 live（`current_state.md` SSoT、`.claude/settings.json` office-hook 管線）；31 個 `.acx-local` 備份刪除（內容＝快照 commit `1d18b3a`）。
- **Incident（已完全恢復、零損失）**：`.agentcortex-src` 快取 remote 殘留指向已死 AgentCortex repo（5.x 線）險些部署錯版（owner 即時糾正）；修快取時部分失敗的**未經批准 `rm -rf`** 留下無 `.git` 的鎖死目錄 → 後續 git 指令穿透到主 repo（forced checkout 換掉 working tree、tags 被蓋）。`main` ref 未受損，全量恢復並逐路徑稽核。違反 Destructive Command Blocking（規則只在 non-loaded reference docs — README↔rules drift）；三個 upstream 修正候選已備好 prompt 交 owner（destructive 規則移入 always-loaded 面 / deploy_brain 核對 cache remote URL / manifest LF pin）。
- Evidence: validator `pass=91 warn=3 fail=0`（WARN 全 advisory）；app suite **82 files / 1903 tests 全綠**（含 hook 行為契約測試）。Tests: Pass

### Ship-fix-event-arrival-ellipse-2026-06-11 (owner 回貼雙 chip — 事件到場幾何 + 走廊 fallback 加固，soak 閘門回緊)

- Branch `fix/event-arrival-ellipse`, quick-win。Owner 將兩張 chip 內文回貼主對話（spawned sessions 無產出，已驗證無分支/worktree）。
- **A 走廊 fallback**：`findBestCorridor` 先驗證後抖動卻不重驗——fuzz 爆發观测到的 opsDesk/whiteboard 角削切類；改為抖動候選需通過（地板+家具+雙段）驗證、否則退回精確點；最終 CORRIDORS[2] 中繼文件化＋拷貝（消 aliasing）；死碼 `nearestCorridor` 移除。fuzz 測試全面播種（雙層 RNG 決定化）＋新增「貼角點對」壓力釘（~600 對、每家具角 MARGIN+2）。
- **B 事件到場幾何（夜跑 #2 的 23px 戰果正式關閉）**：兩個 store 鎖點的 occupied 集合原本**只含 in-group agent**——事件演員可被指到「旁觀者」身上（實測 arch 停在 dev 椅旁 23px 整場）。新 `collectClaimedSpots`（解析序 journeyTarget > groupTarget > targetPosition > position）讓單發與批次鎖點都避所有人；**原地反應者**（groupTarget:null）若觸發瞬間與人重疊改給一步側移（R1 安全：pickParticipants 不選 tracked working）；批次內原地者站位也計入 assigned。
- **Soak 閘門回緊**：group 疊站恢復為 FAIL（warnings 桶留在報告形狀）；spec DD3 更新含歷史。**Tests: 1898 → 1903**。本地 3 分鐘 soak PASS（705 樣本 0 違規，spawn-server 路徑）。Tests: Pass

### Ship-fix-research-zone-routing-2026-06-10 (soak 閘門首戰戰果 — research 區避家具走廊)

- Branch `fix/research-zone-routing`, quick-win。**sim-soak 閘門第一次 CI 實跑就抓到真問題**（run 27285671889）：designer 在 research 書櫃 B 內 (657,459) 站立 ≥2s。根因：research 區沒有 zone 內避障路由（lounge 有）——直線段穿書櫃/印表機，走路中途一停頓就站進家具圖裡（寵物穿牆 bug 的 agent 版）。
- **修**：`routeWithinResearch` —— 書櫃底(460)與印表機頂(488)之間的走廊帶 y=472；上升/下降欄位避障感知（印表機站位在機體正下方 2px——直降必穿體）且欄位候選必須留在 research 地板/zone 內（v1 曾把欄位移出西界 x<469，被 clampToFloor 的 zone-snap 拉飛到主辦公室——fuzz 抓到）。
- **Fuzz 烏龍триage**：同輪 5 違規爆發中 3 個（whiteboard/opsDesk 角）為既有未播種 jitter 極稀有洞（fuzz 測試檔頭自註的 corridor-fallback 缺口，≲1/8000）；修後 current/baseline 各 4×1000 對全乾淨 → chip task_47460ed1 追蹤。
- **新釘**：research 區 300 種子對、每 2px 取樣 0 家具命中。**Tests: 1896 → 1897**。CI soak 重派發綠（見 PR）。Tests: Pass

### Ship-feat-sim-soak-gate-2026-06-10 (owner 核准 — 一次性取證工具升級為常駐夜間閘門 + v1.4.0, AVO-157)

- Branch `feat/sim-soak-gate`, quick-win。owner:「以後可能很多類似的視覺改動也會遇到」→ 把 zone-audit/overlap-recorder 的取證能力固化成機器閘門：`npm run soak` headless 跑 N 分鐘斷言世界不變量（I1 持續疊站 ≥3s、I2 瞬移 >48px、I3 站進家具/出界 ≥2s、I4 凍結行走者 ≥90s）+ nightly CI（`sim-soak.yml`，10 分鐘，非 PR 阻擋——穩定後再升級）。
- **判定器是純函數**（`scripts/soakInvariants.mjs`）+ test-the-test 11 釘（每類違規種入必抓、健康時間線必靜默——含 sampler-gap 守衛殺 GAP_SNAP 假陽性、frozen-walker 90s 依恢復層預算推導）。node-CJS 陷阱實戰命中（src/*.js 在 node 端解析為 CJS）→ 幾何判定改在頁內計算。
- **實跑驗證**：2 分鐘 reuse-server PASS（470 樣本 0 違規）+ 1 分鐘 spawn-server PASS（CI 路徑，report JSON 落檔）。
- **v1.4.0 發版**：package.json 1.3.0→1.4.0、CHANGELOG 故事條目（疊圖時代終結 + 量測先行方法論）、README「Diagnostics & soak testing」節。**Tests: 1885 → 1896**。render-smoke PASS。Tests: Pass

### Ship-feat-standing-overlap-deconfliction-2026-06-10 (owner 第三次疊圖 — 站立疊合五層根因一次關閉, AVO-156)

- Branch `feat/standing-overlap-deconfliction`, **feature**（owner:「好好規劃再處理」→ spec `docs/specs/standing-overlap-deconfliction.md`）。**法醫式取證先行**：新工具 `scripts/overlap-recorder.mjs`（12 分鐘、200ms 取樣、疊站事件觸發時 dump 雙方 12 秒狀態鏈）→ 基線 **12 個持續疊站事件 / 189 疊秒，其中 10 件在字面座標 (240,386)**＝lounge 門節點原始錨點；tracked 的 pm 在該節點**凍結橫跨 8 分鐘**。
- **五層根因（RC）/ 五修（F）**：F1 `setIsWalking(false)` 從 animate() 每路點誤清改為僅最終抵達——1.5s rAF 卡頓看門狗從只護第 1 段變全程護航（凍結觸發源）；F2 門錨點每次過門沿門洞軸抖動 ±10（驗證在地板，同 offset 兩側）；F3 `journeyTarget` 入 store（行走終點對所有 picker 可見；arrival/abort/unmount 全清）；F4 圓形 35px → **視覺橢圓 rx32/ry44**（35px 垂直「分離」其實全疊—— #103 幾何教訓全域化）；F5 到站讓位（事件邊緣、一次/旅程、僅 arriver、驗證乾淨才花，ADR-004 合規）。
- **Fresh adversarial review 抓到 HIGH**：v1 avoidOverlap「設定式」水平解算在雙推手（咖啡機+飲水機同 rank）震盪，12.4%/2000 輸出仍重疊（reviewer 數值實證；舊碼 0%）→ v2 徑向橢圓累積推擠＋環搜備援；複核以 **55 萬次** probe（含病態 clamp 角）0 bad 後 PASS。
- **Live A/B（12 分鐘協議）**：12 事件/189 疊秒 → **0 事件**/27.8 秒（殘餘皆 <2s 路過擦肩，ADR-004 接受之 transit 交錯）。**Tests: 1874 → 1885**（雙推手 2000 次回歸釘=0、密集三叢集、門抖動分佈、journey 生命週期）。render-smoke PASS。Tests: Pass

### Ship-fix-calm-rhythm-2026-06-10 (owner 雙問 — 躁動步調 + 為何不去其他房間)

- Branch `fix/calm-rhythm`, quick-win。Owner:「一直走動很躁動」+「都不會去茶水間/Research」。**量測先行**：引擎模擬（20k 樣本）+ 3 分鐘 headless zone-audit（`scripts/zone-audit.mjs`，新診斷工具）。根因 = work pool 內的 **solo `meeting`**：多數角色 1/4 的 work 抽選 ≈ 全部 cycle 的 ~20% 是獨自行軍會議室（實測 pm 單獨佔會議室 30% 時間；畫面 ≥1 人在走 83%、≥2 人 46%），把真正的茶水間行程（~8% cycle、12–25s 停留）完全淹沒——owner 兩個感受是同一個根因。
- **Shipped（純 reduction）**：solo meeting 移出 ambient work pool（officeLife 群體事件仍擁有會議室——合法、有 R1 守衛的管道）；桌面行為 30–65s（原 18–45s）；茶水間停留拉長（transit < dwell，panel 處方）；`WALK_SPEED` 80→60px/s（game-feel panel：80 在 800×560 場景讀作「趕路」）；`WATCHDOG_TIMEOUT` 90→120s（65s 最長行為 + 15s 走路@60 + 15s stuck-slack = 95s 重推導）。
- **雙專家 panel**（game-feel + honesty, Sonnet）：誠實度淨增（working agent 更常在桌前 = 更貼近其真實狀態）；確認無任何 UI/訊號把 `behavior==='meeting'` 當真實狀態讀；dead-office 門檻（0-walker >80%）遠未觸及。
- **Live A/B**（各 702 樣本；post run 含 4 個真實 tracked sessions）：≥1 人在走 83→66%、≥2 人 46→24%、會議室獨走 pm-30%→0、lounge 到訪 1→9 人次（dev 在 lounge 19% 時間）+ res 進了 research（角色對味）。引擎模擬：working 48.7→17.6 walks/h（walk-share 38.5→18.2%）。**Tests: 1871 → 1874**。Tests: Pass

### Ship-fix-social-lateral-bias-2026-06-11 (owner 三疊截圖 — 社交角度側偏 + 兩套件去 flake)

- Branch `fix/social-lateral-bias`, quick-win。Owner 指正夜景截圖是**三個 sprite 疊在 gate**（非僅家具問題）。查證入口**沒有任何事件聚集點** → 機制 = gate 本尊 + 兩個社交拜訪者：均勻 0–2π 拜訪角度讓訪客落在 ~40px 高的 sprite **正上/正下方**——3/4 視角下垂直對齊即使隔滿 70px 環也完全疊住。
- **Shipped**: 拜訪角度改抽 **水平 ±45° 雙錐**（並肩聊天；構造上 |dx| ≥ |dy| → 垂直成列不可能）+ 200 樣本分佈釘。順手 deflake：movementPathingDeep 與 behaviorEngine 加 seeded RNG（無種子下 ~1/500 全套件閃失敗，本輪實際撞到）。
- Review 右尺寸化：3 行幾何 + 構造性證明測試 = self-review（同表面今日已兩度 fresh review）。**Tests: 1870 → 1871**。Tests: Pass

### Ship-feat-social-chat-feel-2026-06-11 (owner 批次 — 聊天感調校 + 家具障礙補全)

- Branch `feat/social-chat-feel`, quick-win。兩件 owner 直接反饋的事一個 PR 收：
- **聊天感（遊戲專家處方 + owner 核准）**：社交趨近 30–45 → **50–70px**（1.4–1.8 個 sprite 寬 =「走到你面前」而非「站進你身體」；3/4 視角的垂直視覺重疊**刻意不消除**——owner:「完全不蓋住也很奇怪」）；**到位轉身面向對方**（之前缺這半邊所以沒聊天感）＋ 對方短暫回望（R1 守衛 `shouldFaceBack`：tracked/inGroup 一律跳過；revert 還原先前朝向）。**SAME-PICK 保證**：implementer первоначально雙抽（走向 B 面向 A，8 人下錯臉率 6/7）→ coordinator 加 `socialTargetOverride` 串同一抽選，並以 2 測試釘住。
- **家具障礙補全（owner 截圖：設計師站進 GATE 櫃台）**：OBSTACLE_RECTS 原來只蓋主辦公區——gate 櫃台（取左 2/3，保留出口巷道；全寬會把 gate 關在自己櫃台後，被測試抓到）、research 三排書櫃、印表機補入；伺服器架（貼牆無逃逸方向）與電話亭（設計上可進入）刻意排除並註記。寵物 segmentWalkable 統一 2px 取樣（picker==複驗，消滅一類潛在 flake）。**新 class-killer 不變量**：所有站立定點必在地板上且不在任何家具內。
- **Review (fresh)**: PASS — same-pick 全鏈追蹤、stale-ref 路徑閉合、R1 守衛、gate 出口線段、slice 索引不受影響；2 個 MED（守衛顯式清 ref、same-pick 補釘）皆當場處理。
- **Tests**: 1840 → **1870** (+21 社交模擬 + 9 家具不變量)。稽核註記：raw under-30 率由走廊交會主導（organic 模式高估），站立疊合已由 50–70px 環 + 不變量結構性處理。Tests: Pass

### Ship-fix-gap-snap-threshold-2026-06-11 (回歸修復 — 我自己的 1.5s 瞬移門檻；owner 不信任直覺命中)

- Branch `fix/gap-snap-threshold`, quick-win. Owner「新版還是有問題/人物不連貫/用不信任的角度」→ **A/B 鐵證**：全新頁面 3 分鐘視覺稽核（250ms DOM transform 取樣）新版抓到 **20 次 89–225px 瞬移** vs **d260827 基線 0 次**（平行 worktree :5174、同機同負載）。根因：GAP_SNAP_MS=1500 把這台機器家常便飯的 1.5–5s 重載渲染卡頓全變成可見瞬移；watchdog 快轉（1.5s 觸發）在可見卡頓路徑做了同樣的事。治凍結堆的藥本身成了「不連貫」病。
- **Shipped**: GAP_SNAP_MS 1500 → **5000**（>5s = 真正的分頁切換 → 歸位瞬移、堆永遠不被看見；1.5–5s = 卡頓 → 恢復原本的平滑滑行）；watchdog 快轉**移除**（重啟即平滑續走）；死代碼清除；+1 jank-range 回歸釘（4.2s gap 必須滑行不瞬移）。`scripts/proximity-audit.mjs` 入庫為常備診斷工具。
- **Review (fresh)**: PASS — 5 情境凍結真值表全數自洽（hidden>5s snap / hidden≤5s glide / 可見卡頓經 gapMs=0 重置必 glide / 可見>5s 競態兩結果皆可接受 / 邊界嚴格大於）。
- **重稽核**：**0 瞬移、maxStep 22px**（合法步速內）。Suite **1840**。Proximity 議題（40–70% 樣本存在 <30px 對）另案：主因是社交行為設計（chat/thumbs-up 走到同事 30–45px 內、sprite 寬 35px）——已呈 owner 決定是否調距。Tests: Pass

### Ship-fix-frozen-walk-pileup-2026-06-11 (owner 回報 bug — 8人只見6人/凍結疊堆)

- Branch `fix/frozen-walk-pileup`, quick-win. 三連報的最深根因。LIVE 量測：pm+dev 距離 0 連續 **96 秒**、isMoving:true、watchdogRestarts=25。機制：**隱藏分頁 rAF 不觸發**（與 preview_screenshot 同根因）→ 使用者切走時所有行進中走路原地凍結（落在共享節點上成堆）→ 切回來第一幀 dt clamp 讓凍結堆「慢慢滑開」——使用者親眼看到的「疊在一起→又分開了」。可見分頁 ≥1.5s 卡頓經 watchdog 重啟也走同樣的滑開路徑。
- **Shipped**: 純函數 `src/systems/walkFrame.js` `stepWalkFrame`（從 RAF 迴圈萃取的逐幀數學；timestamp gap >1500ms → 該腿直接瞬移到位＋視為抵達）；animate() 委派之；watchdog 重啟前先快轉凍結腿再排 RAF。多腿路徑只快轉凍結那一腿，其餘正常行走（每腿 lastTimeRef 歸零）。
- **Review (fresh)**: PASS — 萃取對所有正常滑行 case 逐位元等價（一個 1.5px–step 窗口邊緣 case 嚴格變好：少一幀抵達）；首幀/下一腿/重啟後 gap=0 證明無誤觸；敏感度（GAP=∞ → 測試失敗）。
- **Tests**: 1831 → **1839** (+8 純數學測試，含 pre-fix 差分釘)。實際效果由 owner 日常觀看驗證（切回分頁第一眼應是各就各位）。Tests: Pass

### Ship-fix-shared-node-stacking-2026-06-11 (owner 回報 bug — 角色在共享節點上精確疊合)

- Branch `fix/shared-node-stacking`, quick-win. Owner 截圖（研究員與某人疊合）→ LIVE store 抓到現行犯：pm 與 dev 同在 (300,180)「top aisle center」距離 0。根因：`findSafePolyline`（mainOffice Dijkstra 路由）回傳**精確共享節點座標**（且是共享物件參照本身），而 findBestCorridor/nearestCorridor 早有抖動——同走廊同時段必精確重合。與 ADR-004 否決的 per-frame 推擠不同：這是小組預先祝福的「便宜側偏」緩解，由 owner 回報觸發其 owner-call 條件。
- **Shipped**: route 重建時中途節點抖動候選 ×4（CORRIDOR_JITTER x / ±6 y），候選須在地板上、不在家具內、且**前後兩段皆不撞桌**（鏈式驗證：每段最終線段在其後端點定案時驗證）；全敗回退精確節點（**絕不比現狀差**）；終點永不偏移；路徑改推全新物件（順手關閉共享常數別名風險）。
- **Review (fresh)**: PASS — 鏈式驗證五個 case 全數成立；全域/區域障礙表以範圍證明 + lineHitsRect 端點內含性證無錯配；deep suite ×3 無 flake；敏感度探針（移除抖動 → spread 測試失敗）。
- **Tests**: 1827 → **1831** (+4)。484 條深度尋路矩陣現在每跑都在驗證抖動後的路徑。Owner 視覺確認待補（純美觀判斷：±15px 車道散佈是否自然）。Tests: Pass

### Ship-fix-pet-wall-phasing-2026-06-11 (owner 回報 bug — 寵物一直穿牆)

- Branch `fix/pet-wall-phasing`, quick-win. Root cause: 寵物漫遊帶 (x 80–750) 橫跨多房間、CSS 直線滑行、`clampToFloor` 只驗端點 → 線段中途自由穿牆/穿家具。
- **Shipped**: 純函數 `segmentWalkable`（4px 取樣、依賴注入）+ `pickWanderTarget`（重試 ≤8、全敗 = 原地停一拍——比穿牆更 calm 也更誠實）；OfficePet 接 `isOnFloor && !isOnObstacle`。Review 的 MEDIUM（lounge 右牆口袋區 18px 地板縫 → ~68%/tick 全敗 → 視覺卡頓 ~10s）當場加 **pocket-escape**：連續 2 拍落空改抽近距離短跳（同一條 segment 閘門，永不穿牆）。alert 衝刺刻意不閘（罕見、資訊性；記錄於 Drift Log）。
- **Review (fresh)**: PASS — 10 點舉證全 PROVEN；敏感度（削弱 picker → 500 跳中 372 次穿牆被測試抓到）；口袋逃生 +1 測試（真實地圖 20-tick >15 成功）。
- **Tests**: 1818 → **1827** (+9：樁牆/薄牆/退化輸入/重試暫停/500 seeded 真實地圖 2px 複驗 0 穿牆且 >300 接受/跨房拒絕含地圖變更防衛/口袋逃生)。smoke 綠。Tests: Pass

### Ship-fix-branch-hop-ghost-sessions-2026-06-11 (owner 回報 bug — 角色被拉到畫面上方/消失重現)

- Branch `fix/branch-hop-ghost-sessions`, quick-win. Owner-reported live bugs root-caused: session slug 內嵌 git branch → 換分支後舊 slug 檔殘留（5 分鐘新鮮窗內）→ scanSessions 把同一 checkout 當兩個 session 合併 → composite `slug~role` 幽靈生成在 OVERFLOW 位（畫面上方 y≈50–80）、舊檔過期再被 eviction 收走（消失/重現）。今天的 16-branch session 在 ~/.claude 累積了 **43 個幽靈檔**。
- **Shipped（源頭修復）**: hook 的 `cleanupGhostAliases()`（processEvent 開頭）— 檔名 4-hex cwd-hash 尾碼做 readdir 便宜預過濾，unlink 前 **parse 證明 `_cwd === process.cwd()`**（跨 repo hash 碰撞永不誤殺）；bare 檔絕不碰；全 try/catch。**COURSE CORRECTION 記錄**：第一版做在 scanner 端（同 _cwd 去重）— 弄壞 11 個 multi-session 測試且會從側門殺掉已出貨的合併機制 → 還原，改 hook 端（一個 checkout 一個 HEAD → 同 cwd 異 slug 必為自己的舊化名）。
- **Review（fresh）**: PASS — 8 點舉證全 PROVEN；reviewer 親自做突變測試（拆 _cwd 防護 → 碰撞測試失敗）；Windows 大小寫不一致的失敗方向是 KEEP（漏清交給 5 分鐘過期，安全方向）。
- **LIVE 鐵證**：修復在本 session 即時生效（hook 從工作樹執行）— ~/.claude **43 → 1 檔**、GET /api/status **0 composite**。**Tests**: 1810 → **1818** (+8)。Tests: Pass

### Ship-chore-q2-q3-security-ci-coherence-2026-06-11 (品質波 Q2+Q3 — 漏洞修補 + CI 一致性)

- Branch `chore/q2-q3-security-ci-coherence`, quick-win. **Q3**: `npm audit fix` resolved 4 REAL vulnerabilities the report-only audit had been hiding — **vitest <3.2.6 CRITICAL** (UI-server arbitrary read/execute) + **vite ≤6.4.1 HIGH** (dev-server arbitrary file read — users literally run this dev server) + picomatch HIGH (ReDoS) + postcss moderate. Lockfile-only in-range bumps; post-bump FULL sweep green (vitest 1810/1810 · build · bundle-budget +0.00% · render-smoke · pack-smoke). security.yml dependency-audit now ENFORCES `--audit-level=high` (`|| true` dropped). Semgrep stays report-only (findings untriaged — deliberate, noted).
- **Q2**: CI matrix [20,22] → **[22,24]** (engines >=22; Node 20 EOL). Branch-protection required checks updated IN LOCKSTEP (else PRs would wedge on the never-reporting `test (20)`): now `test (22)` + `test (24)` + `render-smoke` + **`pack-smoke` (newly promoted to required)**.
- Tests: Pass (full sweep above)

### Ship-fix-avo-154-hook-result-reconcile-2026-06-11 (品質波 Q1 — hook 結果欄位對賬)

- Branch `fix/avo-154-hook-result-reconcile`, quick-win. Closes AVO-154. **Runtime truth nailed by coordinator-induced real failures with capture on**: on this runtime, failed tool calls are ORDINARY PostToolUse with `tool_response:{stdout,stderr,interrupted,isImage}` — NO is_error, NO exit code; NO failure-class hook events exist (capture census 219 PostToolUse / 204 PreToolUse / 3 Subagent* / 0 failure events). Conclusion: AVO-110's specific-reason derivation is **honestly inert on this runtime** (gate requires is_error===true; signal never arrives) — and it STAYS that way (no stdout regex; fabrication refused).
- **Shipped**: `toolResultText(event)` dual-read (tool_result → tool_response.stderr|stdout → ''; future is_error-sending runtimes get working derivation); **PowerShell tool mapped like Bash** (ops role, vibe labels, shell-cmd extraction — 23 real events had been falling to the dev fallback); fixtures 14 → **26** (PowerShell/Agent/Skill/ToolSearch/Subagent* + a hand-crafted failed-command shape), all coordinator privacy-reviewed; divergence pin updated to the PROVEN truth (fails loudly on either reversal). Capture marker left ON (collecting Stop/UserPromptSubmit/StopFailure shapes; delete `~/.claude/office-hook-capture` to stop).
- **Review (fresh)**: PASS — 8-point burden all PROVEN; honesty firewall verified structurally intact (specific reasons unreachable without is_error===true on every path); honest footnote: the blocked-unknown HEURISTIC path was inert-by-accident (toolResult always '') and is now live as designed — floor stays blocked-unknown, never specific.
- **Also this session**: preview_screenshot ROOT-CAUSED (preview window `visibilityState:'hidden'` → Chromium parks rendering, rAF never fires → captureScreenshot starves → 30s timeout; eval/console need no frames hence work; Playwright headless unaffected) — recorded in Protected Surfaces memory; environment-level, not repo-fixable.
- **Tests**: 1705 → **1810** (+105). build + smoke green. Tests: Pass

### Ship-chore-avo-152-bundle-budget-2026-06-10 (穩定波 W5 — bundle 預算 gate；穩定波收官)

- Branch `chore/avo-152-bundle-budget`, quick-win. Closes AVO-152 — **the stability wave (W1–W5 = AVO-149..153) is COMPLETE**. `scripts/bundle-budget.mjs` + committed baseline (450069 B @ 2026-06-10, +10% limit) + CI step in the test job after build. Canary-proven both directions (baseline=100 → FAIL exit 1 with re-base instruction; restored → PASS exit 0). Silent bundle creep now requires an intentional, justified re-base in the same PR.
- Wave totals: tests 1543 → **1705**, 4 new CI gates (npm ci reproducibility · pack-smoke · transport e2e in test job · bundle budget; render-smoke from H1), branch-protection required checks enabled (red PR #89 exposed the empty list), hookWriteLock CI deflake (#90), and W4's REAL finding (tool_response/tool_result divergence → AVO-154). Tests: Pass

### Ship-feat-avo-153-hook-contract-2026-06-10 (穩定波 W4 — hook runtime 契約)

- Branch `feat/avo-153-hook-contract`, feature. Closes AVO-153. Spec `docs/specs/hook-runtime-contract.md` [shipped]. The hook's payload-shape assumptions are now a TESTED CONTRACT built from REAL events instead of hand-written guesses.
- **Shipped**: (1) opt-in raw-event capture in the hook (marker `~/.claude/office-hook-capture` → jsonl append before processing; fully try/catch'd; zero change when absent; marker removed at ship). (2) `scripts/sanitize-hook-capture.mjs` — shape-preserving sanitizer (default-redact free text; enum allowlist; shape-dedup). (3) **14 REAL fixtures** captured live from THIS session (hook runs from the working tree → the implementing session generated its own corpus: Pre/PostToolUse × 7 tools), coordinator privacy-reviewed clean; absent event types documented NOT fabricated. (4) `tests/hookRuntimeContract.test.js` — **143 tests** (shape contracts mirroring the hook's actual reads with line citations + behavior tests spawning the real hook against an isolated status file).
- **REAL FINDING (the feature paying for itself on day one)**: the runtime sends the result under **`tool_response`** while the hook reads **`tool_result`** → on this runtime the hook's result text is always empty for success events, and `is_error`'s ERROR-event shape is not yet captured (corpus is success-only). NOT guessed at: a LOUD divergence-pin test (fails if the runtime shape shifts in either direction) + **AVO-154** ticket (capture an error event first; reconciliation touches the AVO-110 honesty firewall → own careful pass).
- **Review (fresh)**: PASS — capture block proven unable to affect processing; sanitizer default-redact direction verified; privacy scan clean. **Tests**: 1562 → **1705** (+143). build + smoke green. Tests: Pass

### Ship-feat-avo-150-transport-e2e-2026-06-10 (穩定波 W2 — transport-spine 真實線路 e2e)

- Branch `feat/avo-150-transport-e2e`, feature. Closes AVO-150. Spec `docs/specs/transport-spine-e2e.md` [shipped]. The API 脊柱 (POST /api/status → normalizePost.mjs → 檔案 → GET merge; POST /api/event) now has a REAL-PROCESS gate — the H2 .mjs copy and the _seq single-clock fix live exactly there and were unit-only before.
- **Shipped**: `tests/serverTransportE2E.test.js` (19 cases, ~300ms, in `npm test`): boots `node server.mjs` with **HOME/USERPROFILE→temp isolation** (zero production change; in-suite assertion proves the temp `.claude/office-status.json` is created and the developer's real file untouched); canonical `AGENT_CARRY_FIELDS` survival LOOP (future fields auto-covered) + 3 H5 reasonCode tokens + full enum cross-check + invalid-token→null; shorthand POST; invalid-role drop; **#52 coerce-to-idle on the real server path**; **_seq strict-monotonic across alternating /api/status + /api/event** (the H2 clock-split regression target); malformed body → 4xx (both bounds) + server-alive follow-up; /api/health.
- **Review (fresh)**: PASS — all ACs PROVEN; sensitivity probe (flip #52 expectation → explicit failure); 1 MED advisory (Windows SIGTERM coercion — server has no grandchildren, inert) + 2 LOW accepted.
- **Tests**: 1543 → **1562** (+19); e2e ×3 non-flaky. Tests: Pass

### Ship-feat-avo-151-pack-smoke-2026-06-10 (穩定波 W3 — npm-pack 安裝煙測)

- Branch `feat/avo-151-pack-smoke`, feature. Closes AVO-151. Spec `docs/specs/npm-pack-install-smoke.md` [shipped]. The npx-published tarball (files whitelist / bin entrypoint / hook-in-node_modules — a DIFFERENT artifact than the git checkout) now has a blocking gate.
- **Shipped**: `scripts/pack-smoke.mjs` — pack → temp-dir install → 4 assertions: 8-event setup + idempotence (no dup entries on re-run), standalone hook exit 0 (zero-dep verified in installed context), Quick-Start dev boot → 200 + app mount (dev mode = Vite, no /api/health — documented). `ci.yml` `pack-smoke` job (timeout-minutes 15). `npm run smoke:pack` local (Windows verified first-hand).
- **AC-4 test-the-test proven**: removing `public/` from the files whitelist → exit 1 with a diagnostic naming the whitelist. **Review (fresh)**: PASS — false-green analysis: event-DROP caught, event-ADD is a commented sync-contract gap; MED job-timeout + 2 LOW applied in-PR; POSIX grandchild-orphan LOW accepted (CI teardown).
- **Session process fixes alongside W1/W3**: (a) the W1 PR #89 exposed that branch protection had an EMPTY required-checks list (red PR merged) → `test (20)`/`test (22)`/`render-smoke` are now REQUIRED on main (gh api). (b) The hookWriteLock AC-4 CI flake (budget-exhausted worker writing unlocked on 2-core runners — same mechanism as W1's local post-install flake) deflaked in PR #90: test workers retry-until-held; production untouched.
- Tests: 1543/1543; pack-smoke first live CI run on its own PR. Tests: Pass

### Ship-chore-avo-149-ci-reproducible-2026-06-10 (穩定波 W1 — npm ci 可重現建置)

- Branch `chore/avo-149-ci-reproducible`, quick-win. Closes AVO-149. `npm install` → `npm ci` in both ci.yml jobs (test matrix + render-smoke); security.yml audited (no install step, unchanged). Local clean `npm ci` verified against the lockfile BEFORE the CI change; suite 1543/1543 ×4 post-reinstall.
- **Flake watch opened** (Drift Log): one unreproduced `1 failed/1542` on the FIRST run after the clean reinstall (name lost; suspected AV-scan I/O contention on a timing-sensitive test — hookWriteLock bounded-wait prime suspect). 4 subsequent runs green. Capture + deflake if it recurs.
- **Observation ticket-worthy**: ci.yml matrix tests Node 20 while `engines` requires `>=22` — incoherent, future cleanup. Tests: Pass

### Ship-chore-hardening-wave-closeout-2026-06-10 (硬化波收官 — AVO-144 決策結案 + 穩定波登錄)

- Branch `chore/hardening-wave-closeout`, quick-win. **The Fable-5 hardening wave (H4→H1→H2→H3→H5→H6) is COMPLETE** — 7 PRs merged in one day (#82 #83 #84 #85 #86 #87 + this), tests 1462 → 1543, validator 4 warn → 1 (by-design floor), zero fails throughout.
- **AVO-144 resolved by DECISION (ADR-004)**: 3-lens expert panel (game-feel · honesty/calm-tech · systems) unanimously rejected per-frame agent separation — doorway geometry (35–48 px vs MIN_AGENT_DIST 35) makes push-oscillation read as a bug; visual position is component-local so store nudges either lie (silent divergence) or relocate (R1-adjacent); the required evidence harness is unbuildable here. Target-time deconfliction already covers every assignment chokepoint. Backlog row → Deferred-by-decision with re-open conditions (lock-step convergence harness + parameter set + URL flag + owner tuning session).
- **Stability wave registered (W1–W5 = AVO-149..153)**: npm ci reproducibility · npm-pack install smoke · transport-spine e2e · hook-runtime fixture contract · bundle budget gate. None touch agent-os governance (owner brief). Recommended order W1→W3→W2→W4→W5.
- Tests: Pass (1543/1543 unchanged — docs/governance only)

### Ship-feat-avo-143-skip-noop-agent-realloc-2026-06-10 (硬化波 H6a — poll no-op 不重配置)

- Branch `feat/avo-143-skip-noop-agent-realloc`, quick-win. Closes AVO-143. Coordinator-implemented (identity-sensitive one-function change).
- **Shipped**: `applyExternalStatus` per-update skip when every written field is provably unchanged (`!sigChanged ∧ status equal ∧ behavior/expression resolve same`), placed AFTER the ext expiry refresh + AVO-117 episode record (both must run every tick); `agentsMutated` flag (seeded by dayChanged; set by creation/reassignment/eviction) → returns the ORIGINAL `s.agents` reference on a pure poll re-apply. AgentCharacter subscribers + Object-level selectors stop re-firing every ~2s for nothing.
- **Review (focused, fresh)**: PASS — 14-point skip-condition completeness audit all PROVEN (incl. previousStatus read-before-write order, done-growth/blocked-counter gating, occupiedSlots aliasing); sensitivity probe (drop `!sigChanged` → 1 existing test fails) proves the guard load-bearing.
- **Tests**: 1535 → **1543** (+8 identity tests). The 1535 pre-existing tests passing UNCHANGED is the conservativeness proof. smoke exit 0. Tests: Pass

### Ship-feat-avo-148-structured-error-reasons-2026-06-10 (硬化波 H5 — 結構化事件 blocked reasons)

- Branch `feat/avo-148-structured-error-reasons`, feature. Closes AVO-148 (= AVO-110 Phase-2). Spec `docs/specs/structured-error-reasons.md` [shipped]. 3 new reason tokens, **event-driven = honest by construction**: a token stamps ONLY when the named structured hook event observably fired; older Claude Code without these events → handlers inert, nothing claimed.
- **Shipped**: `PermissionDenied` event → `permission-denied` (toolToRole attribution; **tool_name-less → NO-OP**, no spatial over-claim per doctrine); `StopFailure` matcher enum → `api-rate-limit` / `api-auth-failed`, any other/absent matcher → `blocked-unknown` floor (turn died = blocked TRUE, cause unclaimed). Tool-level 401/429 REJECTED (rendered text only = the fabrication AVO-110 refused). Both handlers under the H3 write lock. BLOCKED_REASONS +3 in classify.js AND the normalizePost.mjs mirror with a NEW mechanical list-equality guard (first live run of the H2 checklist — it worked). 3 badge glyphs + en/zh-TW labels claiming exactly the proven scope ("API rate-limited", never "tool hit 429"). RECURRING_REASONS now covers all 6 specific tokens. 3 registration surfaces (cli setup idempotent / repo settings / README).
- **Review (fresh, honesty-critical)**: NOT READY — the project's CLASSIC defect class caught pre-merge this time: handler tests asserted only not.toThrow while the env override redirected the lock dir but NOT STATUS_FILE → seeded fixtures were never read; zero observation of the over-claim wire. + MED recurring omission, MED dev-mis-attribution on tool_name-less denials, LOW floor label. All fixed (4fb4fb0): `getStatusFile()` env-overridable (production byte-identical), tests assert REAL file output incl. negative guards (overloaded/absent → NEVER a specific token) + done-agent invariant + EPHEMERAL 2-event clear; sanity-flip + delta reviewer's live sensitivity probe both prove the tests load-bearing. Delta → **PASS**, 0 UNPROVEN.
- **Tests**: 1499 → **1535** (+36). smoke exit 0. Tests: Pass

### Ship-fix-issue-20-hook-write-lock-2026-06-10 (硬化波 H3 — hook STATUS_FILE 寫入鎖)

- Branch `fix/issue-20-hook-write-lock`, quick-win. Closes #20 (reactivated from Deferred). Spec `docs/specs/hook-status-write-lock.md` [shipped]. The hook's read-modify-write window (SubagentStart racing main-session PostToolUse in one cwd) can no longer lose updates.
- **Shipped**: `acquireStatusLock`/`releaseStatusLock` in `public/hooks/office-status-hook.js` — atomic `mkdirSync` lock dir, 25ms×10 bounded busy-wait (`Atomics.wait`, try/catch-degradable), 2s stale-steal, ENOENT-after-EEXIST retry (coordinator fix), **proceed-unlocked fallback** (liveness sacred: hook runs on every user tool call; worst case = pre-fix behavior). Both RMW sites wrapped in try/finally (Stop handler + main merge span); pure-read sites left unlocked.
- **Review (fresh)**: PASS — all 5 ACs PROVEN; reviewer NEUTERED the lock to verify AC-4 has teeth (4/5 broken runs fail with lost-update/torn-read); SITE-A-nested-in-SITE-B liveness hazard structurally impossible (Stop returns before SITE-B acquire); no process.exit inside any lock span. 2 LOW accepted (time-based steal under >2s OS pause = spec-accepted availability tradeoff; AC-4 failure-sensitivity probabilistic = spec-waived).
- **Tests**: 1489 → **1499** (+10: 6-process×15-cycle mutual-exclusion proof counter===90 exact, stale-steal, bounded fallback; ×3 non-flaky). smoke exit 0. Payload/field logic byte-untouched (drift guards green). Tests: Pass

### Ship-feat-avo-146-status-field-schema-2026-06-10 (硬化波 H2 — status-field schema 統一)

- Branch `feat/avo-146-status-field-schema`, feature. Closes AVO-146. Spec `docs/specs/status-field-schema-unification.md` [shipped, AC-3 amended at review]. Kills the "new field silently dropped by one whitelist copy" HIGH-defect class (AVO-110/AVO-106 history).
- **Shipped**: `src/utils/statusFields.js` — canonical `AGENT_CARRY_FIELDS` (task/label/hint/reasonCode/activeFile) + `FIELD_SANITIZERS` + 9-site data-path map + new-field checklist. normalizePost (both branches) / sanitizeAgent / routeExternalAgents / applyExternalStatus all iterate the canonical list. `server.mjs` inline normalizePost DELETED → imports `src/utils/normalizePost.mjs` (bare-Node runtime copy; `.js` physically unimportable under `"type":"commonjs"`), **mechanically drift-guarded** (list equality + sanitizer probe table + multi-payload behavioral parity in `tests/statusFieldsDriftGuard.test.js`). Hook (cannot import; standalone CJS) gets a source-level drift-guard: every canonical field must appear in BOTH hook whitelist sites. **AC-6 field-survival e2e loop**: every carry field pushed through the full 4-stage pipeline into the store — future fields auto-covered; silent drops fail by construction.
- **Bonus fixes surfaced by the ground-truth audit**: (1) LIVE #52 divergence — server path dropped agents with invalid status while src coerced to idle; now unified (coerce) with dual-instance regression tests. (2) `_seq` clock split (review MED-2) — /api/status + /api/event now share one exported `nextSeq` counter (two counters writing one file could trip the cross-channel stale-drop guard). (3) POST shorthand branch now carries reasonCode/activeFile (documented additive).
- **Review (fresh, truth/data)**: NOT READY — HIGH-1 spec/impl divergence (implementer created the .mjs copy where AC-3 said import .js; reviewer VERIFIED the .js import is impossible and the spec's scanSessions precedent was wrong) + MED-1 (#52 test asserted the wrong module) + MED-2 (_seq split). All fixed (07afa22): spec amended + decision recorded in work log Drift Log; delta reviewer → **PASS** (monotonic nextSeq verified live). Coordinator had also hardened the implementer's comment-only "sync contract" into mechanical SITE 9 tests BEFORE first review.
- **Tests**: 1462 → **1489** (+27 net: drift guards ×18 + #52 dual ×8 + survival loop; old byte-drift parity internals removed). smoke exit 0. Hook file byte-untouched. Tests: Pass

### Ship-feat-avo-145-ci-render-smoke-2026-06-10 (硬化波 H1 — CI render-smoke gate)

- Branch `feat/avo-145-ci-render-smoke`, feature. Closes AVO-145. Spec `docs/specs/ci-render-smoke.md` [shipped]. Wave H1: the PR #71 failure class (render crash, CI green — no jsdom) becomes a **blocking CI gate** instead of a manual habit.
- **Shipped**: `scripts/render-smoke.mjs` (tracked harness; spawns `node server.mjs` — the real prod artifact, serves /api/* so polling can't 404-noise — against `dist/`, asserts: svg ≤15s · ErrorBoundary fallback absent · ≥100 svg descendants · 0 pageerrors · 0 console errors; NO blind allowlists; every degenerate path — server-not-ready/port-in-use/no-browser/dist-missing — exits loud 1). `ci.yml` `render-smoke` job (ubuntu, Node 22, playwright chromium). `package.json`: playwright devDep + `npm run smoke`. Local fallback to system Chrome so devs skip the browser download.
- **AC-6 test-the-test PROVEN twice** (coordinator + fresh reviewer independently): top-of-module throw canary → exit 1 (svg-timeout + 0-descendants + pageerror); render-time ReferenceError (the literal #71 class) → exit 1 firing all four assertions incl. "Something went wrong" + `[ErrorBoundary]` console.error. Clean build → exit 0 (≈1900–2100 svg descendants).
- **Review (fresh acx-reviewer)**: PASS — burden-of-proof AC-1..6 all PROVEN; ground-truthed `server.mjs:119/132/555` (`--port=`/`--no-open`/`/api/health` real, not coincidental defaults); `npm pack --dry-run` confirms harness not shipped. 4 LOW advisories accepted+documented (unawaited browser.close; steady-state-poll-only crashes out of scope per spec Non-Goal; fixed port fails loud; npm install correct for devDeps).
- **Process note**: implementation delegated to a sonnet acx-implementer which died mid-report → coordinator re-ran ALL verification first-hand before accepting (evidence in archived log, not relayed claims).
- **Tests**: vitest **1462/1462** unchanged (zero src/ diff); smoke exit 0/1 both demonstrated. CI render-smoke job's first live run happens on this PR itself. Tests: Pass

### Ship-chore-hardening-h4-zero-noise-2026-06-10 (硬化波 H4 — validator 歸零 + 硬化波 intake)

- Branch `chore/hardening-h4-zero-noise`, quick-win. Opens the owner-selected **Fable-5 hardening wave** (H4→H1→H2→H3→H5→H6; spec-intake decomposition + owner "全做" selection 2026-06-10).
- **Backlog intake**: AVO-145 (CI render-smoke gate) · AVO-146 (transport whitelist unification) · AVO-147 (this task) · AVO-148 (structured error payload, AVO-110 Phase-2) registered; #20 reactivated P3→P1 Pending (=H3); wave notes section added.
- **Validator 4 WARN → 1 WARN (pass 105→109, 0 fail)**: the two leftover shipped logs (`feat-office-pet-barometer`, `fix-issue-28-watchdog-diag`) got honest backfills (Test Gate Results + ADR Coverage marked "backfilled at archival", evidence = original 2026-06-08 records, no new claims) and were archived + INDEX.jsonl chain-appended via `append_chain_entry.py` (status ok ×2). Residual 1 WARN = archived-historical-gap (6 logs) — analysed: 1 validator regex false-positive (`Gate: implement (truth-half) |` not matched), 5 true immutable historical gaps; WARN-by-design, accepted floor. Upstream agentic-os candidates: annotated-receipt tolerance + accepted-baseline list.
- **Repo hygiene**: `.gitignore` now covers `.pet-shots/`, local `scripts/*-shot.mjs` + `pet-*.mjs` (AVO-145 will land ONE tracked harness), `deploy_brain.*` (canonical source = KbWen/agentic-os); `docs/adr|specs/.gitkeep.md` + `work/.gitkeep.md` tracked. git status untracked noise → 0.
- **Evidence**: no `src/`/`tests/` change (diff --stat verified) → 1462/1462 baseline stands; validator receipts above. Tests: Pass

### Ship-feat-declutter-glance-layer-2026-06-10 (UX declutter — bubble cap + de-alarm, owner "畫面太亂")

- Branch `feat/declutter-glance-layer`, quick-win. PR #81 (merged 2nd, after pair-link #80 — rebased to Update Sequence 49, INDEX chain relinked). Off `main` (independent of #80).
- **Origin**: owner worried the office is "too messy". Evidence-first: captured a real busy-moment screenshot, then a 4-lens declutter panel (clutter-auditor · first-time-user · wall-TV readability · calm-tech) each READ the screenshot + the code. **Unanimous #1 noise = simultaneous speech bubbles** (N active agents → N bubbles, no concurrency cap, ~60% of the mess).
- **What shipped (REDUCTION, not new features)**: (1) **Bubble concurrency cap** — pure `src/systems/bubbleVisibility.js` `selectVisibleBubbles(agents, ext, cap=3)` picks ≤3 bubbles by priority `blocked > done > working`, recency tiebreak, stable id order; AgentCharacter gates `BehaviorBubble` on a per-agent boolean selector. **Honesty guarantee**: suppressing a bubble hides TEXT only — the status ring + name-pill color + over-head blocked-reason badge still render, so a real block is never hidden by the cap. (2) **OVERTIME de-alarmed** — the perpetual red pulse (read as a false alarm) → a steady muted-brown chip (night lighting already signals late; red reserved for real blocked state). (3) **Removed the redundant corner status glyph** (⚡/✓/✕/◷) — a 3rd status channel duplicating the pill color + glow ring; status now rides color+ring (visual) + the group aria-label (net a11y gain).
- **Deferred**: bottom role-legend strip demote = its own ticket **AVO-130** (different surface — the control bar, not the office scene). Bigger wall-TV plays (blocked→whole-agent escalation, per-status posture/silhouette, AVO-137 density layers) remain backlog.
- **Liveliness (owner challenge "蓋掉的方式是活躍的嗎? 別蓋死/死氣沉沉")**: the cap originally tie-broke by STABLE id → same low-id agents always won when several held stale ambient bubbles → others permanently mute (dead). Fixed: `selectVisibleBubbles(…, now)` breaks priority+recency TIES with a 2.5s time-rotation so tied agents take turns; real recency still wins (meaningful), blocked/done stay pinned. AgentCharacter passes `Date.now()`; cadence rides the office's continuous store churn (doSchedule/waypoints/poll, sub-second when busy = when the cap binds).
- **Review (fresh, owner-requested)**: 1 acx-reviewer → NOT READY (3 findings) → all addressed: HIGH (rotation was uncommitted → committed), MED (rotation cadence coupled to store-emit — ACCEPTED + documented; a paused office intentionally freezes), LOW (added `awaiting-approval`/`thinking` statusLabels). Honesty (suppress hides TEXT not STATUS) verified live.
- **Tests**: +13 (`bubbleVisibility` — cap, priority, recency, no-thrash-in-window, ROTATION cycles all tied agents, recency-still-wins, blocked-pinned, honesty). Full suite **1424 passed**; build clean (444.8 KB). **Load-the-page verified**: busy 7-agent scene → **3 bubbles ≤ cap**, blocked kept a slot, chips gone, OVERTIME muted, 0 errors. **Liveliness-over-time verified** (`scripts/bubble-rotation-shot.mjs`): ≤3 at once but **5 distinct agents shown across rotation windows** (rotates, not frozen).
- Tests: Pass

### Ship-feat-pair-programming-huddle-2026-06-09 (AVO-106 — co-editing pair OVERLAY; redesigned from a huddle after expert panel)

- Branch `feat/pair-programming-huddle`, feature. Closes AVO-106. Spec `docs/specs/pair-programming-huddle.md` [shipped]. PR https://github.com/KbWen/agent-virtual-office/pull/80 for human merge (main protected); SSoT + work-log archive in the SAME PR.
- **What shipped (final = overlay)**: when two DISTINCT office agents are **co-EDITING the byte-identical file** within a 90s window, a faint **desk-to-desk connecting line + 🔗 `<basename>`** is drawn between them (`src/components/PairLink.jsx`, painted behind agents). PURE in-place overlay — the agents stay at their desks; it NEVER moves them, never sets `inGroupEvent`/`groupTarget`, never holds an `activeEvent`/mutex, has no cooldown, and is NOT in the random event pool. Driven by a transient `store.pairLink` field (not persisted) set/cleared from the existing officeLife `seedUnsub` subscription (gated on `externalStatus` identity change → never on 60fps position ticks; runs before the pause/event guard since it's not an event). Pure `src/systems/pairHuddle.js` `findSharedFilePair` (distinct ids, full-normalized-path compare NOT basename, recency window, idle-excluded). New per-agent `activeFile` threaded through the SAME 6 whitelists as `reasonCode` (hook `activeFileForTool` + merge · `normalizePost` + `server.mjs` inline copy + parity-test embedded copy · `sanitizeAgent` · `routeExternalAgents` · `applyExternalStatus` + `activeFileAt` stamp decoupled from `sigChanged`). **Read excluded at the hook** (`activeFileForTool` = Edit/Write only) so co-reads never over-claim collaboration.
- **Redesigned mid-flight from a 4-expert game panel** (game-feel · calm-tech · systems · sim-fidelity, all read the real code): the first cut was a fired event that **relocated working agents to a whiteboard huddle** (mutex + shared global cooldown, counted Read+Read). Panel verdict: relocating genuinely-*working* agents = the FIRST set-piece to violate the project's **R1 "a tracked desk is never modulated"**; Read+Read over-claimed; the shared `lastSeedAt` budget crowded out the real deploy/eureka seeds; ~every-2-min firing = wallpaper. Owner chose **redesign → pure overlay**, which dissolves ALL of those (no relocation, co-edit-only, no budget/mutex).
- **Honesty by construction**: two events that collapse to one role = one store key → never a pair (we never invent a 2nd agent). Realistic source = a main session + a subagent co-editing in the SAME cwd; multi-worktree cannot false-trigger (hooks don't fire in worktrees + paths differ).
- **Review (2 fresh adversarial passes, truth/data)**: pass-1 on the original huddle → PASS (whitelist + stale-file attack airtight); the OVERLAY redesign got a 2nd fresh delta reviewer → NOT READY on 1 blocker (stale spec still described the removed huddle) → spec rewritten to the overlay + ACs → resolved. Verified: overlay touches ONLY `pairLink` (no position/behavior/status/inGroupEvent), Read-exclusion wired into both hook paths, zero dangling refs to the removed event symbols, render null-safe, self-healing lifecycle. LOW cleanups applied (dead `pairKey` export removed, stale comments, M1 defense-in-depth note that the hook is the sole co-edit gate).
- **Tests**: +33 net (`pairHuddle` 15 honesty invariants · `pairHuddleDataPath` 11 whitelist · `pairLinkOverlay` 6 real-store integration incl. the **R1 assertion: agents NOT relocated** · `pairLink.jsx` 3 SSR render · `activeFileForTool` 3 hook gate). Full suite **1449 passed / 67 files**; build clean (446.68 KB JS). **Load-the-page verified** (headless Playwright `scripts/pair-huddle-shot.mjs`): dev+qa co-editing store.js → `pairLink` set, **`inGroupEvent` false on both / no `activeEvent`** (agents un-relocated), 🔗 line + `store.js` render in place, 0 console errors, no ErrorBoundary.
- Tests: Pass

### Ship-feat-recurring-failure-detection-2026-06-08 (AVO-117 — recurring failure-mode detection)

- Branch `feat/recurring-failure-detection`, feature. Closes AVO-117. Spec `docs/specs/recurring-failure-detection.md` [shipped]. Downstream of AVO-110: aggregates the shipped `reasonCode` stream so a watcher can tell a one-off blip from an agent **stuck in a loop**. PR opened for human merge (main protected); SSoT + work-log archive in the SAME PR.
- **Shipped**: pure `src/systems/recurringFailure.js` (`recordEpisode` / `recurringInfo` / `isNewBlockedEpisode`; threshold 3 / 10-min rolling window / cap 20). When the **same specific reasonCode** (test-run/build/deps — `blocked-unknown` EXCLUDED as noise) recurs across **≥3 distinct blocked EPISODES** for one agent in-window → a quiet ↻ "recurring" escalation on the AVO-110 over-head badge (`blockedReasonBadge.jsx` `recurring` prop) + one permission-gated desktop notification (`desktopNotifier.js`, once per episode). Honest wording claims only the recurring PATTERN of a kind ("Tests keep failing" / "反覆卡在測試"), never a specific bug. State is in-memory in the store (transient, whitelist-persist excludes it); EPHEMERAL sign (only while currently blocked AND recurring).
- **Review (heavy, truth/data)**: a fresh adversarial reviewer → NOT READY with 1 HIGH BLOCKER — the idle-gap inferrer flapping `blocked→awaiting-approval→blocked` for ONE stuck state manufactured a FALSE recurrence (each re-entry counted as a new episode); green tests had hidden it again. Fixed by a pure `isNewBlockedEpisode` that treats the blocked-family (blocked + awaiting-approval) as ONE continuous episode — mirroring `desktopNotifier`'s existing `BLOCKED_DERIVED` prior-art — plus the reviewer's prescribed `blocked→awaiting-approval→blocked` flap regression test (count stays 1). Re-verified.
- **Tests**: +26 (pure recurrence honesty invariants incl. idle-gap flap + window cutoff boundary; store EPISODE-EDGE no-double-count; recurring sign render; once-per-episode notification). Full suite **1411 passed / 63 files**; build clean (444 KB). **Load-the-page verified** (headless Playwright `scripts/recurring-shot.mjs`): 3 real episodes → ↻ sign renders with recurring a11y, 0 console errors, no ErrorBoundary.
- **Deferred**: finer error signatures need a structured-error hook field (shared Phase-2 boundary with AVO-110); cross-session window persistence (not warranted — reasonCode stream is itself non-persisted).
- Tests: Pass

### Ship-feat-blocked-reason-tags-2026-06-08 (AVO-110 / #29 — honest-narrow blocked-reason badge)

- Branch `feat/blocked-reason-tags`, feature. Closes AVO-110 (#29). Spec `docs/specs/blocked-reason-tags.md` [shipped]. Upgrades "卡住了" → "卡在什麼": a structured language-neutral `reasonCode` rendered as a per-agent over-head pixel-glyph "status-effect" badge (game surface) that is a 1:1 map of a signal the hook actually observed (real info). PR opened for human merge (main protected); SSoT + work-log archive committed in the SAME PR.
- **Origin**: 13-agent design panel + adversarial honesty audit **refuted 6 of 7** candidate reasons. Root cause documented: `bashVibeLabel` returns the FIRST segment's noun while `is_error` is one boolean for the WHOLE compound command (wrong-segment attribution); the office-vibe buckets are display-only (AVO-126), not a failure taxonomy. Owner chose **PATH A (honest-narrow)** + bespoke pixel-art glyphs.
- **Shipped (4-reason MVP)**: `test-run-failed` / `build-failed` / `deps-failed` / `blocked-unknown`. Honesty firewall in `deriveBlockedReason` (`public/hooks/office-status-hook.js`): a specific reason stamps ONLY when explicit `is_error===true` AND single-segment (rejects `&&`/`||`/`;`/`|`/newline/`&`) AND a tight `^`-anchored allowlist (bare `\binstall\b`/`\bbuild\b`/`\bmake\b` dropped) AND no launch-failure first-line (RUNNER-PRESENT: ENOENT/command-not-found → unknown); a leading `cd "<path>" &&` harness wrapper is stripped first. Pure `classifyBlockedReason` (classify.js, `classifyStatus` untouched) maps token→{iconId,hue,a11yKey}; `blocked-unknown` is the load-bearing neutral default (NOT a red ✗). New `blockedReasonBadge.jsx` (4 distinct SVG silhouettes) overrides the BehaviorIndicator glyph while blocked, keyed on reasonCode (entry-pop on change only; reduced-motion static, zero info loss); ControlPanel row shows icon+i18n text from the TOKEN (no ext.label re-parse). en + zh-TW labels claim only "test RUN"/"卡在測試執行".
- **Review (heavy, truth/data)**: 2 fresh acx-reviewers → NOT READY (2 HIGH honesty defects green tests had hidden: the `(?![\w-])` boundary leaked `:`/`.`-suffixed scripts as specific tags; the POST `/api/status` ingest = a 4th/5th transport whitelist silently dropping `reasonCode`). Both fixed (in PR #77, squashed to main 33320eb) + fresh delta reviewer re-verified PASS (regex tightening to `(?=$|\s)` proven one-directional). Data path confirmed = **FIVE** whitelists, all carry reasonCode (hook ×2 + sanitizeAgent + routeExternalAgents + normalizePost ×2 + store ext).
- **Tests**: +44 (derivation honesty invariants, classifyBlockedReason, EPHEMERAL clear + cross-agent + transport end-to-end, POST parity, token-driven label, badge render). Full suite **1385 passed / 61 files**; build clean (441 KB). **Load-the-page verified** (headless Playwright `scripts/blocked-reason-shot.mjs` — `preview_screenshot` hangs): 0 console errors, no ErrorBoundary, dev shows 🧪 test-run badge / qa shows ❔ unknown, panel reads "🧪 Test run" / "❔ Blocked".
- **Deferred (Phase-2, separate ticket)**: `permission-blocked` / `auth-error` / `rate-limit` need a structured errno/HTTP-status payload field (substring regex over free-text is fabrication). Unblocks AVO-117 (recurring failure-mode detection).
- Tests: Pass

### Ship-feat-pet-legibility-and-more-types-2026-06-08 (#39 — mode emote + 3 more skins)

- **PR #74 (legibility)**: a TYPE-INDEPENDENT mode emote glyph floats above the pet (hide ⚠ · nap 💤 · excited ⚡ · alert ❗; wander/celebrate none) so the state reads at a glance for ANY skin — owner feedback that the subtle poses were unreadable. Consolidated the scattered per-sprite z/! glyphs into one place. Pure `modeEmote` (+3 tests).
- **PR #75 (more types)**: 3 → **6 skins** — added 🐇 rabbit, 🐦 bird, 🐹 hamster (cosmetic; per-type motion grammar; same honest mode logic). ControlPanel ⚙ radiogroup + en/zh-TW labels.
- **Caught the load-the-page lesson in action**: both verified via headless-Playwright screenshots (all skins render, emotes distinct, 0 console errors) — not just green tests. Suite **1341 passed**; build clean. Spec reference table updated to 6 types + emote column.

### Ship-hotfix-controlpanel-render-crash-2026-06-08 (crash shipped green, caught by ACTUALLY loading the page)

- **PR #71 hotfix.** PR #70 (ControlPanel helper extraction) used `export { … } from './controlPanelLabels.js'` — which re-exports to other modules but does NOT bind the names into ControlPanel's own scope. The component body still calls `shouldShowWatchdogDiag`/`taskChipLabel`/etc. at render → `ReferenceError` → ControlPanel threw → the WHOLE app fell back to the ErrorBoundary ("Something went wrong") on every load. Fix: `import { … }` (binds locally) AND re-export.
- **CI/tests/build were ALL green** (1338 pass) because the node test env has no jsdom — nothing renders ControlPanel, and build doesn't execute render. The crash was invisible until a real page-load (headless-Playwright screenshot; `preview_screenshot` hangs here). Owner prompt "有沒有好好開畫面看看???" surfaced it.
- **Lesson recorded (memory `feedback_load_the_page_render_crashes_invisible_to_ci`)**: after editing ANY rendered component, ACTUALLY load the page + assert svg renders / 0 console errors — green tests ≠ app renders. A reusable headless-shot tool lives at `scripts/pet-shot.mjs` (gitignored / local).

### Ship-retro-cleanup-pet-2026-06-08 (debt cleanup + polish from the 4-perspective retro)

- A 4-perspective retro (engineering · game-design · user · product) reviewed the day's pet work. Acted on the findings (debt + flaw fixes; NO feature cuts, per owner). Two PRs:
- **PR #68 (deflake)**: seeded the `avoidOverlap` fan-out RNG (mulberry32) in `tests/agentSeparationInvariants.test.js` — kills the intermittent `~15 < 20` CI failure that hit ~3 PRs (`avoidOverlap` uses `Math.random` for push direction). Deterministic 5/5.
- **PR #69 (refactor/polish)**: new `useTransientFlag(ms)` hook (timer owned by the flag + fire-nonce) STRUCTURALLY kills the recurring "stuck transient" bug class — celebrate/alert/petted migrated onto it. Run-to-desk de-raced (documented invariant: alert is non-mobile → wander interval cleared → sole pos writer). Polish: relief celebrate beat on blocker-clear (honest); confetti deduped to one channel (removed per-sprite ✦); click-♥ gated to calm base modes; vacuum hide tilt deepened.
- **Review**: acx-reviewer → PASS (honesty/de-race/dedup all hold; hide-on-blocker untouched). Known gap (env limitation): no jsdom → the hook's effect behavior can't be unit-tested here; verified LIVE (alert fires + auto-clears, no stuck). Suite **1331 passed**; build clean.
- **PR #70 (ControlPanel split)**: extracted the pure label helpers (taskChipLabel/blockedReasonLabel/formatTokens/agentLineLabel/shouldShowWatchdogDiag) out of the ~460-line ControlPanel.jsx into a testable `controlPanelLabels.js` (re-exported for back-compat); +7 tests for previously-untested formatters. Completes the engineering-retro top-3 debt items.
- **Retro priority signal (recorded)**: user + product both named **blocked-reason tags (#29)** the highest-user-value next item; the pet is now feature-complete and should be FROZEN.

### Ship-feat-controlpanel-settings-popover-2026-06-08 (UX — ⚙ settings popover consolidates the control bar)

- PR #67 (branch `feat/controlpanel-settings-popover`), feature. UX-panel proposal: the bottom bar had grown to ~10 buttons mixing run-state / cosmetics / dev / help.
- **Shipped**: a ⚙ settings popover holds weather + office-pet (role=switch), pet-skin (role=radiogroup, new store `setPetType`), notifications, and the Test toggle. Bar now lean: language · pause · roster · Run · ⚙ · info. a11y: aria-haspopup/expanded, role=menu/switch/radiogroup, Esc + click-outside close. i18n: `aria.settings` + `settings.*` in en + zh-TW. No data-path change (same actions + localStorage keys; showTest panel still renders, toggled from the popover).
- **Review**: 1 acx-reviewer → PASS (no functional regression — every moved control keeps its handler+selector+persistence; no orphaned `cyclePetType` ref; panel mode untouched; i18n parity). LOW advisories: orphaned old aria/notify i18n keys (harmless), focus-management deferred (v1). **Tests**: +1 (`setPetType`); suite **1331 passed**; build clean. DEV live-verified: ⚙ opens/closes (Esc), weather/pet bar buttons gone, popover toggles + skin radio work.
- This completes ALL panel-recommended pet + UX optimizations (#39 delight pack, run-to-desk, vacuum silhouettes, button consolidation).

### Ship-feat-office-pet-run-vacuum-2026-06-08 (#39 — run-to-blocked-desk + distinct vacuum silhouettes)

- PR #66 (branch `feat/office-pet-run-vacuum`), feature (extends #39). Two panel-recommended honest-signal upgrades.
- **Run-to-blocked-desk**: on a new-blocker edge the pet trots to stand just below a blocked agent's desk → POINTS AT a real blocker (motion = information). Pure `runTarget(pos)` + a primitive `blockedAgentPos` selector reading the store's already-published `agent.position` **read-only** — NO HOME_POSITIONS / movementSystem coupling (Protected Surfaces untouched; `clampToFloor` was already imported). Honesty held (alert still settles to hide; always a REAL blocker — first-found with ≥2).
- **Vacuum silhouettes**: the robot-vacuum's near-identical LED-only modes now have distinct STATIC silhouettes — nap dock+dim, wander sweep trail, excited dust puff, hide tilt+dim (calm; reduced-motion safe).
- **Review**: 1 acx-reviewer → PASS (read-only discipline intact, honesty preserved, no loop/race/stale-chase, vacuum RM-safe); 2 LOW advisories (multi-blocker targets first real blocker — comment corrected; RM snap intentional). **Tests**: +2 (`runTarget`); suite **1330 passed**; build clean. DEV live-verified: pet targets the blocked dev desk EXACTLY (240,386 → 240,404 = y+18, dist 0); vacuum node counts differ per mode.

### Ship-feat-office-pet-delight-2026-06-08 (#39 — delight pack: bigger · deploy spotlight · click-to-pet · mode pop)

- PR #65 (branch `feat/office-pet-delight`), feature (extends #39). Origin: 4-expert panel judged the pet "tasteful wallpaper" vs the owner's "obviously interesting" goal (live-measured ~18px speck); guardian reframe = push delight INTO the signal, novelty OFF the timer.
- **Shipped**: `PET_BASE_SCALE` 1.7 (pet ~18→~30px, readable; wander band tightened off desks + the coffee-machine click target); deploy/eureka ✦ confetti spotlight (real celebrate event, once per event, RM-suppressed); click-to-pet ♥ (cosmetic, never touches mode); squash-stretch `pet-pop` mode-change beat (felt, not faded). All in `OfficePet.jsx` + `index.css`.
- **Honesty/calm-tech intact**: real-signal-only, reduced-motion suppresses all new motion, no fake narrative, hide-on-blocker untouched (delight code is all downstream of mode). Protected Surfaces untouched. Reviewer PASS (2 LOW fixed: pet off the coffee-machine click target, aria-hidden wrapper). Suite **1328 passed**; build clean. DEV live-verified: pet ~30px, pet-pop on mode change, click→♥, celebrate→confetti.
- **Deferred (panel, open)**: run-to-blocked-desk (read-only agent.position); distinct vacuum per-mode silhouettes; ControlPanel ⚙ settings-popover consolidation.

### Ship-feat-office-pet-types-2026-06-08 (#39 — multiple pet types: cat / robot-vacuum / dog)

- PR #64 (branch `feat/office-pet-types`), classification feature (extends #39). Cosmetic personalization, panel-capped at 3 types.
- **Shipped**: `src/components/petSprites.jsx` — `PetSprite({type,mode})` (extracted `CatSprite` byte-faithfully + new `VacuumSprite` (disc + mode-coloured LED) + `DogSprite` (floppy ears/snout/wag)). `petState.js` adds `PET_TYPES`/`nextPetType`/pure `petMotionGrammar` (Roomba=linear easing/no bob, dog=bigger bob, explicit `bobKeyframe`). `petType` store field (default cat, `office-pet-type` key, validated vs PET_TYPES) + `cyclePetType`. ControlPanel 🐾 on/off + change-pet button + en/zh-TW aria. `pet-bob-lg` keyframe.
- **HONESTY INVARIANT**: a type changes ONLY the sprite + motion grammar — `derivePetState`/`resolvePetMode` take no `type` arg, so a real blocker → hide for EVERY skin (red-team-confirmed: no skin can paint a happy state while an agent is blocked; vacuum LED is red on hide/alert).
- **Review**: 1 acx-reviewer → PASS (cat extraction byte-faithful, no circular import store↔petState, SSR+localStorage validated, protected surfaces untouched, i18n parity); 2 LOW advisories fixed (explicit bobKeyframe, dropped unused turnInPlace). **Tests**: +5 (PET_TYPES/nextPetType/petMotionGrammar + cyclePetType persistence + type-independence honesty); suite **1328 passed**; build clean. DEV live-verified: cycle cat→vacuum→dog→cat persists; each skin renders; dog+blocker → alert/hide.

### Ship-feat-office-pet-v2-2026-06-08 (#39 v2 — pet optimizations: scaling · alert/celebrate · cross-fade)

- PR #63 (branch `feat/office-pet-v2`), classification feature (extends #39). Spec §v2 in `docs/specs/office-pet-barometer.md`. Origin: 4-expert research panel (game-design · game-feel · calm-tech · feasibility).
- **Shipped**: `petReadabilityScale(sceneScale)=clamp(1/√scene,1,1.6)` (legible when docked small; size-as-signal vetoed as dishonest). Two transient states via pure `resolvePetMode({base,alert,celebrate})` — `alert` on a NEW-blocker edge (settles to hide), `celebrate` on real eureka/deploy-success (only when not hiding). **Honesty guarantee preserved** (neither shows happy during a real blocker). 220ms mode cross-fade (`pet-fade-in`). alert uses a two-effect timer (owned by `alert`) so an oscillating blockedCount can't leave it stuck (same class as the earlier perk fix, caught in live test).
- **Review**: 1 acx-reviewer → PASS; honesty airtight by construction + unit-proven; both transient effects leak/stuck-free; protected surfaces untouched. **Tests**: +6 (`resolvePetMode`, `petReadabilityScale`); suite **1323 passed**; build clean. DEV live-verified: alert fires+auto-clears, petScale 0.25→1.6 / 0.64→1.25.
- **Deferred**: multiple pet types (cat/robot-vacuum/dog, cosmetic) → next PR.

### Ship-feat-office-pet-barometer-2026-06-08 (#39 / AVO-121 — signal-driven office pet)

- PR #62 (branch `feat/office-pet-barometer`), classification **feature**. Closes #39 (AVO-121). Spec: `docs/specs/office-pet-barometer.md` [shipped].
- **Origin**: 5-expert brainstorm (game-design · game-feel · calm-tech · feasibility · product). Draggable agents REJECTED 4/5 (breaks position=truth, fights movement system, touches protected `AgentCharacter`). Decorative pet flagged anti-calm. Convergent + user-selected: **pet-as-barometer** — keep the charm, make behavior an HONEST readout of real office state.
- **What shipped**: `src/systems/petState.js` pure `derivePetState({mood,blockedCount})` (mirrors `moodToWeather`; `hide` ALWAYS wins on a real blocker = honesty guarantee; idle→nap, smooth/rushing/intense→excited, stuck/frustrated→hide, normal→wander). `src/components/OfficePet.jsx` ambient cat: mode→pose, slow CSS-glide wander reusing pure `clampToFloor` (NO calculatePath/HOME_POSITIONS/agent coords — Protected Surfaces untouched), reduced-motion→static, transient perk on real eureka/deploy-success (resets when event clears). `officePet` store toggle (default ON, `office-pet` localStorage key) + ControlPanel 🐈 + en/zh-TW aria. `pet-snooze`/`pet-bob` keyframes in `index.css` (CSP-safe).
- **Review**: 2 parallel acx-reviewers (correctness + scope/protected/AC) → both **PASS**; all 6 ACs proven; 1 LOW (stuck-perk edge) fixed; protected surfaces untouched; i18n parity; no scope creep.
- **Tests**: +6 (`tests/petState.test.js`). Full suite **1317 passed / 58 files**; build clean. DEV live-verified incl. blocked→hide honesty guarantee, on-floor placement, toggle-off removal, reduced-motion static.

### Ship-fix-issue-sweep-52-45-47-2026-06-08 (3 open bugs: roster null-status · weather CPU toggle · bubble edge clip)

- PR #59 (https://github.com/KbWen/agent-virtual-office/pull/59), branch `fix/issue-sweep-52-45-47`, classification quick-win. Closes #52, #45, #47. Opened for human merge (main protected); SSoT Ship History committed into the SAME PR.
- **#52** `src/utils/normalizePost.js` — the `office-status` ingestion path dropped any agent whose `status` was null/undefined/invalid (the filter discarded the whole agent → it vanished from roster/office). Now a valid role is KEPT and status coerces to the known-safe `'idle'` enum; an unknown/invalid ROLE is still dropped (identity has no safe fallback). The existing "filters out invalid statuses" test contract was updated to "coerces … to idle".
- **#45** weather-animation CPU toggle — new persisted `weatherEffects` store flag (default ON, `office-weather` localStorage key, same pattern as isPaused/rosterMode) + `toggleWeatherEffects`; `PixelOffice` feeds `weatherReduced = reducedMotion || !weatherEffects` to all 12 WallWindow sites; ControlPanel 🌧/🌤 button; en/zh-TW `aria.weatherOff/On`. OFF → static weather (no per-frame rain/cloud/lightning). `prefers-reduced-motion` still forces static regardless. Data paths untouched.
- **#47** speech-bubble horizontal edge clamp — pure exported `computeEdgeShift` in `BehaviorBubble.jsx` shifts the box within `[edgePad, sceneW−edgePad]` while the tail stays anchored on the agent; `AgentCharacter` passes `absX={pos.x} scale={labelScale}`. Back-compat: no scene context → centered as before. **Protected Surface** (bubble positioning) — math unit-proven + live-measured 0-clip/0-regression, but final extreme-edge pixel confirm is owner-only.
- **Tests**: +18 (`normalizePost` +5, `weatherEffectsToggle` 3, `bubbleEdgeClamp` 8, store `sceneBounds` 3). Full suite **1307 passed / 56 files**; vite build clean (~417 KB JS / 31 KB CSS). #45 verified end-to-end in the running app via store import.
- **Review** (3 parallel subagents — correctness / scope+protected-surface / test-quality): scope & test reviewers PASS; correctness reviewer found 1 MED — the #47 clamp hardcoded `sceneW=800`, so **panel mode** (cropped viewBox) mis-clamped and still let bubbles clip the crop. FIXED: `store.sceneBounds` now publishes the active viewBox x-range (PixelOffice → AgentCharacter → `computeEdgeShift({sceneMinX, sceneW})`); default office (minX:0,w:800) is byte-identical. Also hardened the tail-anchor inset (LOW). All LOW test gaps (magnitude assert, edge-flush boundary, panel-bounds) closed.
- **Tooling note**: `preview_screenshot` re-tested fresh this session — times out (30s) even with animations frozen AND with SVG hidden (near-blank page) while eval/console/snapshot respond → the hang is the screenshot TRANSPORT in this environment, not the app. Visual proof path = `getBoundingClientRect` measurement.
- **Known (pre-existing, not from this PR)**: validator `illegal gate phase progression: 2` comes from two completed local work logs (`main.md`, `fix-watchdog-…`) that the validator concatenates into one gate chain; they are gitignored and never shipped.

### Ship-docs-audit-baseline-2026-06-05

- Documentation-baseline consolidation: 8 audit findings (`docs/reviews/2026-06-05-audit.md`) remediated as doc-only, reversible changes. No `src/`/`tests/` touched.
- **F1** SSoT 347→206 lines (Ship History pre-2026-06-02 rotated to `docs/specs/_ship-history-archive.md`); **F2/F3** L2 decision logs backfilled with the ux-vibe-rebalance wave (`ui-rendering`+`office-runtime`); **F4** `ARCHITECTURE.md` current-model banner; **F5** ADR-001 dedup + stale-path fix; **F6** ADR-001/002/003 YAML+lifecycle frontmatter; **F7** CORRECTED — the rebalance wave is ALREADY merged to `main` via squash PR #44 (`012d0f2`); the original "unmerged baseline divergence" claim was a stale-SSoT propagation error caught in `/review`.
- **Review**: 3 fresh acx-reviewers (governance / doc-accuracy / scope) + 1 fresh re-review. Governance + scope PASS first-pass (rotation lossless 24=6+18 reconciled, guards CAS-verified, 0 source files). Doc-accuracy found 1 CRITICAL (stale merge-state) → fixed → re-review Resolved.
- **Guarded writes**: `current_state.md` + `_product-backlog.md` via `guard_context_write.py` (CAS, receipts).
- Tests: Pass (`validate.sh` 0 fail; app vitest unaffected — no source change).

> [!NOTE]
> **Reconciliation (2026-06-05):** the four `feat-ux-vibe-rebalance-*` cycles below were written before squash PR #44 merged. As of 2026-06-05 that wave IS merged to `main` (`012d0f2`, v1.2.0); their "NOT pushed/merged" / "Remaining for human: push/merge" lines are stale, preserved only as historical record. `main` is canonical; `feat/ux-vibe-rebalance` is superseded dev history (git-verified: `src/` identical main↔feat, main 3 commits ahead).

### feat-ux-vibe-rebalance-2026-06-05 (final pre-merge hardening + ship closure)

- Branch `feat/ux-vibe-rebalance`, classification feature. Branch closed for merge (owner-directed; main protected → human owns the protected-remote push/PR). Final HEAD `1a708bf`, 59 commits ahead of `main`, clean fast-forward (main behind 0).
- **Agent-clustering fix ("4 piled, one disappeared")** — root cause: group-event gather (`store.setMultipleAgentGroupEvents` / `setAgentGroupEvent`) wrote `groupTarget` with NO inter-agent separation, so participants stacked on one cell and the y-ordered opaque SVG sprite on top fully occluded the ones beneath. Fix: deconflict every gather target through `clampToFloor` + `avoidOverlap` (push ≥ `MIN_AGENT_DIST`) at the store chokepoint — one fix covers ALL group events; the "disappear" is cured by never fully overlapping.
- **Test-gap closure** — every prior movement test checked agent-vs-MAP only; NONE checked agent-vs-AGENT (why the suite stayed green while sprites stacked). Added `tests/agentSeparationInvariants.test.js` (+5), incl. the exact-bug case "all participants assigned the SAME cell must fan out" (FAILs pre-fix).
- **Fresh-eyes pre-merge sweep** — independent full-branch-diff reviewer: **0 HIGH / 0 MED**; no debug leftovers / `.only` / dup exports; i18n en/zh-TW parity intact. Only 2 LOW pre-existing cosmetic items (not on this branch).
- **Verification**: vitest **1276 passed / 53 files** (+ moodFeedGate, statusBubbleDedup, agentSeparationInvariants over -04b), build clean (414.80 KB JS / 31.05 KB CSS), `validate.sh` **0 fail**. Behavioral logic test-authoritative; **pixel/visual still pending owner confirm** (screenshots broken; eval can't reach the app store).
- **Deferred**: AVO-144 — sustained free-movement (in-transit) per-frame separation still has no agent-vs-agent push (lower-severity transient pass-through; the visible pile-up/disappear is fixed). AVO-141/142/143 unchanged.
- **Remaining for human**: protected-remote push / PR-close; visual confirm + v1.2.0 screenshot/GIF re-capture.

### feat-ux-vibe-rebalance-2026-06-04b (responsive fill + living-office-events honest liveliness)

- Branch `feat/ux-vibe-rebalance`, classification feature. **Committed to branch (8 commits), NOT pushed/merged** — for human PR review (main protected). Owner-directed UX follow-on; living-office-events has its own spec `docs/specs/living-office-events.md` (DRAFT, review-gated). Screenshots broken in env → **all verification is test/measurement-based; PIXEL appearance pending owner visual confirm at PR time.**
- **Responsive fill** — office now spans full browser WIDTH at every pane shape (`PixelOffice` svg width-driven via `aspect-ratio: 800/560` + center + clip; `b61e020`) fixing the left/right-whitespace complaint; roster fills width (drop `max-w` gutters; `ad1db61`); top-row agents' speech bubbles flip BELOW when they'd clip the office top edge (`BehaviorBubble` `below` prop; `52ba139`). Measured via getBoundingClientRect across sizes.
- **living-office-events** — the office now HONESTLY reflects real work without faking status, via a 3-expert roundtable (game/AI-systems/calm-tech) ×2 + 2 code audits + adversarial review (all R1/R2 honesty rules upheld in code). 4 phases:
  - **P1 (`a6c6668`)** L2 derived team-affect: transient `teamPulse` (room "leans in" with real-signal density) + `focusAnchor` (idle agents orient toward the live desk via new `setAgentFacing`), UNTRACKED-only (a tracked desk is never modulated — R1). Derived in `moodEngine.updateStoreMood`.
  - **P2 (`2a5d7c0`)** honesty gating: 5 work-claim events (deploy-success/ops-dev-deploy-check/dev-arch-disagree/eureka/review-debate) fire ONLY with a matching real signal within `WORK_CLAIM_SIGNAL_WINDOW` (90s); random floor scaled-not-muted when live (`floorTickAllowed`, incl. fallback sessions).
  - **P3 (`5a288b6`)** reluctant participant: a tracked agent torn by a set-piece shows a sub-dominant ⏳ (PURE OVERLAY — `store.reluctant`; never touches status/behavior/bubble/position; real bubbles preempt).
  - **P4 (`6f...`/real-seed)** the CAUSAL real→event link (closes owner's "沒有驅動任何一件事情"): a real-signal EDGE (mood→smooth/frustrated, Ops→done, SubagentStart) immediately fires the matching event — honesty-gated + mutex'd + 120s per-event cooldown.
  - **Review + measurement**: 3-lens adversarial /review (correctness PASS, regression PASS w/ 2 fixes applied, honesty surfaced the causal gap → P4 built); extracted pure `resolveFocusFacing` + exported `floorTickAllowed` for AC-4/AC-7 measurement tests.
- **AC**: AC-1✅ AC-2✅ **AC-3⚠️** (structural dominance enforced+tested — overlay never touches live channels; pixel dominance + keep-out routing design-asserted, needs owner visual confirm) AC-4✅ AC-5✅ AC-6✅ AC-7✅.
- **Verification**: vitest **1271 passed / 52 files** (+~50: teamAffectL2 ×13, eventHonestyGate ×6, realSeedTriggers ×6, teamAffectMeasure ×7, gatherTargetsOnFloor ×2, statusBubbleDedup ×4, moodFeedGate ×4, +responsive guards), build clean, validate 0 fail. Behavioral logic test-authoritative (vitest = real modules, no dup); live preview_eval CANNOT drive the app store (module-duplication) + screenshots broken → pixel/visual confirm pending owner.
- **Post-review QA hardening (owner-driven, this session)**: fixed a whole bug CLASS — side-effects firing per-poll instead of per-change. (1) speech bubble, (2) activity-feed push, (3) moodEngine feed (`changedUpdates`) now all gate on a real status/task change → killed the "every character suddenly speaks for no reason / refresh feeling" + false `rushing`/weather inflation. Audit confirmed ledgers/deskItems/notifier/handoff/router/integration-fields already correctly guarded. Adversarial re-review: all fixes correct, no regressions/over-gating, GO. Deferred AVO-143 (no-op agent re-alloc, perf-only). Also: standup gather-spots respread + `clampToFloor` on all groupTargets (no agent in walls); P4 real-seed global-cooldown + no all-gather on SubagentStart; OT→OVERTIME; README EN+zh de-AI'd + slimmed (detail → ARCHITECTURE.md); v1.2.0 + CHANGELOG.
- **Remaining for human**: PR review + visual confirm (⏳/lean-in/orientation tells, standup no-pile, fonts) + re-capture v1.2.0 screenshots/GIF + push/merge. Optional deferred: AVO-141/142/143, AC-3 keep-out routing, Standby-roster richness, overlay-pull.

### feat-ux-vibe-rebalance-2026-06-04 (POINT 2 readable labels + COMMS vertical living-feed rebuild)

- Branch `feat/ux-vibe-rebalance`, classification feature. **Committed to branch, NOT pushed/merged** — for human review (main protected). Informal owner-directed UX follow-on (beyond the frozen `ux-vibe-rebalance` spec; re-spec if formalizing). Autonomous session (user delegated full completion + stepped out).
- **POINT 2 (`75038c3`)** — in-scene text stays readable as the office scales below native: `store.sceneScale` (measured `meet` scale, svgRef + ResizeObserver + 600ms self-heal poll for the throttled webview) drives counter-scaling of agent name/status/bubble (cap 1.5, anchor-preserving grow-in-place — overlap guard), the click-inspector popover (cap 2.5), the event banner, desk nameplates + room headers. Faint area-labels + decoration left small. Verified 320–1280px: readable, 0 overlap/clip, desktop ~unchanged.
- **COMMS vertical living-feed rebuild** — the ☰ roster went from a flat lifeless list to a living **presence rail + activity feed**, per a **5-expert design roundtable** (game-feel · UI/chat-UX · operator · systems-engineer · calm-tech; unanimous REFINE). Commits: **`a01a64c`** P1 rail (2-tier salience — blocked pins top, only blocked reorders; idle dimmed in place; honest quiet state; `rosterModel.js` pure logic + `origin`-tagged activityLog + handoffs logged), **`130649a`** P2 feed (real-events-only, heartbeat/health dot, 🔔 notify), **`1988e74`** P3 juice (feed fade-in, tap-to-focus), **`3c5dc18`** fix review HIGH-1 (separate bounded `eventFeed` — organic theater could otherwise evict real events from activityLog's write-time 50-cap), **`9d20dcb`** review LOW (shared FEED_ORIGINS source).
- **Key design correction (live testing)**: a 3-tier active/idle sort thrashed under live churn → collapsed to 2 tiers (only blocked reorders). **Key proof technique**: dep-free SSR render tests (react-dom/server) since the live office is wired to the active Claude session whose hook poll races injected statuses.
- **Verification**: vitest **1222 passed / 45 files** (+32: rosterModel, activityOrigin incl. eventFeed-survival regression, narrowRosterOrder SSR), build clean, 0 console errors, i18n en/zh-TW parity. Live-verified each phase (the feed even showed this session's real events). Independent acx-reviewer: round-1 NOT READY (HIGH-1) → fixed → **round-2 READY**.
- **Remaining for human**: review + push/merge the branch. Then the deferred additive-juice wave (AVO-133–136) + density dial (AVO-137).

### feat-ux-vibe-rebalance-2026-06-03 (UX Vibe Rebalance — deletion/demotion core)

- Branch `feat/ux-vibe-rebalance`, classification feature. **Committed to branch, NOT merged** — for human review/merge (main is protected). Spec `docs/specs/ux-vibe-rebalance.md` [Frozen].
- Sourced from a 5-lens expert design panel (game-designer · calm-tech · first-time-user · audience-readability · clutter-auditor). Verdict: "cute engine with a dashboard bolted on" → cure = deletion, default density glance-L1, detail on-demand. Owner approved "do all"; this branch ships the deletion/demotion core (AVO-126/127/128/129/131/132). Additive juice (AVO-133–136) + density dial (AVO-137) deferred.
- **AVO-126** — `bashVibeLabel` in `public/hooks/office-status-hook.js`: Bash bubbles map to office nouns (測試/建置/檔案/git/…), never a raw command or path, across working/done/error frames. +5 unit tests incl. a path-leak invariant.
- **AVO-127 / AVO-129** — `ControlPanel.jsx`: 🪙 token meter and ✓/✗ KPI removed from the persistent bar (full + panel); both surfaced on-demand (full = "?" popover; panel = hover tooltip + sr-only mirror). Data paths (tokens, ledgers) untouched.
- **AVO-128** — `AgentCharacter.jsx`: name tags revealed only when an agent is non-idle OR hovered; hidden at idle rest (identity rides on sprite+color+desk). Session badge + status icon unaffected. Live-verified 8/8 idle→no name, working→name.
- **AVO-131** — removed the in-scene monospace TaskLabel pill (+ dead `currentTask`/`classifyTask`); the tool now shows only in the AgentInspector (`inspectorTaskLabel`).
- **AVO-132** — removed the separate violet ThinkingAura; effort (high/xhigh/max) now folds into the single working glow ring's intensity (op+stroke). Live-verified exactly 1 ring/sprite.
- **Verification**: vitest 1042→1047 (+5), build clean (390.97 KB / 122.62 KB gzip, −1.5 KB), 0 console errors; live DOM/store ground-truth confirmed each AC.
- **Review**: independent acx-reviewer on the diff — round 1 NOT READY (AVO-129 panel on-demand gap) → fixed → round 2 PASS. Accepted scoped deviation: `planning` status loses its ring (still has gantt+expression+name; no `STATUS_COLORS` entry) — documented in spec `## Review Deviations`.
- **Remaining for human**: review + merge branch `feat/ux-vibe-rebalance`; then the additive juice wave (AVO-133–136) + density dial (AVO-137), which benefit from owner visual review.

### Ship-chore-migrate-agentic-os-v1.2.0-2026-06-02 (governance brain migration + SSoT reconciliation)

- Migrated the governance brain from **AgentCortex v5.4.0** (source repo went private) to public **Agentic OS v1.2.0** (`source_commit 2354c5f`). Delivered on branch `chore/migrate-agentic-os-v1.2.0` / PR #32 (kept open for human review — NOT merged at this ship).
- 136 framework files (65 new / 68 updated / 3 deprecated-removed). App `src/`/`tests/` untouched; `npm test` 1042 passed; build clean; CI Node 20/22 green.
- **SSoT reconciliation (this ship's guarded write)**: corrected the ADR Index — added the previously-missing `docs/adr/ADR-002-multi-worktree-session-design.md` and switched to the plain-path format (no backticks) so the v1.2.0 validator's reverse-check no longer reports phantom entries. Clears the `SSoT ADR Index completeness` FAIL.
- Also (separate commits on the same branch): added v1.2.0-required lifecycle frontmatter to `_product-backlog.md`.
- **Remaining post-migration drift (NOT fixed here, by design)**: 13 Global Lessons not yet hash-chained (`[prev:]`), and 3 shipped specs (`agent-inspector-info-enhancement`, `character-growth-system`, `clickable-office-objects`) declare `primary_domain` without a `## Domain Decisions` section — both surfaced only because the v1.2.0 validator is stricter than v5's. Tracked for a deliberate follow-up.

### Ship-codex-virtual-office-movement-server-tests-2026-06-02 (movement pathing fix + regression hardening)

- PR #25 (https://github.com/KbWen/agent-virtual-office/pull/25), branch `codex/virtual-office-movement-server-tests`. Classification quick-win. CI green (Node 20 & 22); 1042/1042 vitest; Vite build clean. SSoT + work-log archive committed to the SAME PR (per user instruction, not a separate closure PR like #24).
- **Codex base work (040afc8, 3471808)**: zone-aware `calculatePath` rewrite — door-side approach points, per-zone routing (main office route graph / meeting-table detour / lounge corridor), entrance zone aligned to the visual floor; static agents flagged `returnHomeOnIdle` on external-status clear and `AgentCharacter` walks them home; DOM test hooks `data-agent-id|status|behavior`; non-walking visual-position sync; favicon; deep pathing + multi-task regression suites; deep-sim timeout stabilization.
- **Hardening batch (77c89d3, 2b450e7)** — added this session:
  - Latent bug fixed: right-aisle corridor node `{550,290}` sat INSIDE the whiteboard obstacle once the whiteboard joined the line-crossing set (`MAIN_OFFICE_OBSTACLES = slice(0,9)`), making it a dead, never-selectable pathfinding node. Moved to `{505,290}` (left of whiteboard x≥525). Strict non-regression.
  - Exported `MAIN_ROUTE_NODES`, `DOOR_SIDES`, `getZone` (additive).
  - `tests/movementLayoutInvariants.test.js` (4): route nodes / door anchors must be on-floor, off-furniture, in their claimed zone, door anchors joined by an on-floor segment — guards against hardcoded-layout drift (which is exactly how the dead node slipped in).
  - `tests/returnHomeLifecycle.test.js` (3): `clearExternalStatus` flags every static role to return home; intent consumed exactly once (idempotent, idle-safe); every return route TERMINATES at home (≤2px) — the endpoint guarantee the deep test lacked.
  - `tests/movementPathingFuzz.test.js` (1, 1000 seeded mulberry32 pairs): randomized room-to-room routes never cross a wall or furniture. Zero violations.
  - Observability: RAF watchdog in `AgentCharacter.jsx` now calls `store.recordWatchdogRestart()` + DEV `console.warn` instead of restarting silently. New transient `watchdogRestarts` store field (excluded from persisted snapshot — verified) + 2 store tests.
- **Decision**: favicon PNG/apple-touch-icon fallback intentionally NOT added — without a real binary asset it would 404, regressing the console-cleanliness the SVG favicon was added for. Out of proportion to value.
- **Review**: 0 security findings (A01–A10); secret scan clean (only AVO-108 LLM-token references); no dependency changes; Red Team not auto-triggered for quick-win.
- **Known (pre-existing, not from this work)**: validator reports README mojibake + document-governance + `plan->ship` gate-chain FAILs — all diagnosed earlier as framework false-positives / codex-log gate-naming, none touched by this PR.

> [!NOTE]
> **Ship History older than 2026-06-02 was rotated to [`docs/specs/_ship-history-archive.md`](../../docs/specs/_ship-history-archive.md) on 2026-06-05** to keep this SSoT readable in a single pass. The entries above are the current / active feature cycles; the archive holds the full historical record (v1.1.0 classifier wave, v0.10 vitality, and earlier).

### Ship-fix-watchdog-false-restart-long-commands-2026-06-06

- PR #56 (https://github.com/KbWen/agent-virtual-office/pull/56), external fork `duongynhi000005-oss`, classification quick-win. Fixes #50. Squash-merged as `b246587`.
- **Fix**: the **behavior watchdog** (`AgentCharacter.jsx`, 90s `WATCHDOG_TIMEOUT`) was force-restarting the scheduling chain — resetting the agent's visual posture — whenever a long-running command (compile/test/install) kept the behavior value unchanged past the timeout. It now skips the restart while behavior is held externally. Distinct from the walk/RAF watchdog (`:791`, dropped-frame trigger) that emits the `recordWatchdogRestart()` console line — separate mechanism, left out of scope.
- **Maintainer follow-up (`221c45d`)**: extracted a pure exported `shouldSkipBehaviorWatchdog(agent)` in `constants.js` (covers group-event + active-session skip; one call replaces two duplicated branches; Set is module-level). Added `planning` to `ACTIVE_SESSION_STATUSES`. Removed orphaned `INFERRED_STATUSES` + stale docstring in `idleGapInfer.js`.
- **Tests**: `tests/behaviorWatchdog.test.js` (13 cases) — pins the skip set AND asserts ambient statuses (idle/done/unknown) are NOT skipped. Full suite **1289/1289 (54 files)**; build clean.
- **Lockfile**: regenerates a drifted `package-lock.json` (was 1.1.0/devDeps vs package.json 1.2.1/deps → broke `npm ci`). No new pkgs, no integrity/registry change.
- **Review**: 5-axis + OWASP A01–A10 + secrets clean; 1 MEDIUM advisory (two-watchdog scope), 1 LOW accepted (watchdog suppressed for full active lifetime, mitigated + tested).
- **Ship incident (self-corrected)**: the first ship commit used `guard_context_write.py` with a guard receipt (`337ffd90`) cached from a prior codex session; `replace` mode wrote stale seq-26 content over this consolidated SSoT, dropping the 7 most recent Ship History entries. Caught in post-merge verification; current_state.md restored from `5c4bf49` + this entry, re-committed directly. Lesson: do not reuse stale guard receipts across sessions; verify SSoT seq/entry-count after a guarded write.
- Tests: Pass

### Ship-feat-avo-130-control-bar-reduction-2026-06-13 (#116 — control-bar reduction: single health dot + gear demotion)
- Feature shipped: AVO-130. The resting control bar's 2–4 side-by-side connection/integration pills (live / fallback / API-offline / API-retrying) collapse into ONE focusable health dot whose color encodes the single highest-severity state (precedence offline > degraded > fallback > live > idle, pure-tested `healthDotState`). Language switch, list-view (☰), run-workflow, help (?), and the platform label demoted off the bar into the ⚙ gear menu / info popover. Resting cluster = health-dot · pause · ⚙. Applied in both full and panel mode.
- Honesty/legibility guard: agent presence rail + STATUS_COLORS untouched (the #1 status channel); trouble states auto-show their inline label (not hover-only) so a real offline/degraded/fallback is never hidden; calm states reveal detail on hover/focus/click. Global L/Space shortcuts still work.
- Spec: docs/specs/control-bar-reduction.md (status: shipped; §4.4 DSoT for procedural UI). Commit 8947d3e.
- SSoT written directly (not via guard_context_write.py) to avoid the known stale-receipt bug; logged in Work Log Drift Log. Knowledge consolidation: spec has no `## Domain Decisions` block + this is an incremental UI re-layer covered by existing `ui-rendering` L1 — no new domain decision; consolidation skipped with justification.
- Tests: Pass (6 new healthDotState unit tests; full suite 1943; vite build clean 460.88 kB; render-smoke PASS 4 viewports / 0 errors; live preview + Playwright responsive checks).

### Ship-feat-avo-104-skill-activation-badge-2026-06-13 (#30 — skill activation badge: transient skill bubble)
- Feature shipped: AVO-104. Claude skill activation (SubagentStart: /review, /plan, /implement, /test, /ship, /research) now surfaces per-agent as a transient skill speech-bubble ("🧐 Reviewing") routed through the EXISTING bubble system — the honest Option B chosen by a 4-lens game-design panel (cozy/systemic/juice/calm-tech) over re-adding over-head chrome (AVO-131 declutter line held). One registry change: `skill` added to `AGENT_CARRY_FIELDS` + `FIELD_SANITIZERS` (statusFields.js), auto-propagating through inferStatus/agentRouter/store/normalizePost (AVO-146). `skillBubbleText` + a skill branch in contextBubble.js (gated on working — never blocked/done). i18n `skillBubbles` map en+zh. Hook stamps `skill` on SubagentStart, clears for other agents (transient).
- Honesty guard: skill = working-tier priority (below blocked/done in the existing cap); never suppresses the AVO-110 reason glyph; auto-expires on the existing bubble timer; no new over-head element; optional field (absent = byte-identical). Store→bubble link proven by a deterministic store test.
- Spec: docs/specs/skill-activation-badge.md (status: shipped; §4.4 DSoT + panel). Commits ce7aaf0 (spec) + 4636c92 (impl).
- **Branch note**: this branch was rebased `--onto main` to drop two AVO-130/#116 commits it had inadvertently inherited (cut from the #116 branch) — it is now independent. #116 (PR #142) and this PR both touch SSoT seq + Ship History + backlog; whichever merges second must rebase (trivial: distinct rows/sections, seq line + INDEX chain re-stitch).
- SSoT written directly (not guard) to avoid the known stale-receipt bug; logged in Work Log Drift Log. Knowledge consolidation: spec has no `## Domain Decisions` block; incremental client bubble feature covered by existing `hook-integration`/`ui-rendering` L1 — consolidation skipped with justification.
- Tests: Pass (13 new incl. store→bubble + drift-guard skill survival; suite 1952; build 462.08 kB; render-smoke PASS).

### Ship-feat-avo-136-event-juice-2026-06-13 (#117 — event juice pass: rare meaningful moments)
- Feature shipped: AVO-136. Scoped game-feel juice over EXISTING rare events — deploy-success → one-shot capped ✦ office-confetti burst, eureka → small ✦ sparkle ring near the whiteboard, desk-slam → brief LOCAL jitter on the affected agent only (SVG `<animateTransform additive="sum">` so it composes with the sprite's translate/scale; a CSS transform would override positioning). Review/boss reaction beats already covered by existing officeLife handler expression flips.
- Pure `juiceForEvent` / `shouldShakeDesk` resolver (`src/systems/eventJuice.js`, unit-tested): returns null under reduced-motion (motion fully disabled — event still conveyed by bubbles/behaviors) and for any non-juiced event (rare-only, no idle loop). EventJuice overlay is pointer-events-none, particles keyed by event id (replay once per event, anti-nag), transient <1.2s — never hides status. Confetti/sparkle keyframes bundled in index.css (CSP-safe). No new events, no store flag.
- Spec: docs/specs/event-juice-pass.md (status: shipped; §4.4 DSoT). Commits 2dfd670 (spec) + 1ce15b0 (impl). Built on main AFTER #116/#30 merged (no SSoT conflict).
- SSoT written directly (not guard) to avoid the known stale-receipt bug; logged in Work Log Drift Log. Knowledge consolidation: spec has no `## Domain Decisions`; incremental cosmetic overlay covered by existing `ui-rendering` L1 — skipped with justification.
- Tests: Pass (6 new eventJuice unit tests; suite 1963; build clean; render-smoke PASS 4 viewports / 0 errors; live — deploy GO click rendered 14 office-confetti particles, 0 errors).

### Ship-feat-avo-107-review-gate-queue-2026-06-13 (#112 — gate "waiting" in-tray: honest reframe of review-gate queue)
- Feature shipped: AVO-107. A 4-lens office/management-sim game panel (office-sim · cozy · calm-tech honesty skeptic · multi-agent-studio) reframed the "review-gate queue" into an HONEST gate-desk "waiting" in-tray. The only per-agent waiting signal AVO owns is `awaiting-approval` (idle-gap inferred from blocked+90s) — it does NOT prove "submitted for review", so: driven SOLELY by live `awaiting-approval` count (never `activeWorkflow` membership, already drawn as AVO-105 arrows); copy = existing "waiting on you"; soft/inferred styling (no urgent red); NO per-agent type glyph (no per-agent phase) — at most ONE optional global phase glyph (review/ship); aggregates N waiters into ≤3 askew sheets + true count; invisible at 0; clears the same frame a waiter resolves.
- Pure unit-tested `gateWaiting`/`gatePhaseGlyph` (`src/systems/reviewGate.js`) + `GateWaitingTray` pure overlay at the gate desk (R1: never relocates an agent; complements AVO-105 arrows as the "landed & still waiting" resting state). role=button + aria-label + Enter/Space; reduced-motion drops the settle; click reveals waiters tagged "inferred".
- Spec: docs/specs/review-gate-waiting.md (status: shipped; §4.4 DSoT + panel). Commits ecfa319 (impl) + spec. Built on main AFTER #116/#30/#117 merged → conflict-free.
- SSoT written directly (not guard) to avoid the stale-receipt bug; logged in Work Log Drift Log. Knowledge consolidation: spec has no `## Domain Decisions`; incremental overlay covered by existing `ui-rendering` L1 — skipped with justification.
- Tests: Pass (5 new reviewGate unit tests; suite 1968; build clean; render-smoke PASS 4 viewports / 0 errors; live — a blocked gate agent idle-gap-flipped to awaiting-approval after 90s and the tray rendered with aria-label "1 waiting on you", 0 console errors).

### Ship-feat-avo-123-theme-selector-2026-06-13 (#41 — office theme selector: lightweight overlay-grade)
- Feature shipped: AVO-123. Office theme/skin selector as a LIGHTWEIGHT global tint grade — one full-office rect rendered BENEATH the agent/status layer (the AVO-111 lighting mechanism), NOT a 150-fill re-color. Opt-in ⚙ swatch radiogroup, persisted (`avo.theme`). Ships Default + Winter + Autumn (light tints).
- A 3-lens game panel (cozy art-director · legibility skeptic · office-sim) chose the overlay-grade approach; a per-theme × per-status WCAG **contrast guard** (unit test) then DROVE the theme set: DROPPED Dark (a genuinely-dark tint pushes working-amber→1.36 / idle-gray below the guard; one faint enough to pass ≤0.08 doesn't read as dark; night lighting already gives an honest dark mood), and deferred Retro (needs per-sprite remap) + Cyberpunk (saturation endangers ring contrast). Guards: opacity cap 0.20 + summed (theme+lighting) cap 0.45 (lighting wins) + the build-failing contrast test. Status sits above the tint → never recolored.
- Spec: docs/specs/office-theme-selector.md (status: shipped; §4.4 DSoT + panel). Commit a38adcb. Built on main AFTER #116/#30/#117/#112 merged → conflict-free.
- SSoT written directly (not guard) to avoid the stale-receipt bug; logged in Work Log Drift Log. Knowledge consolidation: spec has no `## Domain Decisions`; incremental overlay covered by existing `ui-rendering` L1 — skipped with justification.
- Tests: Pass (7 new theme unit tests incl. the contrast guard; suite 1975; build clean; render-smoke PASS 4 viewports / 0 errors; live — Winter swatch applied an `rgb(150,180,210)@0.14` tint beneath the status layer + persisted to localStorage, 0 console errors).
