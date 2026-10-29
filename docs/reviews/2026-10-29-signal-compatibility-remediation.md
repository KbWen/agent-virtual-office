# Signal lifecycle remediation — implementation and acceptance evidence

Date: 2026-10-29 (Asia/Taipei)
Spec: [signal-lifecycle-compatibility](../specs/signal-lifecycle-compatibility.md)
Baseline: [compatibility investigation](2026-10-29-signal-compatibility-research.md)

## Status

Application changes are implemented, independently reviewed and regression-tested. Real Claude failure and native Codex delivery are verified. The owner-approved Domain Decisions correction is complete and the spec is frozen again; its document contract passes. The seven existing generated-output line-ending failures were normalized without changing content under the owner's release authorization; whole-repository validation now passes. Merge, tag and GitHub publication remain pending exact-head CI.

Implementation was delegated to `gpt-6-luna` subagents. The primary performed integration checks, independent-review coordination, tests and actual installation. Fresh reviewers derived defects from the diff/spec independently; proven findings were corrected and regression-tested.

## Delivered behavior

| Area | Result |
| --- | --- |
| Claude failures | Registers/handles `PostToolUseFailure`; attributed failures become blocked without leaking error text. Interrupt evidence is neutral. |
| Claude API errors | Uses documented `StopFailure.error`; precise supported enums map to existing reasons, unknown remains unknown. Legacy matcher is fallback only when error is absent. |
| Approval | `PermissionRequest` observes awaiting-approval without making a decision; auto denial remains distinct. Generic notifications/idle do not invent an actor or approval. |
| Closure/late events | Hashed prompt/session ownership, locked rechecks and retry guards reject stale callbacks. SessionEnd needs matching ownership. Stop preserves blocked/waiting/interrupted-idle instead of fabricating a successful recovery. |
| Codex native producer | Six project-local lifecycle registrations, hashed root-session files, validated turn IDs, bounded input, fixed private labels and existing normalized transport. Native Stop/session end are idle; explicit manual done input is preserved. |
| Installation | Verified legacy Claude migration, exact duplicate removal, third-party hook retention, safe quoted paths, staged copies, versioned native-file ownership, verified backups and rollback/update/uninstall/reinstall tests. |
| Honest inference | Blocked no longer becomes awaiting-approval after silence. Working-to-thinking remains a documented heuristic. Native role switches retire former roles; API single/multi representation changes retire only prior API-owned identities, preserving manual updates and peer sessions. |
| Subagents | A verified new Claude owner retires old roles and drops the previous owner's helpers; same-owner prompts preserve current helpers. Late old-owner callbacks cannot clear the new helper. Separate source files retain peer helpers. Codex native observes one root representative and deliberately ignores child events. |
| Privacy | Claude and explicit Codex helper errors use fixed diagnostics, preventing malformed-input parser excerpts from exposing payload text. Native Codex metadata remains bounded and excludes prompts, arguments and outputs. |

The existing office layout, roles, movement, dialogue, notifications policy and dependency declarations are unchanged. Status inference and source identity cleanup were corrected without adding UI or telemetry surfaces.

## Verification

- Final full Vitest: **3050 passed, 0 failed, 3 existing skips across 175 files**, using `--maxWorkers=2`, isolated HOME/USERPROFILE and temporary installer projects, with loopback HTTP permitted. An earlier concurrent pack/full run hit a five-second watcher-test timeout; the bounded run executes every test without changing timeouts or skipping cases.
- Pack smoke: **all five assertions passed**: eleven Claude registrations, repeat setup without duplicates, packed native Codex setup/emission, standalone hook and quick-start server.
- Build: successful after the inference correction; syntax checks and `git diff --check` pass. The pre-existing bundle-size warning remains.
- The initial complete run exposed one pre-existing watcher test using a fixed 20 ms wait. The test now waits for actual lock cleanup and asserts zero publication attempts; watcher production code is unchanged. Focused watcher suite: 38 passed.
- Existing CLI tests now isolate project cwd as well as user home; an invariant confirms the real checkout settings are unchanged by test execution.
- A stale store test assumed successive successful probes occur within the same millisecond. The test now controls the clock and verifies both duplicate suppression and renewal of freshness at a later time; store production behavior was not changed.
- Final mixed-source/subagent/inference focus: **150 passed** across seven files. Tests cover real scanner/router/store transitions, two-session peer preservation, manual/API incremental updates, old-owner child callbacks and same-owner helper preservation.

Local final reports are gitignored under `.agentcortex/context/private/`: `signal-final-full.json`, `signal-final-pack.log`, `signal-mixed-focused.json`, `signal-config-preservation-final.json` and `signal-governance-final.log`. Earlier baseline/install evidence is retained.

## Installed-state verification

- User Claude script is byte-identical to tested source (`HOOK_ID = agent-virtual-office/claude-hook`, version 1.1.0).
- The exact former legacy bytes are preserved in a verified backup. The nominated SHA-256 matched before migration, including CRLF bytes.
- All eleven Claude events have exactly **one** office callback. The old project-relative duplicates and the six old unquoted global-command duplicates are removed; unrelated hooks remain.
- Native Codex project configuration has six core events and both installed scripts match tested source.
- Initial setup preserved Codex `config.toml` byte-for-byte. It later gained six native trust records through host/user activity; the modification time predates the last setup. A final repeat setup at 15:58Z independently verified unchanged whole-file hash and modification time (`signal-config-preservation-final.json`). The installer never edits `config.toml`, trust or `notify`; automation did not approve hooks.
- The previously enabled Claude raw-capture marker was reversibly disabled; existing marker and capture files were preserved. Normal use keeps raw capture off. READMEs distinguish raw-capture risks, local metadata and the fact that API tokens protect writes, not status reads/SSE.
- The loopback server remains at `http://127.0.0.1:5174`, with file-edit inference disabled for this validation process so it cannot manufacture hook evidence.

## Independent review disposition

Corrected findings include: cross-session/late callback writes, neutral Stop semantics, partial-copy cleanup, package-version ownership/update/uninstall behavior, unverified/missing backup provenance, compact-JSON reinstall, malformed turn IDs, CRLF legacy recognition, and the actual unquoted legacy global command variant.

The final targeted review found no remaining actionable defect in source ownership, helper isolation, representation retirement, fixed diagnostics or documented privacy boundaries. Final full-suite verification passed after all source/test changes.

Whole-repository governance validation is distinct from application tests. The missing mandatory Domain Decisions section was corrected with explicit owner approval on 2026-10-30, using nine labeled entries that restate existing decisions; the spec was re-frozen without changing acceptance criteria or interfaces. Its document contract and entry cap pass. The remaining failure is mixed line endings in seven pre-existing Python output artifacts under `output/playwright/2026-10-24-cozy-merge/`. The owner subsequently authorized fixing remaining release blockers. Their line endings were normalized only; normalized content hashes and BOM state were preserved. They remain untracked and are excluded from the release commit. Whole-repository validation:115PASS/5WARN/0FAIL/5expected environment skips.

## Remaining live checks and limitations

1. Real Claude failure became blocked at 16:00:16.892Z; the source Stop write at 16:00:24.128Z retained the failed ops role. SSE and rendered status still showed blocked 149,961 ms after first failure, exceeding the former 90-second false-approval threshold. Evidence: `output/playwright/2026-10-29-signals/final-live-retention-evidence.json` and `claude-blocked-over-90s.png`. No raw capture was needed.
2. Real Codex desktop lifecycle events now reach the same loopback server, including working, approval waiting and idle. Earlier source-neutral idle callbacks are saved in `codex-native-live-before-retirement.json`; the final monitor records role retirement and concurrent Claude/Codex delivery with zero stream errors. No manual status helper/API injection or file-watcher inference was used as native evidence.
3. Live API rate-limit/authentication and deliberate approval-dialog scenarios are not induced; their schema behavior is covered by focused tests. Multi-source representation and subagent takeover corrections also have focused real-store/temporary-file regressions.

Codex is one root-thread representative per native session, not invented child-agent roles or huddles. Native PostToolUse does not assert undocumented success/failure details. Claude's branch/cwd-shared file uses the latest verified owner; multiple Claude chats in that same scope are not independent sources. Claude thinking remains a time-based inference; compaction/informational events do not produce invented office work. Interrupt paths without a supported callback remain unobservable.

## Recovery

Preserve verified original/prior-version script backups and native ownership metadata. Restore only the matching owned script/registration changes after verifying hashes; retain unrelated settings and all pre-existing workspace changes. Native project uninstall uses ownership/reference checks. No destructive checkout/reset/clean or broad directory deletion was performed.
