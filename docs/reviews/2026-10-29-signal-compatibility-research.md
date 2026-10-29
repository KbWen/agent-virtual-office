# Claude Code / Codex signal compatibility investigation

Date: 2026-10-29 (Asia/Taipei)
Scope: compatibility investigation, isolated producer replay, existing regression tests, official documentation comparison, and owner-triggered live observation. This is research, not an implementation/ship receipt.
Repository: `38980d5c4d8a99af3820aa41b42e2d4abbb75e73`, version 1.6.13.
Installed CLIs: Claude Code 2.1.285; Codex CLI 0.148.0; Node 24.13.1. The desktop app's bundled runtime may differ from the CLI on PATH.

## Conclusion

The existing office transport and explicit Codex status writer work in isolated tests. Claude's normal prompt/tool-success/turn-stop events also work in an owner-triggered live session, but its requested failure produces no blocked state. A separate real Codex desktop turn completes successfully without delivering any new office status. Complete current-event compatibility is **not established**: several error/approval paths are missing or read the wrong field, the installed global Claude hook is older than the repository copy, and native Codex observation is not wired in the inspected setup.

The initial inspection found no fresh status file for this checkout. The owner subsequently triggered a real Claude session, and its normal prompt/tool/stop signals reached the running server and rendered UI (see Live observation below). The failure-state gap was also observed. Existing unrelated workspace edits were preserved; no application source or installed user configuration was changed.

## Live observation — owner-triggered Claude session

Server: `http://127.0.0.1:5174`, serving current source through Vite. The process uses `OFFICE_DISABLE_FILE_WATCHER=1` so inferred file-edit activity cannot be mistaken for hook delivery. The real home-directory status source remains enabled; no synthetic status was posted into this live run.

Baseline: `/api/health` returned `ok: true`, `hookSessionCount: 0`, `fileWatcherPresent: false`; `/api/status` returned HTTP 200 with null. The page rendered the office and the no-agent-signal message. SSE connected successfully.

Owner trigger: read `package.json`, run a Node process that waits eight seconds then exits 1, then run a successful Node print, without changing files. The owner confirmed the Claude trigger in this chat.

Observed timeline (2026-10-29, Asia/Taipei):

| Time | Observation |
| --- | --- |
| 13:40:44.689 | First SSE snapshot from `claude-cli`; PM working. |
| 13:40:53 | Real Read tool progresses to done; rendered Research status changes accordingly. |
| 13:40:57.570 | Failure-probe PowerShell begins; both Dev and Ops become working. |
| Through the next update at 13:41:10.300 | No blocked snapshot is delivered; Ops remains working. The failed probe has a captured PreToolUse but no registered failure callback. |
| 13:41:12.311 | The subsequent successful PowerShell completes; Dev and Ops become done. |
| 13:41:21.711 | Stop arrives; PM, Research, Ops and Dev are all done in the SSE data and rendered accessibility labels. |

Across this Claude run: 15 SSE status snapshots; zero observed stream errors and zero browser-console errors. Health reports one hook session and no file-watcher fallback. Normal producer -> status file -> server -> SSE -> rendered UI is therefore proven for this session. No blocked state was observed for the requested failing execution; this is not inferred solely from the final done snapshot.

Additional local drift evidence: one PowerShell operation lights both Dev and Ops. The global old hook lacks PowerShell's Ops mapping, while the repository hook maps it to Ops; both settings layers invoke their respective script. Coexisting versions contaminate role attribution even on otherwise healthy delivery.

Only newly appended hook-capture schemas were inspected: event names, tool names, field presence/types and booleans identifying the two requested probes. Raw prompts, command bodies, results and transcript content were not copied into evidence. Captured successful tool results use `tool_response` objects without top-level `is_error`; effort is an object with `level`.

Artifacts:

- `output/playwright/2026-10-29-signals/claude-live-evidence.json` — sanitized SSE timeline, rendered role/status labels and health.
- `output/playwright/2026-10-29-signals/baseline.png` — rendered no-signal baseline.
- `output/playwright/2026-10-29-signals/claude-active.png` and `claude-finished.png` — actual page captures.
- `.agentcortex/context/private/signal-live-capture-schema.json` — local-only schema projection.

## Live observation — owner-triggered Codex desktop session

The owner triggered a second local Codex chat in this exact checkout, without manually invoking an office script or API. The app's read-only chat inspection independently confirms the completed validation turn; its private chat identifier is omitted:

- Turn: 13:43:24–13:43:42 (Asia/Taipei).
- `package.json` read successfully.
- The requested ten-second Node check completed with exit code 0, duration 11,034 ms, output `codex-signal-check`.

The office's SSE observer was already connected before this turn started and stayed connected through 13:44:36, with zero stream errors. Its total remained 15 snapshots, all from the earlier Claude run. `/api/status` retained the exact last Claude sequence `1793252481613`; health stayed OK with one hook session and no file-watcher fallback. There were **zero observed Codex status events**. This establishes missing automatic delivery for this tested desktop setup, not a failed or unexecuted agent command. It does not establish Codex CLI behavior or explain host capability/trust beyond the inspected missing office registration.

Artifact: `output/playwright/2026-10-29-signals/codex-live-evidence.json` contains the sanitized monitor result and independently confirmed synthetic-command outcome. The temporary browser observer was closed after evidence capture. The loopback server remains running for the owner; file-change inference remains disabled only in that server process.

## Findings

### P1 — Tool execution failures are not consumed

Evidence: `bin/cli.js:443`, `public/hooks/hooks-config.json:15`, `public/hooks/office-status-hook.js:1095`, `public/hooks/office-status-hook.js:1357`.

Neither registration nor the event switch includes `PostToolUseFailure`. Replaying `UserPromptSubmit -> PreToolUse(Bash) -> PostToolUseFailure` leaves the responsible ops agent `working`, rather than reporting a failure. This can persist until another event or client staleness/inference logic changes the display. Merely registering the event would not fix the missing handler.

### P2 — API failure reasons read a configuration concept as an input field

Evidence: `public/hooks/office-status-hook.js:1212`; `tests/avo148StructuredErrorReasons.test.jsx:195`.

The handler reads `event.matcher`. Replays with `StopFailure.error = rate_limit` and `authentication_failed` both produce `blocked-unknown`, losing the specific reason. Existing tests supply `matcher`, so their passing result does not validate the documented payload. The repository does still mark active agents blocked; the older installed global hook ignores this event entirely.

### P2 — Permission waiting is not observed; denial coverage is narrower than the integration guide implies

Evidence: `bin/cli.js:443`, `public/hooks/office-status-hook.js:1179`, `docs/INTEGRATIONS.md` Claude hook section.

`PermissionRequest` and permission-prompt notifications are not registered/handled. Replaying a permission request after `PreToolUse` leaves the agent `working`. The repository's `PermissionDenied` replay correctly reports `permission-denied`, but that event should not be interpreted as coverage for every denial path.

### P1 locally — Global installation has drifted behind the project

The global settings contain six office event registrations targeting the installed home-directory script. That script differs from the repository bytes and lacks `PostToolUseFailure`, `StopFailure`, `PermissionDenied`, and dual-reading of `tool_response`.

Project-local settings contain eight registrations pointing at the repository-relative script, including `StopFailure` and `PermissionDenied`. Both settings layers are present; the project-local configuration does not update the global script used elsewhere. Both scripts report `HOOK_VERSION = 1.0.0`, so that constant alone cannot detect this drift.

Isolated replay against the installed global script leaves tool failure, rate limit, authentication failure, permission denial and permission request scenarios `working`. Healthy tool completion and normal Stop still work.

### Capability gap — Codex has an explicit office writer, but no native lifecycle adapter here

Evidence: `public/hooks/office-status-codex.js:177`, `docs/INTEGRATIONS.md` Codex sections; local configuration inspected without printing unrelated values.

The adapter consumes office-specific JSON and writes an office status file. All five exercised states (`working`, `blocked`, `done`, `planning`, `awaiting-approval`) survive the real writer and session scanner. It is not a native Codex lifecycle-event parser. No office lifecycle registration was found in the inspected user/project hook locations. The user's existing notify command belongs to computer use, not this office; it must be preserved.

Current official Codex documentation describes lifecycle hooks. The integration's lack of native automatic observation is therefore an adapter/setup opportunity, not evidence that its explicit writer broke after an update. This investigation cannot establish which release introduced any mismatch.

## Official reference comparison

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks): successful calls use `PostToolUse`; execution failures use `PostToolUseFailure`. `StopFailure` identifies the API failure in `error`. `PermissionRequest` signals approval requests, while `PermissionDenied` is limited to auto-mode denials. These documented shapes informed the synthetic replays.
- [Official Codex hooks reference](https://learn.chatgpt.com/docs/hooks): supports lifecycle hooks, JSON/TOML hook locations, and review/trust requirements. Availability and trust in the actual desktop runtime still require live validation; no hooks were installed during this investigation.

## Verification

Existing tests: **492 passed across 12 files** (466 in ten producer/scanner/client files, 26 in two real-server HTTP files).

```powershell
# Use a fresh home for the entire runner, not just individual hook subprocesses.
$auditHome = Join-Path $env:TEMP ('avo-signal-audit-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $auditHome | Out-Null
$env:USERPROFILE = $auditHome
$env:HOME = $auditHome
node node_modules/vitest/vitest.mjs run tests/hookRuntimeContract.test.js tests/hookEventRegistrationParity.test.js tests/codexHookContractParity.test.js tests/codexHookIsolation.test.js tests/scanSessions.test.js tests/serverTransportE2E.test.js tests/serverProjectRootE2E.test.js tests/statusIntegrationSSE.test.js tests/inferStatusPolling.test.js tests/avo148StructuredErrorReasons.test.jsx tests/applyMessage.test.js tests/statusFieldsDriftGuard.test.js
```

Environment notes: the first attempt exposed an existing test that accesses the real home-directory capture marker; sandbox permissions prevented deletion. Rerunning with the entire runner's HOME/USERPROFILE isolated passed all ten non-HTTP files. Loopback fetch separately reproduced sandbox `EACCES`; the two HTTP suites then passed with approved loopback access and temporary homes. Their earlier readiness errors are environmental, not evidence of a transport regression. No raw user capture data was read or included.

Additional compatibility probes: 19 isolated scenarios, covering seven events against each Claude script plus five Codex writer-to-scanner states. Repository Claude: three match the target behavior, four expose the gaps above. Installed Claude: two match, five expose gaps. Explicit Codex: five match. These probes demonstrate missing behavior; they are not included in the 492 passing regression-test count.

Local reproducibility artifacts (gitignored):

- `.agentcortex/context/private/signal-compatibility-probes.cjs` — run from this checkout with Node; each producer receives a fresh temporary home.
- `.agentcortex/context/private/signal-compatibility-probes.json` — sanitized expected/actual results.
- `.agentcortex/context/private/signal-compatibility-tests-isolated.json` — 466 passing tests; two HTTP setup failures before loopback approval.
- `.agentcortex/context/private/signal-compatibility-http-tests.json` — 26 passing HTTP tests after loopback approval.

## Recommended implementation order

1. Add failure-event registration and handling, with fixtures from the documented schema and focused regression cases. Treat interruption distinctly from a failed execution; keep unknown error reasons conservative.
2. Read `StopFailure.error`, test actual error-shaped payloads, and define deliberate compatibility handling for older producers.
3. Add observational approval-waiting events without returning approval/denial decisions. Account for notifications and the limited scope of auto-mode denial events.
4. After source fixes pass review, synchronize the installed Claude script and global event list while preserving unrelated hooks/settings. Version/hash evidence must distinguish old installations.
5. Implement a separate Codex-native event adapter and setup path, preserving the existing computer-use notify command and respecting hook trust. Verify actual desktop and CLI emissions separately.

Implementation and settings changes remain follow-up work. Live acceptance after any fix must cover the failed-tool path and actual Codex delivery; live API-error, approval and Codex CLI scenarios remain untested.
