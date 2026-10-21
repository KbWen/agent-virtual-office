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
- **Last Updated**: 2026-10-20T15:25:48.772301Z
- **Last Verified**: 2026-10-11
- **Update Sequence**: 151
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
  - docs/adr/ADR-011-signal-driven-planning-location.md — Accepted 2026-10-19: narrowly scoped real-planning location intent; applies_to: planningPod/store/movementSystem/AgentCharacter
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
  - [hook-integration] docs/specs/antigravity-gemini-hook-integration.md [Shipped] [Updated: 2026-10-20] *(AVO-198: passive Antigravity observer and separate Gemini CLI hooks; owner-approved live-validation limits documented)*
  - [maintenance] docs/specs/engineering-audit-remediation.md [Shipped]  *(2026-09-24 audit remediation: dev server monotonic clock parity F-01, bridge UI planning/awaiting-approval toggles F-05; 2026-09-26 server-hardening wave: malformed-request crash guard, SSE heartbeat/client cap, Host-header DNS-rebinding allowlist, vitest CVE bump; 2026-09-26 dev-server-parity wave: file-watcher fallback root-scoping + `.claude`-segment fix, STALE_MS-based overwrite window, add/unlink SSE watch, dev CORS parity, LAN/no-token warning parity; 2026-09-27 follow-ups: `OFFICE_ALLOWED_HOSTS` also governs the dev server via shared `src/utils/hostAllowlist.mjs`, render-smoke exit-race teardown)*
  - [ci-infra] docs/specs/sim-soak-gate.md [Shipped]  *(AVO-157 — nightly world-invariant soak: teleport/stack/frozen/off-floor; test-the-test 11 pins)*
  - [ci-infra] docs/specs/avo-190-soak-target-identity.md [Shipped]  *(AVO-190 — fail-closed AVO identity preflight for soak and overlap recorder targets)*
  - [ci-infra] docs/specs/avo-189-reachable-raf-watchdog-diagnostic.md [Shipped]  *(AVO-189 — first proven focused lost-chain restart is observable)*
  - [data-path] docs/specs/avo-188-abort-movement-in-place.md [Shipped]  *(AVO-188 — aborted walks stop at rendered truth without stale motion or teleporting)*
  - [office-runtime] docs/specs/standing-overlap-deconfliction.md [Shipped]  *(AVO-156 — standing-stack五層根因: isWalking lifecycle + door jitter + journeyTarget + ellipse spacing + arrival nudge; live A/B 12→0 events)*
  - [office-runtime] docs/specs/avo-187-temporal-doorway-claim.md [Shipped]  *(AVO-187 — atomic full-route physical-door claims; FIFO, fencing, lifecycle release, all-door forced evidence)*
  - [ui-rendering] docs/specs/shareable-daily-card.md [Shipped]  *(AVO-115 / #31 — cozy pixel-art postcard share card; weather/mood hero + 1 number + warm caption; client-side canvas→PNG, opt-in ⚙ Share; honest (no event counting — Option C, derived from done+mood); store.js untouched)*
  - [ui-rendering] docs/specs/poke-acknowledge.md [Shipped]  *(AVO-158 — Poke / acknowledge micro-interaction (Model A, layered on existing click); honest in-place bob + real-status quip; ZERO position/status write; replaces rejected AVO-142 per ADR-005)*
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
  - [ui-rendering] docs/specs/dialogue-interaction-layer.md [Shipped]  *(dialogue layer — ADR-007 channel separation + open-ended content + honesty gate; S1/S1b reduction commits, S2–5 killable hypotheses; red-team + expert/PM hardened; Wave B shipped 2026-10-01)*
  - [ui-rendering] docs/specs/character-roster-lore.md [Shipped]  *(character roster lore & interconnected storylines + automated visual preview asset)*
  - [ui-rendering] docs/specs/calm-stationery-palette.md [Shipped]  *(warm-oak floor/walls + paper inspector with role-tint header, owner-chosen from rendered candidates; all shell/sign/card colours are tokens in `src/systems/officePalette.js` with enforced legibility rules R1–R5)*
  - [ui-rendering] docs/specs/review-2026-09-19-remediation.md [Shipped]  *(2026-09-19 external review, wave 1 — REV-01/02/03/08/09: panel-mode overlays clamp to the live viewBox; no speech is moved into view for an off-crop speaker (both axes + the #47 clamp); dead page-title status channel deleted; relative times tick every 10 s; PR #236)*
  - [hook-io] docs/specs/hook-robustness-privacy.md [Shipped]  *(2026-09-26 audit remediation: lock TOCTOU identity-verified steal-close (token+mtime post-rename recheck) + orphan `.stale.*` cleanup; `atomicWriteJson` EPERM/EBUSY retry; `WebSearch`/`Agent` privacy-leak fixes (raw query/description no longer surfaced); `bridge.js` client-forgeable `source` field closed; `generic-llm-bridge.js` `--watch`-dir git-diff scope + anchored ignore regex + `--port=` support; `cli.js` symlink-safe settings write + null-guard uninstall)*
  - [office-runtime] docs/specs/client-runtime-hygiene.md [Shipped]  *(2026-09-26 audit remediation: confirmed-unchanged (304) poll refreshes the 120s staleness timer; SSE retries every 60s post-give-up, cadence-down gated on a genuine `open` event; persist dedupe key fixed (`_savedAt` excluded); same-day `dailyDoneLedger`/`dailyBlockedLedger` survive a >4h tab-closed gap; `desktopNotifier` per-tick eviction pruning; `clearExternalStatus` eviction parity with `applyExternalStatus`/`abortAgentMovement`)*
  - [office-runtime] docs/specs/honest-office-events.md [Shipped]  *(2026-09-26 audit remediation: `hasRequiredActors()` symmetric pre-fire refusal for a non-empty-but-wrong cast (AVO-191 sibling); idle-gap inference preserves real carry-fields/`changedAt` instead of a synthetic-fresh signal; real work releases a stale group-event pose; `fireWithCast` exported + mutex/epoch-guarded against stale/aborted-fire races; owner-visible Friday-15:00 cadence swap to `group-meeting` (G2))*
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

### Ship-test-antigravity-watcher-sync-2026-10-20

- Quick-win: test-only completion barriers replace fixed wall sleeps; all38cases and exact freshness/skew assertions preserved. Production unchanged.
- Validation:155files/2809tests PASS,3existing skips; independentreviewPASS. PR258 final head CI/merge remains pending at this metadata checkpoint.

### Ship-feat-antigravity-gemini-hook-2026-10-20

- Feature shipped: AVO-198 read-only Antigravity observer and project-local Gemini CLI hooks, PR #258; existing producers/UI preserved.
- Tests: full2809 PASS,3existing skips; Linux Node22/24 CI green; build/budget/render/panel/pack pass.
- Acceptance: owner excluded further real-device tests; Gemini authenticated sessions/native Linux live scenarios remain unverified, not claimed proven.

### Ship-chore-release-v1.6.11-2026-10-11 (live status over HTTPS, and the characters get a little more personality) · release v1.6.11

- Cuts the 3 PRs merged since `v1.6.10` (#254, #255, #256) as **v1.6.11** (patch). #254/#255 were done by Gemini (Antigravity); #256 is the post-merge review that fixed their cut-off bubble lines and the lore book's false "100% aligned" claim. The release commit contains no app code: `package.json` 1.6.10 -> 1.6.11, **both** `package-lock.json` root version fields (0 `"version": "1.6.10"` strings left), the CHANGELOG narrative, and this entry.
- CHANGELOG under-sells: one Fixed (HTTPS-hosted office now polls/streams status, #255), one Changed (new short character lines + lore book, explicitly not runtime lines), Housekeeping (dev-only `source-map-js` override for GHSA-68fv-2mgg-jv7q — verified via GitHub advisory API; the ratchet test). Post-merge: **annotated** `v1.6.11` tag on the release merge commit + `gh release create --latest`.

### Ship-fix-dialogue-bubble-fit-2026-10-11 (the new character lines fit their bubbles; the lore book stops claiming its quotes are bubble lines) · AVO-161 Wave B follow-up

- Quick-win shipped: every bubble line #254 added was wider than the 140 px bubble budget (real-font measure: 40/40 en, 38/40 zh-TW rendered cut off, e.g. "日誌不會騙人，它只是…"). All 80 rewritten shorter in the same voice (max 128 / 110 px); owner approved a rendered before/after. New ratchet in `tests/bubbleTextFit.test.jsx` caps cut-off pool lines at 58 en / 14 zh-TW (red on #254 pools, green after). `docs/CHARACTER_LORE.md` + spec AC-2 corrected: 1 of 58 quoted lore lines is a real pool line, so the book now says its quotes are character-voice flavor text. Dead fabricated-bubble staging removed from `scripts/capture-office-lore-preview.mjs`.
- Tests: vitest 152 files / 2719 passed; build, bundle-budget (+2.83%), pack-smoke, npm audit 0. Also rotated 3 Ship History entries and 1 Spec Index line — both caps were over after #254/#255.

### Ship-fix-https-status-and-security-audit-2026-10-07 (fix HTTPS remote status polling and resolve source-map-js vulnerability)

- Quick-win shipped: Remediated 2 verified defects: (1) Fixed HTTPS remote deployment status polling & SSE termination in src/inference/inferStatus.js where non-localhost HTTPS origins falsely skipped polling and SSE, and (2) pinned source-map-js to ^1.2.2 via package.json overrides, eliminating high-severity CVE (GHSA-68fv-2mgg-jv7q).
- Tests: 151 test suites passed (2,714 passed, 0 failed), npm audit 0 vulnerabilities, pack-smoke 4/4 assertions PASS, render-smoke PASS across 4 viewports, validate.ps1 PASS (115/115).

### Ship-docs-character-roster-lore-2026-10-02 (character lore book, interconnected storylines, and visual preview)

- Feature shipped: Authored comprehensive 8-agent Character Lore & Office Life book (`docs/CHARACTER_LORE.md`) featuring full agent profiles, desk objects, habits, and 4 interconnected narrative threads weaving character bubbles into collective storylines. Added automated Playwright capture harness (`scripts/capture-office-lore-preview.mjs`) generating high-fidelity visual asset (`docs/assets/office-lore-preview.png`).
- Tests: dialogueS2Lint 83/83 passed, validate.ps1 115 passed.

### Ship-feat-avo-161-character-dialogue-depth-2026-10-01 (deepen character personalities, hobbies, and philosophies) · AVO-161 Wave B

- Feature shipped: AVO-161 Wave B: Deepened and humanized character dialogues across 8 roles (PM, Arch, Dev, QA, Ops, Res, Gate, Designer) with distinct personalities, hobbies, life philosophies, and quirks in `src/config/characters.json`, `src/locales/en.json`, and `src/locales/zh-TW.json`. Context bubble pools expanded (+3 lines per role) and gossip pool expanded (+16 lines) adhering to ADR-007 channel separation and open-ended non-conclusive content rules (zero banned terminal completion stems).
- Tests: 150 test suites passed (2,711 passed, 0 failed), dialogueS2Lint passed 83/83, 100% key parity (395/395 keys), smoke passed across 4 viewports.

### Ship-chore-release-v1.6.10-2026-09-27 (the office only shows what is really happening, and the server stops falling over) · release v1.6.10

- Cuts the 13 PRs merged since `v1.6.9` (#240–#252) as **v1.6.10** (patch, per the repo's lean-patch practice). The release commit contains no app code: `package.json` 1.6.9 -> 1.6.10, **both** `package-lock.json` root version fields (0 `"version": "1.6.9"` strings left), the CHANGELOG narrative, and this entry.
- **The CHANGELOG leads with an upgrade note**: the Host allowlist (#246, extended to `npm run dev` by #252) is ON by default, so reverse-proxy / Docker / hostname users must set `OFFICE_ALLOWED_HOSTS` or get `403`; valid-token requests are exempt. Other owner-visible changes listed under Changed: Friday 15:00 runs the group meeting instead of tea (#251), search text no longer shown in bubbles (#249). "Does not claim" list: ~5-min dead-hook clear, one-agent-per-session with Claude+Codex in one project, the deploy-success `doneAt` gap, the bounded hook-lock residual.
- Every included PR shipped with its own Ship History entry, work-log archive and INDEX chain entry; each merged with CI 8/8 green and a `validate.sh` fail=0 run. Post-merge per `repo-gotchas` §12: **annotated** `v1.6.10` tag on the release merge commit + `gh release create --latest`.

### Ship-fix-followups-2026-09-27 (OFFICE_ALLOWED_HOSTS now governs the dev server too; render-smoke really escalates a stuck server)

- Two quick-win follow-ups from the 2026-09-26 audit wave, reviewed on their own branches (`fix/dev-allowed-hosts`, `fix/pack-smoke-teardown`) and shipped bundled to save a CI + validator cycle. (1) PR #246 gave `server.mjs` a Host allowlist, but `npm run dev` ignored `OFFICE_ALLOWED_HOSTS`, so a dev server behind a custom hostname got Vite's own 403. The parser moved to `src/utils/hostAllowlist.mjs`; `server.mjs` imports it (fresh review: 480/480 identical responses main vs branch, 6 env configs x 48 Host cases) and `vite.config.mjs` maps it to `server.allowedHosts` only when set — unset keeps Vite's default, nothing can become `true`. (2) `render-smoke.mjs` escalation `if (!serverProc.killed) kill('SIGKILL')` never fired (`.killed` is true once the signal is SENT); it now waits on the real `exit` event (11 s, above the server's 10 s drain).
- **Dropped on review, not shipped:** a pack-smoke cross-run "orphan reaper". The orphaned `node server.mjs --port=530x` processes seen during the wave were servers agents had started by hand for live probes, not a smoke-script leak; the reaper `taskkill /T /F`-ed any PID in a shared tmp marker with no identity check and would have killed unrelated processes. The premise came from the orchestrator and was disproved by a fresh reviewer.
- Tests: combined branch build clean; vitest 144 files / 2654 tests; `npm run smoke` PASS. Mutation checks: removing the `.`-entry filter, entry port-stripping, or the Vite wiring each fails a test. PR #252.

### Ship-fix-honest-office-events-2026-09-27 (events only fire when someone can actually perform them, and inference stops faking fresh signals)

- Feature shipped: remediated 3 audited honesty defects in office-life set-pieces (ADR-007/008), same class as AVO-191/AVO-194, across `src/systems/officeLife.js`, `src/systems/store.js`, `src/inference/idleGapInfer.js`: (1) `hasRequiredActors()` adds a symmetric pre-fire refusal for a non-empty-but-wrong cast, alongside the existing empty-cast refusal (AVO-191); (2) idle-gap inference now preserves real underlying fields and `changedAt` instead of stamping a synthetic fresh timestamp when inferring `thinking`/`awaiting-approval`; (3) an agent picked up by real work while holding a group-event pose now has that pose released instead of persisting a stale group-event visual. `fireWithCast` is exported and guarded by a mutex + per-fire epoch tokens, closing a stale/aborted-fire race.
- **Owner-visible cadence change**: Friday 15:00 now fires `group-meeting` instead of `tea-break` (G2) — a deliberate swap of which existing event fires at that slot.
- **5 review rounds**: R1-R4 NOT READY (epoch/mutex races, cadence regression, ADR-010 citation gap, LOW pre-ship items) → R5 PASS (AC-1..17 proven, 0 security findings) → r6 closed 4 LOW pre-ship items with 2 additional mutation-verified tests. Root-cause detail: `docs/specs/honest-office-events.md` `## Domain Decisions`, consolidated to `docs/architecture/office-runtime.log.md`.
- Merged `origin/fix/client-runtime-hygiene` (PR #250, carries origin/main #246-#249) before ship; resolved one expected conflict in `store.js` (kept both branches' comment blocks + the `isInferred` param).
- Tests: full suite post-merge **149 files / 2693 tests**, all green. Build clean. `npm run smoke` PASS. `npm run smoke:panel` PASS. `validate.sh` pass=114 warn=6 fail=0 skip=5. PR #251.

## Spec Index Archive

> Rotated out of the live **Spec Index** on 2026-08-16 to satisfy the `check_ssot_caps.py`
> 30-entry advisory cap. These are index lines only — every spec body remains at its
> `docs/specs/` path and is still validated for completeness (both validators union this
> section with the live index; `validate.ps1:2243`). Never delete entries from here.

  - [subagent] docs/specs/subagent-helper-huddle.md [Frozen]  *(SubagentStart→helper sprites; shipped)*
  - [hook-integration] docs/specs/vite-config-esm.md [Shipped]  *(REV-05 — dev-server config renamed to native ESM `vite.config.mjs`; three Vite config-loader warnings gone; Dockerfile/package.json path-drift guard; PR #238; closes F-11 of 2026-09-08)*
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
  - [brand] docs/specs/office-theme-selector.md [Shipped]  *(AVO-123 / #41 — lightweight overlay-grade theme tint beneath status layer; Default/Winter/Autumn light tints; contrast-guarded; Dark/Retro/Cyberpunk deferred)*
  - [game-feel] docs/specs/office-pet-barometer.md [Shipped]  *(#39 / AVO-121 — signal-driven office pet)*
