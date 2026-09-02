# Work Log: chore/release-v1.6.7

## Header

- Branch: `chore/release-v1.6.7`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `2026-09-02`
- Created Date: `2026-09-02`
- Owner: `KbWen`
- Guardrails Mode: `Lite`
- Current Phase: `ship`
- Diff Base SHA: `9834257`
- Checkpoint SHA: `e85e25d`
- Recommended Skills: `verification-before-completion`
- Primary Domain Snapshot: `release`
- SSoT Sequence: `122`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-09-02 06:00 UTC`
- Platform: `claude-code`
- Files Read: `66`

---

## Task Description

Cut v1.6.7 from the 10 commits merged since v1.6.6 (2026-08-26): version surfaces, CHANGELOG,
Ship History, then the annotated tag and the GitHub Release.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-02 | 10 unreleased commits on `main`; `package.json` still at 1.6.6 |
| plan | skipped | - | quick-win fast-path; release process is `repo-gotchas` §12 |
| implement | done | 2026-09-02 | 3 version surfaces + CHANGELOG + Ship History |
| review | done | 2026-09-02 | self-review of the user-facing/housekeeping split |
| test | done | 2026-09-02 | full suite, build, bundle, smoke, both validators, chain, caps |
| handoff | n/a | - | quick-win exempt |
| ship | done | 2026-09-02 | PR #229 (squash `e85e25d`), annotated tag, Release marked latest |

---

## Phase Summary

**implement** — no app code in the release commit itself, mirroring the v1.6.6 shape.
`package.json` 1.6.6 -> 1.6.7 and **both** `package-lock.json` version fields (root and
`packages[""]`), asserted rather than assumed: the edit refused to proceed unless exactly two
lockfile fields matched, and a follow-up scan confirmed **zero `1.6.6` strings remain** in either
file. Ship History entry added with the AVO-191 entry rotated into `archive/ship-history-2026.md`
to hold the cap of 10; SSoT sequence 121 -> 122 through `guard_context_write.py` and verified by
re-reading, since that tool can report `status: ok` while writing stale cached content.

**review — the split is the substance of this release.** Only **2 of the 10** commits are
user-facing: the AVO-194 nap/drowsiness honesty fix (three sites, not the one the backlog row
recorded) and the multi-agent reaction lines (three keys, the third found by the guard written for
the first two). The other eight are governance and tooling and sit under an explicit
"Housekeeping — not user-facing" heading rather than being dressed up as product value.

**The notes also record a claim that did not survive the same day.** `npm run rhythm` shipped in
this wave with a measurement saying ambient motion is spread rather than clustered; two later runs
did not reproduce it, and the cause was the metric itself — an absolute point-gap is bounded by the
independent level it is compared against, so runs at different motion levels were never comparable.
The CHANGELOG says so under "What this release does not claim", and states the finding is **not
established**. A release that claims more than it measured is the same defect class as an office
claiming a working agent is asleep, which is what this release is about.

⚡ ACX

---

## Gate Evidence

- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T05:45:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T05:55:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-02T06:05:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | - | release cut |
| ADR | - | - |
| Issue | - | - |
| PR | https://github.com/KbWen/agent-virtual-office/pull/229 | merged 2026-09-02, squash `e85e25d` |
| Release | https://github.com/KbWen/agent-virtual-office/releases/tag/v1.6.7 | annotated tag, marked latest |

---

## Known Risk

- **R1 — a lightweight tag instead of an annotated one.** This repo has forgotten the tag/Release
  step twice, and a lightweight tag carries no message or tagger. Verified explicitly:
  `git cat-file -t v1.6.7` returns `tag`, not `commit`.
- **R2 — a half-bumped lockfile.** The standing note that the lockfile root was stale at 1.4.0 died
  at the v1.6.5 cut; both fields move together now, and the count is asserted before the edit.
- **R3 — npm publish.** This package is not published to npm and this cut did not publish it;
  `prepublishOnly` exists but was never triggered.

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

- This log, like #227's, is written at closure rather than at bootstrap, and its INDEX entry is
  appended after the merge — the chain is per-branch and linearises cleanly only post-merge.

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

- `npx vitest run` — **2357 passed / 119 files / 0 failed**.
- `npm run build` PASS; `bundle-budget` PASS at 496392 vs baseline 496504 (**-0.02%**).
- `npm run smoke` (render-smoke) PASS across 4 viewports, min 1854 svg descendants, **0 page errors,
  0 console errors**.
- `validate.ps1` exit 0, `pass=114 warn=5 fail=0 skip=5`. `check_audit_chain` intact.
  `check_ssot_caps` ship history 10/10, spec index 30/30.

---

## Evidence

- Version surfaces after the bump: `package.json` `1.6.7`; `package-lock.json` both fields `1.6.7`;
  `grep -c '1\.6\.6'` returns **0** for each file.
- Tag: `git cat-file -t v1.6.7` -> `tag` (annotated); `git rev-list -n1 v1.6.7` -> `e85e25d`, the
  release merge commit on `main`.
- Release: `tag=v1.6.7 draft=false prerelease=false published=2026-09-02T06:00:03Z`, and
  `repos/.../releases/latest` resolves to `v1.6.7`.
