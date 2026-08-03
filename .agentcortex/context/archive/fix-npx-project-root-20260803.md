# Work Log: fix/npx-project-root

## Header

- Branch: `fix/npx-project-root`
- Classification: `hotfix`
- Classified by: `claude-opus-5`
- Frozen: `2026-08-03`
- Created Date: `2026-08-03`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `685e767`
- Checkpoint SHA: `89ff577`
- Recommended Skills: `none`
- Primary Domain Snapshot: `hook-io`
- SSoT Sequence: `116`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-08-03 15:00 UTC`
- Platform: `claude-code`
- Files Read: `31`
- Guardrails loaded: `AGENTS.md (auto) + shared-contracts.md at phase entry` — `engineering_guardrails.md` not re-read (Quick Mode; hotfix fast path, no rule-surface edits)

---

## Task Description

Owner asked for a project-state sweep: find small defects, tech debt, and doc/code drift, fix them
together, then cut a new release (GitHub tags had fallen behind). The sweep surfaced one real
user-facing defect — under the documented `npx` install path both servers match session files against
the PACKAGE directory, so every hook-written status file is filtered out as foreign — plus a
timezone-dependent test file and several stale doc claims.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | complete | 2026-08-03 | Audit of `main@685e767`: tests, build, validator, docs, tags, PRs. |
| plan | complete | 2026-08-03 | Scope frozen to: npx project root, TZ-portable tests, doc drift. Release cut separately. |
| implement | complete | 2026-08-03 | `resolveProjectRoot()` + 16 call sites + CLI env forwarding + 11 tests + doc updates. |
| review | complete | 2026-08-03 | Self-review vs #201: partial-fix regression proven, not asserted. |
| test | complete | 2026-08-03 | 2306/2306 across 5 timezones; build PASS; validator fail=0. |
| handoff | n/a | — | `hotfix` is exempt (AGENTS.md §Delivery Gates). |
| ship | complete | 2026-08-03 | Squash `89ff577` (PR #205); SSoT + archive carried by the v1.6.5 release PR. |

---

## Phase Summary

**bootstrap** — Audited `main@685e767`. Full suite green (2295), build clean, validator
`pass=112 warn=8 fail=0`. Found: (a) GitHub Releases lag tags (latest release v1.6.0, tags to v1.6.4);
(b) CHANGELOG has no entry for the six PRs merged since v1.6.4; (c) `package-lock.json` root version
skewed at 1.4.0; (d) open PR #201 from an external contributor describing a real npx defect;
(e) `tests/agentInspector.test.js` fails on any host outside UTC+8; (f) ADR-007 `applies_to` points at
`src/systems/banter.js`, a file that never existed. No TODO/FIXME debt in `src/`.

**plan** — Owner chose: complete #201's fix in-repo with credit, ship only the new release (no
backfill of v1.6.2–v1.6.4 release pages). Scope frozen to the four source files, two test files, and
the doc surfaces that state the filtering rule.

**implement** — Added `resolveProjectRoot(env, cwd)` to `src/server/scanSessions.mjs` (the module that
owns the `_cwd` matching contract, shared by both servers). Replaced all 8 `process.cwd()` sites in
`vite.config.js` and all 8 in `server.mjs` with a module-level `PROJECT_ROOT`. `bin/cli.js` forwards
the invoking cwd as `OFFICE_PROJECT_ROOT` on BOTH spawn sites (vite and server.mjs). Converted the 10
fixed-offset date literals in `tests/agentInspector.test.js` to the local-time constructor already
used by the `countAgentDoneToday` block. Doc drift fixed in README (en + zh-TW), ARCHITECTURE,
INTEGRATIONS, DEPLOYMENT env table, ADR-002, ADR-007.

**review** — The original patch converted only the 6 read sites. Both POST handlers stamp `_cwd`
themselves; leaving those on `process.cwd()` makes the server filter out its own writes, so the
documented `POST /api/status` / `/api/event` webhook path would have gone dark under npx. Proven by
simulation, not argument (see Evidence). It also missed `server.mjs` entirely — the `serve` /
production path had the identical defect.

**test** — 2306/2306 across UTC-11 → UTC+14; both new test files proven red on the pre-fix code.

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-03T14:52:00Z
- Gate: plan | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-03T14:58:00Z
- Gate: implement | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-03T15:06:00Z
- Gate: review | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-03T15:08:00Z
- Gate: test | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-03T15:10:00Z
- Gate: ship | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-03T15:34:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| PR | https://github.com/KbWen/agent-virtual-office/pull/201 | Diagnosis + original patch by @whoffmandesign; completed here. |
| ADR | docs/adr/ADR-002-multi-worktree-session-design.md | Owns the `_cwd` filtering rule; corrected. |
| ADR | docs/adr/ADR-007-dialogue-channel-separation-and-honesty-gate.md | Stale `applies_to` path corrected. |

---

## Known Risk

- `PROJECT_ROOT` is resolved once at module load. A process that changes `OFFICE_PROJECT_ROOT` at
  runtime would not see it — no caller does, and re-resolving per request would cost a `path.resolve`
  on every poll. Mitigation: documented at the helper.
- An operator who sets `OFFICE_PROJECT_ROOT` to a wrong path sees an empty office rather than an
  error. Same failure shape as launching from the wrong directory today, and the README troubleshooting
  entry now names the variable.

---

## Decisions

### D-1: complete the contributor's patch rather than merge it as-is

- Decision: adopt the same `OFFICE_PROJECT_ROOT` mechanism, extend it to the write sites and to
  `server.mjs`, and credit @whoffmandesign in the code comment and PR body.
- Reason: merging the patch as-is would have fixed the hook path and broken the webhook path in the
  same release. The mechanism itself was correct and idiomatic — only its coverage was partial.
- Alternatives: merge then fix-forward (leaves a broken commit on main); ask the contributor to extend
  (owner chose speed for a defect on the documented install path).
- Impact: #201 closes with the finding written up; the fix ships in v1.6.5.

---

## Drift Log

- Scope grew from "docs + release" to include a product-code hotfix after the audit found the npx
  defect. Owner approved the expansion before implementation.
- SSoT `current_state.md` written directly (guard bypassed) — same deliberate choice as
  Ship-fix-soak-gate-2026-07-16, per the documented stale-receipt hazard in `guard_context_write.py`.
  Ship History + Ship History Archive + Update Sequence 115→116 verified by diff after writing.
- Ship closure (SSoT entry + Work Log archive) rides the `chore(release): v1.6.5` PR rather than the
  feature PR #205, because the release PR is the change that records the version this shipped in.
- Ship History rotated 10→10: the two oldest entries (agentic-os v1.8.11, release v1.6.4) moved
  verbatim to `archive/ship-history-2026.md` to stay at the advisory cap.

---

## Evidence

- Baseline `main@685e767`: vitest `112 files / 2295 tests` pass; `vite build` PASS; validator
  `pass=112 warn=8 fail=0 skip=4`.
- Defect reproduced (pre-fix servers, new e2e stashed source): `GET /api/status` → `expected null not
  to be null` — with a valid hook session on disk the office sees nothing under an npx-style cwd split.
- Partial-fix regression proven: with only the read sites converted, `reads back its own POSTed status`
  fails (`expected false to be true`) — the server filters out its own `POST /api/status` write.
- Post-fix: vitest `114 files / 2306 tests` pass under `TZ` = UTC, America/Los_Angeles,
  Pacific/Kiritimati (UTC+14), Pacific/Midway (UTC-11), Europe/Berlin.
- `npm run build`: PASS, `dist/assets/index-CedgVSl7.js 496.50 kB` (unchanged — no bundled source
  touched).

---

## Test Gate Results

- Command: `npx vitest run` → `Test Files 114 passed (114) · Tests 2306 passed (2306)`.
- Coverage delta: +11 tests (`tests/projectRoot.test.js` 8, `tests/serverProjectRootE2E.test.js` 3).
- Test-the-test: both new files verified red on pre-fix source before being accepted.

---

## Red Team Findings

- **HIGH (fixed before commit)** — the read-only variant of this fix is worse than no fix for webhook
  users: it silently drops the server's own POSTs. Now pinned by
  `tests/serverProjectRootE2E.test.js > reads back its own POSTed status`.
- **MEDIUM (fixed before commit)** — `server.mjs` (the `serve`/Docker path) had all 8 of the same
  sites; a vite-only fix would have left production serving stale file-watcher data.

---

## Resume

none
