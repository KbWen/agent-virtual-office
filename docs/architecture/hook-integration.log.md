# Hook Integration Decision Log

### [hook-integration][2026-04-08][main]
source_spec: docs/specs/codex-status-parity-and-done-count.md
cross_ref: docs/architecture/office-runtime.log.md

- [CROSS-REF] Claude file hooks remain the baseline external integration path and must stay backward compatible.
- [CROSS-REF] Codex CLI helper and Codex App bridge are parity extensions that emit the same normalized `office-status` payloads instead of introducing a parallel hook contract.

### [hook-integration][2026-05-29][main]
source_spec: docs/specs/desktop-notifications.md, docs/specs/idle-gap-inference.md, docs/specs/classifier-foundation.md
cross_ref: docs/architecture/office-runtime.log.md

- [DECISION] The classifier consumes the existing `task` string from `office-status` payloads as-is. No hook contract change required for v1.1.0 — MCP, Tier 3 verb routing, role overrides, workflow handoffs all parse what already arrives.
- [DECISION] Inferred statuses (`thinking`, `awaiting-approval`) are pre-registered in `classify.js` STATUS_TABLE but only produced by the local `idleGapInfer` module, never emitted by hook scripts directly. Hook authors don't need to learn the new values.
- [DECISION] `desktopNotifier` subscribes to store state, not to the hook channel. The hook fires → `applyExternalStatus` → store mutation → notifier reads the next tick. This keeps the hook contract unchanged and the notification logic testable without simulating a transport.
- [DECISION] `unknownLog` records raw hook payloads that fall to Tier 5. Repeat unknowns are the signal to extend Tier 0 — operationally, hook authors and classifier maintainers communicate via this log rather than direct schema coordination.
- [TRADEOFF] Idle-gap inference uses a 10-second polling tick rather than reacting to absence-of-events on the SSE channel. Polling is simpler and decoupled from transport, at the cost of up to a 10-second jitter before inferring `thinking` / `awaiting-approval`.
- [CONSTRAINT] OpenTelemetry GenAI semantic conventions (`gen_ai.tool.name`, `gen_ai.usage.*`) are the target for future hook payload upgrades. The classifier's `visualLabel`, MCP server::tool routing, and `unknownLog` keys are deliberately compatible with that direction.
- [FORWARD-LOOKING] AVO-101 plan-mode visualization and AVO-108 token & cost meter will require hook payload extensions. Until then they live as backlog items, not partial implementations on the existing contract.

### [hook-integration][2026-05-30][main (PR #22)]
source_spec: docs/specs/_product-backlog.md (AVO-101 / AVO-108 / AVO-102 — hook-data wave)
cross_ref: docs/architecture/office-runtime.log.md
note: RESOLVES the [FORWARD-LOOKING] deferral in the 2026-05-29 entry above — AVO-101/108/102 shipped (PR #22, squash-merged to main). The hook payload was extended as anticipated. (Routed during the 2026-06-05 doc-baseline drift sweep; the forward-looking line above is preserved as append-only history.)

- [DECISION] AVO-101 (plan-mode): `statusForPreToolUse` emits `status:'planning'` when `permission_mode==='plan'` (`public/hooks/office-status-hook.js:491`). No dedicated plan event exists, but `permission_mode` rides every tool payload.
- [DECISION] AVO-108 (token meter): the hook tail-reads `transcript_path` (a JSONL; 64 KB from end) for the latest `usage` and emits `tokens:{ctx,out,model}` where `ctx = input + cache_creation + cache_read` (`office-status-hook.js:499`). Token/cost is NOT in the raw hook payload — the transcript is the data path.
- [DECISION] AVO-102 (effort aura): the hook emits `effort.level` (low|medium|high|xhigh|max) from `event.effort.level` (`office-status-hook.js:528`).
- [CONSTRAINT] All three are ADDITIVE to the normalized office-status contract — no existing field changed; consumers ignoring planning/tokens/effort are unaffected. `transcript_path` tailing is read-only and bounded (64 KB); hook authors must not assume the full transcript is parsed. OT GenAI `gen_ai.usage.*` remains the forward target for the token-field naming.
