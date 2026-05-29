# UI Rendering Decision Log

### [ui-rendering][2026-04-08][main]
source_spec: docs/specs/codex-status-parity-and-done-count.md
cross_ref: docs/architecture/office-runtime.log.md

- [CROSS-REF] Inspector rendering stays source-agnostic because runtime inputs are normalized before UI consumption.
- [CROSS-REF] Durable same-day done counts replace capped activity-feed inference without changing the overall inspector surface contract.

### [ui-rendering][2026-05-29][main]
source_spec: docs/specs/weather-system.md, docs/specs/tool-inventory-label.md, docs/specs/workflow-handoff-arrows.md, docs/specs/csp-compatibility.md
cross_ref: docs/architecture/office-runtime.log.md, docs/DESIGN_SPEC.md

- [DECISION] Per-agent reactive subscriptions stay narrow. `AgentCharacter` reads `s.externalStatus[id]?.task ?? null` (one field, not the whole externalStatus object) so the tool inventory label re-renders only when the tool changes — not on every label/expiresAt tick.
- [DECISION] WallWindow weather overlays do NOT share clipPaths across 12 instances. The clip rect depends on per-window (x,y,w,h) so each gets its own `<clipPath id="weather-clip-{x}-{y}">`. The `<defs>` wrapper around each was redundant though, and was removed (12→1 DOM defs node).
- [DECISION] Workflow handoffs reuse the existing `FlyingDocument` SVG via a new `subtle` boolean prop. The component branches inside the same render function — no second component, no parallel pathway. Organic vs workflow handoff is one variable's flip.
- [DECISION] All new TextLabels and pills use monospace 7-10px text with low-opacity dark backgrounds (`fill="#1a1a1a"` @ 0.55). Consistent visual language across `✓N/✗M` metric chip, tool inventory label, and 🔔 button.
- [DECISION] `@keyframes` definitions migrate from inline `<style>` (CSP violation) to bundled `src/index.css`. Future SVG animations follow the same pattern; reach for index.css before reaching for `<style>`.
- [TRADEOFF] The tool inventory label sits at y=-29 in the inverse-scaled name-tag group — between the name tag and the head. There's only ~9 SVG units of clear space; we accepted the tight fit so the label doesnt overlap the agent's face during walking animations.
- [TRADEOFF] The mood-driven weather overlays add up to 60 raindrop `<line>` elements during frustrated / stuck states (5 per window × 12 windows). Tested at 30fps no jank, but if PixelOffice ever exceeds 30 simultaneous SVG animations a higher-level perf strategy is needed.
- [CONSTRAINT] `reducedMotion` (from `prefers-reduced-motion` or pause) MUST disable animations across the new visual surfaces — weather overlays drop every `animation` style prop, FlyingDocuments don't render, tool inventory label stays static (no animation anyway). New animated work must register the same gate.
- [CONSTRAINT] Lightning opacity caps at 0.35 with at most 2 flashes per 5-second cycle. Future flash effects must obey the same photosensitivity ceiling.
- [CONSTRAINT] Workflow handoff visual variant ("subtle") must coexist with the organic (flashier) variant in the same frame without visual clash. Tested live with simultaneous `arch→dev` workflow + `res→gate` organic handoffs.
