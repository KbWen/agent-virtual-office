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
- **Last Updated**: 2026-06-10T00:00:00Z
- **Update Sequence**: 49
- **ADR Index**:
  - docs/adr/ADR-001-vnext-self-managed-architecture.md — vNext self-managed AI architecture
  - docs/adr/ADR-002-multi-worktree-session-design.md — multi-worktree session isolation design
  - docs/adr/ADR-003-status-source-parity-for-codex.md — status-source parity for Codex
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
  - [game-feel] docs/specs/office-pet-barometer.md [Shipped]  *(#39 / AVO-121 — signal-driven office pet)*
  - [office-runtime] docs/specs/blocked-reason-tags.md [Shipped]  *(AVO-110 / #29 — honest-narrow blocked-reason badge; reasonCode contract)*
  - [office-runtime] docs/specs/recurring-failure-detection.md [Shipped]  *(AVO-117 — recurring blocked-reason detection; downstream of AVO-110)*
  - [multi-agent] docs/specs/pair-programming-huddle.md [Shipped]  *(AVO-106 — co-editing pair OVERLAY (desk-to-desk link); per-agent activeFile, edit-only; redesigned from a huddle per expert panel)*
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
