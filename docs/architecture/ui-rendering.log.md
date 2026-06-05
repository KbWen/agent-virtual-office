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

### [ui-rendering][2026-06-05][main (merged via PR #44)]
source_spec: docs/specs/ux-vibe-rebalance.md, docs/specs/responsive-office-roster.md, docs/specs/living-office-events.md
cross_ref: docs/architecture/office-runtime.log.md, .agentcortex/context/current_state.md (Ship History feat-ux-vibe-rebalance-2026-06-03..06-05)
note: Routed from Ship History per audit routing_actions (docs/reviews/2026-06-05-audit.md). These decisions are MERGED to main via squash PR #44 (012d0f2, v1.2.0) — git-verified src/ byte-identical main↔feat; feat branch is superseded dev history. See office-runtime [MERGE STATE].

- [DECISION] The office SVG fills the full browser WIDTH at every pane shape via `aspect-ratio: 800/560` + center + clip on the svg element (NOT a fixed pixel width). This is the owner-required responsive proportion: no left/right whitespace, no crop of agents. The `0 0 800 560` viewBox is a Protected Surface — coordinate/layout changes risk re-breaking it (guarded by `tests/officeViewBox.test.js`).
- [DECISION] In-scene text readability below native scale is solved by `store.sceneScale` (measured `meet` scale via svgRef + ResizeObserver + a 600ms self-heal poll for throttled webviews) counter-scaling name/status/bubble (cap `LABEL_SCALE_MAX = 1.5`, anchor-preserving grow-in-place), the click-inspector popover (cap 2.5), event banner, and desk nameplates. Faint area-labels/decoration stay small by design.
- [DECISION] The ☰ roster is a living **presence rail + activity feed** (`rosterModel.js` pure logic), NOT a flat list. Salience is 2-tier: only `blocked` pins to top and reorders; idle dims in place (a 3-tier active/idle sort thrashed under live churn — collapsed to 2 tiers). The feed is real-events-only with an `origin`-tagged `activityLog`.
- [DECISION] The real-event feed uses a SEPARATE bounded `eventFeed` store field, distinct from `activityLog`'s write-time 50-cap. Without this, organic-theater events could evict real events from the shared log (review HIGH-1). `FEED_ORIGINS` is the single shared source of which origins surface.
- [DECISION] Top-row agents' speech bubbles flip BELOW the head (`BehaviorBubble` `below` prop) when they would clip the office top edge — measured via getBoundingClientRect across window sizes.
- [CONSTRAINT] Per the "畫面清楚好懂、不過分花俏" brief, new in-scene tells stay sub-dominant to the pixel scene. The reluctant-participant ⏳ is a PURE OVERLAY (`store.reluctant`) — it never touches status/behavior/bubble/position and real bubbles preempt it. Any future overlay must follow this never-touch-live-channels rule (cross-ref office-runtime).
- [CONSTRAINT] Pixel/visual correctness is owner-confirm only in this env (`preview_screenshot` hangs; `preview_eval` can't reach the running store due to module duplication). Behavioral correctness is test-authoritative (vitest = real modules). Verify layout/scale changes by getBoundingClientRect/computed-font measurement AND owner visual confirm — never claim "works" from code/tests alone. (SSoT Protected Surfaces.)
- [TODO/AC-3] Pixel-dominance + keep-out routing for set-piece overlays is design-asserted + structurally tested (overlay never touches live channels) but still needs owner visual confirmation — open at routing time.
