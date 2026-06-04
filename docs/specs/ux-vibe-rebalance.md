---
status: frozen
title: UX Vibe Rebalance (deletion/demotion core)
source: external
source_doc: _raw-intake.md (5-lens expert design panel, owner-approved "do all")
created: 2026-06-03
primary_domain: none
secondary_domains: []
---

# UX Vibe Rebalance (deletion/demotion core)

Covers backlog items **AVO-126, AVO-127, AVO-128, AVO-129, AVO-131, AVO-132**. The additive
"juice" wave (AVO-133–136) and the L0/L1/L2 architecture (AVO-137) are a separate future feature
(panel sequencing: "fix the default first, ship the dial second").

## Goal
The product is "a cute engine with a dashboard bolted on". Remove the redundant text/badge channels
that narrate over the already-complete in-world status language, so the existing sprite/expression/
prop-icon/glow/event craft reads as a charming diorama instead of a control panel. Default density =
glance-L1; exact technical detail stays reachable on-demand (click-to-inspect / the "?" popover).

## Acceptance Criteria
1. **AVO-126** — No speech-bubble label ever contains a raw shell command or filesystem path. Bash
   tool events render a friendly office-vibe noun (測試/建置/檔案/git/…), in working, done, AND error
   frames. Unknown commands fall back to a generic "指令/command" — never the raw string.
2. **AVO-127** — The 🪙 token meter no longer renders in the persistent ControlPanel bar (full or panel).
   The `tokens` store data path is unchanged; the value is surfaced on-demand in the "?" info popover.
3. **AVO-128** — Character name tags are not rendered at rest for idle agents. A name appears when the
   agent is non-idle (working/blocked/planning/done) OR on hover, and disappears when it returns to idle.
   Role identity at rest rides on sprite + color + desk position. The worktree session badge and the
   status icon badge are unaffected.
4. **AVO-129** — The ✓N/✗M done/blocked counter no longer renders in the persistent ControlPanel bar
   (full or panel). The ledger data path is unchanged; the counts are surfaced on-demand in the "?"
   info popover with the existing i18n + sr-only mirror.
5. **AVO-131** — The monospace TaskLabel tool pill no longer renders in the office scene. The tool is
   still shown in the AgentInspector (existing `inspectorTaskLabel`), so no information is lost.
6. **AVO-132** — The separate violet ThinkingAura ring is removed. Effort level (high/xhigh/max) is
   folded into the working glow ring's intensity (opacity + stroke width), so a sprite never shows two
   concentric rings.

## Domain Decisions
- The cure is **deletion/demotion**, not addition: default density is glance-L1, detail on-demand (the office is a companion, not a dashboard).
- Name tags **reveal-on-active**; the token meter and done/blocked KPIs are off the persistent bar (surfaced on demand).
- Identity rides **sprite + color + desk**; the exact tool shows only in the click-inspector, not an in-scene pill.
- Effort folds into the single working **glow ring** intensity (no separate thinking aura).
- Bubbles speak office nouns (測試/建置/…), never raw shell strings or paths.

## Non-goals
- The L0/L1/L2 density dial / zen far-view mode (AVO-137) — deferred.
- Additive animation juice: posture-blocked, micro-telegraphs, ring breathe/flash, event confetti
  (AVO-133–136) — deferred (need owner visual review).
- Control-bar gear-menu collapse + health-pill→dot (AVO-130) — deferred; removing the two dashboard
  chips already calms the bar.

## Review Deviations (accepted)
- **planning status loses its ring** (LOW, review): the old AVO-102 aura rendered on working OR
  planning; the folded glow (AVO-132) is working-only, and `planning` has no `STATUS_COLORS` entry.
  Accepted in-scope — planning still reads via gantt-chart behavior + focused expression + revealed
  name tag (not signal-less). A dedicated planning color/ring is future work, not a regression.
- **AVO-129 panel mode** uses a hover tooltip + always-present sr-only mirror (panel mode has no "?"
  popover) as its on-demand surface — equivalent to full mode's popover. Verified live.

## Constraints
- Deletion/demotion only — no new in-world feature. Small, reversible edits.
- MUST NOT regress the hook→status-file→/api/status→store→render pipeline or any existing test.
- Preserve all data paths (tokens, ledgers, task) — only their default *surface* changes.
- a11y: keep sr-only mirrors for any metric that moves into the popover.

## File Relationship
INDEPENDENT (amends the surfaces of shipped AVO-103/108/102; data paths untouched)

## Affected Files
- `public/hooks/office-status-hook.js` — AVO-126 (bashVibeLabel + extractContext Bash)
- `src/components/ControlPanel.jsx` — AVO-127, AVO-129 (remove chips; add on-demand popover stats)
- `src/components/AgentCharacter.jsx` — AVO-128, AVO-131, AVO-132 (name reveal, drop TaskLabel render, fold aura)
- tests: `tests/officeStatusHook.test.js` (bashVibeLabel), plus updates where chips/aura were asserted
