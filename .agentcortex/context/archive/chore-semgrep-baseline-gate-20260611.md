# Work Log: chore/semgrep-baseline-gate

## Header

- Branch: `chore/semgrep-baseline-gate`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-11`
- Created Date: `2026-06-11`
- Owner: `claude-fable-5`
- Guardrails Mode: `Quick`
- Current Phase: `implement`
- Checkpoint SHA: `26ba57c`
- Recommended Skills: `none`
- Primary Domain Snapshot: `ci-infra/security`
- SSoT Sequence: `80`

---

## Session Info

- Agent: `claude-fable-5`
- Session: `2026-06-11 16:10 UTC`
- Platform: `claude-code`

---

## Task Description

Issue #126: Semgrep ran report-only since introduction; triage the baseline so new serious findings block CI. Confirm-first: pulled the FULL findings list from the latest main SAST log (run 27347603762, semgrep 1.123.0, 1059 rules / 404 files): 20 findings = 13 rule×file groups — 2 ERROR (workflow run-shell-injection in sim-soak.yml; spawn-shell-true in sim-soak.mjs), 10 WARNING groups (all by-design: localhost transport, operator-chosen paths, bundled-table loops, opt-in CORS allowlist, sample nginx), 1 INFO.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-11 | quick-win; baseline extracted from CI logs (semgrep not runnable on Windows) |
| plan | done | 2026-06-11 | Fix both ERRORs (real fix + scoped suppression), two-pass workflow (report full / block ERROR), snapshot triage doc |
| implement | done | 2026-06-11 | Both ERRORs resolved; two-pass workflow; baseline snapshot doc. |
| review | done | 2026-06-11 | Self-review (CI config + docs, right-sized): diff = 2 workflows + 1 comment + 1 doc; suppression is rule-scoped with justification, no broad ignores (issue AC). |
| test | done | 2026-06-11 | PR #136 SAST job: report pass 18 findings (was 20 — both ERRORs gone), blocking pass **0 findings / 172 ERROR-severity rules / 407 files**. YAML parse-checked. Post-merge dispatch verify pending (sim-soak minutes=1). |
| ship | done | 2026-06-11 | Same-PR governance closure; #126 closes on merge. |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T16:00:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T16:10:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T16:25:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T16:30:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T16:58:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T17:05:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Issue | https://github.com/KbWen/agent-virtual-office/issues/126 | Semgrep baseline triage + fail-on-new |
| Doc | docs/reviews/2026-06-11-semgrep-baseline.md | 13-group triage table (snapshot) |

---

## Known Risk

- `--config auto` registry drift can introduce new ERROR rules → blocking job fails on unrelated PRs. This is the issue's INTENDED tripwire; gate comment instructs triage-not-loosen. Worst case: one PR blocked until a 1-line nosemgrep/fix lands.
- sim-soak.yml only runs on schedule/dispatch — PR CI does NOT parse it. Mitigation: post-merge manual dispatch (minutes=1) to prove YAML + env indirection.
- Rollback: revert commit (workflow + script comment + doc).

---

## Drift Log

none

---

## Evidence

- Baseline source: gh run 27347603762 SAST job log (20 findings; severity markers ❯❯❱=ERROR ×2, ❯❱=WARNING, ❱=INFO).
- ERROR-1 fixed: `sim-soak.yml` dispatch input now flows through `env: SOAK_MINUTES`, quoted `"$SOAK_MINUTES"` in run (Semgrep-recommended pattern).
- ERROR-2 suppressed scoped: `sim-soak.mjs:42` nosemgrep with justification (npx .cmd shim needs shell on Windows; PORT parseInt-validated).
- PR #136 CI (run 27348253589): full report pass `Ran 508 rules on 407 files: 18 findings` (20 → 18, both ERRORs resolved); blocking pass `Ran 172 rules on 407 files: 0 findings`. All 7 checks green; npm audit + TruffleHog untouched and green (issue AC).
