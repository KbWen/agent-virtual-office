# Work Log Compaction Overflow: fix/dev-server-parity

## Phase Summary

Overflow of the full `## Review Feedback` section, moved out at ship-time compaction
(2026-09-26T17:55:10Z) per `.agent/workflows/handoff.md §6` (active log exceeded the 12KB
`max_kb` threshold). Points back at the active/final log:
`.agentcortex/context/work/fix-dev-server-parity.md` (or, once shipped,
`.agentcortex/context/archive/fix-dev-server-parity-20260926.md`).

## Review Feedback (full, pre-compaction)

Round 1 — fresh adversarial reviewer, 2026-09-26T09:43Z, HEAD `0498ff8`.

| # | Verdict | Evidence |
|---|---|---|
| F-1 fallback ignores files outside project root | ✅ PROVEN | `vite.config.mjs:772-781`; mutation (guard removed) → fabricated status; fixed → `null` |
| F-2 webhook/API status not overwritten in stale window | ✅ PROVEN (w/ R-1 regression) | `:727-730`; mutation (10_000) → overwritten; fixed → kept |
| F-3 SSE watcher reacts to add/unlink | ✅ PROVEN | `:374-380` |
| F-4 plugin CORS authoritative in dev | ✅ PROVEN | `:804`; mutation (cors on) → ACAO wrong both directions; fixed → correct |
| F-5 scanAndMerge call sites guarded | ✅ PROVEN (code) | `:337-338,363-367`; tests non-discriminating (disclosed) |
| F-6 dev LAN/no-token warning matches prod | ✅ PROVEN | `bin/cli.js:345-351` text identical to `server.mjs:540-544` |

Findings: **R-1 BLOCKING** — `:717` hook-file guard widened 10s→5min, no `_cwd` filter; any
project's hook file silences this project's fallback almost permanently (probe: other-project
30s-old hook file → `null`; at 10s → `dev working`). Fix: keep `FALLBACK_PROTECT_MS` on the
bare-file check only, restore hook-file check to 10s. — R-2 (disclosure) CLI/npx root = package
dir, fallback inert there post-F-1; document in spec. — R-3 (low) status dir inside project root
still fabricates. — R-4 (low, pre-existing) nested `.claude/worktrees/**` fires main checkout's
fallback; consider ignoring `.claude/`. — R-5 (low) `STALE_MS` not exported; follow-up. — R-6
(low) Evidence line miscounted (said 26/26, actual 11).
Security clean. Evidence: `npx vitest run` → 135 files/2527 tests (2026-09-26T09:42Z).

Round 2 — fresh reviewer, 2026-09-26T10:09Z, HEAD `f8fdf78`, diff `c238a30...HEAD`.

| # | Verdict | Evidence |
|---|---|---|
| R-1 foreign hook file no longer silences fallback | ✅ PROVEN | `:65,726` `HOOK_ACTIVE_MS`; mutation→`FALLBACK_PROTECT_MS` gives `null`, HEAD → `dev working` |
| R-2 CLI/npx inert disclosure | ✅ PROVEN | spec matches `bin/cli.js:8,360` |
| R-3 status dir nested in root excluded | ✅ PROVEN | `:790-801`; mutation (drop check) → `res working`, HEAD → `null` |
| R-4 tests use temp roots | ✅ PROVEN | `bootDevServer` mkdtemp root |
| R-5 `STALE_MS` export minimal | ✅ PROVEN | `scanSessions.mjs:30` export-only |
| R-6 evidence counts | ✅ PROVEN | 10+3=13; suite 2529 reproduced |
| F-1 path cmp case/sep/prefix (Windows) | ✅ PROVEN | UPPERCASE root + sibling-dir probes both correct |
| F-1 `.claude` skip must not silence worktree-rooted servers | ✗ UNPROVEN | R2-1 below |

Findings: **R2-1 BLOCKING** — `:805` `/node_modules|dist|\.git|\.claude/` tested the ABSOLUTE
path, so any project rooted under a `.claude` segment (every `.claude/worktrees/*` agent
worktree, incl. this repo) had its fallback permanently silenced (probe: c238a30/0498ff8 →
`dev working`, f8fdf78 → `null`). Fix: match against `path.relative(projectRoot, file)`,
segment-anchored. — R2-2 (low) test temp dirs never cleaned up. — R2-3 (low) spec scope line
omits `scanSessions.mjs`. — R2-4 (governance) Work Log over compaction caps; malformed/misordered
09:43:10Z receipt.
Security clean. Evidence: `npx vitest run` → 135 files/2529 tests, no timeouts.

---

### Round 3 (orchestrator, 2026-09-26T10:36:40Z)

- PASS at `f2a02fd`: segment match on `path.relative(root,file)` fixes the `.claude/worktrees` + `distance.js` cases; parity/cli/middleware tests 16/16; validator fail=0 per implementer, re-run below.
