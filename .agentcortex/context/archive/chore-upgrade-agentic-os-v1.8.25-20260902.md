# Work Log: chore/upgrade-agentic-os-v1.8.25

## Header

- Branch: `chore/upgrade-agentic-os-v1.8.25`
- Classification: `hotfix`
- Classified by: `claude-opus-5`
- Frozen: `2026-09-02`
- Created Date: `2026-09-02`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `2375478`
- Checkpoint SHA: `none`
- Recommended Skills: `verification-before-completion`
- Primary Domain Snapshot: `governance`
- SSoT Sequence: `120`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-09-02 01:20 UTC`
- Platform: `claude-code`
- Files Read: `18`

---

## Task Description

Upgrade the deployed Agentic OS governance brain from v1.8.24 to v1.8.25. Upstream
v1.8.25 adds a release-version-consistency pytest guard (upstream-only) and repairs the
one downstream-visible defect it found: the v1.8.24 package shipped
`antigravity-v5-runtime.md` with a stale v1.8.23 framework banner.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-02 | classified hotfix; upstream tag v1.8.25 fetched and peeled |
| plan | skipped | — | hotfix fast-path (`engineering_guardrails.md §10.4`) |
| implement | done | 2026-09-02 | deploy 6 core files + manifest; predicted delta matched exactly |
| review | pending | — | — |
| test | pending | — | — |
| handoff | n/a | — | hotfix exempt from /handoff |
| ship | done | 2026-09-02 | merged as PR #219; SSoT Ship History + this archive + INDEX.jsonl chain entry |

---

## Phase Summary

**bootstrap** — `.agentcortex-src` cache fetched (`origin/main` 72ab8ef..93d0542, new tag
`v1.8.25`) and peeled to the annotated tag by `git checkout` (NOT `reset --hard`), tree clean.
Delta sized BEFORE deploying by two independent methods, because a manifest-intersect alone is
blind to files that become newly *deployable*: (a) `git diff --stat v1.8.24..v1.8.25` = 16 files,
of which 6 intersect `.agentcortex-manifest` once the `docs/` <- upstream-root remap is applied
(`docs/AGENT_MODEL_GUIDE*.md` -> `.agentcortex/docs/AGENT_MODEL_GUIDE*.md`); (b) the deploy
whitelist itself — `deploy.sh` changed exactly `1 insertion / 1 deletion`, the `ACX_VERSION`
literal, so no file entered or left the deployable set. Predicted downstream delta: exactly 6
`core` files, no additions, no removals. The other 10 upstream-changed files are upstream records,
CI config and a new upstream-only pytest guard, none of which deploy.

**implement** — deployed via the provenance-verified source clone's own `deploy.sh` with an
absolute TARGET. Observed delta matched the prediction exactly: 6 core files + the regenerated
manifest, `202 updated / 0 new / 0 removed`. The manifest's own hash diff is confined to those
same 6 rows — no entry added or dropped. `.gitignore` showed as modified with an EMPTY content
diff and a byte count identical to HEAD (3230 == 3230): pure CRLF/LF working-tree noise from
`deploy.sh`'s merge-not-copy handling, restored with `git checkout --` rather than committed as
churn. All 6 deployed files then byte-compared (`cmp`) against the v1.8.25 source, including the
two remapped paths — 6/6 identical, so "deployed from a tag" is proven rather than asserted.

⚡ ACX

---

## Gate Evidence

- Gate: implement | Verdict: PASS | Classification: hotfix | Timestamp: 2026-09-02T01:25:00Z
- Gate: ship | Verdict: PASS | Classification: hotfix | Timestamp: 2026-09-02T06:40:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | — | docs-only version bump; no spec required (hotfix) |
| ADR | — | — |
| Issue | — | — |
| PR | https://github.com/KbWen/agentic-os/pull/426 | upstream v1.8.25 release PR |

---

## Known Risk

- **R1 — a "banner-only" upgrade silently carrying a rule change.** Refuted by measurement, not
  by reading the CHANGELOG: the full `v1.8.24..v1.8.25` diff touches no file under `.agent/rules/`,
  `.agent/workflows/`, `AGENTS.md`, or `.agentcortex/templates/`, and `deploy.sh` changed one
  literal. Residual risk: none identified.
- **R2 — deploy destroying project-authored content** (the class that bit the v1.8.24 upgrade:
  `.gitignore` is merged rather than copied, and sidecars were produced). Mitigated by a full
  `git status` scan post-deploy: 7 paths touched, all predicted, `.gitignore` byte-identical and
  reverted. No sidecars, no untracked residue.

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

- Observed but deliberately NOT fixed here (scope discipline; `docs/specs/` is a tiny-fix
  EXCLUSION per `AGENTS.md §2`, so it cannot ride along as a trivial edit): the two validator
  twins disagree on this repo by exactly one check.
  `docs/specs/pair-programming-huddle.md` declares `status: Shipped` with a capital S;
  `validate.sh` compares case-sensitively and WARNs, `validate.ps1` does not and PASSes.
  Pre-existing and unrelated to this upgrade — neither `validate.sh` nor `validate.ps1` changed
  hash in the manifest, and `validate.ps1`'s tallies are identical pre- and post-deploy.
  Two separable follow-ups: (a) normalize our own frontmatter to `shipped`; (b) the upstream
  twin-parity gap, which is upstream's `[paired-check-parity]` class.

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

none

---

## Evidence

- Upstream provenance: `.agentcortex-src` at `git describe --tags --exact-match HEAD` = `v1.8.25`
  (`f250db1`), working tree clean. Manifest `source_commit` 1.8.24/`a6b04a2` -> 1.8.25/`f250db1`.
- Predicted-vs-observed delta: predicted 6 core files from manifest-intersect + whitelist diff;
  observed `git status` = those 6 + `.agentcortex-manifest`. `deploy.sh` numstat `1 1` (ACX_VERSION only).
- Byte parity vs v1.8.25 source, all 6 incl. both remapped paths: `parity_all_ok=1` (`cmp` per file).
- Banners after deploy: `deploy.sh:29 ACX_VERSION="1.8.25"` · `TESTING_PROTOCOL.md:1 v1.8.25` ·
  `AGENT_MODEL_GUIDE.md:1 v1.8.25` · `antigravity-v5-runtime.md:11 (v1.8.25)` — the last is the
  stale-v1.8.23 banner this release exists to repair, confirmed corrected in OUR tree.
- Validator, pre-deploy baseline captured OUTSIDE the repo: `validate.ps1 exit 0 ·
  pass=114 warn=5 fail=0 skip=5 · "Agentic OS integrity check passed"` (unqualified).
- Validator, post-deploy: `validate.ps1 exit 0 · pass=114 warn=5 fail=0 skip=5` — byte-identical
  tallies to the baseline, which is the expected result for a banner-only upgrade and is what makes
  the "no gate/engine change" claim measured rather than assumed.
- Validator twin, post-deploy: `validate.sh exit 0 · pass=113 warn=6 fail=0 skip=5 ·
  "Agentic OS integrity check passed"` (unqualified). Both twins `fail=0`, both exit 0.
  The 1-pass/1-warn twin delta was accounted for line-by-line rather than waved off: it is
  `docs/specs/ files with unrecognized status value: 1`, caused by a capital-S `status: Shipped`
  in one of THIS repo's specs that `validate.sh` compares case-sensitively and `validate.ps1`
  does not. Pre-existing, unrelated to the upgrade, recorded in `## Drift Log`. The remaining
  5 WARNs are the historical archived-Work-Log structural set, identical on both twins.
- Historical baseline for the twin I had no pre-deploy run of: the `v1.6.6` release commit
  (`2375478`, this branch's Diff Base) records `validate.sh pass=113 warn=6 fail=0 skip=5` --
  byte-identical to the post-deploy measurement. So BOTH twins are provably unchanged by this
  upgrade, `validate.ps1` against a baseline I captured in-session and `validate.sh` against a
  baseline already committed to git history.
