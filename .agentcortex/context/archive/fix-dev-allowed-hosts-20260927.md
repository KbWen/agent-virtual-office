# Work Log: fix/dev-allowed-hosts

## Header

- Branch: `fix/dev-allowed-hosts`
- Classification: `quick-win`
- Classified by: `Claude Opus 5.5`
- Frozen: `2026-09-27`
- Created Date: `2026-09-27`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: ship
- Diff Base SHA: `3f22aa7`
- Checkpoint SHA: `5004b6d`
- Recommended Skills: `none`
- Primary Domain Snapshot: `none`
- SSoT Sequence: `138`

---

## Session Info

- Agent: `Claude Opus 5.5`
- Session: `2026-09-26T23:15:00Z` (real `date -u` capture at Work Log creation; corrected 2026-09-27T04:31:42Z — see Drift Log)
- Platform: `claude-code`
- Files Read: `9`

---

## Task Description

PR #246 added `OFFICE_ALLOWED_HOSTS` Host-header allowlisting to prod `server.mjs`, but the Vite
dev server never sets `server.allowedHosts`, so the env var has no effect in dev and a
custom-hostname/reverse-proxy dev caller gets Vite's default 403. Extract the pure env-parsing
step of prod's `isAllowedHost` into `src/utils/hostAllowlist.mjs` and map it into
`vite.config.mjs`'s `server.allowedHosts`.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-27 | quick-win, SSoT read |
| plan | done | 2026-09-27 | extract+map, test-first |
| implement | done | 2026-09-27 | red→green, evidence green |
| review | done | 2026-09-27 | PASS (fresh adversarial reviewer); 1 MEDIUM governance + 3 LOW advisory |
| test | pending | — | — |
| handoff | pending | — | — |
| ship | pending | — | — |

---

## Phase Summary

**bootstrap**: Classified quick-win (1-2 modules: `vite.config.mjs` + new `src/utils/hostAllowlist.mjs`, `server.mjs` touch). Read SSoT — confirms PR #246/#248 lineage, ADR/backlog untouched by this task. Read `server.mjs`'s `isAllowedHost`/`ALLOWED_HOSTS_ENV`/`hostnameFromHeader` (lines ~213-271) and Vite 8's own `isHostAllowedInternal`/`extractHostNameFromHostHeader` (`node_modules/vite/dist/node/chunks/node.js:17386-17414`) to confirm parity: Vite already special-cases `localhost`/IP literals and supports a leading-dot suffix entry with the same subdomain-wildcard semantics as prod; Vite's own `allowedHosts` entries are matched against a port-stripped hostname, so prod's port-stripping parser is directly reusable.

**plan**: Extract `hostnameFromHeader` + a new `parseAllowedHostsEnv` (the `ALLOWED_HOSTS_ENV` computation) into `src/utils/hostAllowlist.mjs` (`.mjs`, matching the existing `normalizePost.mjs`/`statusContract.mjs` shared-module pattern; package is `"type":"commonjs"` so both `server.mjs` and `vite.config.mjs` import it explicitly by extension). `server.mjs` imports both from the new module instead of defining them inline (behavior-preserving refactor). `vite.config.mjs` imports `parseAllowedHostsEnv`, computes `ALLOWED_HOSTS_ENV` from `OFFICE_ALLOWED_HOSTS`, and spreads `{ allowedHosts: ALLOWED_HOSTS_ENV }` into `server:` only when non-empty — unset env leaves the key absent so Vite's own default (`[]`) is unchanged, and `allowedHosts: true` is never produced. Test-first: (1) `tests/hostAllowlist.test.js` unit/parity tests for the extracted pure functions; (2) `tests/viteAllowedHosts.test.js` behavioral test booting the real `vite.config.mjs` via Vite's `createServer()` with `OFFICE_ALLOWED_HOSTS` set, using a raw TCP request (fetch cannot override the `Host` header) to confirm an allowed custom Host is not 403'd and an unlisted one is. Docs: `docs/INTEGRATIONS.md` / `README.md` / `docs/deployment/DEPLOYMENT.md` `OFFICE_ALLOWED_HOSTS` mentions updated to say it also governs the dev server; `docs/specs/engineering-audit-remediation.md` gets a new dated wave entry.

**implement**: Wrote `tests/hostAllowlist.test.js` first — confirmed red (`Cannot find module '../src/utils/hostAllowlist.mjs'`) — then created `src/utils/hostAllowlist.mjs` (`hostnameFromHeader` + `parseAllowedHostsEnv`); 14/14 green. Refactored `server.mjs` to import both from the new module (deleted its inline duplicates); full suite still green (behavior-preserving). Wrote `tests/viteAllowedHosts.test.js` (7 cases: unlisted-Host 403, listed-Host allowed, leading-dot suffix allow/reject, `:port`-stripped entry, unset-env `localhost` still allowed, unset-env arbitrary-Host still 403) against the ALREADY-wired `vite.config.mjs`, then independently confirmed red by temporarily reverting the `allowedHosts` spread (3 of 7 failed with `403` as expected) and green again after restoring it. Updated `README.md`/`DEPLOYMENT.md`/`docs/specs/engineering-audit-remediation.md` (new 2026-09-27 wave section) to note `OFFICE_ALLOWED_HOSTS` now also governs `npm run dev`. Evidence: `npm run build` clean (451ms); `npx vitest run --testTimeout=30000` — **141 files / 2600 tests green**; `SMOKE_PORT=5901 npm run smoke` PASS (4 viewports, 0 errors); `bash .agentcortex/bin/validate.sh` → `Summary: pass=113 warn=7 fail=0 skip=5` (all 7 WARNs pre-existing/historical-archive advisories, unrelated to this branch — confirmed by re-grepping the archive-file paths named in each, none touched by this diff). Scope check: `git diff --stat` against `origin/main` touches exactly the planned files (`server.mjs`, `vite.config.mjs`, `README.md`, `docs/deployment/DEPLOYMENT.md`, `docs/specs/engineering-audit-remediation.md`, + 3 new files) — no unplanned files. Rollback: revert this branch's commit(s); no schema/data migration, no SSoT/backlog/ADR touched.

- review: PASS (fresh adversarial reviewer, 2026-09-27T04:30:03Z) — live main-vs-HEAD server.mjs Host matrix 480/480 identical (6 env configs + token exemption); real-Vite probe confirms leading-dot=apex+subdomain, entry ports stripped, no `true`/wildcard reachable, unset/empty/blank/'.' env → key omitted (`[]`); dist clean of hostAllowlist; Docker/npm pack ship src/utils; mutations M1/M2/M3 all caught; vitest 141 files/2600 passed; validate pass=114 warn=6 fail=0 skip=5. Security: clean. 1 MEDIUM governance (future-dated implement receipt), 3 LOW advisory — see Review Feedback.

**implement (review-fixes pass, 2026-09-27T04:32:57Z)**: Addressed the review's 1 MEDIUM + 2 of 3 LOW findings (3rd LOW — case-sensitivity — left as documented-not-fixed per Known Risk, on explicit instruction). (1) MEDIUM: corrected invented Gate Evidence timestamps — see Drift Log. (2) LOW: `server.mjs`'s comment above `ALLOWED_HOSTS_ENV` no longer claims Vite's leading-dot wildcard "differs slightly" (it's identical — verified against `isHostAllowedInternal`); reworded to state the parity and why it lets the parser be shared with no translation step. (3) LOW: `tests/viteAllowedHosts.test.js`'s `bootDevServer` now wraps `createServer`/`listen` in try/finally so ambient env is restored even if either throws. Re-ran the two touched test files (`hostAllowlist.test.js` unaffected content-wise, included for completeness) and `node --check server.mjs`.

⚡ ACX

---
- ship: PASS — bundled into PR #252 with its sibling follow-up; archived 2026-09-27. ⚡ ACX

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-26T23:15:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-26T23:15:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-27T03:51:05Z
- Gate: review | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-27T04:30:03Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-27T04:33:58Z <!-- r2 review-cleanup commit 5004b6d; time = its committer date, receipt added by orchestrator -->
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTING→REVIEWED | Timestamp: 2026-09-27T04:34:39Z <!-- r2 orchestrator: comment+test-only delta verified, 21/21 targeted tests -->
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-27T05:48:53Z <!-- shipped bundled in PR #252 (fix/followups-2026-09-27) by orchestrator -->

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | docs/specs/engineering-audit-remediation.md | adding a new dated wave entry |
| PR | #246, #248 | prior waves this follows on from |

---

## Known Risk

- Vite's own `allowedHosts` wildcard match (`node.js:17411`) differs subtly from prod's port-bracket handling in edge cases (e.g. malformed Host headers) documented already in `server.mjs`'s comment above `ALLOWED_HOSTS_ENV` — this task only shares the ENV-PARSING step, not the full per-request matcher, so that documented divergence is unchanged, not widened.
- Mitigation: behavioral test asserts the actual HTTP 403/non-403 outcome through Vite's real middleware, not just the parser's return value.
- LOW (documented, not fixed — from fresh review): Vite matches `Host` case-sensitively; `server.mjs` lowercases before comparing. `Host: EXAMPLE.COM` therefore 403s in dev but 200s in prod. Fails closed (dev is stricter, never more permissive) and no real browser ever sends a non-lowercase `Host`, so accepted as-is.

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

- Correction (2026-09-27T04:31:42Z, real `date -u`): fresh reviewer (MEDIUM) caught the `bootstrap`/`plan`/`implement` Gate Evidence receipts as invented — `implement` read `07:35:00Z`, in the future relative to the review-entry clock (`~03:52:41Z`), and `bootstrap`/`plan` were round-number placeholders (`00:00:00Z`/`00:05:00Z`). Corrected: `bootstrap`/`plan` now use the one real `date -u` capture actually taken before Work Log creation that session (`2026-09-26T23:15:00Z`, both phases were decided in that same pre-write pass, so no finer-grained real timestamp exists for either); `implement` now uses the commit's own committer date (`git log -1 --format=%cI 3a101b3` → `2026-09-27T03:51:05Z`), which is real, verifiable, and consistent with the review's own clock read. `review`'s receipt is untouched (owned by that session). From this point on, every new timestamp in this log is the literal output of `date -u` at write time — no estimates.

---

## Review Feedback

Review session `review-devhosts-d3161a4f` (2026-09-27T04:30:03Z). Verdict PASS; nothing blocking.
- MEDIUM (governance, fix before /ship): `## Gate Evidence` implement receipt `Timestamp: 2026-09-27T07:35:00Z` is future-dated (review-entry `date -u` = 2026-09-27T03:52:41Z); bootstrap/plan `00:00:00Z`/`00:05:00Z` look like placeholders. The owning session should correct them from real clock times (this review did not edit them). Evidence itself was independently reproduced.
- LOW (doc drift): `server.mjs:198-199` still says Vite's wildcard shape "differs slightly", which contradicts this branch's own verified claim (`vite.config.mjs:101-104`, spec). Vite `isHostAllowedInternal` (node.js:17402) implements the identical leading-dot rule (apex + subdomain). Reword that bullet.
- LOW (divergence, fail-closed): Vite matches Host case-sensitively, so `Host: EXAMPLE.COM` gets 403 in dev but 200 in prod. Browsers lowercase Host, so no legit client is affected; optionally note it in the DEPLOYMENT row. `vite preview` also inherits the list (via `preview.allowedHosts ?? server.allowedHosts`), which is benign.
- LOW (test hygiene): `tests/viteAllowedHosts.test.js` `bootDevServer` does not restore `process.env` if `createServer`/`listen` throws. Wrap it in try/finally.

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

none
