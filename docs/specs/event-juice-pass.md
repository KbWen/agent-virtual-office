---
title: AVO-136 Event Juice Pass (rare meaningful moments)
status: shipped
created: 2026-06-13
signal_tier: none
backlog: AVO-136
issue: 117
depends_on: AVO-112
---

# AVO-136 — Event Juice Pass

## Intent

Add scoped game-feel polish to the office's **rare, meaningful** moments so they land with a satisfying beat — the chill + fun → want-to-open product value — WITHOUT turning the office into constant fireworks. Calm-tech pacing is preserved: every effect is triggered by a **real existing event/status only**, is one-shot/capped, dies under reduced-motion, and never covers an agent long enough to hide status (the #1 legibility law).

This spec is the §4.4 Design Source of Truth (procedural UI). The idioms already exist in-repo — `@keyframes pet-confetti` (`src/index.css`, CSP-safe bundled, reduced-motion gated on the pet) and the `officeLife.js` event handlers — so juice is a thin, additive layer over them, not a new system.

## Current state

- Events are seeded + handled in `src/systems/officeLife.js` (`eureka`, `deploy-success`, `review-debate`, `boss-visit`, …) via `setAgentGroupEvent` / `setAgentBehavior` + bubbles. They move agents + flip expressions; there is **no office-level visual beat** today.
- `desk-slam` is a behavior (`behaviorEngine.js`: expr `confused`, frustrated msgs, 4–8s).
- Confetti exists only on the pet (`OfficePet.jsx:162`, `showConfetti = CELEBRATE && !reducedMotion`, `pet-confetti` keyframe).
- `reducedMotion` lives in the store and already gates weather + pet effects.

## Scope

**IN — four beats, each hooking an EXISTING event/status:**

1. **Deploy-success → one-shot office confetti.** A short capped confetti burst (reuse the `pet-confetti` ✦ idiom as a new bundled `office-confetti` keyframe in `index.css`) fired from the existing `'deploy-success'` handler. Single play, ~1.2s, fixed particle count; reduced-motion → no confetti (the existing celebrate bubbles still convey the moment).
2. **Eureka → small sparkle reaction beat** near the whiteboard / arch's desk (a few ✦ sparkles + the existing surprised-expression flip already in the handler). Single beat. Overlaps AVO-112: the *multi-eureka cascade* (2-in-10s → office-wide) is AVO-112's scope — this spec ships the *single-event* sparkle only; the cascade can layer on the same particle idiom later.
3. **Desk-slam → brief localized shake** on the affected agent's sprite/desk ONLY (a short CSS transform jitter, ~300–500ms, single play), never the whole office. Reduced-motion → no shake (the `desk-slam` posture + confused expression remain).
4. **Review-debate / boss-visit → synchronized glance/reaction beat** — a brief, one-shot expression flip on nearby/onlooker agents (e.g. heads turn / surprised) layered on the existing handlers. No movement beyond what the handler already does; reduced-motion → expression flip only, no motion flourish.

**Honesty / safety rules (apply to every beat):**
- Triggered ONLY by a real existing event/status — never a fabricated or timer-only trigger.
- One-shot + capped + debounced — no `repeatCount="indefinite"`, no idle-loop noise; a re-fire within the effect window is a no-op (keyed/debounced).
- `reducedMotion` disables shake / confetti / sparkle motion; the **semantic state stays visible** (posture, expression, bubble, status ring).
- An effect MUST NOT occlude an agent's status ring / blocked-reason glyph; effects render beneath sprites or as brief non-occluding overlays.
- Existing visual safety caps (opacity ceilings, photosensitivity lightning cap) remain.

**NON-GOALS:**
- No new events; no always-on/ambient juice; no whole-office screen-shake (desk-slam shake is local only).
- AVO-112 multi-eureka cascade (separate item; this lays the reusable particle idiom).
- No new persistent chrome; no change to status channels.

## Design (concrete)

- **CSS (CSP-safe):** add bundled keyframes to `src/index.css` next to `pet-confetti` — `office-confetti` (fall+fade, staggered) and `desk-shake` (small translate jitter, 1 iteration). NO inline `<style>` (CSP `style-src 'self'` — per `csp-compatibility.md`).
- **Trigger module (pure + testable):** a small `eventJuice.js` exposing a pure resolver, e.g. `juiceForEvent(eventId, { reducedMotion })` → `{ kind: 'confetti'|'sparkle'|'shake'|'glance'|null, ... }`, returning `null` under reduced-motion for motion effects and for non-juiced events. Render components read it; the resolver is unit-tested without a DOM.
- **Render:** a capped, self-unmounting overlay (e.g. `EventJuice` SVG/HTML layer) keyed by event id so a re-render never re-fires; desk-shake applied to the affected agent group only.
- **Hook points:** the existing `officeLife.js` handlers (`deploy-success`, `eureka`, `review-debate`, `boss-visit`) + the `desk-slam` behavior — set/clear a transient juice descriptor in the store (or derive from `activeEvent`), consumed by the overlay.

## Acceptance Criteria

1. Deploy-success fires a single capped confetti burst; eureka a single sparkle beat; desk-slam a brief LOCAL shake; review/boss a one-shot reaction beat — each only on its real event/status.
2. Reduced-motion ON: no shake/confetti/sparkle motion; semantic state (posture/expression/bubble/status ring) still fully visible. Tested.
3. No effect loops indefinitely; a re-fire within the window is debounced/no-op; effects auto-clear.
4. No effect occludes the status ring or blocked-reason glyph; existing opacity/photosensitivity caps intact.
5. Pure `juiceForEvent` resolver unit-tested (reduced-motion gating + per-event kind + null for non-juiced events).
6. Visual QA covers eureka, deploy, and blocked/desk-slam; full suite + vite build + render-smoke + sim-soak still green with effects enabled.

## Risks & Rollback

- Risk — fireworks/clutter creep: mitigated by rare-event-only triggers, one-shot caps, and the no-status-occlusion rule; beats reuse existing rare seeds (no new triggers).
- Risk — photosensitivity: no rapid flashing; confetti/sparkle are slow fades; lightning cap untouched; reduced-motion fully disables motion.
- Risk — perf on the ~1000-node SVG: effects are short-lived, low particle counts, self-unmounting (zero nodes at rest).
- Rollback: revert the implement commit; effects are additive overlays gated on events — removal restores prior behavior with no data/store migration.

## Note

Beat selection + caps are deliberately conservative; a same-genre game-feel panel could refine particle counts / timing curves before or during `/implement` if the owner wants (cf. the AVO-104 / chill-fun panel precedent). The issue's explicit constraints make the conservative version safe to build directly.
