---
kind: feature
status: draft
primary_domain: frontend
parent_spec: docs/specs/ux-vibe-rebalance.md
created: 2026-06-04
---

# Spec: Responsive Office / Roster Layout (the ☰ views must FILL the pane)

> **Status: DRAFT — awaiting owner approval before any implementation.** This formalizes the
> responsive behavior that the recent ad-hoc iteration kept getting wrong. Build is GATED on this.

## Problem

The app has two views of the same data:
- **Office** — a FIXED 800×560 **landscape** pixel scene (coordinates hardcoded in `movementSystem`; cannot reflow or crop — owner rejected cropping: "裁切是最爛的選擇").
- **Roster** (`NarrowRoster`) — a vertical list (presence rail + activity feed).

Neither currently fills every pane shape, so the owner sees dead space + wrong proportions:
- Office in a **tall** pane → scales to width, big empty band above/below (landscape geometry).
- Roster in a **wide** pane → a narrow centered column floating in a wide pane ("擠在一邊、字小").

Root cause: **there is no spec defining which view shows, and how it fills, at each pane shape.** Every fix so far was a guess. This spec defines it with **measurable** acceptance criteria (verifiable via `getBoundingClientRect`, since `preview_screenshot` is broken in this environment).

## Research basis (standard web practice, per owner's request to look it up)
- **Filling the viewport with no empty space** is standard CSS: a Grid/Flex shell at `height:100%`/`100vh` with the body row = `1fr` takes all remaining space; responsive card areas use `grid-template-columns: repeat(auto-fill, minmax(MIN, 1fr))` to fill the width (1→N columns). (CSS-Tricks/MDN/web.dev dashboard patterns.) → the roster/feed MUST fill via this; a fixed `max-width` centered column was a mistake (it manufactures side gutters).
- **A fixed-aspect visual** (the 800×560 office) has exactly TWO standard fits (MDN `object-fit`, web.dev `aspect-ratio`): `cover` = fills the box but CROPS; `contain`/`meet` = shows all but LETTERBOXES (the whitespace). No third option exists. Crop is owner-rejected ⇒ the leftover band MUST be filled with content — the standard "dashboard fills remaining space" pattern ⇒ the Hybrid below is the *necessary* resolution, not a preference.

## Decision — FULLY FLUID, no size thresholds (per owner: "完美自適應，一般使用不能有問題")

There are **no width/height assumptions and no view-switch thresholds.** The docked view must fill
the pane and stay readable at EVERY normal size; only genuinely extreme aspect ratios may degrade
gracefully. The office is a fixed landscape that physically cannot reflow, so the fluid filler must
be the **reflowable content** (the presence rail + activity feed). Therefore:

**HYBRID, continuously sized — there is always ONE adaptive layout, no mode switch:**

1. **Office band (top):** the office scene scaled to the pane WIDTH (centered, never cropped). Its
   height is whatever the landscape ratio yields at that width, **capped at ~55% of pane height** so
   it never eats a tall pane. On a wide-short pane it naturally fills most/all of the height.
2. **Live panel (fills the rest):** the presence rail + activity feed occupy **100% of the remaining
   space below the office**, growing/shrinking fluidly. On a tall pane this is large (lots of
   readable status + feed); on a wide-short pane it's a slim strip; on a balanced pane it's split.
3. **Continuous, not stepped:** as the pane changes W or H, the office band and the live panel
   re-proportion smoothly — **no breakpoint, no flip, no dead band at any normal size.**
4. The standalone ☰ roster (full-height list) is retained as an option, but the DEFAULT docked
   experience is this single fluid hybrid so nothing the owner does to the window leaves dead space.

> This keeps the office (the mesmerizing hero) ALWAYS visible AND guarantees the pane is filled at
> any shape — because the reflowable live panel absorbs whatever space the fixed office can't.

## Acceptance Criteria (ALL measurable via getBoundingClientRect — verified over a SWEEP)

Verify over a sweep of NORMAL sizes — widths {360, 480, 640, 900, 1280} × heights {520, 700, 900, 1100} (20 combos):

- **AC-1 (fills, every size):** at every swept size, total rendered content covers **≥ 92% of pane height** (office band + live panel), with **no empty band > 48px** anywhere. No "floating small thing in a big pane."
- **AC-2 (office never cropped, never dominates a tall pane):** office scaled by width (centered, full art visible); office band height ≤ 55% pane height; office horizontally centered (`|leftMargin − rightMargin| ≤ 8px`).
- **AC-3 (live panel fills remainder):** the presence+feed panel's height = pane height − office band − chrome, ± 8px; it scrolls internally if its content overflows (never overflows the pane).
- **AC-4 (legibility, every size):** on-screen text never below — agent name **14px**, status/feed body **12px**, time **10px** — at ALL swept sizes (counter-scale if needed, like POINT 2).
- **AC-5 (single column / no sparse grid):** the live panel is a single column at every width (centered max-width only as a readability cap, with the office filling the width above it — so the pane never looks half-empty).
- **AC-6 (no regression):** `movementSystem` + agent sprites byte-unchanged; the office's own scene rendering unchanged; wide full-window office still looks right.
- **AC-7 (existing contract holds):** blocked pins top + only-blocked reorders; feed = real events only; team-status strip (blocked › workflow › active); times real/"now" never "0s"; reducedMotion + a11y intact.

## Out of scope / non-goals
- No cropping/zoom of the office (owner-rejected). No faking per-agent data / decorative-events-as-team-state.
- No new motion beyond the calm contract. Genuinely extreme ratios (e.g. < 200px wide, or > 4:1) may degrade — only NORMAL sizes are guaranteed.

## Verification method
`preview_screenshot` hangs in this environment, so EVERY AC is verified by **rendered-geometry
measurement** (`getBoundingClientRect` via preview_eval, swept across the 20 sizes) + unit tests for
the pure sizing math + the owner's visual confirmation. No "looks fine" without a measured number.

## Open question for the owner (one quick confirm before /plan)
Approve the **fluid Hybrid** (office band on top + live panel filling the rest, continuously, no
thresholds)? Or do you want the office to be able to take MORE/LESS than ~55% of a tall pane (i.e.
tune the office-vs-panel balance)? Once you confirm, I run `/plan → /implement → /review → /test`
strictly, verifying each AC by measurement.
