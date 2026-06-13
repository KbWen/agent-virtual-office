---
status: living
title: Agent Virtual Office — Product Backlog
created: 2026-05-29
last_updated: 2026-06-13
---

# Agent Virtual Office — Product Backlog

> Living index of planned features. Bootstrap reads this to detect ongoing product work.
>
> **Shipped items rotated to `_shipped-log.md` on 2026-05-29** after the v0.10 +
> classifier + observability wave brought the prior backlog (#1–#73) to ~100% Done.
> This file tracks the next wave (AVO-101+).

> [!NOTE]
> **Branch hygiene (2026-06-05):** the ux-vibe-rebalance / living-office / responsive wave is already MERGED to `main` via squash PR #44 (`012d0f2`, v1.2.0) — `main` is the canonical, current product state. The `origin/feat/ux-vibe-rebalance` branch (60 un-squashed dev commits) is git-verified superseded: its `src/` is byte-identical to `main`, which is 3 commits ahead (also carries PR #53 hero refresh + #54 hook fix). That branch has already been deleted from origin (the 2026-06-05 drift sweep pruned 5 stale local remote-tracking refs; origin now has only `main`). The wave's lasting decisions are routed to `docs/architecture/{ui-rendering,office-runtime}.log.md`.

---

## Feature Inventory

| # | Feature | Kind | Labels | Priority | Spec File | Tier | Status | Dependencies |
|---|---------|------|--------|----------|-----------|------|--------|--------------|
| AVO-101 | Plan-Mode visualization | product | real-ai-behavior | P0 | — | feature | Done | — |
| AVO-102 | Extended-thinking aura | product | real-ai-behavior | P1 | — | feature | Done | — |
| AVO-103 | Tool inventory label | product | real-ai-behavior | P1 | — | feature | Done | — |
| AVO-104 | Skill activation badge | product | real-ai-behavior | P2 | docs/specs/skill-activation-badge.md | feature | Shipped | #30; transient skill bubble (panel Option B), reuses bubble cap, working-tier, honest |
| AVO-105 | Handoff arrows | product | multi-agent | P0 | — | feature | Done | — |
| AVO-106 | Pair-programming huddle | product | multi-agent | P1 | docs/specs/pair-programming-huddle.md | feature | Done | co-editing pair overlay (desk-to-desk link, edit-only); redesigned from a huddle per expert panel (PR #80) |
| AVO-107 | Review-gate queue | product | multi-agent | P1 | docs/specs/review-gate-waiting.md | feature | Shipped | #112; honest reframe → gate-desk "waiting" in-tray (awaiting-approval only, no queue/type fabrication); panel-decided |
| AVO-108 | Token & cost meter | product | info-density | P0 | — | feature | Done | — |
| AVO-109 | Recent-files heatmap | product | info-density | P2 | — | feature | Pending | — |
| AVO-110 | Blocked-reason tags | product | info-density | P1 | docs/specs/blocked-reason-tags.md | feature | Done | unblocks AVO-117; Phase-2 (permission/auth/rate-limit) deferred |
| AVO-111 | Time-of-day lighting | product | game-feel | P2 | — | quick-win | Done | chill-fun wave; smooth 24h color-grade in `src/systems/lighting.js` (replaced 9 discrete steps); desk-lamp halos split to AVO-125 |
| AVO-112 | Eureka cascade | product | game-feel | P3 | — | feature | Pending | — |
| AVO-113 | OpenTelemetry GenAI export | infra | observability | P1 | — | feature | Pending | — |
| AVO-114 | Event-stream replay scrubber | product | observability | P2 | — | feature | Pending | — |
| AVO-115 | Shareable daily card | product | brand | P1 | — | feature | Pending | — |
| AVO-116 | Per-agent cost attribution & daily $ trend | product | info-density | P1 | — | feature | Pending | AVO-108 |
| AVO-117 | Recurring failure-mode detection | product | observability | P1 | docs/specs/recurring-failure-detection.md | feature | Done | AVO-110 |
| AVO-118 | Workflow graph minimap (DAG view) | product | multi-agent | P2 | — | feature | Pending | AVO-105 |
| AVO-119 | Language / file-type breakdown | product | info-density | P2 | — | feature | Pending | — |
| AVO-120 | Daily MVP / productivity leaderboard | product | brand | P2 | — | feature | Pending | — |
| AVO-121 | Office pet (ambient companion) | product | game-feel | P3 | — | feature | Done | reframed as signal-driven barometer; docs/specs/office-pet-barometer.md (PR #62) |
| AVO-122 | Ambient soundscape (toggle) | product | game-feel | P2 | docs/specs/ambient-soundscape.md | feature | Done | chill-fun wave; 100% procedural Web Audio (0 KB), off-by-default; clatter∝teamPulse + double-gated rain; coffee gurgle dropped (honesty — tea-break isn't a real signal) |
| AVO-123 | Office theme / skin selector | product | brand | P2 | docs/specs/office-theme-selector.md | feature | Shipped | #41; lightweight overlay-grade (Default/Winter/Autumn light tints); contrast-guarded; Dark/Retro/Cyberpunk deferred (unsafe/need more than a tint) |
| AVO-124 | Agent appearance customization | product | brand | P3 | — | feature | Pending | — |
| AVO-125 | Cozy micro-interactions | product | game-feel | P3 | — | feature | Pending | AVO-111 |
| AVO-126 | Bubble register unification (banish raw shell strings) | review-finding | vibe-rebalance | P0 | docs/specs/ux-vibe-rebalance.md | quick-win | Done | — |
| AVO-127 | Token meter off the default view | review-finding | vibe-rebalance | P0 | docs/specs/ux-vibe-rebalance.md | quick-win | Done | AVO-108 |
| AVO-128 | Name pills → reveal-on-active | review-finding | vibe-rebalance | P0 | docs/specs/ux-vibe-rebalance.md | feature | Done | — |
| AVO-129 | Done/blocked KPI off the persistent bar | review-finding | vibe-rebalance | P1 | docs/specs/ux-vibe-rebalance.md | quick-win | Done | — |
| AVO-130 | Control-bar reduction (gear menu + single health dot) | review-finding | vibe-rebalance | P1 | docs/specs/control-bar-reduction.md | feature | Shipped | #116; 4 health pills→1 dot, lang/run/view/help demoted into ⚙ |
| AVO-131 | TaskLabel pill → inspector-only | review-finding | vibe-rebalance | P1 | docs/specs/ux-vibe-rebalance.md | quick-win | Done | AVO-103 |
| AVO-132 | ThinkingAura → fold into glow ring | review-finding | vibe-rebalance | P1 | docs/specs/ux-vibe-rebalance.md | quick-win | Done | AVO-102 |
| AVO-133 | Blocked reads from posture (physical legibility) | product | vibe-rebalance | P1 | — | quick-win | Done | AVO-110 |
| AVO-134 | BehaviorIndicator micro-telegraphs | product | game-feel | P2 | — | quick-win | Done | — |
| AVO-135 | Status-ring distance encoding (breathe/flash) | product | game-feel | P2 | — | quick-win | Done | — |
| AVO-136 | Event juice pass (reaction beats / shake / confetti) | product | game-feel | P2 | docs/specs/event-juice-pass.md | feature | Shipped | #117; deploy confetti + eureka sparkle + desk-slam local shake; rare/capped/reduced-motion-safe; AVO-112 cascade can layer on the particle idiom |
| AVO-137 | Density-layer foundation (glance-L1 default + zen far-view) | product | vibe-rebalance | P1 | — | architecture-change | Pending | AVO-126, AVO-127, AVO-128 |
| AVO-138 | Subagent helper huddle (desk-side capped figures + heavy-load cue) | product | game-feel | P1 | docs/specs/subagent-helper-huddle.md | feature | Done | AVO-106 |
| AVO-139 | Responsive office width-fill + readable labels (no whitespace/crop) | product | vibe-rebalance | P0 | docs/specs/responsive-office-roster.md | feature | Done | — |
| AVO-140 | Living-office honest events (L2 team-affect + honesty gating + reluctant + real-seed) | product | real-ai-behavior | P1 | docs/specs/living-office-events.md | feature | Done | AVO-138 |
| AVO-141 | Comms / vertical (☰ roster) deeper optimization — "still lots of room" | product | vibe-rebalance | P2 | docs/specs/living-office-events.md | feature | Pending | AVO-140 |
| AVO-142 | Drag-to-move agents (manual reposition for realer interaction) | product | game-feel | P2 | — | feature | Pending | — |
| AVO-143 | applyExternalStatus: skip no-op agent re-allocation (don't re-render all agents each poll) | chore | tech-debt | P3 | — | quick-win | Done | hardening-wave H6a; shipped 2026-06-10 |
| AVO-144 | Sustained inter-agent separation in free movement (agents pass THROUGH each other in transit; RAF loop has no per-frame separation — only gather targets are deconflicted) | product | game-feel | P2 | docs/adr/ADR-004-no-per-frame-agent-separation.md | feature | Deferred | hardening-wave H6b — RESOLVED BY DECISION (3-lens panel unanimous): per-frame separation rejected (doorway geometry + unverifiable visuals + R1); re-open conditions in ADR-004 |
| #20 | Hook read-modify-write atomic | chore | tech-debt | P1 | docs/specs/hook-status-write-lock.md | quick-win | Done | hardening-wave H3; shipped 2026-06-10 |
| AVO-145 | CI render-smoke gate (headless load-the-page in ci.yml + consolidate shot scripts into one tracked harness) | infra | tech-debt | P0 | docs/specs/ci-render-smoke.md | feature | Done | hardening-wave H1; shipped 2026-06-10 |
| AVO-146 | Transport field-whitelist unification (reasonCode/activeFile × 5-6 independent whitelists → one shared schema module) | chore | tech-debt | P0 | docs/specs/status-field-schema-unification.md | feature | Done | hardening-wave H2; shipped 2026-06-10 |
| AVO-147 | Validator zero-noise + repo hygiene (archive leftover shipped logs, backfill sections, gitignore local tooling) | chore | tech-debt | P1 | — | quick-win | In Progress | hardening-wave H4 (first) |
| AVO-148 | Structured error payload for blocked reasons (errno/HTTP-status hook field → honest permission-blocked/auth-error/rate-limit) | product | info-density | P1 | docs/specs/structured-error-reasons.md | feature | Done | hardening-wave H5; shipped 2026-06-10 (event-driven: PermissionDenied/StopFailure; tool-level 401/429 rejected as fabrication) |
| AVO-149 | CI reproducibility: npm install → npm ci in all workflow jobs (lockfile-exact builds) | infra | tech-debt | P0 | — | quick-win | Done | stability-wave W1; shipped 2026-06-10 |
| AVO-150 | Transport-spine e2e in CI: boot real server.mjs, POST /api/status + /api/event → GET round-trip, assert canonical-field survival on the wire | infra | observability | P1 | docs/specs/transport-spine-e2e.md | feature | Done | stability-wave W2; shipped 2026-06-10 |
| AVO-151 | npm-pack install smoke: pack tarball → install in temp dir → cli setup + server boot (protects the npx-published artifact) | infra | tech-debt | P1 | docs/specs/npm-pack-install-smoke.md | feature | Done | stability-wave W3; shipped 2026-06-10 |
| AVO-152 | Bundle-size budget gate in CI (fail on >+10% vs committed baseline) | infra | tech-debt | P2 | — | quick-win | Done | stability-wave W5; shipped 2026-06-10 (baseline 450069 B) |
| AVO-153 | Hook-runtime payload fixture corpus: record REAL Claude Code hook events as fixtures + contract tests pinning the shapes the hook relies on (is_error era vs PostToolUseFailure era, StopFailure matcher) | infra | observability | P1 | docs/specs/hook-runtime-contract.md | feature | Done | stability-wave W4; shipped 2026-06-10; 14 live fixtures + 143 contract tests |
| AVO-154 | Reconcile hook result-field reads with runtime truth (W4 found: runtime sends `tool_response`, hook reads `tool_result` → toolResult always empty on this runtime; is_error shape on ERROR events not yet captured) | chore | tech-debt | P1 | — | quick-win | Done | shipped 2026-06-11; error events INDUCED+captured (no is_error exists on this runtime → derivation honestly inert); toolResultText dual-read + PowerShell→ops mapping + 26-fixture corpus |
| AVO-155 | Add same-pick guarantee test for socialTargetOverride | review-finding | social-chat | P2 | — | quick-win | Pending | feat/social-chat-feel review 2026-06-10: `getTargetForBehavior` 4th-param override is untested — flip override to ignore-mode causes 0 test failures; add a test passing a pre-seeded socialTargetOverride and asserting the walk destination orbits that specific peer |
| #120 | Prepublish build-before-test contract | chore | tech-debt | P0 | docs/reviews/2026-06-11-tech-debt-audit.md | quick-win | Done | shipped 2026-06-11 in `0a1aa93`; `prepublishOnly` now runs build before test |
| #121 | Monolith extraction map | chore | tech-debt | P1 | docs/architecture/monolith-extraction-map.md | quick-win | Done | doc-only guard for future seam extraction; no runtime refactor |
| #122 | normalizePost.mjs runtime mirror | chore | tech-debt | P2 | docs/reviews/2026-06-11-tech-debt-audit.md | feature | Pending | defer until transport fields change again; current drift guards are green |
| #123 | Bridge dynamic rendering hardening | chore | tech-debt | P0 | docs/reviews/2026-06-11-tech-debt-audit.md | quick-win | Done | shipped 2026-06-11 in `0a1aa93`; external `bridge-ui.js`, no inline handlers or dynamic `innerHTML` |
| #124 | Silent catch observability classification | chore | tech-debt | P1 | docs/architecture/silent-catch-policy.md | quick-win | Done | classification policy + current inventory; hook crash-proof paths preserved |
| #125 | Dependency maintenance wave | chore | tech-debt | P2 | docs/reviews/2026-06-11-tech-debt-audit.md | quick-win | Done | vite 6→8 + plugin-react 6 + vitest 4 (brings esbuild 0.28.1) clears the high-sev esbuild "NPM_CONFIG_REGISTRY RCE" audit advisory that was failing CI on every PR; esbuild-override-on-vite-6 was tried and broke the build (121 transform errors), so the major bump is the only fix |
| #126 | Semgrep baseline and fail-on-new serious findings | infra | tech-debt | P1 | docs/reviews/2026-06-11-tech-debt-audit.md | feature | Pending | security hardening lane; requires baseline triage |
| #127 | Architecture overview refresh | chore | tech-debt | P1 | docs/ARCHITECTURE.md | quick-win | Done | current runtime spine refreshed 2026-06-11 |
| #128 | Resolve audit routing_actions | chore | tech-debt | P0 | docs/reviews/2026-06-11-tech-debt-audit.md | quick-win | Done | audit findings routed into backlog and architecture decision logs |

## Status Key

- **Status**: `Pending` | `In Progress` | `Done` | `Deferred`
- **Priority**: P0 (must) → P3 (nice to have)
- **Kind**: `product` (player-facing feature) | `infra` (developer-facing tooling/telemetry) | `chore` (hardening)
- **Tier**: expected classification when built (`feature` | `quick-win` | `architecture-change`)
- **Labels**: theme — `real-ai-behavior` · `multi-agent` · `info-density` · `game-feel` · `observability` · `brand` · `tech-debt` · `vibe-rebalance`

> Done rows are kept here for one wave for traceability, then rotate to `_shipped-log.md`.
> AVO-103/105 shipped 2026-05-29; AVO-101/102 shipped + AVO-108 core shipped in PR #22 (2026-05-29/30); the rolling-1h / $ cost / sparkline portion of AVO-108 remains.

---

## Implementation Notes

### 🎯 Real AI Behavior Coverage
- **AVO-101 Plan-Mode visualization** — Claude `plan` mode / Codex planning looked identical to `working`. New `planning` status with a scrolling outline above the agent's whiteboard until plan-approval. *Shipped (92198e5): hook emits `status:'planning'` on `permission_mode==='plan'`; the scrolling-outline polish is deferred.*
- **AVO-102 Extended-thinking aura** — Subtle pulsing halo around the agent's head whose radius scales with thinking-budget. *Shipped (a62cd14): violet aura from `effort.level`.*
- **AVO-103 Tool inventory label** — Small monospace pill below name tag showing the active tool. *Shipped 2026-05-29: `AgentCharacter.jsx` `TaskLabel`; built-ins show short names, MCP tools collapse to `server::tool`; 17 routing tests.*
- **AVO-104 Skill activation badge** — Flip a small skill badge above the agent on activation. Skill name already in some hook payloads (Stop/UserPromptSubmit context); needs i18n + icon mapping.

### 🤝 Multi-Agent Collaboration
- **AVO-105 Handoff arrows** — Animated paper-document arc between desks on workflow phase transitions. *Shipped 2026-05-29: `src/inference/workflowHandoff.js`, 7 mapped transitions, `FlyingDocument` `subtle` prop; re-entrancy bug-pinned.*
- **AVO-106 Pair-programming huddle** — When two agents work on the same file/PR, both walk to a shared whiteboard. Detect shared-artifact correlation from hook events; reuse meeting group-behavior pattern.
- **AVO-107 Review-gate queue** — Gate role gets a literal queue of waiting tickets next to their desk. Track pending approvals per gate role; small ticket SVG stack.

### 📊 Information Density
- **AVO-108 Token & cost meter** — Status-bar chip: rolling 1h tokens-in/out + $ estimate per model with sparkline. *Core shipped (11c73f8): 🪙 chip shows context size + model. Remaining: rolling-1h window, $ cost, sparkline.*
- **AVO-109 Recent-files heatmap** — Toggle minimap overlay: top 10 hot file paths colored by edit frequency. File-path data flows via `Edit`/`Write` tool args; aggregate into 1h rolling window.
- **AVO-110 Blocked-reason tags** — Classifier extension → `blocked.reason` enum, colored sub-icon on status bubble (auth-error vs test-fail vs waiting-on-human). Extend `classifyStatus` with sub-reason; OpenTelemetry GenAI error taxonomy as reference.

### 🎨 Game Feel / Ambient
- **AVO-111 Time-of-day lighting** — Global color-grade layer shifting with wall-clock time (warm dawn / neutral noon / blue evening / dim night with desk-lamp halos). Existing `getLightingOverlay` (PixelOffice.jsx) handles night; extend to full day cycle. *Shipped (chill-fun wave): extracted to pure module `src/systems/lighting.js` — smooth keyframe-interpolated 24h grade (deep-night→purple-dawn→amber-morning→clear-noon→golden-hour→sunset→blue-dusk) replacing the 9 hard steps; hour-granular (keeps PixelOffice's hour-only subscription). Then a 5-lens design panel (color/calm-tech/game-feel/a11y/clutter) tuned it: night capped at 0.38 desaturated indigo + sunset desaturated to terracotta (off the orange status-ring hue) + dawn rose-blush & warm shoulders; **z-order fix** — tint moved to paint BENEATH the agent/status layer so it never dims rings/labels/bubbles (the #1 product law); **on/off toggle** in the ⚙ settings sheet (default ON; first-run OFF under prefers-reduced-motion/contrast; localStorage `avo.lighting.enabled`; off → clear midday baseline). 7 unit tests incl. the 0.38 legibility ceiling; visual proof at 07/13/18/21 + toggle-off (`scripts/lighting-shot.mjs`, `lighting-toggle-shot.mjs`). Desk-lamp halos at night carried to AVO-125.*
- **AVO-112 Eureka cascade** — 2+ eurekas within 10s → confetti cascade across the whole office. Hook into existing eureka handler; tiny SVG particle system.

### 📈 Performance / Observability
- **AVO-113 OpenTelemetry GenAI export** — Optional OTLP exporter emitting spans per agent action with `gen_ai.*` semantic conventions; toggle in settings. Aligns with classifier panel discussion #B1.
- **AVO-114 Event-stream replay scrubber** — Timeline scrubber at bottom: drag back to replay last 30min at 4x/8x/16x. Event log capped at 50 entries in store; extend retention + render timeline.

### 📣 Brand / USP
- **AVO-115 Shareable daily card** — End-of-day "office card" generator: single pixel-art PNG summarizing today's done/blocked/eurekas/weather, branded, one-click share. Use OffscreenCanvas; pull from ledgers + activeEvent history.

### 🔬 Competitive Research Wave (AVO-116+, added 2026-06-02)
> Sourced from a scan of AI-agent observability tools (LangSmith / Langfuse / AgentOps), multi-agent UIs (LangGraph Studio / CrewAI Studio / Sim Studio), pixel-art virtual offices (Gather.town), and dev-activity visualizers (WakaTime). Each item maps a feature that exists in those tools onto AVO's pixel-office metaphor.

- **AVO-116 Per-agent cost attribution & daily $ trend** — Observability tools (AgentOps, LangSmith) surface *agent-level cost attribution* + $ breakdowns, not just raw tokens. Extend AVO-108: per-role $ estimate (from `tokens.{ctx,out,model}` × model price table), a daily/weekly cost sparkline, and a "biggest burner" highlight on the office HUD.
- **AVO-117 Recurring failure-mode detection** — LangSmith auto-clusters traces to flag recurring failure modes. When the same `blocked.reason` / error signature recurs ≥N times in a window, raise a "recurring issue" sign over the affected desk + optional desktop notification. Builds on AVO-110.
- **AVO-118 Workflow graph minimap (DAG view)** — LangGraph Studio's node/edge graph is the canonical multi-agent view. Add a toggle minimap rendering the active workflow as a phase DAG (spec-intake→spec→plan→implement→test→review→ship) with the live node highlighted — complements the spatial office (AVO-105) with a structural view.
- **AVO-119 Language / file-type breakdown** — WakaTime's per-language/file metrics. Donut/legend of the languages + file types agents touched today, aggregated from `Edit`/`Write` tool args (1h or daily window). Pairs with AVO-109's heatmap.
- **AVO-120 Daily MVP / productivity leaderboard** — WakaTime's leaderboard adds gamification. End-of-day "MVP" ribbon + a small ranked list of agents by tasks-done / blocked-cleared, drawn from `dailyDoneLedger` / `dailyBlockedLedger`. Shareable alongside AVO-115.
- **AVO-121 Office pet (ambient companion)** — Gather.town added follow-along pets purely for charm. A cute low-functional pet (cat / robot vacuum) that wanders the office, naps when idle, perks up during eurekas. Pure game-feel.
- **AVO-122 Ambient soundscape (toggle)** — Gather.town's ambient object sounds. Optional, OFF-by-default soundscape: keyboard clatter scaled to active-agent count, coffee machine on tea-break, rain matching the weather system. Must respect a mute setting + `prefers-reduced-motion`-style audio opt-out.
- **AVO-123 Office theme / skin selector** — Gather.town lets you reskin walls/floors. A theme switcher: default / dark-mode / seasonal / cyberpunk palette swaps over the existing SVG office. Visual-only; persists to store.
- **AVO-124 Agent appearance customization** — Gather.town avatar customization (hair/clothing/accessories). Per-role cosmetic options (hat / color / accessory) so users can personalize their roster; persists to store like `deskItemCount`.
- **AVO-125 Cozy micro-interactions** — Cozy-sim polish: desk plants that grow with `growthLevel`, coffee steam, monitor glow tint by status, desk-lamp halos at night. Small SVG/animation touches that deepen the "alive office" feel; complements AVO-111 lighting.

### 🎯 UX Vibe Rebalance Wave (AVO-126+, added 2026-06-03)
> Sourced from a 5-lens expert design panel (game-designer · calm-tech · first-time-user ·
> audience-readability · clutter-auditor) reviewing the live product. Owner-approved "do all".
> Verdict: "cute engine with a dashboard bolted on" — the cure is **deletion + diegetic show-don't-tell**,
> default density **glance-L1**, exact detail opt-in via click-to-inspect. Full raw verdict was in
> `_raw-intake.md` (deleted after spec generation per spec-intake §1a). **Several items AMEND already-shipped
> features** — see Dependencies column. Parent/unifier: AVO-137.

- **AVO-126 Bubble register unification** — banish raw shell strings from speech bubbles; route Bash (and any
  tool with no friendly verb) through the same human-verb/emoji-noun label table the other tools use. The #1,
  unanimous, cheapest-highest-impact fix. Touches `public/hooks/office-status-hook.js` (`toolLabel` Bash branch + `shortCommand`).
- **AVO-127 Token meter off the default view** — remove the 🪙 ctx/out chip from the persistent bar; expose in the
  L2 inspector only. *Amends AVO-108 (keep the data path, demote the surface).*
- **AVO-128 Name pills → reveal-on-active** — stop rendering 8 persistent English name tags; reveal a name on
  active/state-change (peripheral-triggered, works on wall-TV/stream) + hover on desktop, fade on idle. At rest,
  identity rides on sprite + color + desk position (optionally a small role glyph).
- **AVO-129 Done/blocked KPI off the persistent bar** — move the ✓N/✗M counter to on-demand / settings; the day's
  rhythm is felt through events, not read off a tally.
- **AVO-130 Control-bar reduction** — resting bar = clock · live-dot · pause; collapse EN/中, run, test, notify
  behind one gear; integration-health 4 pills → 1 dot that only colors on trouble.
- **AVO-131 TaskLabel pill → inspector-only** — drop the monospace tool pill from the glance layer; the bubble +
  prop-icon already carry the action. Exact tool string lives in the inspector. *Amends AVO-103.*
- **AVO-132 ThinkingAura → fold into glow ring** — one ring per sprite; encode effort in the glow's intensity/pulse
  instead of a second concentric halo. *Amends AVO-102.*
- **AVO-133 Blocked reads from posture** — make "stuck" legible physically (slump / scratch-head / 💢 desk-slam)
  so trouble reads in peripheral vision before any click. *Relates AVO-110.*
- **AVO-134 BehaviorIndicator micro-telegraphs** — anticipation pop-in (0→1.1→1) + squash on icon appear so state
  CHANGES are caught by motion, not by reading text.
- **AVO-135 Status-ring distance encoding** — idle = slow breathe / no ring, working 1.5s, blocked 1s, done = a
  one-shot celebratory flash rather than a standing state. Pre-attentive far-read for the wall-TV persona.
- **AVO-136 Event juice pass** — shared reaction beats (synchronized expression flips), screen-shake on desk-slam,
  confetti on deploy-success, bigger boss-visit scramble. *Overlaps AVO-112 (eureka cascade).*
- **AVO-137 Density-layer foundation** — formalize the L0/L1/L2 model: glance-L1 default (in-world core always on),
  click-to-inspect = L2 (self-demonstrating, no settings slider), optional `zen` far-view mode for streamer/wall-TV.
  *Architecture-change; build AFTER the cheap wins (126–128) per "fix the default first, ship the dial second".*

### 🛡️ Hardening Wave (H1–H6, added 2026-06-10)
> Owner-selected "全做，照建議順序" after a Fable-5 baseline audit (1462/1462 tests green, validator
> 105 pass / 4 warn / 0 fail, main == origin). Theme: make the project 堅不可摧 — structural defenses
> against the failure classes that have actually bitten (green-CI render crash PR #71; whitelist
> field-drop HIGHs in AVO-110/106 reviews). Order: **H4 → H1 → H2 → H3 → H5 → H6**.

- **H1 = AVO-145 CI render-smoke gate** — the #71 crash class (app dead, CI green — no jsdom) is
  currently only defended by a manual habit. Land a headless-Playwright smoke job in `ci.yml`
  (page loads, office svg renders, 0 console errors) and consolidate the 12 ad-hoc local
  `scripts/*-shot.mjs` into one tracked harness.
- **H2 = AVO-146 whitelist unification** — `reasonCode`/`activeFile` each thread through 5–6
  independently-maintained whitelists (hook ×2 · normalizePost + server.mjs inline copy ·
  sanitizeAgent · routeExternalAgents · store). Two HIGH review defects came from a copy silently
  dropping a new field. One shared field-schema module; every transport imports it.
- **H3 = #20 hook atomic write** — reactivated; file-lock or append-only for the hook's
  read-modify-write state.
- **H4 = AVO-147 validator zero-noise** — this wave's opener; 4 WARN → 1 WARN (the by-design
  archived-historical-gap record), git status untracked noise → 0.
- **H5 = AVO-148 structured error payload** — AVO-110 Phase-2 boundary: hook emits errno/HTTP-status
  → honestly unlocks `permission-blocked`/`auth-error`/`rate-limit`; AVO-117 recurrence inherits the
  finer signatures.
- **H6 = AVO-143 + AVO-144** — sim-layer robustness: skip no-op agent re-allocation per poll;
  per-frame separation in free movement.

### 🧱 Stability Wave (W1–W5 = AVO-149..153, added 2026-06-10)
> Planned at hardening-wave completion per owner brief: "對專案流程有幫助的，讓專案變得很穩定
> （不要改到專案內 agent-os 大腦治理本身）". All five target the project's own delivery spine —
> none touch `.agent/`, `.agentcortex/` governance, or AGENTS.md. Recommended order:
> **W1 (AVO-149) → W3 (AVO-151) → W2 (AVO-150) → W4 (AVO-153) → W5 (AVO-152)** — reproducibility
> first, then protect the published artifact, then the API spine, then the runtime contract, then
> the budget guard. Upstream agentic-os candidates (validator annotated-receipt tolerance +
> accepted-baseline list, from H4) live in KbWen/agentic-os — out of scope here by owner brief.

### 🔧 Carried-over from prior wave
- **#20 Hook read-modify-write atomic** — PID isolation + rename fallback already mitigates risk; full file lock or append-only design would be ideal. *Deferred — current mitigation acceptable; revisit only if state-loss reports surface.*

---

> History: 73 prior items shipped 2026-03–2026-05; see `_shipped-log.md`.
