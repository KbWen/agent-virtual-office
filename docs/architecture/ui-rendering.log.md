# UI Rendering Decision Log

### [ui-rendering][2026-04-08][main]
source_spec: docs/specs/codex-status-parity-and-done-count.md
cross_ref: docs/architecture/office-runtime.log.md

- [CROSS-REF] Inspector rendering stays source-agnostic because runtime inputs are normalized before UI consumption.
- [CROSS-REF] Durable same-day done counts replace capped activity-feed inference without changing the overall inspector surface contract.
