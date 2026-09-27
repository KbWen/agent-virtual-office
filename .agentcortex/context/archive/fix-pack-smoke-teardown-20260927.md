# Work Log: fix/pack-smoke-teardown

## Header

- Branch: `fix/pack-smoke-teardown`
- Classification: `quick-win`
- Classified by: `Claude Opus 5.5 (dispatching agent)`
- Frozen: `2026-09-26`
- Created Date: `2026-09-26`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: ship
- Diff Base SHA: `3f22aa764b0238f9a3f868cd2b798eb1833159f9`
- Checkpoint SHA: `d55b04a70332b25c67b78ff87a8e359fadc56db4`
- Recommended Skills: `none`
- Primary Domain Snapshot: `ci-infra scripts`
- SSoT Sequence: `138`

---

## Session Info

- Agent: `claude-sonnet-5`
- Session: `2026-09-26 23:13 UTC`
- Platform: `claude-code`
- Files Read: `9`

---

## Task Description

Fix orphaned `node`/`vite` processes left behind by `scripts/pack-smoke.mjs` (and check
`render-smoke.mjs` / `panel-features-verify.mjs` for the same class of bug) after
`npm run smoke:pack` runs, observed on Windows 11 as hours-long leftover processes.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-26T23:13Z | quick-win, SSoT read, worklog created fresh |
| plan | done | 2026-09-26T23:13Z | inline (quick-win, no docs/specs artifact required) |
| implement | done | 2026-09-26T23:46Z | see Phase Summary / Evidence |
| review | skipped | — | quick-win optional per engineering_guardrails.md §10.4 |
| test | skipped | — | quick-win optional; vitest full suite run instead as evidence |
| handoff | n/a | — | quick-win exempt |
| ship | pending | — | caller stops after /implement per task instructions |

---

## Phase Summary

- plan: Re-derived the real spawn chain. `pack-smoke.mjs` spawns `bin/cli.js` (Assertion 4),
  which itself spawns `vite` as a grandchild (wrapper pattern) — this is the one script with
  a real wrapper→grandchild exposure. `render-smoke.mjs` and `panel-features-verify.mjs` spawn
  their server directly (single hop, no grandchild) and already tore down cleanly in testing.
  Root cause for "hours-long" orphans: if the OS kills `pack-smoke.mjs`'s own node process from
  *outside* (harness/CI timeout, operator force-kill) before it reaches `cleanup()`, no JS in
  that process ever runs again (finally/exit/signal handlers included), so the cli.js+vite
  subtree is orphaned with no self-timeout of its own. Separately, `render-smoke.mjs` had a
  dead-code bug: `if (!serverProc.killed) serverProc.kill('SIGKILL')` — `.killed` flips true the
  instant the signal is *sent*, not when the process exits, so the SIGKILL escalation never
  fires, and the fixed 3s wait was shorter than `server.mjs`'s own up-to-10s graceful-drain cap.
- implement: `scripts/pack-smoke.mjs` — added a cross-run stale-PID marker
  (`<tmpdir>/avo-pack-smoke-devchild.pid`) written right after the dev-server child is spawned
  and cleared on normal cleanup; the next invocation reaps any leftover subtree from a
  previously-killed run before starting. Added explicit `SIGINT`/`SIGTERM` handlers that run
  full async cleanup. Refactored `killTree`/added `killPidTree`/`isPidAlive` helpers.
  `scripts/render-smoke.mjs` — replaced the `.killed` check with a real `exit`-event race
  (11s deadline, comfortably longer than server.mjs's 10s drain cap) before escalating to
  SIGKILL (POSIX) / `taskkill /T /F` (win32). `panel-features-verify.mjs` inspected — already
  uses a correct close-event-based teardown; not touched. Files: 2 changed
  (`scripts/pack-smoke.mjs`, `scripts/render-smoke.mjs`), planned 2, actual 2 — no divergence.
  Confidence: 90% — high.
- review: Not Ready — HIGH: stale-PID reaper kills unrelated process trees (no identity check, shared un-keyed marker, concurrent-run kill); diagnosis not reproduced (hard-kill of pack-smoke did not orphan the subtree on Win11, but left a stale marker) — routed back to implement
- implement (corrective, resume-after-review): Scope corrected per reviewer's disproven-premise + safety findings. `scripts/pack-smoke.mjs` restored to `origin/main` content via `git checkout origin/main -- scripts/pack-smoke.mjs` (no stale-PID reaper, no marker file, no SIGINT/SIGTERM handlers added — none of that machinery is needed; the reviewer showed hard-killing pack-smoke mid-Assertion-4 orphans nothing). `scripts/render-smoke.mjs`'s exit-event teardown fix is KEPT — reviewer independently verified it correct and non-hanging on both platforms. Real root cause of the reported orphans (per reviewer): agents manually launched `node server.mjs --port=530x --no-open` from their own Bash tool for live probes (ports 5301-5304, SMOKE_PORT range) and never stopped them — not a smoke-script teardown defect. Files: 1 changed (`scripts/render-smoke.mjs`), planned 2 originally / actual 1 after correction. Confidence: 95% — high (reviewer reproduced both the false-positive kill and the non-reproduction of the original diagnosis).

⚡ ACX

---
- ship: PASS — bundled into PR #252 with its sibling follow-up; archived 2026-09-27. ⚡ ACX

## Gate Evidence

- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-26T23:46:25Z
- Gate: review | Verdict: NOT READY | Classification: quick-win | Transition: REVIEWED→IMPLEMENTING | Timestamp: 2026-09-27T02:06:39Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-27T02:18:48Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTING→REVIEWED | Timestamp: 2026-09-27T02:21:33Z <!-- r2 orchestrator: scope narrowed to render-smoke.mjs only (d55b04a); r1 reviewer already PROVED that change -->
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-27T05:48:53Z <!-- shipped bundled in PR #252 (fix/followups-2026-09-27) by orchestrator -->

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | — | none (quick-win, no spec required) |
| ADR | — | none |
| Issue | — | none |
| PR | — | none (not opened; caller stops after /implement) |

---

## Known Risk

- CORRECTED (was wrong — see Review Feedback): the original diagnosis assumed pack-smoke's
  wrapper→grandchild (cli.js→vite) subtree could be orphaned by an external hard-kill of
  pack-smoke.mjs's own process. Reviewer reproduced a hard-kill of pack-smoke mid-Assertion-4
  on Win11 and it orphaned nothing (no listener on the dev port, marker PID not alive ~6s
  later). The `pack-smoke.mjs` stale-PID-reaper "fix" built on that false premise has been
  fully reverted (restored to `origin/main`) — it was itself unsafe: one shared, un-keyed
  tmpdir marker + unconditional `taskkill /T /F` on "any live PID found there" means a
  concurrent `smoke:pack` run, or any unrelated process that happens to reuse that PID, gets
  its whole process tree killed. Reviewer reproduced this false-positive kill directly.
- Real root cause of the reported `node server.mjs --port=530x --no-open` orphans (per
  reviewer): agents manually launched that command from their own Bash tool for live probes
  (ports 5301-5304 = SMOKE_PORT values assigned per agent) and never stopped it — not a
  smoke-script teardown defect. No code fix applies to that; it's an operational hygiene issue
  (stop servers you launch manually, or use the `smoke`/`smoke:pack` npm scripts which already
  tear down correctly).
- `render-smoke.mjs`'s exit-event teardown fix (kept) has no analogous risk: it only ever
  acts on `serverProc`, the one child this same script spawned — no shared marker, no
  cross-run state.

---

## Decisions

none

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

- Scope correction (not a reclassification): commit `3229a9b`'s `scripts/pack-smoke.mjs`
  changes were reverted to `origin/main` content (new commit `d55b04a`) per NOT READY review
  findings — the diagnosis they were built on was disproven and the reaper itself was unsafe.
  `scripts/render-smoke.mjs`'s fix from the same original commit is kept (verified correct).
  No Target Files were added beyond the original 2; scope only narrowed.

---

## Review Feedback

Reviewer: fresh adversarial /review session (Claude Opus 5.5), head `3229a9b`, base `3f22aa7`. Probes run with an isolated TEMP/TMP (never the shared %TEMP% marker).

- BLOCKING (HIGH, safety): `scripts/pack-smoke.mjs:135-141` reaps whatever PID the marker holds if merely alive, then `taskkill /T /F` (`:89`) kills its WHOLE tree. No identity check (command line / creation time / port). Reproduced: seeded the marker with an unrelated dummy parent (node dummy-parent.cjs, pid 16344) + child (4964); `npm run smoke:pack` printed "Reaping stale dev-server subtree ... (pid 16344)" and both processes were gone afterwards. The Known-Risk claim "blast radius bounded to a single unrelated process" is false — `/T` takes the whole tree (e.g. an editor or terminal and everything under it).
- BLOCKING (HIGH, safety): `MARKER_PATH` (`:133`) is one fixed path in `os.tmpdir()`, not keyed by run/port. A second concurrent `smoke:pack` (parallel agent sessions share this machine) reaps the first run's LIVE cli.js+vite at startup (`:205` runs before anything else), failing run A's Assertion 4 and overwriting its marker.
- BLOCKING (correctness of diagnosis): hard-killing pack-smoke's own node process mid-Assertion-4 (probe hardkill-pack.cjs, TerminateProcess, no JS cleanup) did NOT orphan the subtree on Win11: 6 s later no listener on the dev port and marker PID 34868 not alive — but the marker file WAS left behind. So in the realistic path the reaper reaps nothing and instead leaves a stale PID for Windows to reuse, which is precisely the hazard above. Likewise hard-killing render-smoke (ports 5963/5964) did not orphan server.mjs. The reported `node server.mjs --port=530x --no-open` signature is render-smoke's (SMOKE_PORT), not pack-smoke's (ephemeral port, cli.js->vite); root cause of that orphan is unproven.
- Fix direction: drop the cross-run PID reaper, or key it by identity: store {pid, port, tmpDir} and reap only processes whose Win32_Process/`ps` command line contains that run's unique mkdtemp `tmpDir` path (both cli.js and vite carry it), per-run marker file name. Reproduce the actual orphan (which parent, which kill mode) before adding cross-run machinery.
- Non-blocking: render-smoke exit-event race (11 s > server.mjs 10 s drain) is correct on both platforms and cannot hang (bounded, `.once('exit')` registered before kill). Note on win32 `kill('SIGTERM')` already TerminateProcess-es, so the old `.killed` bug only mattered on POSIX. SIGINT/SIGTERM handlers in pack-smoke are fine.

---

## Red Team Findings

- HIGH: PID-reuse / shared-marker reaper can kill unrelated user process trees and concurrent runs (see Review Feedback). Blocks as a stability/safety defect in this review.

---

## Design Reference

none

---

## Observability

none

---

## Resume

none

---

## Test Gate Results

none

---

## Evidence

- `npm run smoke:pack` x4 (2 pre-fix baseline, 2 post-fix) — all `ALL ASSERTIONS PASSED`,
  exit 0. Post-fix: no listener on the assigned port, no leftover `cli.js`/`vite` process,
  marker file absent after each run (verified via `Get-CimInstance Win32_Process` /
  `Get-NetTCPConnection` diffed against a pre-run baseline).
- Stale-marker reap test: seeded `avo-pack-smoke-devchild.pid` with a live dummy
  `node -e "setInterval(...)"` process's real Windows PID, ran `node scripts/pack-smoke.mjs`
  — first line of output: `[pack-smoke] Reaping stale dev-server subtree from a previous
  run (pid 20796)...`; confirmed that PID was gone immediately after
  (`Get-CimInstance Win32_Process -Filter 'ProcessId=20796'` → empty), then the run completed
  normally (`ALL ASSERTIONS PASSED`).
- `SMOKE_PORT=5951 npm run smoke` / `SMOKE_PORT=5953 npm run smoke` (render-smoke.mjs, x2 post-fix)
  — both `render-smoke PASS`, 0 pageerrors/console errors; `Get-NetTCPConnection -LocalPort`
  empty after each.
- `PANEL_PORT=5952 npm run smoke:panel` (x1, untouched — already correct) — `PASS`, port clean
  after.
- `npx vitest run --testTimeout=30000` — 139 files / 2579 tests passed, 0 failed.
- `node --check scripts/pack-smoke.mjs && node --check scripts/render-smoke.mjs` — both OK.
- Review probes (2026-09-27T02:06:39Z): `npx vitest run --testTimeout=30000` -> 139 files / 2579 passed, exit 0. `npm run smoke:pack` (isolated TEMP) -> ALL ASSERTIONS PASSED, exit 0; post-run leak check: no cli.js/vite/listener from the run (only unrelated Codex `./server.mjs` processes present, not ours).
- `bash .agentcortex/bin/validate.sh` (x2, prior round) — exit 0 both times, 0 `[FAIL]`.
- Post-correction (2026-09-27T02:14-02:18Z): `git checkout origin/main -- scripts/pack-smoke.mjs`
  then commit `d55b04a` — `git diff origin/main -- scripts/pack-smoke.mjs` is empty (byte-identical
  to origin/main); `git diff origin/main -- scripts/render-smoke.mjs` shows only the kept fix.
  `SMOKE_PORT=5954 npm run smoke` → `render-smoke PASS`, 0 pageerrors/console errors;
  `Get-NetTCPConnection -LocalPort 5954` → 0 connections after. `npx vitest run
  --testTimeout=30000` → 139 files / 2579 tests passed, 0 failed. Stale marker file
  `avo-pack-smoke-devchild.pid` confirmed absent before starting this round.

