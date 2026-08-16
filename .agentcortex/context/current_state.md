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
- **Last Updated**: 2026-08-03T23:30:00+08:00
- **Last Verified**: 2026-08-15
- **Update Sequence**: 116
- **ADR Index**:
  - docs/adr/ADR-001-vnext-self-managed-architecture.md — vNext self-managed AI architecture
  - docs/adr/ADR-002-multi-worktree-session-design.md — multi-worktree session isolation design
  - docs/adr/ADR-003-status-source-parity-for-codex.md — status-source parity for Codex
  - docs/adr/ADR-004-no-per-frame-agent-separation.md — AVO-144 resolved by decision: per-frame separation rejected (3-lens panel); re-open conditions recorded
  - docs/adr/ADR-005-no-user-drag-to-move-agents.md — AVO-142 rejected by decision: user drag-to-move rejected (4-lens panel unanimous); position=state honesty; interaction redirected to AVO-158 Poke; re-open conditions recorded
  - docs/adr/ADR-006-no-observability-cost-dashboard-scope.md — AVO is not an observability/cost dashboard; Cancels off-mission AVO-109/113/114/116/118/119/120 + descopes AVO-108 $ remainder; conditions for opening a NEW item recorded
  - docs/adr/ADR-007-dialogue-channel-separation-and-honesty-gate.md — dialogue layer: bubble=voice / status=symbol+ring (detail→inspector, blocked=exception) + open-ended non-conclusive content rule + inter-agent honesty gate G1–G10 (reject relationship-memory); applies_to: src/systems/{roleArchetype,behaviorEngine,officeLife,contextBubble}, src/components/{AgentCharacter,BehaviorBubble}, src/locales/*.json
  - docs/adr/ADR-008-no-fabricated-need-ambient-honesty.md — ambient/companion honesty rule: no fabricated need/engagement/emotional-state (N1–N7 checklist: anti decay/streak/loot-for-time-open; pet hides on blocker incl. awaiting-approval; no unbound decorative channel; degrade to honest neutral; real-clock-only variety; no engagement notification); consolidates ADR-004/005/006/007; closes backlog AVO-166
  - docs/adr/ADR-009-no-in-repo-portable-core-extraction.md — portable status-core extraction stays OUT of AVO (deferred to a clean-room NEW repo; AVO untouched, unpublished). `codex/product-action-strip` PR #195 Phase-1 UI polish ships; Phase-2 in-repo package API (34 subpaths / .mjs mirrors / manifest) parked-not-merged. YAGNI/REDUCE + no npm consumer + 88-byte bundle headroom; preserves Phase-2 findings F1–F9 for the future extraction (F1/F4 honesty-critical). Re-open: a concrete consumer project is ready to depend on the core
  - docs/adr/ADR-010-atomic-door-route-claims.md — AVO-187 shipped atomic full-route physical-door claims with FIFO fairness and fenced lifecycle; extends ADR-004; applies_to: movementSystem, store, AgentCharacter, doorway tests and soak
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
  - [subagent] docs/specs/subagent-helper-huddle.md [Frozen]  *(SubagentStart→helper sprites; shipped)*
  - [real-ai-behavior] docs/specs/skill-activation-badge.md [Shipped]  *(AVO-104 / #30 — transient skill bubble on SubagentStart via existing bubble cap (working-tier); panel Option B, honest no-over-head-element)*
  - [game-feel] docs/specs/event-juice-pass.md [Shipped]  *(AVO-136 / #117 — rare-event juice: deploy confetti + eureka sparkle + desk-slam local shake; pure juiceForEvent resolver, reduced-motion-safe, never occludes status)*
  - [multi-agent] docs/specs/review-gate-waiting.md [Shipped]  *(AVO-107 / #112 — honest reframe: gate-desk "waiting" in-tray driven by awaiting-approval only; no queue/type fabrication; complements AVO-105 arrows; panel-decided)*
  - [brand] docs/specs/office-theme-selector.md [Shipped]  *(AVO-123 / #41 — lightweight overlay-grade theme tint beneath status layer; Default/Winter/Autumn light tints; contrast-guarded; Dark/Retro/Cyberpunk deferred)*
  - [ci-infra] docs/specs/sim-soak-gate.md [Shipped]  *(AVO-157 — nightly world-invariant soak: teleport/stack/frozen/off-floor; test-the-test 11 pins)*
  - [ci-infra] docs/specs/avo-190-soak-target-identity.md [Shipped]  *(AVO-190 — fail-closed AVO identity preflight for soak and overlap recorder targets)*
  - [ci-infra] docs/specs/avo-189-reachable-raf-watchdog-diagnostic.md [Shipped]  *(AVO-189 — first proven focused lost-chain restart is observable)*
  - [data-path] docs/specs/avo-188-abort-movement-in-place.md [Shipped]  *(AVO-188 — aborted walks stop at rendered truth without stale motion or teleporting)*
  - [office-runtime] docs/specs/standing-overlap-deconfliction.md [Shipped]  *(AVO-156 — standing-stack五層根因: isWalking lifecycle + door jitter + journeyTarget + ellipse spacing + arrival nudge; live A/B 12→0 events)*
  - [office-runtime] docs/specs/avo-187-temporal-doorway-claim.md [Shipped]  *(AVO-187 — atomic full-route physical-door claims; FIFO, fencing, lifecycle release, all-door forced evidence)*
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
  - Older `[Shipped]` index lines are in `## Spec Index Archive` at the bottom of this file. Spec bodies stay in `docs/specs/` — only index lines rotate.
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
- **A green sim-soak does NOT mean movement is healthy.** Preserved here because the ship entry carrying this warning was rotated to `archive/ship-history-2026.md` on 2026-08-16, and archived entries are not auto-read at bootstrap. For 32 runs the soak's stack data was *uninterpretable, not merely false-red*: the rig injected ~22 spurious 3s freezes per 150s AND released the journey claim (the only anti-stack mechanism) ~22x per 150s, so a real stack was indistinguishable from a manufactured one. The 2026-07-16 fix repaired the GATE, not the office — it means we can finally measure, not that movement is fine. Full account: archived `Ship-fix-soak-gate-2026-07-16`.
- **Verification reality**: behavioral correctness = the **test suite** (vitest = real modules, no dup). Pixel/visual correctness = **owner only**. `preview_screenshot` must NOT be relied on (hangs).

## Ship History

### Ship-chore-remove-dead-deskcluster-2026-08-16 (1 genuinely dead export; 6 of 7 candidates were my own false positives)

- Removed `DeskCluster` from `src/components/TopDownFurniture.jsx` -- exported, never imported or rendered. 1 file, **-17 lines, 0 additions**; bundle 496.50 -> **496.18 kB**.
- The scan that found it originally flagged **7** dead exports and **6 were false positives**: the detector excluded the defining file from its reference search, so symbols used only within their own module looked unreferenced (`onLocaleChange`, `drawCard`, `DOOR_CLAIM_LEASE_MS`, `HELPER_OFFSETS`, `HELPER_HEAVY_THRESHOLD`, `MODE_EMOTE`). Each was re-checked individually before anything was deleted. `DeskCluster` appears exactly once in the whole repo -- at its own declaration.
- **The verification that mattered, and the near-miss inside it.** `render-smoke` reported `min svg descendants 2042` while an earlier run this session reported **2051** -- which would mean removing "dead" code changed the render, i.e. that it was not dead. It did not mean that: the 2051 run was on a different branch (the dependency refresh), so two variables had moved at once. Re-measured as a **same-branch A/B**: `main` unmodified -> 2042, with the removal -> 2042. Provably render-inert. Worth keeping: `min svg descendants` is a **floor assertion over a live animated scene**, not a render fingerprint -- cross-branch or cross-run comparisons of that number prove nothing, only a same-tree A/B does.
- Tests: Pass -- Vitest 114/114 files and 2306/2306 tests; build PASS; `render-smoke` PASS across 4 viewports with 0 pageerrors and 0 console errors; same-branch A/B render proof above.

### Ship-chore-dependency-refresh-cve-clearance-2026-08-16 (2 CVEs cleared; 9 deps refreshed)

- Cleared both open advisories by bumping the declared `vite` range 8.0.16 -> 8.2.1: it requires `postcss ^8.5.25`, above the `<=8.5.22` advisory range, and pulls the fixed `nanoid` 3.3.18. Resolved chain is now `vite@8.2.1 -> postcss@8.5.26 -> nanoid@3.3.18`; `npm audit --omit=dev` reports **0 vulnerabilities**. The other 8 stale direct deps were refreshed in the same pass (all patch/minor); `npm outdated` is empty. Only `package.json` + `package-lock.json` changed -- zero source files.
- **A rejected approach, recorded so it cannot quietly return.** The scan's first proposal was to move `vite` / `@vitejs/plugin-react` / `@tailwindcss/vite` / `tailwindcss` out of `dependencies` into `devDependencies`, reasoning that build tools do not belong in production deps and that this was why `npm audit --omit=dev` surfaced build-chain CVEs as production vulnerabilities. **That would have broken the documented install path.** `bin/cli.js:294` resolves and executes Vite's CLI via `require.resolve('vite/package.json', { paths: [root] })`, and `package.json files:` ships `vite.config.js` + `src/`, so under `npx agent-virtual-office` Vite runs on the consumer's machine as a genuine runtime dependency. Reclassifying it would have re-opened precisely the failure v1.6.5 shipped to fix (PR #205). Refuted by reading `bin/cli.js` before any edit was made; **no dependency was reclassified.**
- Honest severity, stated rather than inflated: neither library reaches the shipped browser bundle (0 occurrences in `dist/`). They execute in the build / dev-server process -- which under `npx` is the consumer's machine, so the exposure is real but needs attacker-controlled input into that user's own build chain. This is dependency hygiene, not an incident.
- The `rolldown 1.0.3 -> 1.2.4` jump inside vite 8.2.1 was the actual regression risk and it landed clean. Bundle grew 496,504 -> **496,515 bytes (+11)**; `scripts/bundle-budget.mjs` PASSES at +0.00% against its 10% headroom, so `bundle-budget.json` was deliberately **not** re-based -- the budget is a ceiling with room, not an exact pin, and editing it would have been an unnecessary change to a deliberately-managed file.
- Lockfile scope audited against the git baseline rather than the audit summary: 73 entries changed, all traceable to the 9 declared bumps and their platform-binary fanout; the 5 removals (`@emnapi/*`, `@tybys/wasm-util`, `@rolldown/binding-wasm32-wasi`, `tslib`) are the wasm-fallback chain rolldown 1.2.4 drops. Zero out-of-scope packages.
- Tests: Pass -- `npm audit --omit=dev` 0 vulnerabilities; Vitest 114/114 files and 2306/2306 tests on vitest 4.1.10; build PASS; bundle-budget gate PASS; `npm run smoke` PASS (4 viewports, 0 pageerrors, 0 console errors); **`npm run smoke:pack` ALL ASSERTIONS PASSED**, including booting the packed tarball's dev server and getting HTML with the app mount -- the direct proof that Vite still resolves and runs from an installed package.

### Ship-chore-ssot-index-rotation-2026-08-16 (both SSoT caps restored; the "never rotate" rule retired)

- Spec Index collapsed **47 -> 30 inline + 18 archived** into `## Spec Index Archive`, and Ship History rotated **11 -> 10**. `check_ssot_caps.py` now prints `ssot caps OK - ship history 10/10, spec index 30/30 (+18 archived)` -- the first time both caps have been satisfied.
- **This retires the standing "never rotate the Spec Index" rule, by measurement rather than by trusting a changelog.** That rule came from the 2026-07-10 entry below, where rotating produced 13 hard FAILs because both validators scraped the index with a regex that stopped at the next `##` header and contained zero references to `## Spec Index Archive`. Upstream fixed it in `b5d2e29` (#381): `validate.ps1:2240-2243` now scrapes the live index block **and unions the archive section into it**. The rotation was applied and then measured -- `[PASS] SSoT Spec Index completeness: all shipped/living specs are indexed`, `fail=0`.
- **Merge-order constraint, and it is load-bearing.** This branch is stacked on `chore/upgrade-agentic-os-v1.8.21` because the fix lives *in the validators*, which only exist at v1.8.21. Verified before starting: `main`'s v1.8.17 validators contain **0** references to `Spec Index Archive`; the v1.8.21 pair contains **2 each**. Merging this rotation ahead of the upgrade would reproduce the original 13-FAIL outcome exactly.
- Only `[Shipped]` index lines moved. The 1 `[Draft]`, the 2 `[Frozen]`, and the trailing "When reading specs..." instruction line stay inline -- archiving a non-shipped spec would hide live design authority behind an archive header.
- **Two things measurement caught that reading would not have.** (a) The first pass moved 17 lines and the count stayed at 31: the explanatory pointer line added to the index is itself an indented child entry, and the cap counter counts those. Fixed by moving one more `[Shipped]` line. (b) The Ship History closing note claimed "Older entries (68)" while the archive actually held **74** -- a hand-carried count already drifted by 6 before this task touched anything. It was **deleted** rather than corrected to 75, following upstream's own precedent in this same release wave (`aca9bf4`, "delete the hand-carried backlog count"); a number nobody recomputes is a number that lies again next rotation.
- Tests: Pass -- `check_ssot_caps.py` OK on both caps; `validate.ps1` `pass=113 warn=6 fail=0 skip=5` with `[PASS] SSoT Spec Index completeness`; rotated entry carries no `](../` links so the archive depth hazard did not apply.

### Ship-chore-upgrade-agentic-os-v1.8.21-2026-08-15 (governance brain v1.8.17 -> v1.8.21)

- Upgraded the vendored Agentic OS framework from **v1.8.17** (`102e19b`) to the latest upstream release **v1.8.21** (`f5a161c`) from canonical `KbWen/agentic-os.git`. Classified `hotfix` under the Supply-Chain / Provenance Escalation rule. Deploy: `202 updated / 2 skipped / 0 new / 0 removed`; real change set = **30 tracked files, 0 product files**.
- The 2 SKIPs were the correct ones. Both `.acx-incoming` sidecars were generic framework templates that would have destroyed project content -- the SSoT sidecar was the blank `[Describe your project in one line]` placeholder, and the `.claude/settings.json` sidecar carried **no hooks at all** (this project's 8 `office-status-hook.js` entries are the whole status-transport spine). Inspected and deleted; residue 0.
- `.gitignore` is the one file deploy **merges** rather than copies, so it was excluded from byte-parity and hand-audited instead: purely additive (upstream PR #408's `.claude/settings.local.json` entry), zero pre-existing entries dropped.
- **Two long-standing local blockers are fixed upstream and the prior records here were stale.** (a) `validate.sh` exit-141 SIGPIPE on Windows (upstream issue #336, recorded above as "unfixed in v1.8.11") now completes: `pass=112 warn=7 fail=0 skip=5`, exit 0 -- and the trigger condition is still present (2 files >64KB, `ship-history-2026.md` = 136KB), so it is a real fix, not an absent trigger. (b) The Spec Index rotation trap (recorded above as "attempted, then REVERTED" because the validators' regex knew nothing about `## Spec Index Archive`) is fixed by upstream `b5d2e29` (#381); both v1.8.21 validators now reference that section and `ship.md:184` documents the collapse with an over-fold guard.
- **Deliberately NOT done in this ship**: the Spec Index collapse (now 47 entries vs cap 30) and Ship History rotation (this entry makes 11 vs advisory cap 10). Both are now unblocked by the fixes above, but doing them inside a supply-chain hotfix is scope creep; they are the first items of the follow-on technical-debt pass, where the newly-safe rotation gets verified rather than assumed. `check_ssot_caps.py` prints both under a non-failing WARN/PASS.
- **Upstream findings routed to the owner.** NEW: `validate.sh` and `validate.ps1` disagree on the same tree -- `pass=112` vs `pass=113`; `docs/specs` frontmatter check exists only in the `.ps1`; `backlog label vocabulary` reports 2 vs 1 distinct labels; `archive size` measures 1108KB vs 878KB; the Evidence-floor check covers one more classification in the `.ps1`. Not new: the phantom `-- tool not present` SKIPs are already upstream **#173** ("19 tools referenced, 7 absent, at least 4 deliberately, no allowlist separates intent from oversight"); `check_worklog_references.py` being source-only follows the **#137** precedent.
- Review limits stated rather than implied: no fresh-context reviewer was dispatched (same-session author reviewed own work; the trust-boundary external signal was the upstream CHANGELOG cross-check plus an independent `git ls-remote` provenance check), and the 202 deployed files were NOT line-by-line audited for malicious content -- the applied control is provenance + byte-parity, which is the appropriate control for vendored framework code, not a code audit.
- Tests: Pass -- Vitest 114/114 files and 2306/2306 tests; build PASS with the bundle unchanged at 496.50 kB; `validate.ps1` `pass=113 warn=7 fail=0 skip=5` (baseline `113/6/0/4`, fail stays 0); `validate.sh` `pass=112 warn=7 fail=0 skip=5`; 202/202 deployed files byte-match the v1.8.21 source after CRLF normalization; upgraded-tool functional smoke 9/9 including a proven stale-`expected-sha` rejection by `guard_context_write.py`.

### Ship-chore-release-v1.6.5-2026-08-03 (npx project-root fix + maintenance sweep) · release v1.6.5

- Release cutting the merged npx/project-root correctness work as **v1.6.5**: `package.json` 1.6.4→1.6.5 + CHANGELOG narrative ("It works where you actually run it") + Ship History. The stale `package-lock.json` root version (1.4.0, unchanged since v1.4.0) was corrected to 1.6.5 in the same commit — it is a metadata field npm regenerates, and leaving it skewed was a standing doc/description inconsistency the owner asked to clear. Git tag `v1.6.5` created + pushed by the agent (annotated, on the release commit).
- Covers PRs #198–#205 since v1.6.4: the npx hook-filtering fix (#205), AVO-187/188/189/190 doorway reliability + Agentic OS v1.8.17 (#204), the sim-soak gate repair (#202), and SSoT/governance maintenance (#198–#200, #203).
- Scope note: GitHub Releases still has no release page for v1.6.2–v1.6.4 (tags exist). Owner decided against backfilling; only v1.6.5 gets a release page. Recorded here so the gap is not mistaken for missing tags.

### Ship-fix-npx-project-root-2026-08-03 (PR #205 — the office was blind under the documented npx path)

- Shipped as squash `89ff577`. `bin/cli.js` spawns both servers with `cwd` set to the PACKAGE root, so under `npx` their `process.cwd()` is the npx cache dir. Session files are matched against that root while the hooks stamp `_cwd` with the real project — so **every hook-written status file was discarded as foreign** and the office fell back to file-watcher data (`source: 'file-watcher'`, `_hint: 'no-hooks'`, labels degraded to raw `.jsonl` filenames). Status visibility, the product's core value, was dead on the documented install path. Diagnosed by external contributor @whoffmandesign in PR #201.
- `resolveProjectRoot()` now lives in `src/server/scanSessions.mjs` — the module that owns the `_cwd` matching contract and is imported by both servers, so the two cannot drift. `bin/cli.js` forwards the invoking cwd as `OFFICE_PROJECT_ROOT` on **both** spawn sites; an explicit value wins (multi-worktree).
- **Two gaps beyond #201, both proven not asserted.** (a) The original patch converted only the 6 read sites; both POST handlers stamp `_cwd` themselves, so a read-only fix makes the server filter out its own `POST /api/status` / `/api/event` writes — trading the hook path for the webhook path. Simulated: the read-only variant fails `serverProjectRootE2E > reads back its own POSTed status`. (b) `server.mjs` (the `serve`/Docker path) had all 8 identical sites and was equally broken.
- Also swept: `tests/agentInspector.test.js` mixed fixed `+08:00` ISO literals with a LOCAL-time `dayKey`, so 2 cases failed on any host outside UTC+8/UTC — the same defect this file already fixed once for CI, never swept. And doc drift: README (en+zh-TW), ARCHITECTURE, INTEGRATIONS, DEPLOYMENT env table, ADR-002 all stated the filter keys off `process.cwd()`; ADR-007 `applies_to` pointed at `src/systems/banter.js`, a file that never existed.
- Tests: Pass — Vitest 114/114 files and 2306/2306 tests under TZ = UTC, America/Los_Angeles, Pacific/Kiritimati (UTC+14), Pacific/Midway (UTC-11), Europe/Berlin; both new test files verified RED on pre-fix source; build PASS with the bundle unchanged at 496.50 kB; validator `pass=112 warn=8 fail=0 skip=4`; CI 7/7.

### Ship-pr-204-ci-release-gates-2026-08-01

- Cleared PR #204 release gates with a lockfile-only PostCSS 8.5.18 security patch and an intentional AVO-187 bundle-budget rebase to the measured 496,504-byte production bundle. No product source or dependency range changed. Commit: `cfabe93`.
- Tests: Pass — local npm audit 0 vulnerabilities, PostCSS 8.5.18, build/bundle gate, and 2295/2295 tests; GitHub CI #451 and Security Scanning #360 passed test (22/24), pack/render/soak smoke, npm audit, Semgrep, and TruffleHog.

### Ship-avo-187-temporal-doorway-claim-2026-07-31

- Shipped AVO-187 on `codex/chore-upgrade-agentic-os-v1.8.17`: atomic full-route physical-door claims serialize both directions with stable FIFO tickets, journey fencing, complete lifecycle release, and rendered-truth timeout/dynamic-removal aborts. Commit: `018ef1e`.
- Tests: Pass — Vitest 112/112 files and 2295/2295 tests; production build PASS; Agentic OS validator 112 PASS / 0 FAIL; real-server 4/4 doors over 22 batches with empty final owners/requests; 10.005-minute cold-watch with zero invariant violations.

### Ship-fix-avo-189-reachable-raf-watchdog-diagnostic-2026-07-30

- Shipped AVO-189 on `codex/chore-upgrade-agentic-os-v1.8.17`: the first reachable focused lost-chain restart now increments the existing diagnostic counter and emits the existing dev warning. The change is the predicate threshold `>=2`→`>=1`; RAF timing, restart behavior, and frame reset semantics are unchanged.
- Pending RAF handles and unfocused documents remain excluded, preserving the existing host-throttling noise guards. Commit: `feb23ef`.
- Tests: Pass — focused 21/21; Vitest 111/111 files and 2271/2271 tests; build PASS; Agentic OS validator 112 PASS / 0 FAIL before Work Log wording cleanup.

### Ship-fix-avo-188-abort-movement-in-place-2026-07-30

- Shipped AVO-188 on `codex/chore-upgrade-agentic-os-v1.8.17`: one atomic store action stops aborted walks at a defensive copy of the rendered position, clears `isMoving` and `journeyTarget`, and aligns `targetPosition` without teleporting to an abandoned waypoint.
- Force-unstick and behavior-watchdog use the action directly. True component removal defers one microtask; same-flush live teardown/setup clears the unmounted flag and keeps the existing restoration path intact. Commit: `ac07a4d`.
- Tests: Pass — focused 67/67; Vitest 111/111 files and 2271/2271 tests; build PASS; forced-spawn soak 5 samples / 0 violations; Agentic OS validator 113 PASS / 0 FAIL.

> Older entries are archived, newest-first, in
> `.agentcortex/context/archive/ship-history-2026.md`. They are not auto-read at bootstrap.

## Spec Index Archive

> Rotated out of the live **Spec Index** on 2026-08-16 to satisfy the `check_ssot_caps.py`
> 30-entry advisory cap. These are index lines only — every spec body remains at its
> `docs/specs/` path and is still validated for completeness (both validators union this
> section with the live index; `validate.ps1:2243`). Never delete entries from here.

  - [vibe-rebalance] docs/specs/control-bar-reduction.md [Shipped]  *(AVO-130 / #116 — 4 health pills→1 expandable health dot; lang/run/view/help/platform demoted into ⚙ menu / info popover)*
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
