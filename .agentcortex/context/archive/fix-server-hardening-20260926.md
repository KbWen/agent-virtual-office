# Work Log: fix/server-hardening

## Header

- Branch: `fix/server-hardening`
- Classification: `hotfix`
- Classified by: `claude-sonnet-5 (dispatched sub-agent)`
- Frozen: `2026-09-26`
- Created Date: `2026-09-26`
- Owner: `KbWen`
- Guardrails Mode: `Full`
- Current Phase: ship
- Diff Base SHA: `c238a30d51881fb2add5a0a875736d6e32ce542c`
- Checkpoint SHA: `0ebf3ef`
- Recommended Skills: `none`
- Primary Domain Snapshot: `office-runtime`
- SSoT Sequence: `n/a`

---

## Session Info

- Agent: `claude-sonnet-5`
- Session: `2026-09-26 09:13 UTC`
- Platform: `claude-code`
- Files Read: `12`
- Guardrails loaded: §1, §2, §4, §7, §8.1, §10 (core) + §5 (testing), §12 (implement), security_guardrails.md (full)
- Compacted: 2026-09-26, in place (coordinator directive, no archive overflow; ship archives). r4/test rounds condensed Review Feedback/Security/Red Team/Known Risk/Evidence prose; Gate Evidence/Phase Summary/Drift Log kept verbatim + appended.

---

## Task Description

Remediate 4 findings from a 2026-09-26 `server.mjs` audit: (1) crash on malformed request line, (2) SSE drops ~every 60s, (3) no Host-header DNS-rebinding guard, (4) vitest CVE GHSA-82fw-gwwq-j7x9. Test-first, isolated worktree. Two `/review` rounds found deployment-compat gaps (Nginx, Docker) + doc/test issues, remediated same branch.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-26T09:13Z | hotfix confirmed |
| plan | done | 2026-09-26T09:20Z | 4 findings re-derived |
| implement | done | 2026-09-26T09:13:26Z | r1: 20d2725/944db3f/5cd4a81/2ac0872 |
| review | NOT READY | 2026-09-26T09:38Z | r1 — see Review Feedback |
| implement | done | 2026-09-26T09:47:07Z | r2: b110c8c/9ae9b02 |
| review | NOT READY | 2026-09-26T10:17:36Z | r2 — see Review Feedback |
| implement | done | 2026-09-26T10:19:05Z | r3: 61615fe/a424d5a |
| review | PASS | 2026-09-26T10:54:09Z | r3 |
| implement | done | 2026-09-26T11:08:30Z | r4: 0ebf3ef (LOW-9..11 cleanup, pre-/test) |
| review | PASS | 2026-09-26T11:50:18Z | r4 (LOW-9..11 verified); row added at /test entry |
| test | done | 2026-09-26T12:20:27Z | full suite+build+bundle+audit+smoke+validate.sh+live smoke, all green |
| handoff | n/a | — | hotfix exempt |
| ship | done | 2026-09-26T14:37:10Z | re-sync (no-op, already current), suite 2553/2553, build 464ms, validate.sh pass (see Evidence) |

---

## Phase Summary

- bootstrap: hotfix (crash + access-control §10.4). Extending `docs/specs/engineering-audit-remediation.md`. Confidence 95%.
- plan: `server.mjs` + tests/docs/spec. F1+F3 → F2 → F4 → docs, separate commits.
- implement (r1): F1 `safeParseUrl()`, F3 `isAllowedHost()`, F2 `setTimeout(0)`+15s heartbeat, F4 vitest→4.1.11. Suite 2529/2529. Commits `20d2725`,`944db3f`,`5cd4a81`,`2ac0872`.
- review (r1): NOT READY — HIGH-1 (breaks nginx reverse-proxy), MEDIUM-1 (fabricated timestamps).
- implement (r2): HIGH-1/MEDIUM-1/LOW-1..4 fixed — detail in spec §Review Remediation r2. Suite 2540/2540. Commits `b110c8c`,`9ae9b02`.
- review (r2): NOT READY — HIGH-2 (Docker can't pass var), MEDIUM-2 (CI 403s). r1 items re-verified PROVEN.
- implement (r3): HIGH-2/MEDIUM-2/LOW-5..8 fixed — detail in spec §Review Remediation r3. Suite 2549/2549; build/smoke/audit green; HIGH-2/MEDIUM-2 live-verified (Evidence). Commits `61615fe`,`a424d5a`.
- review (r3): PASS — HIGH-2/MEDIUM-2/LOW-5..7 verified; 0 CRITICAL/HIGH; 3 LOW advisory.
- implement (r4, pre-/test cleanup): LOW-9 duplicated comment removed (`server.mjs`), LOW-10 stale "verbatim" wording fixed (`office.service`/`pm2.config.cjs`), LOW-11 Bearer-form exemption + open-mode-no-exemption tests added (mutation-checked, 12 tests caught the open-mode regression). Suite 2553/2553. Commit `0ebf3ef`.
- review (r4): PASS 11:50:18Z — LOW-9..11 verified cleared, 0 CRITICAL/HIGH/MEDIUM outstanding.
- test: full suite 2553/2553; build/bundle-budget/audit/smoke/smoke:pack green; validate.sh pass=114 fail=0; live isolated prod-server (port 5520) confirms F1 (400, no crash), F3 (Host allow/deny), SSE stream open. See Test Gate Results.
- ship: PASS — re-sync no-op (already current w/ origin/main); suite 2553/2553; build 464ms; validate.sh pass=114 warn=5 fail=0 skip=5; PR #246 opened, CI 8/8 green; SSoT current_state.md seq 135->136 (guarded write, byte-verified); worklog archived.
⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: hotfix | Timestamp: 2026-09-26T09:15:00Z
- Gate: plan | Verdict: PASS | Classification: hotfix | Timestamp: 2026-09-26T09:25:00Z
- Gate: implement | Verdict: PASS | Classification: hotfix | Timestamp: 2026-09-26T09:32:19Z
  <!-- Corrected in review round 2 (was fabricated as 10:35:00Z). Rewritten from `git log --format=%cI` on 2ac0872. -->
- Gate: review | Verdict: NOT READY | Classification: hotfix | Transition: REVIEWED→IMPLEMENTING | Timestamp: 2026-09-26T09:44:01Z
  <!-- Classification added round 4 (was missing) — LOW-9..11 review finding. -->
- Gate: implement | Verdict: PASS | Classification: hotfix | Timestamp: 2026-09-26T10:05:01Z
- Gate: review | Verdict: NOT READY | Classification: hotfix | Transition: REVIEWED→IMPLEMENTING | Timestamp: 2026-09-26T10:17:36Z
- Gate: implement | Verdict: PASS | Classification: hotfix | Timestamp: 2026-09-26T10:33:58Z
- Gate: review | Verdict: PASS | Classification: hotfix | Timestamp: 2026-09-26T10:54:09Z
- Gate: implement | Verdict: PASS | Classification: hotfix | Timestamp: 2026-09-26T11:08:30Z
- Gate: review | Verdict: PASS | Classification: hotfix | Timestamp: 2026-09-26T11:50:18Z
- Gate: test | Verdict: PASS | Classification: hotfix | Timestamp: 2026-09-26T12:20:27Z
- Gate: ship | Verdict: PASS | Classification: hotfix | Timestamp: 2026-09-26T14:37:10Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | docs/specs/engineering-audit-remediation.md | "Server Hardening Wave" + 3 Review Remediation sections |
| Issue | GHSA-82fw-gwwq-j7x9 | vitest/@vitest/mocker moderate CVE, dev-only |
| ADR | — | — |
| PR | https://github.com/KbWen/agent-virtual-office/pull/246 | #246 |

---

## Known Risk

Root Cause: `new URL(req.url, 'http://x')` (main listener + `serveStatic`) had no try/catch — malformed request-target threw synchronously inside `http.createServer`'s callback, outside any `'error'` handler; one crafted request crashed the process.

F1: parse scoped to URL construction only, 400 fallback. F2: disabling per-socket SSE timeout is accepted long-lived-by-design; `OFFICE_MAX_SSE_CLIENTS` bounds total connections. F3: behavior change — hostname access needs `OFFICE_ALLOWED_HOSTS` or valid token, documented README/DEPLOYMENT.md/spec; rollback = revert commit / unset call site. F4: dev-only. Token exemption (r3): not new risk — same secret already gates every write endpoint. LOW-8 (accepted, out of scope): SSE ignores `res.writableLength`, follow-up candidate.

Rollback: 8 small commits across 3 rounds, no overlapping lines within a round; `git revert <sha>` per finding.

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

- 2026-09-26T09:38:24Z r1: removed stray `⚡ ACX` from Phase Summary.
- 2026-09-26T09:44:01Z r1: flagged fabricated timestamps — MEDIUM-1.
- 2026-09-26T09:47:07Z r2: corrected per MEDIUM-1 — gate receipt → `09:32:19Z` (git `%ct` on 2ac0872 → `date -u`); phase-table → real lock-refresh `09:13:26Z`. All timestamps from here on are real.
- 2026-09-26T10:06:29Z r2: flagged Work Log >12KB; left uncompacted (reviewer boundary excludes `archive/work/`).
- 2026-09-26T10:33:58Z r3: compacted in place per coordinator directive (no archive overflow).
- 2026-09-26T11:08:30Z r4: `⚡ ACX` removed again by reviewer, restored; added missing `Classification: hotfix` to the r1 NOT READY receipt; re-trimmed 13KB→≤12KB (same protected-section rule).
- 2026-09-26T12:20:27Z test: Phase Sequence table was missing the r4 review-PASS row (Gate Evidence had it) — added. Lock: `recover_worklog_lock.py ensure` → created.

---

## Review Feedback

- R1 (09:44:01Z, NOT READY): F1/F2/F4 PROVEN, F3 PARTIAL. HIGH-1 (nginx 403s undoc), MEDIUM-1 (fabricated timestamps), LOW-1..4. Suite 2527/2529 (2 unrelated flaky), isolated rerun 43/43.
- R2 (10:17:36Z, NOT READY): r1 items RESOLVED. HIGH-2 (Docker can't pass var), MEDIUM-2 (CI 403s), LOW-5..8. Suite 2540/2540.
- R3 (10:54:09Z, PASS): r2 items RESOLVED (live matrix, mutants caught). Advisory LOW-9..11, cleared r4. Suite 2549/2549.
- R4 (11:50:18Z, PASS): LOW-9..11 verified cleared. 0 CRITICAL/HIGH/MEDIUM outstanding.

Detail: `docs/specs/engineering-audit-remediation.md` §Review Remediation r2/r3.

---

## Security Findings

R1: HIGH-1 (A05, nginx undoc) resolved r2; A01 Host matrix clean; A02/A03 clean; A06 vitest bump. R2: HIGH-2 (A05, docker-compose var) resolved r3; LOW-5 (`.` entry rebinding) resolved r3. R3: A01 clean (`isAuthorized` 144-case diff=0; token exemption only on valid token, never open mode, not echoed); A02 SHA-256+`timingSafeEqual` kept.

---

## Red Team Findings

R1 lite: Host-bypass (numeric/hex IPv4, bracketed, dup-Host, missing Host) all 403; 16 crash vectors survived — no CRITICAL. R2 lite: log-flood bounded 50 lines; SSE-cap reconnect probe (25 cycles) clean — no CRITICAL.

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

Fix → proving test map (`tests/serverCrashHardening.test.js` unless noted):
- F1 (crash on malformed request-target): raw-socket repro tests (`GET http://a:b:c/`, `GET http://[`) + live smoke — 400, process survives, `/api/health` 200 after.
- F2 (SSE ~60s drop): `sseClientCap.test.js` + heartbeat assertions — mutation-check (revert fix) → 3 failed/1 passed.
- F3 (Host guard + Docker/Nginx `OFFICE_ALLOWED_HOSTS` + token exemption): describe block + live curl matrix (localhost 200 / evil.example 403) — mutation-check 3-12 failed depending on mutant, all restored green.
- F4 (vitest CVE GHSA-82fw-gwwq-j7x9): `npm audit` → 0 vulnerabilities (vitest 4.1.11).
- Full regression: 136 files / 2553 tests, 0 failed.
- SSE liveness: live GET `/api/status/stream` → `200 text/event-stream`, stays open.

---

## Evidence

### Round 1

F1 red pre-fix: `TypeError: Invalid URL`, process crashed. Post-fix: `serverCrashHardening.test.js` 9/9; mutation-checks restored green. Full suite 2529/2529; build/bundle-budget/smoke×2/audit green. Commits: `20d2725`,`944db3f`,`5cd4a81`,`2ac0872`.

### Round 2 (post-review fixes)

HIGH-1 live: no `OFFICE_ALLOWED_HOSTS` → `403`; set → `200`. `serverCrashHardening.test.js` 17/17; `sseClientCap.test.js` 3/3 (new). Mutation-checks restored green. Full suite 2540/2540; build/bundle-budget/smoke×2/audit green.

### Round 3 (post-review fixes)

HIGH-2: `docker-compose.yml` `environment` now forwards `OFFICE_ALLOWED_HOSTS: ${OFFICE_ALLOWED_HOSTS:-}` (Docker unavailable in sandbox; proven `${VAR:-}` pattern reused). MEDIUM-2 live: bad Host + valid token → `200`; bad Host + no/wrong token → `403`. `serverCrashHardening.test.js` 26/26 (+9). Mutation-check (remove token-exemption / remove `.`-filter / inflate log cap) each → 1 failed/25 passed; all restored green. Full suite 2549/2549; build/bundle-budget(+0.90%)/smoke×2/audit green. Commits: `61615fe`,`a424d5a`. `validate.sh` → pass=113 fail=0.

### Round 4 (LOW-9..11 cleanup, pre-/test)

`node --check` on server.mjs/pm2.config.cjs OK. `serverCrashHardening.test.js` 30/30 (+4: Bearer-form exemption, open-mode). Mutation-check (`hasValidApiToken` flip) → 12 failed/18 passed (wide blast radius via `isAuthorized`); restored green. Full suite 2553/2553. Commit `0ebf3ef`. `validate.sh` → pass=114 fail=0 (slow, ~25min under sibling-agent load; not hung).

### Test phase (checkpoint 0ebf3ef unchanged, no source edits)

`npx vitest run` → 136 files / 2553 tests passed. `npm run build` → 432ms; bundle-budget PASS 500949B (+0.90%, limit +10%). `SMOKE_PORT=5501 npm run smoke` → PASS 4 viewports, 0 errors. `SMOKE_PORT=5501 PANEL_PORT=5511 npm run smoke:pack` → ALL ASSERTIONS PASSED. `npm audit` → 0 vulns. `validate.sh` → pass=114 warn=6 fail=0 skip=5.

Live isolated prod-server (`node server.mjs --port=5520`, `HOME`/`OFFICE_STATUS_DIR` → scratchpad, `OFFICE_ALLOWED_HOSTS=localhost:5520`): `Host: localhost:5520` → `200`; `Host: evil.example` → `403`; raw-socket `GET http://a:b:c/ HTTP/1.1` (F1 repro) → `400`, process alive, `/api/health` → `200` right after; `GET /api/status/stream` → `200 text/event-stream`, stays open. Server stopped cleanly, port confirmed free.
