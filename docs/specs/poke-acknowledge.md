---
title: AVO-158 Poke / acknowledge micro-interaction (Model A, layered)
status: draft
created: 2026-06-14
signal_tier: none
backlog: AVO-158
issue: none
primary_domain: ui-rendering
depends_on: ADR-005
---

# AVO-158 — Poke / acknowledge micro-interaction

## Intent

Deliver the "I interacted with my character and it noticed me" warmth that AVO-142
(drag-to-move) was rejected for (ADR-005). The honest, panel-decided form is a **Poke**:
the character reacts **in place** to a click, with ZERO position/state change. Design
authority for this feature is **ADR-005 §"Interaction model — Model A"** (this spec is the
AC + scope layer; do not duplicate the rationale).

## Scope (Model A — layered, NO new gesture)

- **IN** — wire an acknowledge reaction onto the EXISTING agent click (`AgentCharacter`
  `handleClick` → `setSelectedAgent`):
  - Click a character → inspector opens (unchanged) **AND** the character fires an in-place
    acknowledge: a gentle vertical **bob** (reuse the AVO-136 `<animateTransform>` idiom) +
    a transient **bubble** with a short quip drawn from the character's **real status**,
    auto-clearing ~1.2 s.
  - Re-clicking a character whose inspector is already open = reaction only (inspector
    stays; bob+quip re-fire). This emerges naturally — `setSelectedAgent(id)` is idempotent.
  - **Repeat escalation** (cozy, not punishing): quip cycles a seeded per-status pool;
    3rd poke within 5 s → longer bob; 5th+ → a brief "turn-away / ok-ok" variant; reset
    after 10 s idle.
  - **Keyboard**: `Enter` = click (inspector + poke); `Space` = poke-only (re-poke without
    toggling the inspector). `preventDefault` on Space.
  - **Right-click (mouse only)**: `onContextMenu` → `preventDefault` + poke-only (desktop
    bonus). **Touch**: no long-press path — every tap already fires the reaction via click.
- **Pure logic** in a new `src/systems/pokeReaction.js`: quip selection + escalation state
  (timestamps → intensity), unit-testable without a DOM.
- i18n quip pools (en + zh-TW) per status + escalation lines.

**Honesty (inherited from ADR-005):** the reaction NEVER writes position or status; quips
are drawn from the agent's real current status only; no fabricated state.

**Non-goals:** no drag/reposition (ADR-005); no sound; no persistent state; no new gesture
on the sprite; no identity/nickname (that is AVO-124); no change to the movement system.

## Acceptance Criteria

- **AC-1** Clicking an agent still opens the inspector (no regression) AND triggers an
  in-place reaction. Verify: existing inspector test stays green; live click shows bob+bubble.
- **AC-2** The reaction writes **zero** position/status — `agent.position`/`status` unchanged
  across a poke. Verify: unit/integration asserts no store position/status mutation on poke.
- **AC-3** Quip text is drawn from the agent's **real status** (a `blocked` agent never shows
  a "working" quip). Verify: `pokeReaction` unit test maps status→pool; no cross-status leak.
- **AC-4** Repeat-poke escalates then resets honestly (3rd→long, 5th→turn-away, reset 10 s).
  Verify: `pokeReaction` unit test drives timestamps and asserts intensity transitions.
- **AC-5** Keyboard: `Enter` = inspector+poke, `Space` = poke-only. Verify: handler logic
  test / live keyboard check.
- **AC-6** `prefers-reduced-motion` → no bob animation; the static quip bubble still shows.
  Verify: reducedMotion gates the `<animateTransform>`; bubble renders regardless.
- **AC-7** a11y: the quip bubble is announced once (`role="status" aria-live="polite"`,
  auto-clear); the bob animation is `aria-hidden`. Verify: rendered attributes.
- **AC-8** en + zh-TW quip pools exist with key parity; no clipped/raw-key text. Verify:
  JSON parity check + live render both locales.

## Domain Decisions

- [CONSTRAINT] Poke is honest by construction: zero position/status write; quips derive only
  from real status (ADR-005). Any future reaction must keep this.
- [DECISION] Model A (layered onto the existing click) — no competing gesture; long-press/
  right-click-primary rejected (input trap on small auto-moving sprites + undiscoverable +
  keyboard-hostile). Full rationale: ADR-005.
- [TRADEOFF] Reaction is a bob + bubble (not a literal sprite-facing turn) for v1 — simplest
  honest "noticed you" tell; richer facing is a later refinement.

## File Relationship

EXTENDS ADR-005 (design authority). INDEPENDENT of other specs. Reuses BehaviorBubble +
the AVO-136 animateTransform idiom; does not modify the movement system or store position.
