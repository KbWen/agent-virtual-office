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
- **Last Updated**: 2026-09-20T13:42:06+08:00
- **Last Verified**: 2026-09-19
- **Update Sequence**: 133
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
  - [ui-rendering] docs/specs/calm-stationery-palette.md [Shipped]  *(warm-oak floor/walls + paper inspector with role-tint header, owner-chosen from rendered candidates; all shell/sign/card colours are tokens in `src/systems/officePalette.js` with enforced legibility rules R1–R5)*
  - [ui-rendering] docs/specs/review-2026-09-19-remediation.md [Shipped]  *(2026-09-19 external review, wave 1 — REV-01/02/03/08/09: panel-mode overlays clamp to the live viewBox; no speech is moved into view for an off-crop speaker (both axes + the #47 clamp); dead page-title status channel deleted; relative times tick every 10 s; PR #236)*
  - [hook-integration] docs/specs/vite-config-esm.md [Shipped]  *(REV-05 — dev-server config renamed to native ESM `vite.config.mjs`; three Vite config-loader warnings gone; Dockerfile/package.json path-drift guard; PR #238; closes F-11 of 2026-09-08)*
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

### Ship-fix-avo-197-oneshot-animations-2026-09-20 (the one-shot animations actually play now) · AVO-197

- Quick-win shipped: SIX one-shot SMIL animations in the office were dead. SMIL resolves `begin="0s"` against the DOCUMENT timeline, so an element mounted on a status change, a behaviour change or a poke is already past its active duration and snaps to its end value — no error, no warning, correct-looking markup, which is how it survived five features shipping. AVO-135's "one-shot celebratory flash" was mounted for 60 frames and visible on exactly 1. Found while building AVO-193 (whose steam uses CSS and was never affected).
- **Fixed with `begin="indefinite"` + `beginElement()` on mount, deliberately NOT a CSS rewrite**, even though AVO-193 used CSS and CSS is easier to unit-test. AVO-136/158 are `additive="sum"` transforms on a root `<g>` already carrying `translate(x,y) scale(CHAR_SCALE)`: a CSS `transform` REPLACES that base transform, and the CSS `translate` property composes but applies OUTSIDE it, silently changing how far an agent bobs. Both CSS routes were measured working before being rejected on those grounds. No duration, curve or `values` list changed — a repair, not a re-tune.
- Verified in a real browser, same instrument on both sides, counting distinct animated values (a snap gives 1-2; a real animation at 60fps gives tens): done flash 2→43, poke bob 2→21, desk-slam jitter 1→26, behaviour pop 2→19, reason pop 2→22, banner fade 1→24. The done flash went from **1 visible frame to 39**.
- **Three of my own measurements were wrong first** and each would have produced a false claim: sampling `document.querySelector` while triggering a different agent; reading `getScreenCTM()`, which does not reflect SMIL transform animation at all; and a deterministic "DEAD" for the behaviour `thinking`, which has no case in `BehaviorIndicator` and renders null, so the instrument was measuring an empty box. All three were caught before any conclusion, each by re-validating against a known-playing control.
- Tests: vitest **2512 passed / 133 files** (+10). The unit tests deliberately do NOT assert that the animations play — believing markup was the original mistake — they hold the wrapper contract plus a regression guard (with its own can-it-fail self-test) against any future unwrapped one-shot. Build, single-file build, render-smoke and panel smoke PASS. Owner approved the before/after frame strips before merge. PR #244.

### Ship-feat-avo-193-coffee-busy-feedback-2026-09-20 (the coffee machine says BUSY when it cannot serve you) · AVO-193

- Quick-win shipped: clicking the coffee machine while every agent is genuinely working did nothing at all. The silence was CORRECT — AVO-191 refuses to drag a working agent to the machine — but it reads as a broken click, and unlike the deploy button and the whiteboard, `tea-break` has no `INTERACTION_REACTOR` entry, so `fireInteractionReaction` returned on its first line. The machine now answers for itself: screen `CAFE` → `BUSY` plus three wisps of steam for 2s. Owner chose this from rendered candidates before any repo edit.
- **The refusal is untouched, and that is the whole design.** The feedback hangs off the FALSY return of `triggerInteractiveEvent`; adding `tea-break` to `INTERACTION_REACTOR` would have been the tempting one-liner and is exactly what AVO-191 removed. Measured in a real browser with every agent `working`: positions identical, statuses identical, full id→bubble-text map identical before and after, `activeEvent` null throughout — compared as maps, not counted, since 8 agents already had ambient bubbles.
- The steam is a CSS `@keyframes`, NOT SMIL: an `<animate begin="0s">` mounted after page load counts from DOCUMENT start and renders already-finished, which is how the first prototype got invisible steam. Proof it plays: the three wisps read opacity 0.83 / 0.62 / 0.33 mid-run. Reduced motion keeps both signals and drops the movement (`animated: 0`, static opacity), like the pet-pop site.
- Tests: vitest **2502 passed / 132 files** (+7, new `tests/coffeeBusyFeedback.test.jsx`, red first on 5 of 7). Four mutations killed, incl. showing the feedback without consulting the honesty gate. Build, single-file build, render-smoke and panel smoke PASS. PR #241. Closes the last open finding of the 2026-09-19 handoff review (REV-10).

### Ship-fix-avo-196-offscreen-speaker-bubbles-2026-09-20 (no speech bubble for a speaker you cannot see) · AVO-196

- Quick-win shipped: in the compact panel an agent standing below the visible crop (the lounge `stretch` (180,490) and `coffee` (80,475) spots) still rendered its bubble INSIDE the crop with nobody visible saying it. PR #236 closed the same defect above and to the sides and deliberately left this one as a design call. The owner chose the rule from rendered candidates (prototype in a scratch worktree, no repo edit before approval): hide the bubble when the speaker's ANCHOR is outside the crop, EXCEPT `blocked`/`awaiting-approval`.
- **The exemption is the point.** ADR-007 D1 licenses `blocked` to seize the bubble as the message worth interrupting for, and the panel's control bar already says "Needs your attention: <name>", so nothing actionable is hidden. This corrects the backlog row's earlier claim that ADR-007 forbids suppressing voice — it does not; re-read at design time.
- The test is the ANCHOR, matching the three sides #236 already guards. A first cut measured a ~44-unit sprite height and made the coffee spot "visible" by 4 units; the anchor rule is simpler and consistent, and one #236 render case changed meaning (a meeting-chair speaker now renders no bubble at all rather than an unflipped one) while the pure helpers still pin the flip/clamp geometry.
- Tests: vitest **2495 passed / 131 files** (+9). Two mutations killed (drop the blocked exemption, never hide). Build, bundle-budget +0.68%, render-smoke and panel smoke PASS. Browser evidence on the staged scene: before, both an idle and a blocked speaker below the view showed bubbles inside the crop; after, only the blocked one. PR #240.

### Ship-chore-release-v1.6.9-2026-09-20 (nothing gets cut off in the small window, and English gets whole sentences) · release v1.6.9

- Cuts the 3 PRs merged since `v1.6.8` (#236, #237, #238) as **v1.6.9**. They all answer the 2026-09-19 external review, which was worked as untrusted input: 10 findings, 7 fixed, 2 rejected on evidence, 1 = AVO-193. The release commit contains no app code: `package.json` 1.6.8 -> 1.6.9, **both** `package-lock.json` version fields (verified 0 `"version": "1.6.8"` strings left), the CHANGELOG narrative, and this entry.
- **Two of the three are user-facing**: #236 (the panel-mode inspector and bubbles, no speech without a visible speaker, and relative times that keep counting) and #237 (bubble width fitting: English whole lines 52%→85%). #238 (the dev-server config as ESM, plus the manifest path guard) is under "Housekeeping — not user-facing". The notes carry a "does not claim" list: the panel inspector can cover the clicked agent, below-crop speakers are AVO-196, the north-door feet-anchor flip, and font-dependent line breaks.
- Tests at the cut: vitest **2486 passed / 131 files**; build PASS; `bundle-budget` PASS at 499642 vs baseline 496504 (+0.63%); `render-smoke` PASS (4 viewports, 0 errors); `pack-smoke` ALL ASSERTIONS PASSED. Post-merge per `repo-gotchas` §12: **annotated** `v1.6.9` tag on the release merge commit + `gh release create --latest`.

### Ship-chore-vite-config-esm-2026-09-20 (the dev-server config becomes native ESM; three warnings gone) · REV-05

- Feature shipped: REV-05, the last open item of the 2026-09-19 review. It also closes the half of F-11 (2026-09-08) that was deferred. Every `vite`/`vitest`/`vite build` run printed MIXED_EXPORTS and two "ESM syntax in a file loaded as CommonJS" warnings. The cause was re-derived: Vite 8 bundles an ESM config inside a `"type": "commonjs"` package, and the review's claim that Node 22 was responsible is wrong. The tool's own warning says the native loader is planned as a future default, which would stop this config loading. `vite.config.js` is now `vite.config.mjs` (R099 rename) and imports `statusContract.mjs` directly. Every functional reference follows; historical records are untouched.
- **A new guard makes path drift loud.** `tests/buildManifestPaths.test.js` checks that every Dockerfile COPY/ADD source and every package.json `files` entry exists. Both consumers drop a missing path silently: CI never builds the image, and `npm pack` skips a missing entry. After a bare rename the guard went red on exactly the two stale references. A fresh-context review (Sonnet) came back NOT READY in round 1: one live comment, plus guard-parser gaps for continuation lines, JSON-array COPY and ADD. Both were fixed and round 2 was READY. The reviewer also confirmed that `[...]` in Docker (Go filepath.Match) and npm (minimatch) globs is a character class, so the guard keeps it as one. Accepted: a future heredoc COPY would make the guard fail loudly rather than silently.
- Tests: vitest **2486 passed / 131 files**, 0 warning lines. A live dev server booted from the new file: POST/GET /api/status and OFFICE_STATUS_DIR work. `npm pack` ships the file and pack-smoke passes. Bundle budget (app bundle byte-identical), render smoke and panel smoke PASS. Commit hygiene: the spec commit first swallowed the staged `git mv`. It was soft-reset before push, and a memory was added. PR #238.

### Ship-fix-bubble-truncation-width-2026-09-19 (speech bubbles fit by width, so English stops getting cut mid-word) · REV-07

- Quick-win shipped: REV-07 of the 2026-09-19 external review, held back from #236 because it changes how the office looks. Bubbles were cut at 16 CHARACTERS, and 16 CJK characters are ~1.7× as wide as 16 Latin ones, so 46% of English lines were cut mid-word ("forgot a semicol…") against 5% of zh-TW. The review under-stated this; it reads as an occasional cut.
- Bubbles now fit a **width budget** (140). The width is measured with canvas `measureText` in the bubble's own font (one shared constant with the `<text>`), grapheme-safe, with a Latin word back-off and a trailing-punctuation trim. The budget was chosen by simulating five budgets against every locale line in a real browser. It shows more text with less clutter, because the old per-char estimate over-padded English by ~22%: whole lines en 52%→85%, zh 92%→95%; mean bubble narrower in both (108→101, 90→86); widest bubble in the office 187→158. The owner approved same-state en + zh-TW captures before commit.
- Tests: vitest **2481 passed / 130 files** (+13). 4 mutations killed; one survived the first test set (its only case cut exactly at a space), and a mid-word case was added until it failed. Build, bundle-budget +0.63%, render + panel smoke PASS. PR #237.

### Ship-fix-review-2026-09-19-2026-09-19 (an external review, re-derived — panel mode stops clipping and losing speech; waiting times keep counting)

- Feature shipped: the Gemini handoff review (`docs/reviews/2026-09-19-handoff-review.md`, 10 findings against v1.6.8) was worked as **untrusted input**. Five are fixed (REV-01/02/03/08/09). REV-04 and REV-06 are rejected on evidence: an above-head bubble cannot be covered by a later-painted agent, and the extraction map the review cites says "not a refactor request". REV-10 is AVO-193, and REV-07/REV-05 get their own PRs. Two premises were wrong: the title channel could never see other tabs, and REV-05's warnings come from Vite 8 and Rolldown, not Node 22. Two findings were under-scoped: three surfaces froze their relative times, not one, and two comment sites were stale, not one.
- **Panel mode clamps overlays to the live viewBox.** `store.sceneBounds` now carries `minY`/`h`. `placeInspector` keeps the card inside every crop (clipped 155px/20px before, 0 after, measured in a browser); in the full office it is numerically the old clamp, and the boxes measured identical. The bubble now flips against the crop's top.
- **A fresh-context reviewer caught the first cut putting speech on screen with no speaker.** Meeting chairs (x 645–765) sit right of every panel crop. The new flip and the old #47 edge clamp together dragged their bubbles into view, and no capture had staged a meeting. It was then measured: `main` already leaked ~2.5 such bubbles into the tall panel. Now 0, because the orphan guard covers both axes and the clamp. Speakers just BELOW a crop are still shown; that is AVO-196 and a design decision under ADR-007.
- **Relative times tick.** A local 10 s `useNowTick` drives the roster, the inspector's AVO-169 duration and the activity feed. In a real-browser A/B after a 22 s wait, `main` was 14–20 s stale and the branch was current. The dead `document.title` channel is deleted, and a src-wide guard test keeps it out.
- Tests: vitest **2468 passed / 129 files** (+46 tests, +3 files net). 9 wiring mutations each fail a test. Build, bundle-budget +0.48%, render/panel/pack smoke all PASS. Two independent fresh reviews: round 1 NOT READY, round 2 READY. **Disclosed:** spec AC-2/6/11 were amended under the owner's standing delegation without the §4.2 draft→frozen flip. PR #236.

### Ship-chore-release-v1.6.8-2026-09-14 (a calmer office, and waiting finally looks like waiting) · release v1.6.8

- Cuts the 5 commits merged since `v1.6.7` (2026-09-02) — #230 through #234 — as **v1.6.8**. No app code in the release commit itself: `package.json` 1.6.7 -> 1.6.8, **both** `package-lock.json` version fields (root + `packages[""]`), CHANGELOG narrative, this entry. Verified zero `"version": "1.6.7"` strings remain in either file.
- **Two of the five are user-facing**: the calm palette with its legibility rules (#234) and the external-audit sweep (#232 — the container that never started, the waiting agent that looked busy, the Codex hook that dropped agents, the pasted hook config missing the two events that make a denial an honest `blocked`). The soak stale-label warning (#231), the June work-log archive (#233) and the v1.6.7 chain record (#230) sit under "Housekeeping — not user-facing".
- **The notes state what the palette rules do not certify.** R1 compares each status colour at full strength while rings render below full opacity, so it guards the floor rather than certifying ring contrast — written into "What this release does not claim" alongside the partly-closed F-11 and the two owner-accepted layout quirks, rather than letting "legibility rules" read as a guarantee.
- Tests at the cut: vitest **2422 passed / 126 files**; build PASS; `bundle-budget` PASS at 498871 vs baseline 496504 (**+0.48%**, limit +10%); `pack-smoke` PASS. The oldest entry (AVO-195 backlog row) rotated verbatim into `archive/ship-history-2026.md` to hold the cap of 10. Post-merge per `repo-gotchas` §12: **annotated** `v1.6.8` tag + `gh release create --latest`.

### Ship-feat-calm-stationery-palette-2026-09-13 (a warmer, calmer office, and a palette anyone can change without breaking legibility)

- Feature shipped: a local design handoff (`scratch/design-handoff/`) proposed a "warm stationery studio" look for the main floor, walls, team signs and agent inspector. It was treated as input, not authority. The proposed wall `#A39C89` measured **1.03:1** against the Research/Meeting floors, and **no `STATUS_COLORS` value reaches 4.5:1 as text, even on white** (working amber 2.17). That second finding is why inspector status text is ink and the status colour lives on the dot.
- **The owner chose the look from rendered candidates, not the packet.** The packet said no visual review was needed; mid-implement the owner asked to see screens first ("怕改了更醜"). Pure stationery, two warm blends and two card treatments were rendered as DOM overrides with no source change. The owner picked "warm oak" (floor `#D6C29C`, wall `#806E5A`) plus a 16% role-tint card header, and the code is pixel-matched to that render.
- **Then the design stopped being hard-coded** (owner: "開源repo，要讓大家好看、好修改、且有規則"). `src/systems/officePalette.js` holds the room shell, signs and card; the components hold no palette hex, and door openings share their room's floor token. `tests/officePalette.test.js` enforces R1–R5, and each rule is proven to fail on a real past mistake (old floor, rejected wall, the pre-palette status line, the pre-palette door literal). The move was pixel-identical, verified with diff maps. This scope arrived after "commit + PR" but before the ship commit, so the task was **reclassified quick-win -> feature** and an uncommitted ship closure was **withdrawn** rather than shipped under the old scope.
- **A fresh-context reviewer caught the rules overclaiming**, verdict NOT READY. R4/R5 were not yet shown to bite. R1 measured the SOLID status colour while rings render below full opacity (working amber 1.25 solid, ~1.13 at the ring's 50%). R1 is now stated as a floor guard, not a certificate, rather than fitting a threshold to today's numbers. The close icon sat at 3.96-4.38 on the tint and is now ruled an icon (3:1). All fixed; re-review PASS. Accepted and seen by the owner: ENGINEERING sits ~3px under the Developer tag (tag on top). Pre-existing on `main`: in panel mode the inspector can overflow its cropped viewBox.
- Tests: vitest **2422 passed / 126 files** (+14 rules tests); build PASS; `bundle-budget` +0.48%; render-smoke and panel smoke PASS; hermetic `sim-soak` 1 min ×2 PASS, 0 invariant violations; 18-state hermetic BEFORE/AFTER capture (1280×720, 1440×900, panel, night, zh-TW) with Escape/Enter close asserted from the DOM; `validate.sh` fail=0. PR #234.

### Ship-fix-audit-2026-09-08-2026-09-08 (an external audit, re-derived — the container never started and a waiting agent looked busy)

- Works an external audit handoff (`docs/reviews/2026-09-08-audit-handoff.md`, 12 findings) as **untrusted input**: every finding was re-derived from source before anything was touched. All 12 reproduce, but **three of its file/line references were wrong** and **one of its suggested fixes would have introduced a bug** — mapping `awaiting-approval` to `check-phone`/`stretch` would have WALKED the waiting agent to the lounge, because both are lounge destinations in `movementSystem.js`'s `BEHAVIOR_LOCATIONS`. Position is state in this product.
- **The P0 was invisible to every gate we own.** `server.mjs` imports `src/server/scanSessions.mjs` and `src/utils/normalizePost.mjs`; the Dockerfile runner stage copied neither, so every container exited on `ERR_MODULE_NOT_FOUND` while the build, 2362 tests and three smoke gates stayed green. Fixed by copying the exact runtime closure (56 KB, not all 1.1 MB of `src/`) and pairing it with `tests/dockerRuntimeClosure.test.js`, which walks the import graph so a future import cannot silently re-break the image. Docker is not installed here, so the proof is a **replica of the runner image's filesystem** — pre-fix it reproduces the exact `ERR_MODULE_NOT_FOUND`, post-fix the server boots — not a real `docker run`; a reviewer with Docker should confirm.
- **An agent waiting on YOUR permission prompt was animating a clattering keyboard and saying "almost... almost~".** `awaiting-approval` arrives from `idleGapInfer` with a status and nothing else, so both `decideBehavior` and `generateContextBubble` fell through to their task-family/`-working` defaults — a work claim over the exact absence of work, under the calm cyan ring that was supposed to mean the opposite. It now has a desk-bound hourglass and its own bubble pool in both locales. Verified in a real browser against an isolated dev server, asserting the **rendered DOM**: hourglass present, keyboard glyph absent, control agent still typing.
- **Three silent contract mirrors had drifted.** `office-status-codex.js` was still on the pre-AVO-101 four-status list, so it DROPPED every `planning`/`awaiting-approval` agent, under-counted `activeCount`, and stripped the `reasonCode`/`activeFile`/`skill` carry fields — a Codex-driven blocked agent lost its reason badge. `bridge.js` treated any non-whitelisted value as a task NAME, turning `{ dev: 'planning' }` into a "working" agent labelled "planning". `bridge-ui.js` disagreed with the office's identity colours on 7 of 8 roles. All three are now pinned by drift-guard tests; the codex carry fields also gained the canonical sanitizers, which is a **net tightening** (`task`/`label`/`hint` were previously uncapped and `reasonCode` unvalidated).
- **F-09 was worse than reported.** The audit saw a macOS symptom; the unit was wrong on GNU date too. `_seq` is a millisecond epoch everywhere — `scanSessions` dedups inside a 2s window and expires `done` against `Date.now()` — and the shell hook was emitting nanoseconds. Both platforms measured.
- Docs closed at their source, not by editing prose: `bin/cli.js` registers 8 hook events while `INTEGRATIONS.md` said 6 and `hooks-config.json` (the file the docs tell you to paste) omitted `PermissionDenied`/`StopFailure` — the two events that make a denied tool call an honest `blocked`. Now pinned to `bin/cli.js`. `README.zh-TW.md` regained four sections; `ARCHITECTURE.md`'s room diagram was missing the Designer desk and the Gate station.
- **F-11 is only partly closed, deliberately.** The deprecated Rollup option is fixed (output byte-identical, verified both ways). `MIXED_EXPORTS` and the `configLoader: native` warnings need `vite.config.js` renamed to `.mjs`, which touches every test that imports it — out of scope for a defect sweep, recorded with a written rationale rather than left looking done.
- Tests: **125 files / 2408 passed** (+6 files, +46, all new guards; each proven to FAIL on the un-fixed input first). Build clean, bundle budget +0.20% against a +10% limit, all three smoke gates green, `validate.sh` pass=114 warn=5 fail=0.

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
  - [real-ai-behavior] docs/specs/skill-activation-badge.md [Shipped]  *(AVO-104 / #30 — transient skill bubble on SubagentStart via existing bubble cap (working-tier); panel Option B, honest no-over-head-element)*
  - [game-feel] docs/specs/event-juice-pass.md [Shipped]  *(AVO-136 / #117 — rare-event juice: deploy confetti + eureka sparkle + desk-slam local shake; pure juiceForEvent resolver, reduced-motion-safe, never occludes status)*
  - [multi-agent] docs/specs/review-gate-waiting.md [Shipped]  *(AVO-107 / #112 — honest reframe: gate-desk "waiting" in-tray driven by awaiting-approval only; no queue/type fabrication; complements AVO-105 arrows; panel-decided)*
