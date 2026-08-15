# Work Log: chore/remove-dead-deskcluster

## Header

- Branch: `chore/remove-dead-deskcluster`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `true`
- Created Date: `2026-08-16`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `4fd13ebef8b10ab2428499d2553b1e5ba2a5792c`
- Checkpoint SHA: `4fd13ebef8b10ab2428499d2553b1e5ba2a5792c`
- Recommended Skills: `verification-before-completion (auto), karpathy-principles (auto), frontend-patterns (scope-detected)`
- Primary Domain Snapshot: `ui-rendering`
- SSoT Sequence: `116`

---

## Session Info

- Agent: `claude-opus-5` · Session: `2026-08-16 02:00 UTC` · Platform: `claude-code`
- Guardrails loaded: `AGENTS.md §Core Directives (Quick mode)` · Override: `none`
- Lock: acquired at bootstrap (`status: created`).

---

## Task Description

Remove `DeskCluster` from `src/components/TopDownFurniture.jsx` — exported, never imported or
rendered anywhere. Found by the 2026-08-16 `src/` tech-debt scan. Branched from `main` (`4fd13eb`),
independent of the three other open branches.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-08-16 | quick-win; single file |
| plan | done | 2026-08-16 | delete decl + its banner comment; nothing else |
| implement | done | 2026-08-16 | −17 lines |
| review | done | 2026-08-16 | `React.memo` still used 17× — import stays |
| test | done | 2026-08-16 | same-branch A/B render proof |
| ship | done | 2026-08-16 | — |

---

## Phase Summary

- The scan originally flagged **7** dead exports; **6 were false positives** — my detector excluded
  the defining file from the reference search, so symbols used only within their own module looked
  unreferenced (`onLocaleChange`, `drawCard`, `DOOR_CLAIM_LEASE_MS`, `HELPER_OFFSETS`,
  `HELPER_HEAVY_THRESHOLD`, `MODE_EMOTE`). Each was re-checked individually before anything was
  deleted. `DeskCluster` is the only genuine one: it appears exactly once in the whole repo, at its
  own declaration. | Confidence: 97%.
- **The verification that mattered, and the near-miss in it.** `render-smoke` reported
  `min svg descendants 2042`, while an earlier run in this session reported **2051** — which would
  mean removing "dead" code changed the render, i.e. it was not dead. It did not mean that: the 2051
  run was on a *different branch* (`chore/dependency-refresh-cve-clearance`, with bumped deps), so
  two variables had moved at once. Re-measured properly as a **same-branch A/B**: main unmodified →
  `2042`, with the removal → `2042`. Provably render-inert.
- Lesson worth keeping: `min svg descendants` is a **floor assertion over a live animated scene**,
  not a render fingerprint. Cross-branch or cross-run comparisons of that number are not evidence of
  anything; only a same-tree A/B is.

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T02:00:00+08:00
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T02:02:00+08:00
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T02:06:00+08:00
- Gate: review | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T02:09:00+08:00
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T02:14:00+08:00
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T02:17:00+08:00

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Code | `src/components/TopDownFurniture.jsx` | the only file changed |
| Prior | 2026-08-16 `src/` tech-debt scan | source of the finding |

---

## Known Risk

- **R1 — deleting a component that is actually rendered would silently remove office furniture, and
  no unit test would catch it** (the suite asserts behavior, not scene composition). Mitigated by the
  same-branch A/B render proof above, not by the test suite.
- **R2 — `React.memo` import could be orphaned** by the deletion. Checked: still used 17× in the
  file; the import stays.

---

## Conflict Resolution

none

---

## Drift Log

- Skip Attempt: NO · Gate Fail Reason: N/A · Token Leak: NO
- `karpathy-principles` §3 says "if you notice unrelated dead code, mention it — don't delete it".
  Deleting here is authorized: the owner queued this item explicitly as D3 in the tech-debt list.
  Recorded so the deviation from the default is traceable.

---

## Evidence

- Dead-code proof: `grep -rn "DeskCluster"` across `*.js/jsx/mjs/md/html` (excluding `node_modules`,
  `dist`) → **1 hit in `src/`**, the declaration itself. The 4 other hits are abandoned
  `.claude/worktrees/*` copies, which are gitignored and not built.
- Diff: **1 file, −17 lines, 0 additions.**
- Build PASS; bundle **496.50 → 496.18 kB** (−320 bytes), consistent with removing dead code.
- Vitest **114/114 files, 2306/2306 tests**.
- `render-smoke` PASS, 4 viewports, 0 pageerrors, 0 console errors.
- **Same-branch A/B**: `main` unmodified → `min svg descendants 2042`; with removal → `2042`.
