# Hook Integration Decision Log

### [hook-integration][2026-04-08][main]
source_spec: docs/specs/codex-status-parity-and-done-count.md
cross_ref: docs/architecture/office-runtime.log.md

- [CROSS-REF] Claude file hooks remain the baseline external integration path and must stay backward compatible.
- [CROSS-REF] Codex CLI helper and Codex App bridge are parity extensions that emit the same normalized `office-status` payloads instead of introducing a parallel hook contract.
