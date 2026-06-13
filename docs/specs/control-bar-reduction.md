---
title: AVO-130 Control-Bar Reduction (gear menu + single health dot)
status: draft
created: 2026-06-13
signal_tier: none
backlog: AVO-130
depends_on: AVO-137
issue: 116
---

# AVO-130 — Control-Bar Reduction

## Intent

Calm the resting control bar to a glance-first minimum so the office reads as a living scene, not a dashboard bolted onto a toy. Reduce the persistent control cluster to **clock · health-dot · pause · gear**, collapse the four separate connection/integration pills into **one expandable health dot**, and demote the remaining secondary controls (language, run-workflow, list-view, help, platform label) into the existing ⚙ gear popover. **No functionality is removed — only re-layered.** Parent concept: AVO-137 density-layer foundation (glance-L1 default, detail opt-in).

This spec is the §4.4 Design Source of Truth. AVO is a procedural pixel-art / Tailwind-in-code product; there is no per-element Figma/Stitch artifact. The DSoT here = this spec's concrete control inventory + the before/after verification screenshots (inspectable, linkable). Owner-accepted DSoT path for procedural UI (same precedent as `cozy-micro-interactions.md`).

## Current state (baseline, `ControlPanel.jsx`)

A prior reduction wave (AVO-127 / AVO-129 / #39) already moved the ✓/✗ done-blocked KPI, the 🪙 token meter, all cosmetic toggles, desktop-notifications, and the dev test-panel off the resting bar. What still sits on the **full-mode** resting bar:

- Left: clock `HH:MM` (`hour`/`minute`).
- Center (flex-1): **agent presence rail** — per-agent name · status · color/status dots. This is the core status channel.
- Right: `activeEvent` transient · **4 health pills** (`statusSource==='external'`→Live, `statusSource==='fallback'`→fallback-N, `integrationHealth.state==='offline'`→API-offline, `==='degraded'`→API-retrying) · platform chip · button cluster **[ lang · pause · ☰ list-view · run · ⚙ · ? ]**.

**Panel mode** (`isPanel`) has a parallel mini-bar: presence dots + Live pill + offline pill + pause.

## Scope

**IN — 1. Single health dot.** Replace the 2–4 simultaneously-renderable connection/integration pills (full mode: live/fallback/offline/degraded; panel mode: live/offline) with one focusable dot whose color encodes the single highest-severity state. The exact-state derivation is a pure, unit-tested helper.

**IN — 2. Demote secondary controls into ⚙.** Move **language switch**, **run-workflow**, **list-view (☰)**, and **help (?)** trigger from the resting button cluster into the gear popover as rows. Move the **platform chip** into the help/info popover (ambient metadata). Resting button cluster becomes **[ pause · ⚙ ]** plus the health dot.

**IN — 3. Panel-mode parity.** Panel mode uses the same health-dot helper (collapses its live/offline pills).

**KEEP (untouched, explicitly):** clock; the agent presence rail and its per-agent dots (the #1 status-legibility channel — REDUCE-not-add never touches it); `activeEvent` transient indicator; pause/resume on the bar; the `Space` pause and `L` language keyboard shortcuts (still bound and functional even though the L button moves into the menu — onboarding still lists both).

**OUT / NON-GOALS:** no removal of any control or data path; no redesign of the gear popover visuals beyond adding rows + a divider; no new store flags or persisted prefs; no change to presence-rail content, status colors, or the onboarding first-run auto-open behavior; AVO-137's full L0/L1/L2 model is not built here (this is its minimal control-surface slice).

## Design (concrete)

### Health-dot state derivation — pure helper

Add to `controlPanelLabels.js` (testable without JSX):

```
healthDotState({ statusSource, integrationHealth, externalCount }) -> {
  level: 'offline' | 'degraded' | 'fallback' | 'live' | 'idle',
  trouble: boolean,        // true for offline | degraded | fallback
  // i18n key + replacement value for the detail label, reusing existing strings
}
```

Precedence (highest severity wins, single result): `offline` > `degraded` > `fallback` > `live` > `idle`.
- `offline`  ← `integrationHealth.state === 'offline'` → red, solid.
- `degraded` ← `integrationHealth.state === 'degraded'` → amber, pulse.
- `fallback` ← `statusSource === 'fallback'` → amber/yellow, pulse; label uses `ui.fallbackAgents` with `externalCount`.
- `live`     ← `statusSource === 'external'` (+ integration not offline/degraded) → emerald, pulse; label `ui.live`.
- `idle`     ← none of the above (demo/local, no external feed, healthy) → quiet gray, no pulse.

Detail label strings reuse the EXISTING i18n keys (`ui.live`, `ui.fallbackAgents`, `status.apiOffline`, `status.apiRetrying`) — no new copy needed except an `aria.health` summary label and an `idle`/"local" label.

### Health-dot rendering

- A `<button>` (focusable, keyboard-operable, `aria-label` = summarized state) carrying the colored dot.
- **Glance behavior — "collapsed unless trouble exists":** when `level` is `live` or `idle` (healthy), show **only the quiet dot** (no inline text). When `trouble` is true (offline/degraded/fallback), show the dot **plus** its short inline label, so trouble is glanceable without interaction.
- **Expand on demand:** hover **or** keyboard focus **or** click reveals a small detail tooltip/popover with the precise state text. Detail is reachable by keyboard (focus reveals it; not hover-only). Reuses the gear-popover Esc/click-outside dismissal pattern if implemented as a popover; a `title` + focus-visible inline reveal is acceptable for the lighter tooltip variant.

### Gear popover additions

The existing ⚙ popover (`role="menu"`, Esc + click-outside close) gains, above the current cosmetic toggles and separated by a divider:

- **Language** — row that cycles locale (same `cycleLang`), shows next-locale label.
- **View mode** — Office / List toggle (drives `toggleRosterMode`, `aria-pressed`).
- **Run workflow** — action row (`triggerWorkflow`).
- **Help & shortcuts** — row that opens the existing info/onboarding popover (which already holds the ✓/✗ + 🪙 on-demand metrics); the platform label renders inside that info popover.

All rows are focusable buttons; tab order within the menu is linear; existing notifications + test-panel rows stay.

## Acceptance Criteria

1. **One dot, not pills.** In full mode, at most one connection/integration indicator (the health dot) renders at a time; the four separate pills are gone. Panel mode likewise shows one dot.
2. **Severity precedence.** Unit tests pin `healthDotState` precedence: offline > degraded > fallback > live > idle, including combined inputs (e.g. `statusSource==='external'` + `integrationHealth==='offline'` → `offline`).
3. **Trouble is glanceable; detail is reachable.** Healthy (live/idle) shows a quiet dot only; trouble shows dot + inline label. The precise detail text is revealed on hover AND on keyboard focus AND on click.
4. **No functionality removed.** Language switch, list-view, run-workflow, help, notifications, and test-panel are all still reachable (now via ⚙ / its sub-popover). `Space` and `L` shortcuts still work.
5. **Keyboard access complete.** Every demoted control is focusable and operable by keyboard; gear menu Esc/click-outside still close; health-dot detail reachable by focus.
6. **Narrow layout.** At a narrow viewport the resting bar has no overflow/clipped text or buttons (fewer persistent buttons than baseline).
7. **Before/after density.** Verification includes before/after screenshots at a representative width showing the reduced resting bar.
8. Full test suite green; vite build clean; no new per-frame work; no new store flag.

## Risks & Rollback

- **Risk — discoverability:** burying list-view/language one click deeper could surprise power users. Mitigation: keep `L`/`Space` shortcuts, keep onboarding hints; these are opt-in density actions, consistent with glance-first AVO-137.
- **Risk — status legibility regression:** collapsing pills must not hide a real `offline`/`degraded` condition. Mitigation: trouble states auto-show their inline label (not hover-only); precedence unit-tested so the worst state always wins.
- **Risk — a11y regression:** hover-only detail would fail keyboard users. Mitigation: AC-3 + AC-5 require focus-reveal; tested.
- **Rollback:** single-file change (`ControlPanel.jsx` + pure helper in `controlPanelLabels.js` + i18n keys). Revert the implement commit to restore the prior bar; no data/store migration, so rollback is clean.
