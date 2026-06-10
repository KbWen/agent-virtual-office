---
status: shipped
title: AVO-153 — Hook-runtime payload fixture corpus + contract tests
created: 2026-06-10
last_updated: 2026-06-10
---

# AVO-153 — Hook-Runtime Contract (real-event fixtures)

## Problem

The hook's behavior is keyed on Claude Code's hook-event payload shapes (`hook_event_name`,
`tool_name`, `tool_input.command/file_path`, `tool_response.is_error`, token-usage transcript
shapes, `permission_mode`, …). Those assumptions are encoded ONLY in hand-written test payloads —
the H5 research showed docs and runtime can disagree (docs describe a `PostToolUseFailure`-era
schema while the runtime hook relies on `is_error`). When Claude Code updates its payloads, the
office degrades silently. Turn the runtime truth into a TESTED contract built from REAL captured
events.

## Acceptance Criteria

- **AC-1 Capture mode (hook)**: opt-in via marker file `~/.claude/office-hook-capture` — when
  present, the hook appends the raw stdin event as one JSON line to
  `~/.claude/office-hook-capture.jsonl` BEFORE processing. Fully try/catch'd; zero cost and zero
  behavior change when the marker is absent (drift guards + suite stay byte-green); capture
  failures never affect processing. Documented in the hook header + README.
- **AC-2 Sanitizer** `scripts/sanitize-hook-capture.mjs`: converts a capture .jsonl into
  shape-preserving fixtures — keeps structure, key names, enum-ish fields (`hook_event_name`,
  `tool_name`, `permission_mode`, booleans, numbers as representative literals); REDACTS
  free-text values (commands, prompts, file paths → fixed placeholders preserving type and
  rough length class). Dedupes by (hook_event_name, tool_name) shape signature.
- **AC-3 Real fixtures committed** at `tests/fixtures/hook-events/*.json` — captured from a real
  Claude Code session in THIS repo (the hook runs from the working tree, so enabling the marker
  during the implementing session captures live events), sanitized via AC-2, human-reviewed for
  residual sensitive strings before commit. Minimum corpus: PreToolUse (Bash + a file tool),
  PostToolUse (success; failure/is_error if one occurs), UserPromptSubmit, Stop. SubagentStart/
  SubagentStop/PermissionDenied/StopFailure included IF observed (do not fabricate — absent
  events are listed as "not yet captured" in the fixture README).
- **AC-4 Contract tests** `tests/hookRuntimeContract.test.js`:
  (a) SHAPE contract: for each fixture, assert the fields the hook actually reads exist with the
  expected types (derive the read-list from the hook source — e.g. `tool_name` string,
  `tool_input.command` string for Bash, `tool_response` presence semantics). A Claude Code
  payload change shows up as a fixture-vs-hook mismatch when fixtures are re-captured.
  (b) BEHAVIOR contract: spawn the REAL hook (stdin pattern from pack-smoke/hookWriteLock) with
  each fixture against an isolated OFFICE_STATUS_FILE; assert exit 0 and the expected status-file
  effect (role mapping, status value) per event type.
- **AC-5** Full suite green; capture marker absent in CI (capture path untested-by-default is
  fine — its no-op path IS exercised by every other hook test); fixture README documents the
  re-capture procedure (enable marker → use Claude Code normally → sanitize → review → commit).

## Non-Goals

- Capturing across other machines/versions (one runtime's truth now; re-capture procedure covers
  updates).
- Fabricating fixtures for events never observed (honesty: absent = documented absent).

## Risks & Rollback

- **Privacy**: raw captures contain prompts/commands → sanitizer + mandatory human review before
  commit; raw .jsonl stays in ~/.claude (never in the repo); .gitignore the capture filename
  defensively.
- **Rollback**: capture block is ~10 lines in the hook; fixtures/tests are additive files.
