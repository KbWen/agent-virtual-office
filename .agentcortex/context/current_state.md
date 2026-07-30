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
- **Last Updated**: 2026-07-30T23:59:00+08:00
- **Last Verified**: 2026-07-31
- **Update Sequence**: 113
- **ADR Index**:
  - docs/adr/ADR-001-vnext-self-managed-architecture.md — vNext self-managed AI architecture
  - docs/adr/ADR-002-multi-worktree-session-design.md — multi-worktree session isolation design
  - docs/adr/ADR-003-status-source-parity-for-codex.md — status-source parity for Codex
  - docs/adr/ADR-004-no-per-frame-agent-separation.md — AVO-144 resolved by decision: per-frame separation rejected (3-lens panel); re-open conditions recorded
  - docs/adr/ADR-005-no-user-drag-to-move-agents.md — AVO-142 rejected by decision: user drag-to-move rejected (4-lens panel unanimous); position=state honesty; interaction redirected to AVO-158 Poke; re-open conditions recorded
  - docs/adr/ADR-006-no-observability-cost-dashboard-scope.md — AVO is not an observability/cost dashboard; Cancels off-mission AVO-109/113/114/116/118/119/120 + descopes AVO-108 $ remainder; conditions for opening a NEW item recorded
  - docs/adr/ADR-007-dialogue-channel-separation-and-honesty-gate.md — dialogue layer: bubble=voice / status=symbol+ring (detail→inspector, blocked=exception) + open-ended non-conclusive content rule + inter-agent honesty gate G1–G10 (reject relationship-memory); applies_to: src/systems/{banter,behaviorEngine,officeLife,contextBubble}, src/components/{AgentCharacter,BehaviorBubble}, src/locales/*.json
  - docs/adr/ADR-008-no-fabricated-need-ambient-honesty.md — ambient/companion honesty rule: no fabricated need/engagement/emotional-state (N1–N7 checklist: anti decay/streak/loot-for-time-open; pet hides on blocker incl. awaiting-approval; no unbound decorative channel; degrade to honest neutral; real-clock-only variety; no engagement notification); consolidates ADR-004/005/006/007; closes backlog AVO-166
  - docs/adr/ADR-009-no-in-repo-portable-core-extraction.md — portable status-core extraction stays OUT of AVO (deferred to a clean-room NEW repo; AVO untouched, unpublished). `codex/product-action-strip` PR #195 Phase-1 UI polish ships; Phase-2 in-repo package API (34 subpaths / .mjs mirrors / manifest) parked-not-merged. YAGNI/REDUCE + no npm consumer + 88-byte bundle headroom; preserves Phase-2 findings F1–F9 for the future extraction (F1/F4 honesty-critical). Re-open: a concrete consumer project is ready to depend on the core
  - docs/adr/ADR-010-atomic-door-route-claims.md — AVO-187 proposed atomic full-route physical-door claims with FIFO fairness and fenced lifecycle; extends ADR-004; applies_to: movementSystem, store, AgentCharacter, doorway tests and soak
  - .agentcortex/adr/ADR-001-vnext-self-managed-architecture.md — framework scaffold mirror of ADR-001
- **Active Backlog**: `docs/specs/_product-backlog.md`
  - **As of 2026-06-15 cleanup** — **no-"Deferred" hygiene rule**: every item is DO / REFINE / CLOSE, never parked. **3 open on-mission items**: AVO-160 (sprite-asset pipeline, P3) · AVO-124 (sprite cosmetics, P3) · AVO-141 (comms rail optimization, P2). 54 Done/Shipped rows rotated to `_shipped-log.md` (AVO-101+ wave). **11 items Cancelled**: 7 off-mission per **ADR-006** (cost/observability/analytics out of scope) + AVO-142/144 (rejected by ADR-005/004) + AVO-112 (eureka cascade — honesty flaw: real eureka can't cluster in 10s) + AVO-137 (density-layer — glance-default already shipped, zen far-view not a target). Drift reconciled: AVO-147 stale-"In Progress"→Done, AVO-120 stale-"Pending"→Cancelled. The highest next-value work (sprite ART, dialogue/text 台詞文字) is intentionally **unticketed** until scoped — do not backfill busywork (REDUCE-not-add). Pre-AVO historical notes below retained for provenance only.
  - 15 features across 5 themes (historical, pre-AVO): 辦公室生命感、資訊密度、互動性、整合延伸、視覺升級
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
    - #15 白板手寫動畫 — confirmed pre-existing (`PixelOffice.jsx:169` `WhiteboardAnimation`); closure-documented at #14 ship time (similar to #7 pattern)
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
  - [vibe-rebalance] docs/specs/ux-vibe-rebalance.md [Shipped]  *(AVO-126/127/128/129/131/132 — MERGED to main via squash PR #44, v1.2.0, 2026-06-05)*
  - [living-office] docs/specs/living-office-events.md [Shipped]  *(AVO-140 — MERGED to main via squash PR #44, v1.2.0, 2026-06-05)*
  - [subagent] docs/specs/subagent-helper-huddle.md [Frozen]  *(SubagentStart→helper sprites; shipped)*
  - [vibe-rebalance] docs/specs/control-bar-reduction.md [Shipped]  *(AVO-130 / #116 — 4 health pills→1 expandable health dot; lang/run/view/help/platform demoted into ⚙ menu / info popover)*
  - [real-ai-behavior] docs/specs/skill-activation-badge.md [Shipped]  *(AVO-104 / #30 — transient skill bubble on SubagentStart via existing bubble cap (working-tier); panel Option B, honest no-over-head-element)*
  - [game-feel] docs/specs/event-juice-pass.md [Shipped]  *(AVO-136 / #117 — rare-event juice: deploy confetti + eureka sparkle + desk-slam local shake; pure juiceForEvent resolver, reduced-motion-safe, never occludes status)*
  - [multi-agent] docs/specs/review-gate-waiting.md [Shipped]  *(AVO-107 / #112 — honest reframe: gate-desk "waiting" in-tray driven by awaiting-approval only; no queue/type fabrication; complements AVO-105 arrows; panel-decided)*
  - [brand] docs/specs/office-theme-selector.md [Shipped]  *(AVO-123 / #41 — lightweight overlay-grade theme tint beneath status layer; Default/Winter/Autumn light tints; contrast-guarded; Dark/Retro/Cyberpunk deferred)*
  - [ci-infra] docs/specs/sim-soak-gate.md [Shipped]  *(AVO-157 — nightly world-invariant soak: teleport/stack/frozen/off-floor; test-the-test 11 pins)*
  - [ci-infra] docs/specs/avo-190-soak-target-identity.md [Shipped]  *(AVO-190 — fail-closed AVO identity preflight for soak and overlap recorder targets)*
  - [ci-infra] docs/specs/avo-189-reachable-raf-watchdog-diagnostic.md [Shipped]  *(AVO-189 — first proven focused lost-chain restart is observable)*
  - [data-path] docs/specs/avo-188-abort-movement-in-place.md [Shipped]  *(AVO-188 — aborted walks stop at rendered truth without stale motion or teleporting)*
  - [office-runtime] docs/specs/standing-overlap-deconfliction.md [Shipped]  *(AVO-156 — standing-stack五層根因: isWalking lifecycle + door jitter + journeyTarget + ellipse spacing + arrival nudge; live A/B 12→0 events)*
  - [ui-rendering] docs/specs/shareable-daily-card.md [Shipped]  *(AVO-115 / #31 — cozy pixel-art postcard share card; weather/mood hero + 1 number + warm caption; client-side canvas→PNG, opt-in ⚙ Share; honest (no event counting — Option C, derived from done+mood); store.js untouched)*
  - [ui-rendering] docs/specs/poke-acknowledge.md [Shipped]  *(AVO-158 — Poke / acknowledge micro-interaction (Model A, layered on existing click); honest in-place bob + real-status quip; ZERO position/status write; replaces rejected AVO-142 per ADR-005)*
  - [game-feel] docs/specs/office-pet-barometer.md [Shipped]  *(#39 / AVO-121 — signal-driven office pet)*
  - [office-runtime] docs/specs/blocked-reason-tags.md [Shipped]  *(AVO-110 / #29 — honest-narrow blocked-reason badge; reasonCode contract)*
  - [office-runtime] docs/specs/recurring-failure-detection.md [Shipped]  *(AVO-117 — recurring blocked-reason detection; downstream of AVO-110)*
  - [multi-agent] docs/specs/pair-programming-huddle.md [Shipped]  *(AVO-106 — co-editing pair OVERLAY (desk-to-desk link); per-agent activeFile, edit-only; redesigned from a huddle per expert panel)*
  - [ci-infra] docs/specs/ci-render-smoke.md [Shipped]  *(AVO-145 / hardening-wave H1 — blocking render-smoke gate; AC-6 test-the-test proven)*
  - [data-path] docs/specs/status-field-schema-unification.md [Shipped] [Updated: 2026-06-14 — #122 runtime mirror eliminated → statusContract.mjs single source]  *(AVO-146 / hardening-wave H2 — AGENT_CARRY_FIELDS canonical schema; 9-site map; drift-guarded)*
  - [hook-io] docs/specs/hook-status-write-lock.md [Shipped]  *(#20 / hardening-wave H3 — bounded-wait RMW lock; multi-process proof)*
  - [office-runtime] docs/specs/structured-error-reasons.md [Shipped]  *(AVO-148 / hardening-wave H5 — event-driven permission-denied / api-rate-limit / api-auth-failed)*
  - [ci-infra] docs/specs/npm-pack-install-smoke.md [Shipped]  *(AVO-151 / stability-wave W3 — pack→install→setup/hook/boot smoke gate)*
  - [ci-infra] docs/specs/transport-spine-e2e.md [Shipped]  *(AVO-150 / stability-wave W2 — 19-case real-server API e2e; HOME-override isolation)*
  - [hook-io] docs/specs/hook-runtime-contract.md [Shipped]  *(AVO-153 / stability-wave W4 — live-captured fixtures + 143 contract tests; found the tool_response/tool_result divergence → AVO-154)*
  - [game-feel] docs/specs/cozy-micro-interactions.md [Shipped]  *(AVO-125 / chill-fun wave — night desk-lamp halos beneath the status layer; status-tinted monitor glow DROPPED on honesty (desk-fixed glow vs walking agents))*
  - [game-feel] docs/specs/ambient-soundscape.md [Shipped]  *(AVO-122 / chill-fun wave — off-by-default 0-KB procedural Web Audio; clatter∝teamPulse (silent@0) + double-gated rain; coffee gurgle DROPPED on honesty (tea-break is a clock event))*
  - [ui-rendering] docs/specs/dialogue-interaction-layer.md [Frozen]  *(dialogue layer — ADR-007 channel separation + open-ended content + honesty gate; S1/S1b reduction commits, S2–5 killable hypotheses; red-team + expert/PM hardened)*
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
- [Category: text-integrity][Severity: MEDIUM][Trigger: append-existing-file-eol][prev: 9672c90b] Appending to an existing tracked file via a bash heredoc (cat >>) writes LF lines; if that file is CRLF in the working tree it becomes mixed-EOL and fails validate.sh text integrity. Prefer the Edit tool (preserves EOL) or normalize the whole file to one EOL after appending.
- [Category: gate-chain][Severity: MEDIUM][Trigger: gate-receipt-ordering][prev: 6c281ae5] validate.sh parses Work Log Gate Evidence receipts in FILE ORDER, not by timestamp. Inserting a missing receipt (e.g. bootstrap) out of phase order triggers illegal gate phase progression even when its timestamp is earlier. Always place receipts in bootstrap, plan, implement, review, test, handoff, ship order.
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

### Ship-fix-avo-189-reachable-raf-watchdog-diagnostic-2026-07-30

- Shipped AVO-189 on `codex/chore-upgrade-agentic-os-v1.8.17`: the first reachable focused lost-chain restart now increments the existing diagnostic counter and emits the existing dev warning. The change is the predicate threshold `>=2`→`>=1`; RAF timing, restart behavior, and frame reset semantics are unchanged.
- Pending RAF handles and unfocused documents remain excluded, preserving the existing host-throttling noise guards. Commit: `feb23ef`.
- Tests: Pass — focused 21/21; Vitest 111/111 files and 2271/2271 tests; build PASS; Agentic OS validator 112 PASS / 0 FAIL before Work Log wording cleanup.

### Ship-fix-avo-188-abort-movement-in-place-2026-07-30

- Shipped AVO-188 on `codex/chore-upgrade-agentic-os-v1.8.17`: one atomic store action stops aborted walks at a defensive copy of the rendered position, clears `isMoving` and `journeyTarget`, and aligns `targetPosition` without teleporting to an abandoned waypoint.
- Force-unstick and behavior-watchdog use the action directly. True component removal defers one microtask; same-flush live teardown/setup clears the unmounted flag and keeps the existing restoration path intact. Commit: `ac07a4d`.
- Tests: Pass — focused 67/67; Vitest 111/111 files and 2271/2271 tests; build PASS; forced-spawn soak 5 samples / 0 violations; Agentic OS validator 113 PASS / 0 FAIL.

### Ship-fix-avo-190-soak-target-identity-2026-07-30

- Shipped AVO-190 on `codex/chore-upgrade-agentic-os-v1.8.17`: `sim-soak` and `overlap-recorder` now share a fail-closed `/src/systems/store.js` identity preflight before Playwright launches. Unrelated HTTP 200 targets, timeouts, invalid URLs, and non-2xx probes fail with the rejected URL; only explicit connection refusal on the default origin permits the spawn fallback.
- Commit: `fec1086` (`fix(soak): verify target identity before sampling`). Scope is limited to the soak scripts, shared probe, focused tests, and spec; no product runtime files changed.
- Tests: Pass — Vitest 111/111 files and 2268/2268 tests; build PASS; fake HTTP 200 rejected by both consumers; forced-spawn soak 5 samples / 0 violations; Agentic OS validator 113 PASS / 0 FAIL.

### Ship-codex-chore-upgrade-agentic-os-v1.8.17-2026-07-30

- Upgraded the vendored Agentic OS governance framework from **v1.8.11** (`cada3c4`) to the latest formal release **v1.8.17** (`102e19b`) from canonical upstream `KbWen/agentic-os.git`. Supply-chain/provenance handling kept the task at `hotfix`; the deployed diff contains 49 tracked framework updates and 2 managed additions, with zero product, dependency, or test-path changes.
- Downstream-owned scaffolds were preserved: the live project SSoT and Claude office hooks remained intact; generated `.acx-incoming` templates were inspected and removed. All deployed framework files match the v1.8.17 source bytes, excluding the target-generated manifest.
- Tests: Pass — Agentic OS validator `pass=113 warn=7 fail=0 skip=4`; Vitest `2263/2263`; production build PASS. Branch retained locally; no push or PR performed.

### Ship-fix-soak-gate-2026-07-16 (PR #202 — sim-soak un-broken: bounded coverage + symmetric walk teardown)

> [!WARNING]
> **The nightly sim-soak is green again — this does NOT mean the office is healthy.** For 32 runs the
> stack data was **uninterpretable, not merely false-red**: the rig injected ~22 spurious 3s freezes per
> 150s AND randomly released the journey claim (the only anti-stack mechanism) 22x per 150s, so a real
> stack was indistinguishable from a manufactured one. **We are not exonerating the movement system — we
> are admitting we never measured it.** Do NOT infer "movement is healthy" from a green soak until several
> clean nightlies accumulate. **AVO-187 (door-crossing stack) is REAL, production-reachable, and OPEN.**

- Ended a **32-run nightly red streak** (last success 2026-06-13). Both causes were defects in the GATE, found by measurement after **three** wrong root-cause theories were killed by an adversarial panel. Merged as squash `eb0a83a`; CI 7/7; full suite **2263 pass**; three consecutive green soaks (branch probe-free x2 + merged main x1: 2395/2396 samples, 0 violations).
- **(a) Coverage false-red.** The sample floor was `expected - 2` (2398/2400), tighter than ordinary 250ms timer jitter (clean CI yields 2393–2397), and the runner threw **before** `evaluateSoak` and the report write — so all 32 failures left **no artifact**. Fixed by `scripts/soakCoverage.mjs` (`assessSoakCoverage`: max 5 misses or 0.5%, fail-closed on material under-sampling) + report-before-fail ordering. *Implemented by the codex release-audit session; verified independently.*
- **(b) The soak tripped a bug its own rig created.** `sim-soak.mjs` runs a **Vite dev server by design** (its sampler must import `/src` for ground truth) ⇒ StrictMode ⇒ React 19 **double-invokes passive effects on re-placed fibers**. `PixelOffice` re-sorts `agentList` by **live `position.y`** (SVG paint order *is* depth), so **any walker re-places every keyed `<AgentCharacter>`**; react-dom's `placeChild` MOVE branch flags `Placement|PlacementDEV` **byte-identically to an insert**. That fired the `[]`-dep "unmount" cleanup on **live mid-walk instances** — cancelling the rAF (frozen until the 2.5s watchdog's next 1s poll = a near-constant **+3000ms**, *exactly* `STACK_SUSTAIN_MS`) and dropping `journeyTarget`. **A/B: 22 spurious teardowns / 150s with StrictMode on, 0 with it off.** Fixed by making setup/cleanup **symmetric** (setup restores; pure `shouldRestoreWalk` guard; journey stashed from the store SSoT, not mirrored at the six publish sites). **No DEV/StrictMode branching** — a correct effect is invariant under double-invocation; `<Activity mode="hidden">` runs the same path in production. Also removed the deferred-timer `clearTimeout` loop from that cleanup: it too ran on live components and nothing re-arms a cleared handle, so it permanently killed pending bubble-clears (**a bubble asserting state the agent no longer has**) and the pass-document receive step (**a handoff drawn but never received**).
- **Filed, NOT fixed** — `AVO-187` (P1, honesty-critical, production-reachable): `jitterDoorCrossing` offsets only **perpendicular to travel**, so every door pins its travel axis at **exactly zero spread**; two agents pausing at one side are always ≤`DOOR_JITTER` (20px) apart — inside `STACK_DIST_PX` (30) and the 32x44 ellipse. **Any pause at a door is a guaranteed stack** (measured: 4/4 clean-CI stacks at x=585 exactly). Its own comment cites the 2026-06-10 forensic at `(240,386)` — the coordinate `mainToLounge` **still pins today**; that mitigation turned a 0px point-stack into a 20px segment and never reached its own alarm. **Not fixable by raising `DOOR_JITTER`** (opening ~50px) — needs a **temporal door claim** + an ADR. Characterized by `tests/doorCrossingSeparation.test.js` + a source note so it cannot go quiet. Also filed: `AVO-188` (abort sites leave a stale `isMoving:true`; `AgentInspector` reads it and lies), `AVO-189` (`shouldRecordRafWatchdogRestart` is structurally unreachable — reads 0 on a broken build; **never assert on it**), `AVO-190` (`sim-soak` blind-reuses any server on :5173 — during this investigation that was a *different project*).
- Downstream: `living-world` roadmap M4 got a precondition (`56d494e`) — extract from `eb0a83a`+, and the trap is **not AVO-specific**: any rAF-driven movement + depth-sorted keyed list hits it with zero AVO code.
- Process: SSoT appended directly (guard bypassed deliberately — the documented stale-receipt hazard); Ship History now 11 vs the advisory cap of 10 (`check_ssot_caps.py` prints this under a `[PASS]`, never a FAIL) — recorded rather than silently rotated.
- Tests: Pass

### Ship-chore-ssot-rotation-and-worklog-hygiene-2026-07-10 (SSoT rotation + work-log hygiene)

- Closes the three follow-ups left open by the Agentic OS v1.8.11 brain upgrade (PR #199, squash `884a0ac`).
- **Ship History rotation** (`ship.md:208`): 74 -> 10 entries. The 64 oldest moved verbatim to `.agentcortex/context/archive/ship-history-2026.md`. The surviving 10 are byte-identical - no entry was edited or reordered (`ship.md:207`). One `../../docs/specs/...` link inside the moved content was flattened to a plain path, per the depth hazard called out at `ship.md:209`.
- **Spec Index rotation: attempted, then REVERTED.** `ship.md:197` says to collapse the oldest `[Shipped]` entries into a `## Spec Index Archive` section once the index passes 30. Doing so turns a never-failing advisory into a hard failure: `validate.{sh,ps1}` scrape the index with a regex that stops at the next `##` header (`validate.ps1:1999`) and contain **zero** references to `Spec Index Archive`, so all 13 rotated specs immediately report as `[FAIL] SSoT Spec Index completeness: 13 shipped/living spec(s) not in index`. The index stays at 43 entries and `check_ssot_caps.py` keeps printing its advisory. Reported upstream; the documented procedure and the validator disagree.
- **Work-log hygiene**: 9 active -> 2. Six live logs were `cmp`-proven byte-identical to their committed archive copies and deleted (feat-avo-104/107/123/130/136, refactor-avo-146). Two shipped-but-unarchived logs (`codex/strengthen-panel-feature-verifier`, office-layout-enrichment) were archived with hash-chained `INDEX.jsonl` entries. An 8-day-expired `main.lock.json` (owner `codex`, 60-min timeout) was released.
- **Deliberately untouched**: `.agentcortex/context/work/main.md` - codex's audit log on the live `main` branch. Reported, not archived: promoting an incomplete gate chain into git would manufacture validator FAILs.
- **Upstream**: the `validate.sh` exit-141 SIGPIPE abort (unfixed in v1.8.11) is reported as `KbWen/agentic-os` issue #336, with root cause, a reproduction, and three suggested fixes.
- Evidence: `check_ssot_caps.py` -> `ssot caps OK - ship history 10/10, spec index 30/30`; `validate.ps1` (pwsh 7) fail=0; vitest 2251 passed; build clean.

### Ship-chore-upgrade-agentic-os-v1.8.11-2026-07-10 (governance brain v1.8.1 -> v1.8.11)

- Upgraded the vendored Agentic OS brain from **v1.8.1** (`source_commit b172145`) to **v1.8.11** (`cada3c4`) from canonical upstream `KbWen/agentic-os.git`. Classified `hotfix` (supply-chain/provenance escalation: the deploy replaces `.agentcortex/bin/deploy.sh` and regenerates `.agentcortex-manifest`). Commits `442039d` (archival) + `b84330e` (deploy). Cache aligned by `checkout cada3c4` on a verified-clean tree, so `reset --hard` was never needed.
- Deploy: `195 updated / 2 skipped / 5 new / 1 removed`; git sees 49 real modifications (remainder are EOL-normalized no-ops). Team-owned `current_state.md` + `.claude/settings.json` SKIPped and preserved; both `.acx-incoming` sidecars inspected then discarded. Orphan `.agent/workflows/superpowers-playbook.md` removed. New surfaces: `/ask-local`, `/govern-audit`, `check_ssot_caps.py`.
- Evidence: `validate.ps1` (pwsh 7) `pass=98 -> 100, warn=17, fail=0, skip=4`; vitest `2251 passed (108 files)`; `vite build` clean. The deploy touched no `src/`, `public/`, or `tests/` file.
- Value: v1.8.4 deploy data-loss fix (a preserved file's baseline now records the upstream hash, not the user's, so a later deploy cannot silently overwrite a customization); **v1.8.9 Design Gate accepts a committed Markdown/ASCII wireframe (`docs/design/<screen>.md`) as a valid design artifact** - UI planning no longer dead-ends without a paid DSoT tool; v1.8.9 Claude same-turn continuation; v1.8.10 drops a contradictory guardrails required-read from 10 command stubs; v1.8.7 Windows `guard_context_write` lock fix; v1.8.7 chain-aware Global Lessons archival unfreezes the 20/20-capped registry.
- **Known gap, NOT fixed upstream**: `validate.sh` under git-bash aborts (exit 141 / SIGPIPE) on any work log larger than the 64 KB pipe buffer - `set -euo pipefail` plus a Python matcher that breaks early - and separately exhausts Windows fork resources on a full run. **On Windows use `validate.ps1` under pwsh 7.** The trigger, `work/codex-product-action-strip.md` (98,825 B, shipped but never cleaned up), is archived at `archive/work/codex-product-action-strip-20260704-full.md`; it holds the 2026-07-04 PR #195 final review, Red Team Findings, and Resume block that the compacted 2026-07-02 archive lacks.
- New advisories from `check_ssot_caps.py` (printed indented under a `[PASS]`, never a FAIL): Ship History 73 entries (cap 10), Spec Index 43 entries (cap 30). Rotation deferred and recorded here rather than silently dropped.

### Ship-chore-release-v1.6.4-2026-07-04 (product action strip Phase-1) · release v1.6.4

- Release cutting the merged Phase-1 product-action-strip polish (PR #196, squash `dacb682`) as **v1.6.4**: `package.json` 1.6.3→1.6.4 + CHANGELOG narrative ("Clearer signals, plainer words"). No further app change. Lockfile root version left stale per convention. Git tag `v1.6.4` created + pushed by the agent (annotated, on release commit `d7911e0`).
- Scope note: this branch's Phase-2 in-repo portable-core layer (34-subpath package API + `.mjs` mirrors) was PARKED not merged per **ADR-009** (owner Option A — AVO stays a local, unpublished app; the reusable core is deferred to a clean-room copy-out into a NEW repo if a second consumer firms up). PR #195 closed as the parked reference; self-review findings F1–F9 preserved in ADR-009 (F1/F4 honesty-critical).
- Tests: Pass (full suite 2251, from #196; CI 7/7 green — Semgrep / render-smoke / test 22+24 / pack-smoke / npm audit / TruffleHog)

### Ship-codex-product-action-strip-2026-07-02

- Feature shipped: polished agent status surfaces and visual/copy clarity. Persistent blockers now surface in the control panel, activity-feed implementation artifacts are translated through an explicit reusable classifier, quiet agents collapse into a clean count, first-run setup hint readability improved, and local audit screenshots are ignored.
- Commit: aeea422 feat(ui): polish agent status surfaces
- Tests: Pass (focused Vitest 31, build, smoke, full suite 2246)

### Ship-chore-release-v1.6.3-2026-06-27 (office layout enrichment) · release v1.6.3

- Release cutting the merged office-layout-enrichment work (PR #192, squash `fcf5ee1`) as **v1.6.3**: `package.json` 1.6.2→1.6.3 + CHANGELOG narrative (Unreleased → v1.6.3 "Fuller corners, honest windows"). No further app change. Lockfile root version left stale per convention. Tag + `npm publish` performed manually by owner.
- Tests: Pass (full suite 2222, from #192)

> Older entries (66) are archived, newest-first, in
> `.agentcortex/context/archive/ship-history-2026.md`. They are not auto-read at bootstrap.
