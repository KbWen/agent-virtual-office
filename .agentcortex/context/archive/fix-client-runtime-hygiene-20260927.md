# Work Log: fix/client-runtime-hygiene

## Header

- Branch: `fix/client-runtime-hygiene`
- Classification: `feature`
- Classified by: `Claude Opus 5.5`
- Frozen: true
- Created Date: `2026-09-26`
- Owner: `KbWen`
- Guardrails Mode: `Full`
- Current Phase: ship
- Diff Base SHA: `c238a30d51881fb2add5a0a875736d6e32ce542c`
- Checkpoint SHA: `18943427e31be39bba1e24c5ac6350ec8a5b7c47` <!-- merge commit, post-origin/main merge -->
- Recommended Skills: `test-driven-development (auto), systematic-debugging (auto), karpathy-principles (auto)`
- Primary Domain Snapshot: `none`
- SSoT Sequence: `n/a` (no `docs/architecture/` Domain Doc consulted)

---

## Session Info

- Agent: `Claude Opus 5.5`
- Session: `2026-09-26 09:34 UTC` (continued across 3 implement entries)
- Platform: `claude-code`
- Guardrails loaded: §1, §2, §4, §7, §8.1, §10 (core) + §5 (testing), §12 (implement)
- Override: none

---

## Task Description

Remediate 6 client-runtime-hygiene audit findings (2026-09-26) in `inferStatus.js`/`store.js`/
`desktopNotifier.js`: (1) false idle at 120s; (2) SSE never retries after give-up; (3) persist
dedupe key never matched; (4) >4h tab-closed same-day wiped ledgers; (5) notifier dedupe pruned
only on stop; (6) `clearExternalStatus` skipped eviction cleanup. 2 review rounds → round 3
(`cdd7a1a`) PASS.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-26T09:34:51Z | classified feature |
| plan | done | 2026-09-26T09:36:14Z | 6 findings re-derived from source, all confirmed |
| implement | done | 2026-09-26T09:37:44Z | commit `d40af71` |
| review | not-ready | 2026-09-26T09:49:59Z | round 1 — see `## Review Feedback` |
| implement | done | 2026-09-26T10:12:27Z | R1-R6 round-1 fixes; commit `8a33f29` |
| review | not-ready | 2026-09-26T10:14:18Z | round 2 — AC2 health flap + validator FAILs |
| implement | done | 2026-09-26T10:51:51Z | R2-1 health gate, spec Domain Decisions, worklog compaction, R6b test; commit `cdd7a1a` |
| review | done | 2026-09-26T11:14:18Z | round 3 — PASS, 6/6 AC PROVEN |
| test | done | 2026-09-26T11:53:42Z | full suite + build + bundle + both smokes + validator all green |
| handoff | done | 2026-09-26T12:24:47Z | Resume block written; awaiting 2nd-reviewer spot-check before /ship |
| ship | done | 2026-09-27T05:14:31Z | merged origin/main (1 expected conflict resolved); PR #250 |

---

## Phase Summary

- bootstrap→implement#1(`d40af71`)→review#1 NOT READY(3/6)→implement#2(`8a33f29`)→review#2 NOT
  READY(5/6)→implement#3(`cdd7a1a`)→review#3 PASS(6/6 AC). Detail: `## Review Feedback`.
- test: full suite 2541/2541 (135 files, 0 failed); 6/6 AC covered; build+bundle+both smokes
  PASS; adversarial 4 LOW findings, no blockers; validator `fail=0` (see `## Evidence`).
- handoff: Resume block + reviewer-facing summary written; recommend Open PR / Keep branch for
  a 2nd reviewer spot-check (owner-arranged) — do NOT `/ship` from this session.
- ship: PASS — merged origin/main (#246-249), 1 expected conflict resolved; 144/2658 tests green;
  build/2 smokes PASS; PR #250 opened; SSoT seq 139→140; archived to
  `.agentcortex/context/archive/fix-client-runtime-hygiene-20260927.md`.
  ⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: feature | Timestamp: 2026-09-26T09:34:51Z
- Gate: plan | Verdict: PASS | Classification: feature | Timestamp: 2026-09-26T09:36:14Z
- Gate: implement | Verdict: PASS | Classification: feature | Timestamp: 2026-09-26T09:37:44Z
- Gate: review | Verdict: NOT READY | Classification: feature | Transition: REVIEWED→IMPLEMENTING | Timestamp: 2026-09-26T09:49:59Z
- Gate: implement | Verdict: PASS | Classification: feature | Timestamp: 2026-09-26T10:12:27Z
- Gate: review | Verdict: NOT READY | Classification: feature | Transition: REVIEWED→IMPLEMENTING | Timestamp: 2026-09-26T10:20:20Z
- Gate: implement | Verdict: PASS | Classification: feature | Timestamp: 2026-09-26T10:51:51Z
- Gate: review | Verdict: PASS | Classification: feature | Transition: IMPLEMENTING→REVIEWED | Timestamp: 2026-09-26T11:14:18Z
- Gate: test | Verdict: PASS | Classification: feature | Transition: REVIEWED→TESTED | Timestamp: 2026-09-26T11:54:38Z
- Gate: handoff | Verdict: PASS | Classification: feature | Transition: TESTED→HANDEDOFF | Timestamp: 2026-09-26T12:24:47Z
- Gate: ship | Verdict: PASS | Classification: feature | Transition: HANDEDOFF→SHIPPED | Timestamp: 2026-09-27T05:14:31Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | `docs/specs/client-runtime-hygiene.md` | authored + Domain Decisions (r3) |
| Spec | `docs/specs/desktop-notifications.md` | finding 5 |
| Spec | `docs/specs/perf-metrics-chip.md` | findings 3/4 + R6 |
| Spec | `docs/specs/codex-status-parity-and-done-count.md` | finding 4 |
| Test | `tests/statusIntegrationSSE.test.js` | R1/R2/R3/AC1/AC2/R2-1 |
| Test | `tests/storePersistenceSeedWiring.test.js` | R6b load-seed |

---

## Known Risk

- **F1**: 304 refreshes the 120s staleness timer; honesty bound unchanged — client
  `externalStatus.expiresAt` (+300000ms) untouched by a 304, so a silent hook still clears
  within ~300–305s (client field, not server `scanAndMerge`/`STALE_MS`).
- **F2 / F2 health (R2-1)**: retries every 60s post-give-up (~90s/cycle); only genuine SSE
  `open` switches to the 10s heartbeat poller. `handleSSEProbe` suppresses SSE `ok:false`
  while `polling.active && pollProbeOk` (fast poller can back off to 8s by retry time);
  offline still fires when both channels are down.
- **F3/F4/R6b**: dedup key excludes `_savedAt`; salvage keeps same-day ledgers past the 4h
  cutoff (positions only dropped); `shouldWritePersistedSnapshot` floors a write every 30 min,
  seeded from loaded `_savedAt` (store.js ~227).
- **F5/F6**: `pruneEvictedAgents` runs per-tick not just on stop; `clearExternalStatus` now
  calls `pruneEvictedId` too. 3 eviction sites still not unified — follow-up, out of scope.
- **Rollback**: `git revert` any of the 3 commits; each independently reversible.
- **Test-env**: SSE needs `window`/`EventSource`/`localStorage` stubs; module-init needs
  `vi.resetModules()` + dynamic `import()`.

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

- 2026-09-26T10:05Z: `sed -i` normalized `inferStatus.js` CRLF→LF during red-check restoration
  (caught via `diff`); switched to `Edit` tool (preserves EOL) thereafter.
- 2026-09-26 (×5, 10:2xZ→12:2xZ): compacted in place repeatedly as new phase content pushed it
  over the 12KB/300-line cap; every receipt kept verbatim throughout.

---

## Review Feedback

Condensed — superseded by this Work Log's own sections + the spec's Review Remediation.
R1 (`d40af71`): 3/6 AC; heartbeat-at-retry-start blocking → fixed in `8a33f29`. R2 (`8a33f29`):
5/6 AC; health-flap-on-retry + validator FAIL×2 blocking → fixed in `cdd7a1a`. R3 (`cdd7a1a`):
6/6 AC, PASS.

---

## Red Team Findings

Adversarial Test Cases (`/test`, `feature` → Full Red Team/Adversarial Cases per
`red-team-adversarial` skill; no Beast Mode). No auth/session/token/API surface touched by any
of the 6 fixes — all LOW/advisory, none block the gate:

| # | Category | Scenario / Note | Pri |
|---|---|---|---|
| 1 | Boundary | `resolvePersisted` at exactly `now-4h` (strict `>`, store.js:208) treated fresh; exact boundary untested (tests use -1000ms/-5h only) | LOW |
| 2 | Race | SSE `open` same tick as GET `ok:false`; gate needs `pollProbeOk===true`, null fails open (no masking) — source-verified, no dedicated test | LOW |
| 3 | Malformed input | Persisted blob valid JSON, `_savedAt` absent → treated as epoch 0 → always stale → salvage runs; not a distinct test case | LOW |
| 4 | Resource | `pruneEvictedAgents` walks 3 Maps/tick, no roster cap; theoretical only, out of scope | LOW |

No CRITICAL/HIGH. Consistent with review's "Security: clean".

---

## Security Findings

none — both review rounds reported "Security: clean" (security_guardrails.md §1 A01–A03 +
secret-detection quick-scan, run at `/implement` completion each pass). No auth/credential/
token-handling code touched by any of the 6 findings.

---

## Design Reference

none (backend/runtime-logic fix; no user-visible UI change; exempt per
`engineering_guardrails.md §4.4`).

---

## Observability

Sink: existing `console` no-op guards + silent `catch {}` (unchanged — no new catch blocks, no
new error surface). Scope: the 3 primary files above.

---

## Resume

`ship:[doc=docs/specs/client-runtime-hygiene.md][code=src/inference/inferStatus.js,src/systems/store.js,src/inference/desktopNotifier.js][log=.agentcortex/context/work/fix-client-runtime-hygiene.md]`

- State: SHIPPED (feature, HANDEDOFF→SHIPPED this phase).
- Completed: bootstrap→plan→implement×3→review PASS(r3,6/6 AC)→test PASS→handoff→ship PASS.
- Next: none — PR #250 open, CI in progress; do NOT merge from this session (coordinator watches).
- Context: 6 findings fixed across 3 rounds; ship merged origin/main (#246-249, 1 expected
  conflict in codex-status-parity-and-done-count.md resolved by keeping both sections), full
  suite 144/2658 green post-merge, build+2 smokes PASS. SSoT seq 139→140, spec status shipped,
  Domain Decisions consolidated into docs/architecture/office-runtime.log.md.

### Read Map (for next agent)
- `docs/specs/client-runtime-hygiene.md` → full (AC1-6, Domain Decisions, Review Remediation)
- `.agentcortex/context/work/fix-client-runtime-hygiene.md` → full (this Work Log)
- `src/inference/inferStatus.js`, `src/systems/store.js`, `src/inference/desktopNotifier.js` → full

### Skip List
- `tests/*.test.js` this branch — reviewed/verified red→green, no changes expected
- `docs/specs/desktop-notifications.md`, `perf-metrics-chip.md`,
  `codex-status-parity-and-done-count.md` — already updated + reviewed

### Context Snapshot (≤200 tokens)
6 client status-integration findings fixed/3 rounds; review PASS r3 (6/6 AC); test/handoff this
session reconfirmed 2541/2541 tests + build/bundle/2 smokes/validator all `fail=0`. Risks: dead
hook clears ~300s not 120s (intentional, F1); SSE failures suppressed only while GET polling
itself is healthy (F2/R2-1); 3 eviction sites not unified (follow-up); exact-4h
`resolvePersisted` boundary untested (Red Team #1, LOW). Merge note: `store.js` also touched by
`fix/honest-office-events` in different regions — expect clean/trivial merge. NOT shipped.

### Backlog Status
- Active Backlog: `docs/specs/_product-backlog.md` — not touched (out of scope)
- Current Feature: client-runtime-hygiene — HANDEDOFF, pending ship
- Remaining: n/a (single-feature branch) · Next Recommended: 2nd reviewer spot-check, `/ship`

---

## Test Gate Results

`/test` (2026-09-26T11:53:42Z, at `cdd7a1a`): `npx vitest run` — **135 files, 2541 tests, 0
failed** (0 skipped this run; prior round's 25-skip e2e-guard not reproduced, informational
only). Build+bundle-budget PASS. Both smokes (isolated ports 5504/5514) PASS. Validator: see
`## Evidence`.

### AC Coverage Map

| AC | Test file(s) |
|---|---|
| AC1 304-refresh | `statusIntegrationSSE`, `applyMessage` |
| AC2 SSE retry/health | `statusIntegrationSSE` (retry/R2-1/R1 describe blocks) |
| AC3 dedupe key | `storePersistence` ("persistedSnapshotKey excludes _savedAt") |
| AC4 4h ledger survival | `storePersistence` (salvage/resolvePersisted), `storePersistenceSeedWiring` |
| AC5 notifier per-tick prune | `desktopNotifier` ("mid-run eviction pruning") |
| AC6 clearExternalStatus parity | `storeReconcile` ("evicted dynamic agent state cleanup") |

6/6 AC PROVEN by automated tests (`tests/*.test.js`), matches review round 3.

---

## Evidence

- `npx vitest run`: 133/2528 (`d40af71`) → 134/2539 (`8a33f29`) → **135/2541** (`cdd7a1a`,
  round 3 + `/test`, re-confirmed twice). All 0 failed.
- Round-3 red→green (`Edit`, not `sed`; restored+`diff`-confirmed): R2-1 health-gate revert →
  `expected [] to equal [false,false,false]`; R6b load-seed revert (store.js~227) → `expected 0
  to be 1`. Both restored green. Prior red→green (F5/F6, R1, AC1/R3): unchanged, in commits
  `d40af71`/`8a33f29` + spec `## Review Remediation`.
- `npm run build`+`bundle-budget.mjs`: PASS, unchanged since `cdd7a1a` — `501995 bytes; baseline
  496504 (+1.11%); limit 546154 (+10%)`.
- `/test`: `SMOKE_PORT=5504 npm run smoke` / `PANEL_PORT=5514 npm run smoke:panel`: PASS, 0
  errors each.
- `bash .agentcortex/bin/validate.sh` (final run, 2026-09-26T12:24:47Z): `Summary: pass=113
  warn=6 fail=0 skip=5` — matches round-3 baseline; the 6 WARNs are pre-existing/historical,
  unrelated to this branch.
