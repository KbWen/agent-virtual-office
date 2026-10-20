---
title: "AVO-198 — Antigravity and Gemini CLI Status Adapters"
status: frozen
created: 2026-10-18
last_updated: 2026-10-20
primary_domain: hook-integration
classification: feature
planning_state: implementation-ready
implementation_state: not-started
---

# AVO-198 — Antigravity and Gemini CLI Status Adapters

## Goal

Observe real activity from Antigravity and Gemini CLI through separate producers feeding the existing office-status pipeline. The owner selected both adapters on 2026-10-19. Claude will implement; this is a verified plan, not evidence of a working integration. Freeze this draft when approved or on implementation entry, before code changes.

File Relationship: INDEPENDENT feature spec, governed by ADR-002 project/session isolation, ADR-003 transport parity and ADR-007/008 honesty. Current code and accepted ADRs govern current behavior; shipped specs remain historical references.

## Scope and Non-goals

- Antigravity desktop: passive read-only observer for the locally observed ~/.gemini/antigravity layout, started by both AVO servers; no Antigravity hook registration.
- Gemini CLI: official lifecycle hooks, explicitly installed through setup --platform gemini. No automatic detection claim without installation.
- Both: project/session isolation, generic labels, safe output, expiry, shutdown, installed-package compatibility.
- Non-goals: AVO-199/200/201, sprites/cosmetics, new UI, movement, workflow-command inference, completion counters, token/cost monitoring, remote source discovery, Antigravity CLI/IDE data-root variants and Gemini transcript scraping.
- No new npm dependencies, API endpoints, frontend statuses or rendering branches. Existing manual Gemini/API bridges remain available.

## Evidence and Corrections

| Earlier assumption | Evidence / correction |
|---|---|
| Both platforms use the same hooks.json/events | Official sources below establish separate configuration and event vocabularies. Never share their raw decoder. |
| Last 4 KB is sufficient | Local structure-only probe on 2026-10-19: 227 complete rows, maximum line 8,493 bytes. Use incremental complete-line decoding. |
| DONE means the turn ended | Same sample: 222 DONE rows, 99 containing tool calls. DONE alone proves neither turn completion nor idle. |
| Every tool has Cwd | Local keys: run_command.Cwd, file tools TargetFile/AbsolutePath, questions without path keys. Binding needs explicit rules. |
| Keep only the newest conversation | Loses same-project concurrency. Use independent session outputs, fairly scheduled within explicit limits. |
| Import fileToRole from classify.js | It is in public/hooks/office-status-hook.js:448. classify.js classifies behavior; importing the Claude hook attaches stdin listeners. |
| Silently swallow failures | Require bounded redacted production stderr diagnostics and safe retries. |
| All pre-tool failures always block for 30s | Official Antigravity docs establish a decision contract and timeout, not every failure outcome claimed by the earlier draft. Remove that universal claim. |

The probe emitted only keys, tool names, counts and enums, never prompt/command/content/error values. Installed source versions and a supported-version range are still unproven; record versions during live acceptance.

## External References

- [Antigravity hooks](https://www.antigravity.google/docs/hooks), checked 2026-10-19: camelCase hook identity and application-specific transcript path. This is not a guarantee of the private JSONL row schema or presence-file liveness.
- [Gemini CLI hook reference](https://geminicli.com/docs/hooks/reference/), checked 2026-10-19: snake_case identity, JSON input/output, distinct lifecycle/tool events and best-effort session exit.
- [Gemini CLI configuration](https://geminicli.com/docs/hooks/), checked 2026-10-19: hooks live in Gemini settings, not Antigravity hooks.json.
- Canonical repository references: src/utils/statusContract.mjs, src/server/scanSessions.mjs, docs/adr/ADR-002-multi-worktree-session-design.md, docs/adr/ADR-003-status-source-parity-for-codex.md and ADR-008-no-fabricated-need-ambient-honesty.md.

## Unified Output and Privacy Contract

- Use the existing canonical office-status contract: type, agents, activeCount, workflow:null, source, _cwd, _seq, and sanitized carry fields. No source-specific frontend path.
- Sources: antigravity and gemini-cli. Filenames: `office-status-antigravity-<digest>.json` and `office-status-gemini-<digest>.json`. Digest = first 24 hex chars of SHA-256(platform + NUL + canonical root + NUL + validated source session ID).
- Never use raw session IDs/paths as filenames, branch-only identity, or write bare office-status.json. Honor OFFICE_STATUS_DIR and resolveProjectRoot().
- Canonical roots use realpath where available, safe trailing-separator removal and Windows-only case folding. Distinct worktrees remain distinct. Containment checks use path segments, not string prefixes.
- Each session output has one current representative. Switching roles replaces the previous role and clears its carry fields. activeCount follows canonical active-status semantics.
- task uses generic canonical tokens (Read/Edit/Write/Bash/Task/AskUserQuestion); labels come from fixed action strings. hint, skill, reasonCode, activeFile default null. Only a proven write target may populate a normalized project-relative activeFile, capped at 200 chars. Reads never create co-edit evidence; suspicious paths are omitted.
- Never persist/display raw prompts, responses, search text, commands, results, file bodies, thinking, errors or model-provided summaries in outputs, fixtures or diagnostics. Commands may be inspected transiently to classify known command forms, never executed.
- _seq advances only for a newly accepted fresh event or a single neutralization edge, never unchanged polling/mtime. Antigravity uses nextSeq(); Gemini serializes max(wallClock, previousSeq+1) per session.

## Antigravity Adapter

### Configuration and Ownership

OFFICE_ANTIGRAVITY_MODE=auto|off (default auto): activate only when the compatible desktop data layout exists. OFFICE_ANTIGRAVITY_ROOT optionally selects that data root; do not create it. Source data is read-only. Docker/remote without an explicitly mounted compatible root degrades to no observation. Tests inject temporary roots/clocks; no network or subprocess discovery.

Implement startAntigravityWatcher({projectRoot,statusDir,dataRoot,...testDependencies}) -> {stop} in src/server/antigravityWatcher.mjs. Use async I/O, one cancellable timer and at most one in-flight tick. No synchronous request-path reads, recursive watchers or separate daemon.

### Discovery and Complete-line Reading

1. Enumerate direct `brain/<safe-id>` children and the fixed .system_generated/logs/transcript.jsonl suffix every 10s. Process at most 32 candidate stats per tick with a round-robin discovery cursor; do not permanently ignore later candidates. Track at most 32 active conversations, evicting least-recent accepted activity deterministically. Presence locks are hints only. Reject non-regular files and symlink/junction escapes from the canonical data root.
2. On attachment establish a live boundary at current EOF. A bounded last-256-KiB scan may establish project binding only; never publish startup history as new activity. Unknown binding waits for future proof. Document that work already in progress when AVO opens may initially be invisible.
3. Each 1s tick reads sequentially from stored offsets, at most 64 KiB/conversation and 256 KiB total. Fairly rotate active conversations. Keep partial UTF-8 bytes until newline; do not treat chunks as records. Partial-line memory <=1 MiB; oversized records are discarded through the next newline with one safe diagnostic.
4. Detect truncation/replacement using file identity and size, clear partial data and establish a new EOF boundary. Deduplicate generation+step index; revised/replayed rows do not repeat activity edges. Unknown schema, invalid timestamps/enums or malformed rows are skipped safely.
5. Only complete records whose source timestamp is within 15s of first observation and <=5s future skew may create activity. Old backlog, touched files and persistent locks cannot renew liveness. Decode backlog within budgets; drop stale rows rather than make them fresh.

### Binding and Honest State

- Exact canonical run_command.Cwd equal to the office root establishes conversation binding. An absolute TargetFile/AbsolutePath/Path/path proven within that root establishes ownership for that record only. Path values may be JSON-encoded strings with one outer double-quote layer; decode that layer before absolute-path and containment checks. Truly relative, malformed or control-bearing paths remain untrusted. Missing-root records may reuse the last exact-Cwd binding, not a file-only guess.
- Any subsequent explicit foreign root/file invalidates binding before mapping. Relative/ambiguous paths, unknown IDs and multi-root ambiguity emit nothing. Never infer ownership from prompt text, repository basename or branch.
- A fresh scoped tool row proves observed activity, not continuing execution. RUNNING may show mapped work; DONE tool rows may show a bounded working observation but never done or a completion-ledger event. Bare DONE/PLANNER_RESPONSE and time gaps never assert successful completion.
- invoke_subagent -> generic delegating work, not a fabricated planning phase. ask_question -> awaiting-approval only with proven RUNNING question evidence; a completed historical question cannot create a wait.
- Map run_command to ops (qa only for known exact test-runner forms), view_file/read_file/list/search to res, and replace_file_content/write_to_file/write_file/edit_file to fileToRole(target) or dev. edit_file uses the canonical Edit task; other existing mappings remain unchanged. Only these write tools populate activeFile. Unknown tool names remain generic dev work; never infer roles from workflow slash commands.

Compatibility amendment approved by the owner on 2026-10-20: live structure-only observation found read_file.args.Path containing a JSON-quoted absolute path and run_command without Cwd. Thirteen decoded paths included twelve inside the office root and one foreign path. Preserve the foreign-path refusal and record-only ownership; no command-text/root guessing or hook installation is authorized by this amendment. Aliases were implemented and verified before re-freezing.
- After 15s without a new accepted event write idle once, clearing action fields, then stop renewing the output. The existing 300s scanner TTL eventually removes it. Silent long-running work may look neutral; no fake heartbeat.
- Coalesce to at most one output/conversation/second; neutralization must not starve. stop() is idempotent, cancels timers/pending writes and prevents late publications. Source absence/read failures never prevent HTTP startup.
- Simultaneous production/dev observers may see the same source. Serialize publication per output using the bounded ownership-token lock described below, re-read the current output under lock, and reject duplicate/older source event keys before advancing _seq. Persist only a hashed generation/step key and source timestamp as private ordering metadata. Neutralize only if the output still refers to the same last event; an old observer cannot idle newer work. Test this with two observer instances sharing one status directory.

## Gemini CLI Adapter

### Lifecycle and Mapping

Add standalone public/hooks/office-status-gemini.js. Guard main execution with require.main===module so test imports have no stdin/write side effects. Setup copies it outside the package: mirror only small transport/role rules under parity tests; do not import the side-effectful Claude hook or create a general framework.

Decode session_id, cwd, hook_event_name, timestamp and the documented event-specific fields. These names are not interchangeable with Antigravity fields.
For tool events read tool_name/tool_input, including their platform-specific path keys; do not copy Antigravity toolCall/args parsing. Resolve the Gemini payload cwd as its project root and require the office to use that same root; ambiguous subdirectory/multi-root launches fail neutral rather than guessing a parent repository.

| Event | Conservative office state |
|---|---|
| BeforeAgent | working on last known role or dev; a prompt does not prove planning |
| BeforeTool | mapped role, generic working action |
| AfterTool | retain work; never terminal success, clear permission wait |
| AfterAgent | idle, cleared action fields; never done |
| Notification of type ToolPermission | awaiting-approval, without message/details text |
| SessionEnd | best-effort idle; missing callback relies on existing TTL |

BeforeTool/AfterTool/AfterAgent clear a prior permission wait. Unsupported event/type produces no state. Do not mine error text to invent blocked reasons.

Cover run_shell_command, read_file, read_many_files, list_directory, glob, grep_search, write_file, replace, web_fetch and google_web_search. Unknown/MCP tools use dev/working plus a generic task, never the raw name. Known exact test-runner command forms route to qa; other shell work routes to ops. Do not regex-search arbitrary commands for the substring "test". File roles match existing fileToRole behavior under parity cases; do not repair existing mapping precedence in this feature.

### Failure, Ordering and Publication

- Bound stdin to 1 MiB and total processing to 1s. Overflow, invalid JSON, timeout, unsupported input and I/O failure publish nothing; emit exactly one empty JSON object on stdout with exit zero. No permission/control overrides or new raw-capture mode. Logs use fixed redacted codes on stderr.
- Serialize read/modify/write per output with an ownership-token lock and bounded wait; never steal a potentially live lock. Timeout drops observation and permits normal agent work. Under lock reject timestamps older than last applied; terminal/permission-clearing events win equal timestamps so delayed BeforeTool cannot revive an ended turn. Store only minimal ordering metadata, never payload bodies.
- Identical-time parallel tools need no exact pending-call counter: AfterTool cannot announce completion. Model timestamps are untrusted; reject invalid or implausible times.
- Both producers use same-directory temp+atomic rename with bounded EBUSY/EPERM retry. On failure keep prior valid JSON untouched; no partial direct-write fallback. Temp/lock files do not match scanner regex. Missing/corrupt old state does not crash the hook.
- Hook errors in the application's recoverable paths must not block agent work. Missing Node, external process termination and platform hook latency cannot be guaranteed away; document limitations.

### Explicit Project Setup and Uninstall

- Extend bin/cli.js dispatch before the existing Claude setup/uninstall branch: setup --platform gemini / uninstall --platform gemini. Bare commands preserve Claude behavior; unknown platforms error rather than silently install Claude.
- Install the standalone script at `<invoking project>/.gemini/hooks/office-status-gemini.js` and uniquely named AVO entries for the six events in `<project>/.gemini/settings.json`. Quote absolute Node/script paths for the actual host shell; bounded hook timeout. Do not use .agents/hooks.json.
- Idempotently merge only owned entries; preserve unrelated keys/hooks/trust settings and symlink targets. Malformed settings abort with no mutation. Atomic settings writes and a local pre-install backup permit rollback. Never execute commands found in settings during setup.
- Uninstall removes only identified AVO Gemini entries and its unmodified owned script, preserving foreign/user-edited entries. Do not remove settings, .gemini directories, logs, status directories or other producers.
- Test spaces, Unicode, quotes and metacharacters with actual Windows and POSIX execution. Document project trust/hook enablement and required Node version. No hooks are installed by opening the office; project hooks being disabled is a supported no-observation state.

## Server Integration

Both server.mjs and Vite configureServer start the same observer with resolved project root/status directory. Production shutdown and Vite close/middleware cleanup call stop(). Existing status-directory watchers/SSE and scanAndMerge handle both producers. Gemini hooks run independently of observer startup.

Do not change scanner semantics, frontend source enums, classifier, store or movement. If current source labeling or merging needs such a change, stop and amend the scope with evidence before editing.

## Acceptance Criteria

| AC | Required proof |
|---|---|
| AC-01 | Separate platform decoders reject each other's raw payload; canonical transport, activeCount and carry-field parity are maintained. |
| AC-02 | Multiple same-project sessions and both sources coexist through scanAndMerge; same branch/different roots and same ID/different sources cannot collide. |
| AC-03 | Startup history, stale locks, touch, unchanged poll and old backlog produce no fresh work; exact expiry/future-skew boundaries and restart are fake-clock tested. |
| AC-04 | >4-KiB rows, partial UTF-8/newlines, oversized lines, malformed-then-valid rows, replacement/shrink and repeated step cases stay bounded and recover. |
| AC-05 | Binding covers absent/relative/foreign paths, source switching roots, Windows case/separators, POSIX case and symlink escape; unknown ownership emits nothing. |
| AC-06 | Antigravity DONE never declares completion; question/subagent mappings invent neither approval nor planning; role mapping and write-only activeFile are verified. |
| AC-07 | Spawned Gemini script handles all six events, malformed/oversized input, unknown types, old/equal timestamp races, stdout contract and best-effort exit. |
| AC-08 | >32 discovery candidates, burst coalescing, fair read budgets, ENOENT/EACCES/EBUSY, lock contention, rename failure and stop-during-write neither crash nor corrupt other outputs. |
| AC-09 | Synthetic secret/prompt/search/command/result sentinels are absent from output JSON/stdout/stderr; read events cannot create co-edit signals. |
| AC-10 | Production and Vite GET/SSE observe both sources using isolated roots; removing either observer startup wire causes its integration test to fail. |
| AC-11 | Gemini setup/uninstall is idempotent, preserves foreign config and symlink targets, refuses malformed settings, handles quoted paths and preserves bare Claude behavior. |
| AC-12 | No-source, Claude-only, Gemini-only, both new sources, Codex coexistence, offline, npx/project-root and Docker/no-mount scenarios pass; packed runtime has no repo-only imports/new dependencies. |
| AC-13 | Fresh full tests/build/budget/pack/governance pass; record available real-source observations and installed versions. Antigravity live read->neutral is evidenced. Gemini lifecycle/permission behavior is verified by isolated spawned-hook/transport tests; authenticated Gemini and native Linux live acceptance are excluded from this delivery by the owner's 2026-10-20 amendment, and must remain documented as unverified rather than claimed proven. |

Delivery amendment approved by the owner on 2026-10-20: merge AVO-198 without further real-device acceptance, which the owner does not intend to perform. Retain automated regression, security/review, packaged-runtime and governance gates. Existing Antigravity live evidence stays valid; Gemini authenticated work/permission and native Linux execution remain explicit accepted limitations, not synthetic substitutes for claimed live evidence. This changes delivery scope only, not runtime isolation/privacy or the feature classification.

## Claude Implementation Plan

All steps are sequential checkpoints, split into independently verifiable 2–5 minute edits. Read target files, acquire the branch lock and freeze this draft on implementation entry. Do not omit an adapter or weaken ACs to get green tests.

| Step | Atomic unit and verification | AC |
|---|---|---|
| S1 | Hand-author synthetic fixtures plus transport/role parity tests; record installed versions. Red tests fail for missing adapters, not broken fixtures. | 01,02,06,09 |
| S2 | Antigravity complete-line decoder, root binding and state reducer; fake-clock/chunk/stale/foreign/no-false-done tests. | 03,04,05,06 |
| S3 | Observer discovery, fair async budgets, publication and stop; filesystem fault tests and temporary-file integration. | 02,03,04,08,09 |
| S4 | Standalone Gemini decoder/reducer/serialized atomic writer; spawned script tests for lifecycle, concurrency, timeout and privacy. | 01,02,07,08,09 |
| S5 | Gemini-specific CLI setup/uninstall; subprocess tests against temporary projects/settings, symlinks and quoted paths. | 11,12 |
| S6 | Wire observer into production and Vite with all roots/cleanup; real GET/SSE tests and startup-wire removal negative controls. | 10,12 |
| S7 | README setup/limits, full regression, installed-package check and available live evidence with owner-accepted limitations; then review->test->formal handoff->ship. | 12,13 |

### Target Files

- New runtime: src/server/antigravityWatcher.mjs, public/hooks/office-status-gemini.js.
- Modified runtime: server.mjs, vite.config.mjs, bin/cli.js.
- New tests: tests/antigravityWatcher.test.js, tests/geminiHook.test.js, tests/geminiSetup.test.js, tests/googleAdaptersServerIntegration.test.js; synthetic examples in tests/fixtures/google-adapters/.
- Extend tests/scanSessions.test.js only for necessary coexistence cases; use existing tests/codexHookContractParity.test.js as a regression/reference, without rewriting expectations.
- Docs: this spec, README.md and the active Work Log. Backlog/domain/SSoT updates occur only in their authorized phases.
- Protected non-targets: Claude/Codex hooks, src/systems/classify.js, store, movement, frontend/locales and package dependency manifests.
- Frozen overlap: docs/specs/subagent-helper-huddle.md lists server.mjs for helpers passthrough. On 2026-10-19 the owner explicitly authorized a limited implementation-time unfreeze solely to check observer start/stop wiring while preserving helpers behavior. Claude must record this authorization, set that spec to draft only when entering the affected work, and re-freeze after alignment; broader helper changes still require scope amendment. This planning session leaves that frozen file unchanged. Before README edits consult repo-gotchas section 1 for pinned phrases.

### Verification Commands and Expected Results

1. npx vitest run tests/antigravityWatcher.test.js tests/geminiHook.test.js tests/geminiSetup.test.js tests/googleAdaptersServerIntegration.test.js tests/scanSessions.test.js tests/codexHookContractParity.test.js — all pass; removing root/expiry/startup protections makes focused tests fail.
2. npm test — zero failures, no weakened assertions/new skips. Verify Windows paths/quoting and the existing POSIX/Git Bash cases; native Linux execution is an owner-accepted unverified delivery limitation.
3. npm run build; node scripts/bundle-budget.mjs — clean build, within existing budget; no observer in browser bundle.
4. npm run smoke:pack — existing package smoke passes; additionally execute both adapters from an extracted npm tarball with temporary roots, proving no repository-only imports.
5. npm run smoke; npm run smoke:panel — regression with isolated status directory, OFFICE_ANTIGRAVITY_MODE=off and existing fallback disabled. These are not proof of real Google integration.
6. pwsh -File .agentcortex/bin/validate.ps1 — zero failures after final writes; explain warnings.
7. Record available source versions and observations without raw prompt/command capture. Retain Antigravity's real read->neutral evidence and Gemini CLI 0.64.0 executable/version evidence. Authenticated Gemini work/permission, additional real-device scenarios and native Linux execution are not required for this delivery under the explicit owner amendment; report them as unverified limitations.

### Risks and Rollback

- Antigravity private format and silent work: fail neutral with redacted diagnostics; disable OFFICE_ANTIGRAVITY_MODE=off. Do not fabricate liveness or add intrusive hooks as an unapproved fallback.
- Gemini hook latency: bounded processing/no network/nested agents. Explicit project install only; uninstall removes owned registrations/script. Restore configuration from pre-install backup when needed.
- Windows/concurrency failure: drop publication after bounded retries, preserve existing JSON and allow TTL expiry. No lock weakening, partial JSON writes or deletion of another producer.
- Code rollback reverses this feature's hunks only, preserving inherited dirty backlog/spec/audit, all untracked/gitignored files and user settings. No reset/clean or recursive deletion.

## Domain Decisions

- [DECISION] One feature delivers two platform-specific adapters; shared branding does not imply shared protocol.
- [DECISION] Antigravity desktop uses passive observation; Gemini CLI uses explicit project hook installation.
- [CONSTRAINT] Existing contract/scanner own the UI-facing path; no fabricated done/planning/workflow/approval signals.
- [CONSTRAINT] Identity includes platform, canonical project root and source session.
- [TRADEOFF] Bounded observation and 15s neutralization can miss silent work; honest neutral wins over manufactured freshness.
- [CONSTRAINT] Raw source text is neither persisted nor executed; fixtures are synthetic.
- [TRADEOFF] Standalone Gemini mirrors small rules under parity tests to avoid side-effectful hook imports and premature abstractions.
- [CONSTRAINT] Both server paths and packed runtime need automated evidence before delivery; unavailable live-source/platform validation stays explicitly unverified under the owner-approved delivery scope.

## Claude Resume

Ready for /implement subject to normal phase-entry gates and freezing this draft. No application code changed. Branch feat/antigravity-gemini-hook, baseline 460d71d. Preserve all inherited dirty files. Active evidence: .agentcortex/context/work/kbwen-feat-antigravity-gemini-hook.md. The Gemini work log is historical evidence and cannot authorize skipping plan/tests. Acquire the branch lock for the implementing session. This planning checkpoint is not formal post-test handoff or permission to ship.
