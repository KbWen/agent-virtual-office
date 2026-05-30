# Project Current State (vNext)

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
- **Last Updated**: 2026-05-30
- **Update Sequence**: 26
- **ADR Index**:
  - `.agentcortex/adr/ADR-001-vnext-self-managed-architecture.md`
  - `docs/adr/ADR-003-status-source-parity-for-codex.md`
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

- [Category: global-memory][Severity: MEDIUM][Trigger: archive-handoff] Branch-local lessons are lost after archival. Use the Global Lessons registry for repeatable patterns that should survive work log rotation.
- [Category: format-safety][Severity: HIGH][Trigger: apply-patch-line-numbers] Do not copy line numbers from view tools into edits; they corrupt file patches.
- [Category: path-safety][Severity: HIGH][Trigger: bulk-rename] Validate for accidental double-prefix replacements like `agentcortex/agentcortex/...` immediately after bulk path rewrites.
- [Category: wrapper-validation][Severity: MEDIUM][Trigger: wrapper-validation] Wrapper checks should assert behaviorally equivalent path construction, not only one literal path string.
- [Category: shell-portability][Severity: MEDIUM][Trigger: cross-platform-validation] Cross-platform validation entrypoints should prefer portable `grep`-style checks over environment-specific `rg` assumptions.
- [Category: worklog-contract][Severity: HIGH][Trigger: branch-normalization] Resolve filesystem-safe work log keys from raw branch names before gate checks; missing active logs are recoverable, but missing evidence is not.
- [Category: patch-fallback][Severity: LOW][Trigger: apply-patch-instability] When `apply_patch` is unstable on this Windows workspace, use tightly scoped whole-file rewrites only for new or text-only files, then immediately re-verify with `git diff --check`.
- [Category: detector-validation][Severity: MEDIUM][Trigger: integrity-baseline] Validate new integrity checks against real repo bytes before baselining, or pure-LF files may be misclassified as mixed EOL.
- [Category: shell-dependency][Severity: HIGH][Trigger: validation-runtime-dependency] Cross-platform validation entrypoints must not add new hard runtime dependencies unless the migration path is documented.
- [Category: path-separation][Severity: HIGH][Trigger: framework-path-migration] Downstream-facing artifacts such as specs and ADRs must stay in project-visible `docs/` paths, not hidden framework directories.
- [Category: review-process][Severity: LOW][Trigger: multi-role-review] Different reviewer personas catch different failure classes; multi-role review is useful for high-risk template changes.
- [Category: guard-placement][Severity: HIGH][Trigger: write-path-guard] Place guardrail rules where all relevant classifications read them, not only in documents that some tiers skip.

## Ship History

### main-2026-05-30 (overnight optimization: label consistency + blocked-reason visibility)

- Autonomous overnight session (Claude Opus 4.8). Goal: verify features trigger correctly + find/execute optimizations. 3 quick-wins shipped locally (NOT pushed — left for human review; repo remains ahead of origin pending the prior push too).
- **Trigger verification (no code)**: live preview confirmed the full hook→status-file→vite `/api/status`→store→render pipeline works with REAL Claude Code hook events (dev character rendered the live MCP tool in use, PM=thinking from UserPromptSubmit, today-done counter live). Additionally verified via direct store-module import: weather (mood:'stuck'→thunderstorm, 12 clip-paths/60 rain/12 lightning), done→idle lifecycle (designer done→10s expiry→cleared→idle), idle-gap inference (blocked+90s→awaiting-approval), reduced-motion a11y (weather renders, 0 animated elements), i18n parity (260=260 keys, no leaks), zero console errors.
- **Ship 1 — `fix(ControlPanel)` 7475760**: collapse raw MCP tool names. Added exported pure `taskChipLabel(task)`→`classifyTask().visualLabel`; the control-panel status line no longer shows `mcp__Server__tool` (now `Server::tool`), matching the AVO-103 character TaskLabel. +10 tests.
- **Ship 2 — `feat(ControlPanel)` a757af4**: surface blocked failure reason (AVO-110 lite). Added `blockedReasonLabel(ext)` + `agentLineLabel(ext,t)`; a blocked agent's status line now shows the hook's reason (`❌ npm test failed`) instead of the bare tool. Text-reason core of AVO-110; the classified reason-enum + colored sub-icon deferred for user aesthetic review. +10 tests.
- **Ship 3 — `fix(AgentInspector)` fedb37c**: collapse label-less raw MCP task. Added `inspectorTaskLabel(ext)` to agentInspectorModel.js. Completes the "no raw `mcp__` in ANY surface" invariant (AgentCharacter ✓ / ControlPanel ✓ / AgentInspector ✓ / ActivityFeed uses human label). +4 tests.
- **Ship 4 — `fix(hook)` dfdf855** (adversarial-review HIGH): a `SubagentStart` without `agent_id` set the `workflow` banner but left `_workflowAgentId` null; a later `SubagentStop` with mismatched/absent `agent_type` failed to clear it and `Stop` PRESERVED it → phantom workflow banner stuck FOREVER until the next prompt. Fix: `workflow: null` unconditionally at Stop (a banner can never outlive a turn) + extracted/tested `shouldClearWorkflowOnSubagentStop()` clearing orphaned banners. Not reachable where subagent dispatch fires as `PreToolUse{Agent}` (this setup), latent elsewhere. +6 tests.
- **Ship 5 — `fix(inferStatus)` 196ede6** (adversarial-review MED): a workflow-only message (`#workflow=X` hash, no role keys) set `activeWorkflow` without external agents → `statusSource` stayed `'organic'` → the staleness sweep never fired → green banner pinned over an idle office forever. Fix: extracted/tested `stalenessSweepAction()`; sweep now clears an orphaned organic workflow. +3 tests.
- **Ship 6 — `fix(server)` b5b9a0a** (adversarial-review HIGH): `scanAndMerge` did `(data.agents || []).filter(...)` — a truthy NON-ARRAY `agents` in a corrupt/old-hook/foreign session file threw TypeError, CRASHING the server process at the two unguarded callers (SSE-connect + file-watch debounce timer — the latter fires on ordinary file activity) and blanking the office at the GET path. Fix: `Array.isArray` root guard + try/catch defense-in-depth on both unguarded callers (matching the already-guarded POST/GET callers). TDD (test failed on old code). +2 tests. Verified server boots + serves 200 with the fix.
- Adversarial sweep covered the ENTIRE trigger pipeline (hook → store → client inferStatus → server/session-merge). Findings: store = clean; hook = 1 HIGH fixed + 1 MED deferred (straggler PreToolUse >30s post-Stop → contradictory `_stopped`+working, narrow edge); client = 1 MED fixed + 1 MED deferred (multi-session exit-reconcile stale-dropped because merged `_seq`=max-child-seq can drop on session exit → exited worktree agent lingers ≤5min; fix needs server+client seq-semantics change); server = 1 HIGH fixed.
- Tests: 960→995 vitest (+35, all green). Build clean throughout (386.48 KB / 120.96 KB gzip app; server-only fix adds 0 to bundle). 7 commits on `main`, NONE pushed — all for human review.
- **Ship 7 — `fix(inferStatus)` 6e49ed5** (#6, was deferred MED → FIXED): added `isAuthoritativeSnapshotSource()`; multi-session payloads (whose merged `_seq`=max-child legitimately drops on session exit) are now exempt from the seq stale-drop at all 3 points → exited worktree agents no longer linger ≤5min. Content-dedup at transport prevents spam. +4 tests.
- **Ship 8 — `fix(hook)` 4dcae10** (#5, was deferred MED → FIXED): added `shouldCarryStoppedSignal()` gating the `_stopped` carry-forward on `activeCount===0`, so a >30s straggler PreToolUse can no longer emit a contradictory `{_stopped:true, activeCount:1, working}`. Winding-down `done` (0 active) still carries the idle signal (race protection intact). +3 tests.
- Tests: 960→1002 vitest (+42, all green). 11 commits on `main`, NONE pushed.
- **HOOK-DATA INVESTIGATION (resolved the P0 blocker)**: fetched the official Claude Code hooks spec. Payload fields: `session_id, transcript_path, cwd, permission_mode, effort{level}, hook_event_name, tool_name, tool_input, agent_id, agent_type`. → **AVO-101 (plan-mode) IS FEASIBLE** via `permission_mode === 'plan'` on tool events (no dedicated plan event, but the mode is in every payload). → **AVO-108 (token meter)**: no token/cost in the hook payload, BUT `transcript_path` points to a JSONL with per-message usage → feasible via a transcript-tailing data path (medium effort). → **AVO-102 (thinking aura)**: the new `effort.level` field is a usable signal. AVO-101 build needs: add `'planning'` to `VALID_STATUSES` (constants.js), `STATUS_TABLE` (classify.js), `STATUS_BEHAVIOR_MAP` (store.js), i18n, + hook emits status='planning' when permission_mode==='plan'.
- **Validator FAILs are NOT real defects** (diagnosed): README.md "mojibake" = framework validator checking its own `'Why AgentCortex?'` sentinel against a downstream PRODUCT readme (false positive — do NOT add the string). README.zh-TW.md "mixed-eol" = local autocrlf working-tree artifact; the COMMITTED blob is already clean uniform LF (`git show HEAD` = 0 CRLF / 230 LF). clickable-office-objects.md = `primary_domain: none` doc-governance quirk. None require a repo change.
- **Ship 9 — `feat(AVO-101)` 92198e5**: plan mode is now visualized. Hook emits `status:'planning'` (via tested `statusForPreToolUse`) when `permission_mode==='plan'`; wired through VALID_STATUSES + classify STATUS_TABLE (FAMILIES.PLAN) + decideBehavior override (→ gantt-chart) + STATUS_BEHAVIOR_MAP + i18n (Planning/規劃中). Verified end-to-end by driving the real pipeline (routeExternalAgents → applyExternalStatus → gantt-chart + focused). Fancy "scrolling plan outline" visual deferred (aesthetic). +9 tests.
- **DISTRIBUTION (resolved)**: `main` is a PROTECTED branch (no direct push). All session work is on branch `claude/overnight-trigger-fixes` → **PR #22** (https://github.com/KbWen/agent-virtual-office/pull/22), 14 commits, awaiting human review/merge. Install does NOT need npm publish: repo is PUBLIC, so `npx github:KbWen/agent-virtual-office` (verified working) + `git clone` work once the PR merges. npm publish is optional polish.
- Tests: 960→1006 vitest (+46, all green) across the session.
- **Ship 10 — `feat(AVO-108)` 11c73f8**: token meter. Hook tail-reads the transcript (`transcript_path`, 64 KB from end, <1ms) for `usage` → emits `tokens:{ctx,out,model}`; ControlPanel 🪙 chip shows context size (compact) + counts/model in tooltip. Presence-semantics store field. VERIFIED WITH REAL DATA (repo hook wrote my live ~652k context; chip matched). Deferred: rolling-1h / $ cost / sparkline. +18 tests.
- **Ship 11 — `feat(AVO-102)` a62cd14**: extended-thinking aura. Hook emits `effort.level` (low|medium|high|xhigh|max); active agents render a subtle violet aura scaled by level (high+ only). VERIFIED WITH REAL DATA (my live 'high' effort → 2 auras at r=28). Aura aesthetics conservative, worth a preview look. +8 tests.
- Session totals: **960→1024 vitest (+64), 17 commits on PR #22**, build clean throughout. AVO-101 + AVO-108 + AVO-102 all shipped (the 3 hook-data features #7 unblocked).
- **REVIEW + TEST + SHIP (PR #22)**: independent adversarial pre-merge review of the full net diff (22 files, ~760 insertions) → **MERGE-READY, 0 blockers**; correctness, presence-semantics integration, hook safety, validation, server hardening, and test quality all verified. One NIT fixed pre-merge (`scanSessions` multi-session merge now carries `tokens`/`effort` like `mood`, +1 test). Test gate: 1025/1025 vitest, clean Vite build, `git diff --check` clean. Squash-merged to `main`.
- **Remaining for human**: review+merge PR #22; optional `npm publish` (free, your account); AVO-108 token meter (transcript-tailing path) / AVO-102 thinking aura (effort.level) — feasible, not yet built; visual backlog (AVO-104/106/107/111/112/115, aesthetic) incl. AVO-101's deferred scrolling-outline polish.

### main-2026-05-29 (AVO-103 tool inventory label)

- Shipped: `TaskLabel` SVG component inside `src/components/AgentCharacter.jsx`. Per-agent subscription to `s.externalStatus[id]?.task` re-renders only on tool change (not on every label/expiresAt tick). Renders `classifyTask(task).visualLabel` in a 7px monospace pill at y=-29 in the inverse-scaled name-tag group, just below the name tag and above the character head. Fill `#E8E8E8` on `#1a1a1a` opacity 0.55 background — low contrast, no animation, no flashy colour. Returns null when no task is set → idle agents stay clean.
- Built-in tools display concise names (`Bash`, `Read`, `Edit`, `Write`, `Grep`, `Glob`, `Task`, `WebFetch`, `WebSearch`, `Notebook`, `Plan`). MCP-namespaced tools collapse via the inner-verb bubble-up shipped earlier — `mcp__notion__create_page` shows as `notion::create`, `mcp__atlassian__search_issues` as `atlassian::search`.
- Live verified during implementation against real Claude Code hook events: dev character showed `Claude_Preview::preview_eval` for an MCP tool call, ops showed `Bash` from npm test runs, qa/designer showed `Edit` from source edits, gate showed `AskUserQuestion` from interactive prompts. All seven agents had their labels update within ~1s of the hook firing.
- Tests: 960/960 vitest passed (was 943, +17 new in tests/taskLabel.test.js — 11 built-in tools, MCP server::tool routing, MCP no-verb fallback, verb-classified routing, long-name truncation, defensive null/undefined/empty).
- Build: vite 887ms clean, 386.05 KB raw / 120.80 KB gzip (+0.6 KB raw — minimal component).

### main-2026-05-29 (AVO-105 handoff arrows)

- Shipped: `src/inference/workflowHandoff.js` subscribes to `activeWorkflow`; on 7 mapped phase transitions fires `addHandoff(from, to, {subtle: true})`. Mapping: `/spec-intake→/spec` pm→arch, `/spec→/plan` arch→pm, `/plan→/implement` arch→dev, `/implement→/test` dev→qa, `/implement→/review` dev→gate, `/test→/review` qa→gate, `/review→/ship` gate→ops. Unmapped transitions, null endpoints, missing roster roles, and identical workflow → no fire.
- `addHandoff(from, to, opts)` signature extended with `opts.subtle: boolean`. `FlyingDocument` gained `subtle` prop — workflow handoffs render the calm variant (no gold sparkle trail, 60° rotation instead of 360°, no 1→1.3→1 scale pulse) per the brief "畫面要清楚好懂、不過分花俏". Existing organic officeLife handoffs continue to fire with `subtle: false` (default) and keep their original flashier animation — verified in live preview where a `res→gate` officeLife handoff coexisted with workflow `arch→dev`/`dev→qa` and only the workflow ones lacked sparkles.
- Re-entrancy bug found and fixed at implementation: zustand fires subscribers synchronously on every setState, so `addHandoff` would re-enter the workflow watcher; without advancing `prevWorkflow` before the side effect the listener would see the SAME new workflow as a "transition" and recurse infinitely. Fixed by advancing the closure variable BEFORE calling addHandoff and pinned as `BUG-PIN` test.
- Tests: 943/943 vitest passed (was 925, +18 new tests covering 7-row mapping, subtle propagation, null/boot safety, lightweight roster skip, unmapped transitions, lifecycle, re-entrant safety bug-pin, full /spec→/plan→/implement→/test→/review→/ship chain firing 5 handoffs in order).
- Build: vite 1.07s clean, 385.49 KB raw / 120.67 KB gzip (+0.9 KB raw — module + small inline closure).

### main-2026-05-29 (session wrap-up: backlog + docs + perf)

- Docs: `docs/specs/_product-backlog.md` rotated — 73 shipped items moved to new `docs/specs/_shipped-log.md`; lean fresh backlog with 15 AVO-101..AVO-115 next-wave items + #20 deferred carryover. Themes: Real AI Behavior Coverage (plan-mode viz, extended-thinking aura, tool inventory, skill badge), Multi-Agent Collaboration (handoff arrows, pair huddle, review queue), Information Density (token meter, recent-files heatmap, blocked-reason tags), Game Feel (time-of-day lighting, eureka cascade), Performance/Observability (OT GenAI export, replay scrubber), Brand/USP (shareable daily card).
- Docs: new root `CHANGELOG.md` summarising the entire session (8 features + 2 follow-ups + CSP + wrap-up).
- Docs: README — refreshed Tech Highlights (replaced 8 old rows with 14 rows covering classifier, role-aware animations, mood-driven weather, idle-gap inference, desktop notifications, self-improving classifier, today metrics chip, reduced-motion/a11y); refreshed Architecture tree with all new modules (`classify.js`, `unknownLog.js`, `moodEngine.js`, `contextBubble.js`, `desktopNotifier.js`, `idleGapInfer.js`, `server.mjs`, etc.).
- Perf: WeatherOverlay clipPath optimisation — SVG `<clipPath>` doesn't actually need a `<defs>` wrapper; removed it. Live preview confirmed `defsCount: 1` (was 12 during active weather) — 11 DOM nodes saved with zero behavior change. Rain (60), lightning (12), clipPaths (12) all still render correctly.
- Tests: 925/925 vitest (no test changes; pure docs + structural simplification).
- Build: vite 838ms clean, 384.57 KB / 120.32 KB gzip.

### main-2026-05-29 (2 follow-up fixes from spawned chips)

- Fix 1: `src/systems/moodEngine.js` `pushEventBatch` wraps `resetIdleTimer()` + `updateStoreMood()` in `if (added > 0)`. Empty-array or all-skipped-entries batches no longer accidentally flip mood→idle. Two existing tests adjusted that relied on the prior `pushEventBatch([])` recompute hack.
- Fix 2: `src/systems/classify.js` Tier 4 (MCP namespace) now returns `family: inner.family` when the inner verb matches — previously always returned a flat EXTERNAL. `decideBehavior()` now picks family-appropriate animations for MCP create/delete/search/read instead of collapsing all to `typing`. EXTERNAL fallback retained for MCP tools whose inner name doesnt match any verb pattern.
- Tests: 925/925 vitest passed (was 915, +10 across the two fixes).
- Files: `src/systems/moodEngine.js`, `src/systems/classify.js`, `tests/moodEngine.test.js`, `tests/weatherRealWorld.test.js`, `tests/classify.test.js`, `tests/classifierWiring.test.js`.

### main-2026-05-29 (#8 desktop notifications + #C idle-gap inference)

- #8 shipped: `src/inference/desktopNotifier.js` polls store 5s, fires browser Notification when an agent stays blocked ≥30s + tab hidden + permission granted. Per-episode dedupe (blocked→working→blocked = 2 notifications, but same episode = 1). ControlPanel 🔔 button requests permission on user gesture (modern browsers require this). i18n + sr-only.
- #C shipped: `src/inference/idleGapInfer.js` closes Pixel Agents' admitted gap. Conservative thresholds: working+45s → inferred 'thinking'; blocked+90s → inferred 'awaiting-approval'. Injected through `applyExternalStatus` so inferred statuses pass through `decideBehavior` (COGNITION/GATE family → reading-screen / shield-verify). Reversibility by construction — real hook events overwrite the inferred status. lastUpdatedAt stamped only on status/task signature changes (not movement ticks).
- Tests: 915/915 vitest passed (was 875, +24 desktopNotifier + 16 idleGapInfer). Build clean, +5 KB raw / +1.6 KB gzip (two new modules + UI button).
- Files added: `src/inference/desktopNotifier.js`, `src/inference/idleGapInfer.js`, `tests/desktopNotifier.test.js`, `tests/idleGapInfer.test.js`. Edits: `src/components/PixelOffice.jsx` (2 useEffect), `src/components/ControlPanel.jsx` (🔔 button), `src/locales/en.json` + `zh-TW.json` (notify.* keys), `docs/specs/_product-backlog.md` (#8 → Done).

### main-2026-05-29 (unknownLog #A3)

- Shipped: `src/systems/unknownLog.js` — dev-mode in-memory aggregator. Five buckets (task/status/mood/role/workflow) each capped at 200 entries; oldest-evict on overflow. Exposes `recordUnknown(kind, raw)` / `getUnknownReport()` / `clearUnknownLog()` / `isDevMode()`. Globals `window.__office_unknownLog` (Maps) + `window.__office_logUnknowns()` (sorted console reporter) for DevTools.
- Wired all 5 classify* Tier 5 branches to call recordUnknown. Known classifications (Tier 0–4) never record, so the log only surfaces genuine gaps.
- Production safety: `isDevMode()` reads `import.meta.env.PROD === true` and short-circuits; override hook `globalThis.__OFFICE_FORCE_UNKNOWN_LOG__` for explicit control.
- Tests: 875/875 vitest passed (was 851, +24 unknownLog tests covering: basic recording, kind isolation, sorting, cap+eviction, defensive inputs, dev-mode gate, integration with all 5 classify*).
- Build: vite 946ms clean, 380.17 KB raw / 118.90 KB gzip (+1 KB raw / +0.45 KB gzip).

### main-2026-05-29 (role-aware classifier #A2.1)

- Wiring shipped: `classifyRole(roleId)` (extracts base role from `slug~role` composites, classifies into orchestrator/builder/verifier/deployer/investigator families); `classifyWorkflow(workflow)` (normalizes leading-slash and case, recognizes 26 AgentCortex lifecycle phases); `decideBehavior({task, role, status, workflow})` central 4-priority resolver (status > workflow > role > family-default).
- AgentCortex skill associations drive role overrides: pm/arch own writing-plans → gantt-chart bias; qa/checker own TDD+red-team → magnifier bias; ops owns finishing-a-development-branch → deploy-button bias; res owns doc-lookup → research bias; gate owns auth-security → shield-verify bias; designer owns frontend-patterns → whiteboard bias.
- Workflow overrides outrank role: `/ship`→deploy-button, `/test`→magnifier, `/research`→research, `/plan`→gantt-chart, `/review` & `/audit`→magnifier.
- Tests: 851/851 vitest passed (was 748, +67 unit + 36 integration). Build clean, +1.4 KB raw / +0.3 KB gzip.
- Files: `src/systems/classify.js` (+~140 lines: ROLE/WORKFLOW override tables + 3 new exports), `src/systems/store.js` (1 wiring line swap), `tests/classify.test.js` (+~150 lines), `tests/classifierRoleContext.test.js` (new, +220 lines, 36 tests).
- Memory: saved `feedback_classification_rigor.md` so future classifier work checks `.agent/skills/` + `.agent/workflows/` BEFORE defaulting to generic W3C/schema.org taxonomies.

### main-2026-05-29 (classifier wiring #A2)

- Wiring shipped: `store.applyExternalStatus` augmented with `familyToBehavior(classifyTask(task).family)` fallback (Bash/Read/Grep/Glob still hit static STATUS_BEHAVIOR_MAP first → byte-identical for built-ins); `moodToWeather` delegates to `classifyMood(mood).family` (parity proven by existing weatherSystem.test.js).
- New capability: MCP / verb-classified / unknown tasks pick family-appropriate animation instead of generic `'typing'` — `Write`→writing-notes, `Task`→gantt-chart (subagent dispatch), `authenticate`→shield-verify, `dispatchJob`→gantt-chart, `sendEmail`→chat, `searchIndex`→research.
- Tests: 748/748 vitest passed (was 704; +12 familyToBehavior unit tests + 32 classifierWiring integration tests proving regression safety + new capability). Build clean, +6 KB raw / +2.4 KB gzip.
- Files: `src/systems/classify.js` (familyToBehavior export), `src/systems/store.js` (applyExternalStatus fallback), `src/components/TopDownFurniture.jsx` (moodToWeather delegation), `tests/classify.test.js` (familyToBehavior cases), `tests/classifierWiring.test.js` (new, integration).

### main-2026-05-29 (classifier foundation #A1)

- Foundation shipped: `src/systems/classify.js` pure module exporting `classifyTask` / `classifyStatus` / `classifyMood` + `FAMILIES` vocabulary. Standards-aligned per panel discussion: W3C Activity Streams 2.0 verb taxonomy, OpenTelemetry GenAI attribute naming (forward), MCP `mcp__<server>__<tool>` namespace parser.
- 4-tier waterfall: Tier 0 built-in (11 Claude Code canonical tools + TodoRead/TodoWrite), Tier 3 verb heuristic (10 verb families with word-boundary regex), Tier 4 MCP namespace, Tier 5 unknown (preserves raw + truncates label to 16 chars).
- Tests: 90 new (704/704 total vitest passed), build clean, no UI change (foundation only; downstream wiring is #A2).
- Files: `src/systems/classify.js` (new, +270 lines), `tests/classify.test.js` (new, +250 lines).

### main-2026-05-29 (weather + #15 closure)

- Feature shipped: #14 天氣系統 — `moodToWeather()` pure mapping (stuck→thunderstorm, frustrated→rain, rushing→cloudy, default→clear); `WeatherOverlay` SVG component with rain lines, drifting clouds, lightning flash; `WallWindow` accepts `weather` + `reducedMotion` props; `PixelOffice` subscribes `mood` + `reducedMotion`, injects CSS keyframes once; lightning opacity capped at 0.35 every 5s for photosensitivity safety.
- Closure: #15 白板手寫動畫 confirmed pre-existing at `PixelOffice.jsx:146` (`WhiteboardAnimation`); marked Done with closure note (no new code, similar to #7 pattern).
- Tests: Pass (575/575 vitest, build clean, preview all 4 weather modes verified including reducedMotion path)
- Files: `src/components/TopDownFurniture.jsx`, `src/components/PixelOffice.jsx`, `tests/weatherSystem.test.js` (new, 12 tests)

### main-2026-05-29 (perf metrics + drift fix)

- Feature shipped: #6 底部效能指標 — added `dailyBlockedLedger` (transition counter, parallel to `dailyDoneLedger`) and rendered `✓N / ✗M` chip in ControlPanel Full + Panel modes with i18n + sr-only + tooltip; day rollover resets both ledgers atomically.
- Follow-up fix: drift defense — `dayChanged` now ORs both ledgers' staleness so a drifted blocked ledger can't silently inflate yesterday's counts (caught by deep review's scenario test).
- Tests: Pass (563/563 vitest after drift fix, build clean, preview EN+ZH chip reactivity verified)
- Files: `src/systems/store.js`, `src/components/ControlPanel.jsx`, `src/locales/en.json`, `src/locales/zh-TW.json`, `tests/storeBlockedLedger.test.js` (new, 23 tests including 11 review-pass scenarios)

### feat-v10-office-vitality-2026-05-26 (superseded / closed)

- PR #17 closed without merge: core v0.10 vitality features (growth fix, 3 events, sprint kanban) and production deployment infra (server.mjs, Docker, Nginx, PM2, systemd) were superseded and shipped via PR #19 with deeper hardening (R48–R86 + 30 perf rounds). Merging would have regressed main. Branch deleted.
- Branch cleanup: 12 stale remote branches deleted (all merged/closed PRs), 2 local branches deleted.

### claude-condescending-raman-1e48a0-2026-05-16 (closure)

- Feature closed: #7 可點擊辦公室物件 — all three objects confirmed clickable in existing code (commit 5b79616); spec doc generated as closure record; no new code required.

### claude-condescending-raman-1e48a0-2026-05-16

- Feature shipped: #1 Character Growth System — daily-reset desk items (coffee/sticky/books) tied to done-event count; 4-level GROWTH_LEVELS [0,1,3,6]; fixed % 6 wrapping bug; gated growth inside shouldCount to prevent polling inflation.
- Tests: Pass (149/149 vitest, build clean)

### main-2026-04-08

- Feature shipped: Inspector info enhancement with durable same-day done counting, mood/workflow rows, Codex CLI helper, and Codex App bridge parity/docs.
- Tests: Pass (145/145 vitest, build success, Codex CLI/App live evidence captured)

### fix-agent-inspector-hooks-crash-2026-04-02

- Feature shipped: Designer character, multi-worktree support, skill-aware hooks (Stop/UserPromptSubmit/skill context), smart file routing, webhook endpoint, compound skill routing, review P0/P1 fixes, AgentCortex v5.4.0 upgrade.
- Tests: Pass (98/98 vitest, no console errors)
