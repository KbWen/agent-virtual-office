---
status: shipped
title: Signal lifecycle compatibility for Claude Code and Codex
source: internal
created: 2026-10-29
updated: 2026-10-30
primary_domain: hook-integration
secondary_domains: []
---

# Signal lifecycle compatibility

## Goal
Restore honest observation of real agent work, failure and waiting states after upstream and installation drift, and wire supported native Codex lifecycle events into AVO's existing transport. Preserve the calm office, privacy and existing manual integration routes.

## Acceptance Criteria
- AC-1: Claude PostToolUseFailure is registered and attributed consistently with PreToolUse (including PowerShell, file routing and skill context); genuine failures become blocked with conservative existing reason codes. Interrupt evidence never fabricates a failed or successful task. Successful PostToolUse behavior remains compatible.
- AC-2: Claude StopFailure reads the documented error enum for rate_limit/authentication_failed and unknown errors. Documented error takes precedence over any explicitly supported legacy matcher field; no raw error text is published.
- AC-3: Claude PermissionRequest produces awaiting-approval for the attributable tool role without returning any decision. PermissionDenied remains auto-mode-only evidence. Permission notifications without reliable role attribution do not invent a responsible actor. Pending work clears/resumes on subsequent genuine lifecycle events.
- AC-4: Claude SessionEnd neutralizes that source's session state and helpers without counting completion; unknown events, compaction, informational notifications and malformed payloads do not fabricate working/done/approval. Document remaining unobservable interrupt paths rather than guessing.
- AC-5: Native Codex prompt/tool/permission/Stop/Interrupt/SessionEnd events use a separate adapter feeding the current office-status schema and session scanner. Per-session files do not collide with Claude or other Codex sessions. Unattributable child events must not finish a parent session. Unknown tools use fixed generic labels; arguments, patch bodies, prompts, output and transcript contents are not persisted. Tool completion alone is not claimed as business-task success; undocumented error shapes remain unknown.
- AC-6: Project-local Codex setup/uninstall merges only identifiable owned hooks/scripts, is idempotent, preserves all unrelated JSON/TOML settings and the existing notify command, rejects ambiguous/malformed/unsafe paths without partial settings writes, and explains native trust/reload requirements without bypassing them.
- AC-7: Claude installation refreshes the owned installed script/event list and resolves the proven old/global plus repository/local duplicate while preserving unrelated hook handlers/settings. Modified foreign content is retained; upgrade/rollback has verifiable backups/ownership evidence. Hook identity/version evidence distinguishes stale copies.
- AC-8: Tests exercise actual current event shapes, error paths, boundaries, source isolation, concurrent/late callbacks, installer repeat/uninstall preservation and privacy. Existing full tests/build/pack checks pass. Server/SSE/rendered-state acceptance covers owner-triggered Claude failure and normal completion, plus actual Codex delivery once its native hook trust is satisfied. Unavailable live paths remain explicitly unproven.

## Constraints
- ADR-003: one normalized transport and existing UI; retain explicit office-status-codex.js input format.
- ADR-006/008: honest ambient visualization; no cost/analytics/debug dashboard, new UI chrome, fake need, fabricated work/success or all-event collection.
- Existing eight roles and six transport statuses remain unchanged. Thinking is an existing inference, not newly relabeled as direct upstream evidence.
- Native hooks observe only: no approval decisions, control JSON, arbitrary shell execution from payloads, trust edits or permission bypasses.
- Codex models one root-thread status per source session. SubagentStart/SubagentStop do not create invented office roles or finish the parent. Core setup events are UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, Stop and SessionEnd. Optional Interrupt payloads neutralize rather than complete; do not register unsupported events on an older runtime.
- Codex PostToolUse confirms a callback, not success: preserve active work unless structured result evidence is explicitly validated. Do not guess failure from arbitrary tool output text. Document this limitation until live schema evidence permits a narrow extension.
- Bound input, writes and callback latency. Use existing atomic status conventions and privacy-safe fixed diagnostics. Tests isolate HOME/USERPROFILE; live tests never inject synthetic status into real producer state.
- No unrelated refactor, dependency/version upgrade, movement/visual change or alteration of user-owned baseline files.

## Domain Decisions
- [DECISION] Claude and Codex producers use the existing normalized office-status transport and UI; producer files remain separate to prevent collisions.
- [CONSTRAINT] Native integrations observe events only. They do not decide approvals, modify trust/notify settings, or bypass platform consent.
- [CONSTRAINT] The native Codex adapter persists only bounded, fixed status metadata; it does not persist prompts, arguments, patches, output, transcript contents, or raw session IDs.
- [DECISION] Claude's supported lifecycle evidence includes tool/subagent work, attributable approval waits, reported failures, turn end, and session end; unsupported paths remain gaps.
- [DECISION] For a Claude branch/working-directory lane, the latest verified session owns its visible state; handoff drops the previous owner's helpers and stale roles, and stale callbacks must not revive them.
- [DECISION] Codex native status represents one root thread per session. Child events do not create office roles or finish the parent; separate producers remain isolated and merge as session representatives.
- [CONSTRAINT] Approval requires attributable lifecycle evidence; PermissionDenied is auto-mode-only, and idle/notification signals do not imply approval.
- [CONSTRAINT] Tool callback completion and Stop are not business-task success. Thinking remains an elapsed-time inference, not direct upstream evidence.
- [TRADEOFF] Keep coverage honest and partial: do not fabricate work, failure, success, approval, or unsupported cross-provider child-agent visibility.

## Non-goals
- Listen to every platform event regardless of whether it proves an office state.
- Infer human approval from idle notifications, failure from arbitrary output text, or overall task success from Stop.
- Change existing subagent/huddle appearance, frozen visual specifications or role meanings.
- Replace Codex's existing notify infrastructure or automate native hook trust consent.

## Interface Contracts
- Claude: stdin current hook-event JSON; existing file-backed office-status writer with source claude-cli. New event cases reuse existing role routing, locks and stale-event guards.
- Codex: standalone public/hooks/office-status-codex-hook.js reads one bounded stdin native JSON event. Reuse public/hooks/office-status-codex.js normalization without altering its explicit input API; installation copies both scripts together. Native files use source codex-cli, a one-way hash of cwd plus session_id, and a separate office-status-codex-hook-* namespace. Each root thread has one representative agent, fixed tool/role labels, numeric fresh sequence and exact cwd scoping. No raw session id in the filename, no raw payload content in emitted metadata.
- CLI: existing bare setup/uninstall remains Claude; explicit --platform codex selects project-local native Codex setup/uninstall. Gemini routes are preserved.
- No new HTTP endpoint, status enum, role enum, browser injection or rendering path.

## Evidence and Validation
- Baseline report: docs/reviews/2026-10-29-signal-compatibility-research.md.
- Official schemas: https://code.claude.com/docs/en/hooks and https://learn.chatgpt.com/docs/hooks.
- Focused Red/Green regressions, full Vitest suite, build, pack smoke, independent security/honesty review, then live server/SSE/UI acceptance.

## Risks and Rollback
- Multiple callback processes can race; do not share files across independent producers/sessions or skip read-modify-write locking.
- Installer ambiguity or edited owned content must fail closed; no wholesale replacement of user settings. Keep rollback limited to proven owned changes and include local/ignored installed state.
- Native hook trust and actual desktop runtime capability require user action/live evidence. CLI feature reporting alone is insufficient.
- Restore only this feature's application hunks and exact installer-owned files/entries; retain all unrelated dirty/untracked state.

## Implementation Plan
1. Claude adapter + focused tests: public/hooks/office-status-hook.js; tests/claudeLifecycleCompatibility.test.js; update affected test fixtures/assertions only where the documented error field is now authoritative. Verify real failing schema cases are red before production changes and green afterward.
2. Codex adapter + focused tests (independent of step 1): public/hooks/office-status-codex-hook.js; tests/codexNativeHook.test.js. Read and reuse the existing explicit writer and scanner contracts. Verify root-session isolation, unknown/malformed events, bounded input, privacy, working/waiting/stop/session-end and late-callback behavior.
3. Installer and registration integration (after adapter contracts): bin/cli.js; public/hooks/hooks-config.json; .claude/settings.json only if tracked and needed to eliminate its known owned duplicate; tests/cliSignalSetup.test.js and affected existing setup/parity tests. Preserve third-party handlers and config values. Verify idempotence, partial failures, symlinks, path quoting, backup/ownership and uninstall.
4. Synchronize only relevant event tables/integration instructions in README.md, README.zh-TW.md, docs/INTEGRATIONS.md, .codex/INSTALL.md and tests/hookEventRegistrationParity.test.js. No unrelated prose or branding changes.
5. Primary independently reviews security/honesty and integration; run full Vitest/build/pack smoke with temporary homes. Then install the exact tested local hooks, obtain native runtime trust through its normal user flow if required, and repeat server/SSE/UI acceptance with the owner. Persist remaining platform/runtime limits explicitly.

## Acceptance Mapping
- Step 1: AC-1, AC-2, AC-3, AC-4.
- Step 2: AC-5.
- Steps 3-4: AC-6, AC-7.
- Step 5 plus each task's regressions: AC-8.
- Confidence: 92% — upstream schemas and proven reproductions cover design; desktop trust and callback delivery are explicit live acceptance risks.
