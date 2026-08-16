# Work Log: chore/ssot-index-rotation

## Header

- Branch: `chore/ssot-index-rotation`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `true`
- Created Date: `2026-08-16`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `6921d52`
- Checkpoint SHA: `6921d52`
- Recommended Skills: `verification-before-completion (auto), karpathy-principles (auto)`
- Primary Domain Snapshot: `none`
- SSoT Sequence: `116`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-08-16 01:10 UTC`
- Platform: `claude-code`
- Guardrails loaded: `AGENTS.md §Core Directives (Quick mode)`
- Override: `none` · Downstream-Capabilities: carried (`kb-main→OK`, Read-Once)
- Lock: acquired at bootstrap (`status: created`) — the miss in the preceding ADR unit is not repeated.

---

## Task Description

Restore both SSoT section caps: collapse the Spec Index (47 → 30 inline, rest to
`## Spec Index Archive`) and rotate the Ship History (11 → 10, oldest entry to
`archive/ship-history-2026.md`).

**This branch is deliberately STACKED on `chore/upgrade-agentic-os-v1.8.21`, not cut from `main`** —
and that is load-bearing, not convenience. The fix that makes Spec Index rotation safe lives *in the
validators*, which only exist at v1.8.21. Verified before starting: `main`'s v1.8.17
`validate.ps1`/`validate.sh` contain **0** references to `Spec Index Archive`; the v1.8.21 pair
contains **2 each**. Performing this rotation on a `main`-based branch would reproduce the exact
13-FAIL outcome recorded in the SSoT's `Ship-chore-ssot-rotation-and-worklog-hygiene-2026-07-10`
entry. **This work must not merge before the upgrade does.**

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-08-16 | quick-win; lock acquired; dependency on upgrade branch verified first |
| plan | done | 2026-08-16 | move only `[Shipped]` lines; never Draft/Frozen |
| implement | done | 2026-08-16 | 18 index lines archived; 1 ship entry rotated |
| review | done | 2026-08-16 | — |
| test | done | 2026-08-16 | both validators |
| ship | done | 2026-08-16 | — |

---

## Phase Summary

- implement/test: **the prior "never rotate the Spec Index" rule is now obsolete, and this was
  proven rather than assumed.** That rule came from the 2026-07-10 session, where rotating produced
  13 hard FAILs because the validators' regex stopped at the next `##` header and knew nothing about
  `## Spec Index Archive`. Upstream fixed it in `b5d2e29` (#381); `validate.ps1:2240-2243` now
  scrapes the live index block **and** unions `^## Spec Index Archive` into it. The rotation was
  applied and then measured: `[PASS] SSoT Spec Index completeness: all shipped/living specs are
  indexed`, `fail=0`. | Confidence: 95%.
- Only `[Shipped]` index lines were moved. The 1 `[Draft]`, the 2 `[Frozen]`, and the trailing
  "When reading specs…" instruction line all stay inline — rotating a non-shipped spec would hide
  live design authority behind an archive header.
- **A miscount caught by measurement, not by reading**: the first pass moved 17 lines and left the
  count at 31, because the explanatory pointer line I added is itself an indented child entry and
  the cap counter counts those. Fixed by moving one more `[Shipped]` line (18 total), keeping the
  pointer — it earns its slot by telling a reader where the rest went.
- **Pre-existing drift found while rotating**: the Ship History closing note claimed
  "Older entries (68)" while the archive actually held **74** before this rotation — a hand-carried
  count that had already drifted by 6. Rather than update it to 75 (which drifts again on the next
  rotation), the number was **deleted**, following upstream's own precedent in this same release
  wave: `aca9bf4 chore(ssot): delete the hand-carried backlog count`.

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T01:10:00+08:00
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T01:14:00+08:00
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T01:30:00+08:00
- Gate: review | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T01:36:00+08:00
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T01:40:00+08:00
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T01:44:00+08:00

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Upstream | `b5d2e29` (#381) | made the Spec Index collapse remedy executable; closed the over-fold path |
| Upstream | `aca9bf4` (#406) | precedent for deleting hand-carried counts instead of maintaining them |
| Code | `.agentcortex/bin/validate.ps1:2240-2243` | the union of live index + `## Spec Index Archive` |
| Prior | SSoT `Ship-chore-ssot-rotation-and-worklog-hygiene-2026-07-10` | the 13-FAIL attempt this supersedes |

---

## Known Risk

- **R1 — merging this before the v1.8.21 upgrade would hard-FAIL the validator.** Not mitigated by
  code; it is a merge-order constraint, stated in §Task Description and in the commit message. The
  branch is stacked so git itself carries the dependency.
- **R2 — over-folding re-WARNs** (`ship.md:184`). Mitigated: inline count landed at exactly 30 and
  `check_ssot_caps.py` prints `spec index 30/30`, not an over-fold warning.
- **R3 — relative-link depth hazard** on content moved from `current_state.md` (depth 2) to
  `archive/` (depth 3). Checked: the rotated Ship History entry contains **no** `](../` or `](./`
  links, so no flattening was required.

---

## Conflict Resolution

none

---

## Drift Log

- Skip Attempt: NO · Gate Fail Reason: N/A · Token Leak: NO
- Guarded SSoT writes outside `/ship` (4 total: two index collapses, the ship-history rotation, and
  the hand-carried-count deletion). All went through `guard_context_write.py` with a fresh
  `--expected-sha` each time and were verified after write. Logged here because
  `AGENTS.md §Write Isolation` reserves SSoT writes for `/ship` and this unit's whole payload IS the
  SSoT.
- One failed write attempt mid-task: the archive-insertion regex assumed column-0 `- ` while the
  rotated lines are indented `  - `. The guard rejected the run because the input file was never
  produced, so **no partial state was written**; corrected and re-run.

---

## Evidence

- Dependency check before any edit: `git show main:.agentcortex/bin/validate.ps1 | grep -c 'Spec
  Index Archive'` → **0** (same for `validate.sh`); on the v1.8.21 base → **2** each.
- Spec Index: 47 → **30 inline + 18 archived**. Composition preserved: 1 `[Draft]`, 2 `[Frozen]`,
  and the instruction line all retained inline; only `[Shipped]` lines moved.
- Ship History: 11 → **10**; `Ship-chore-ssot-rotation-and-worklog-hygiene-2026-07-10` prepended to
  `archive/ship-history-2026.md` (now 75 `### Ship-` entries) with its rotation note updated.
- `check_ssot_caps.py` → **`ssot caps OK — ship history 10/10, spec index 30/30 (+18 archived)`**
  (was two WARNs). First time both caps are satisfied.
- `validate.ps1` → `pass=113 warn=6 fail=0 skip=5`, **`[PASS] SSoT Spec Index completeness: all
  shipped/living specs are indexed`** — the check that previously produced 13 FAILs.
