# Work Log: chore/soak-hermetic-status-dir

## Header

- Branch: `chore/soak-hermetic-status-dir`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `2026-09-02`
- Created Date: `2026-09-02`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `2375478`
- Checkpoint SHA: `none`
- Recommended Skills: `verification-before-completion`
- Primary Domain Snapshot: `ci-infra`
- SSoT Sequence: `120`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-09-02 03:00 UTC`
- Platform: `claude-code`
- Files Read: `41`

---

## Task Description

`sim-soak` spawned its dev server with no `OFFICE_STATUS_DIR`, so it read `~/.claude` — where the
operator's own live Claude Code hook traffic lands every few seconds. Runs were measuring that
traffic as well as the office, and could report invariant violations an unrelated editing session
caused. Isolate the spawn path, and make the reuse path state honestly that it cannot be isolated.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-02 | found while building an ambient-behaviour probe; `staged-capture.mjs` already had the fix |
| plan | skipped | — | quick-win fast-path |
| implement | done | 2026-09-02 | new pure module + spawn isolation + honest reuse verdict |
| review | pending | — | — |
| test | done | 2026-09-02 | 10 unit tests + BOTH branches proven against real servers |
| handoff | n/a | — | quick-win exempt |
| ship | done | 2026-09-02 | merged as PR #221; SSoT Ship History + this archive + INDEX.jsonl chain entry |

---

## Phase Summary

**implement** — the spawn path now creates a fresh `mkdtemp` directory and passes it as
`OFFICE_STATUS_DIR`; cleanup removes only that directory, never an operator-supplied path. The
REUSE path cannot be isolated — the reused server's status source was fixed when it started — so
instead of assuming, it asks: `GET /api/status` and reports what is actually being served.
The design decision that matters: **an unverifiable answer counts as NOT isolated.** A probe that
times out, 500s or returns an unparseable body reports "not isolated", because the entire purpose
of the check is to stop a run claiming a clean provenance it has not established.

Verdict logic lives in a separate pure module (`scripts/soakHermeticity.mjs`) with the fetch
injected, matching how `soakInvariants` / `soakCoverage` / `soakTarget` are already split so the
gate logic itself is testable. The verdict is printed at start, carried in `SOAK_REPORT` JSON, and
— deliberately — **repeated inside the FAIL output**, because a provenance caveat printed twelve
minutes before a failure is a caveat nobody reads.

A non-isolated run is reported, not failed. Failing it would break the documented `SOAK_URL` /
`:5173` reuse workflow, and the honest statement plus a `--spawn` instruction is the actionable
half.

⚡ ACX

---

## Gate Evidence

- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T03:05:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T03:12:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T06:40:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | — | tooling quick-win |
| ADR | — | — |
| Issue | — | filed from this session's measurement work, no backlog row yet |
| PR | https://github.com/KbWen/agent-virtual-office/pull/221 | merged 2026-09-02 |

---

## Known Risk

- **R1 — deleting a directory the tool did not create.** `rmSync` runs only on the `mkdtemp`
  path this process created in `os.tmpdir()`, and `soakStatusDir` is null on the reuse path, so
  an operator-supplied `OFFICE_STATUS_DIR` is never a deletion target.
- **R2 — a green claim on an unverifiable probe.** Explicitly designed against: probe error,
  non-200 and unparseable body all resolve to `isolated: false`, each with a unit test.

---

## Decisions

### D-1: report a non-isolated run rather than failing it

- **Decision**: `hermeticity.isolated === false` prints a verdict and a FAIL-time note; it does
  not change the exit code.
- **Reason**: reuse via `SOAK_URL` / a running `:5173` is a documented workflow. Failing it would
  break local use, and the actionable content — "these violations may not be the office's, re-run
  with `--spawn`" — does not need an exit code to be useful.
- **Alternatives**: fail on non-isolated (rejected: breaks the documented path); warn only at
  start (rejected: a caveat 12 minutes before the failure is not read).
- **Impact**: `scripts/sim-soak.mjs` output and report only.

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

none

---

## Review Feedback

none

---

## Red Team Findings

none

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

- `npx vitest run` — **2329 passed / 117 files / 0 failed** (baseline at `2375478` was 2319; +10 new).
- `tests/soakHermeticity.test.js` — 10 cases covering both branches and every not-isolated cause.

---

## Evidence

- **Spawn branch, real run**: `node scripts/sim-soak.mjs --spawn --minutes 1` printed
  `sim-soak hermeticity: ISOLATED — spawned with OFFICE_STATUS_DIR pointed at a fresh empty
  directory`, then `sim-soak PASS — 235 samples over 1 min, 0 invariant violations`. The
  `SOAK_REPORT` JSON carries `"hermeticity": {"mode":"spawned","isolated":true,...}`.
- **Reuse branch, real run against a deliberately contaminated server** (a second dev server
  started on `:5211` with its own status dir, then POSTed `dev: working` / `qa: blocked` through
  the real API): `SOAK_URL=http://localhost:5211 node scripts/sim-soak.mjs --minutes 1` printed
  `sim-soak hermeticity: NOT ISOLATED — reused server is serving live agent status (dev, qa)`.
  It names the exact roles, so the operator can see whose traffic is in the run.
  Both branches exercised against real servers rather than only mocked — the mocked tests pin the
  verdict logic, these two runs pin the wiring.
- Origin of the defect, for the record: found while building an ambient-behaviour probe for this
  session's measurement work. `staged-capture.mjs` had already solved exactly this
  (`OFFICE_STATUS_DIR` on its own spawn) and `vite.config.js` documents the env var as existing
  "so a visual shot can run against an EMPTY directory: otherwise the operator's own live Claude
  Code hook traffic lands here every few seconds". The soak simply never adopted it.
