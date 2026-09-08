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

### [hook-integration][2026-06-11][main]
source_review: docs/reviews/2026-06-11-tech-debt-audit.md
cross_ref: docs/architecture/silent-catch-policy.md

- [DECISION] Bridge page dynamic UI must avoid inline handlers and dynamic `innerHTML`. The launcher keeps the external script split (`public/bridge.html` + `public/bridge-ui.js`) so the existing CSP can block inline script without breaking controls.
- [CONSTRAINT] Hook and bridge failure handling is intentionally crash-proof, but new silent catches must follow `docs/architecture/silent-catch-policy.md`; user-visible API failures remain observable through status codes or sanitized logs.
- [CONSTRAINT] Hook hot paths must stay fast and avoid logging raw prompts, command bodies, token payloads, or local paths unless an existing sanitized diagnostic channel explicitly allows it.

### [hook-integration][2026-09-08][fix/audit-2026-09-08 (audit remediation)]
source_review: docs/reviews/2026-09-08-audit-handoff.md
source_sha: 936d92baae08f709d75c5134af183db1c667d559
cross_ref: docs/architecture/ui-rendering.log.md

- [DECISION] Every restatement of the office-status contract outside `src/utils/statusContract.mjs` is a MIRROR and must be pinned by a drift-guard test. Three mirrors had silently drifted behind AVO-101/AVO-167: `public/hooks/office-status-codex.js` (a standalone CJS script that cannot `require` the ESM contract), `public/bridge.js`, and `public/bridge-ui.js`'s identity colours. The mirrors stay -- what changed is that an unpinned mirror is now considered a defect, not a shortcut.
- [DECISION] A missing status in a mirror is not a filter, it is a MISCLASSIFICATION. `bridge.js` treated any non-whitelisted value as a task NAME, so `{ dev: 'planning' }` produced a "working" agent labelled "planning"; the codex hook DROPPED the agent outright. Both failure modes are silent and neither surfaces as an error.
- [DECISION] `server.mjs` now resolves its status directory through `OFFICE_STATUS_DIR`, matching `vite.config.js`, and announces an active override in the startup banner. The dev-server precedent deliberately scoped that variable to `configureServer` so it could not reach a built office; that claim is about the vite plugin's own registration and the browser payload (still true -- `grep -rl OFFICE_STATUS_DIR dist/` finds nothing). Extending it to the production server adds no fabrication capability, only a second way to point at the file the existing `/api/status` writer already owns.
- [DECISION] `_seq` is a MILLISECOND epoch across every transport. The shell hook had been emitting `date +%s%N` -- nanoseconds on GNU date, and a literal `"1757318400N"` on BSD/macOS. Both break consumers written against milliseconds: `scanSessions` dedups a bare status file against a slugged one inside a 2s window and expires `done` against `Date.now()`, and the client keeps a numeric high-water mark.
- [CONSTRAINT] `server.mjs` is NOT self-contained. It imports `src/server/scanSessions.mjs` and `src/utils/normalizePost.mjs`, so any packaging step that ships the server must ship that import closure. The Dockerfile runner stage did not, and every container built from it exited on `ERR_MODULE_NOT_FOUND` while the build, the tests and the smoke gates all stayed green. `tests/dockerRuntimeClosure.test.js` now walks the graph and fails when it reaches outside what the runner copies.
- [CONSTRAINT] Hand-wiring instructions are part of the contract. `bin/cli.js` registers 8 hook events; `docs/INTEGRATIONS.md` said 6 and `public/hooks/hooks-config.json` -- the file the docs tell you to paste -- omitted `PermissionDenied` and `StopFailure`, which are exactly what turn a denied tool call or a Claude-API failure into an honest `blocked` state. A hand-wired install silently lost that. Pinned to `bin/cli.js` by `tests/hookEventRegistrationParity.test.js`.
- [CONSTRAINT] Hook-authored labels must resolve language through `detectHookLang()` (`~/.claude/office-lang`, default `en`). `generic-llm-bridge.js` had hard-coded Traditional Chinese, so an English office showed Chinese status text with no way to change it.
- [TRADEOFF] The Docker runner copies `src/server` + `src/utils` (56 KB) rather than all of `src/` (1.1 MB). The narrower copy keeps app source out of the runtime image but can be outgrown by a future import -- which is why it ships paired with the import-graph guard rather than on its own.
