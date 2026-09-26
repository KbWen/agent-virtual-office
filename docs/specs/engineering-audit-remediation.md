---
status: shipped
classification: feature
source: internal
primary_domain: office-runtime
secondary_domains:
  - ui-rendering
  - hook-integration
---

# Engineering Audit And Performance Remediation

## Goal

在不做未授權大重構的前提下，對 Agent Virtual Office 進行一次可驗證的工程審查，找出並修復高信心的明顯 correctness 問題與效能熱點，優先處理會影響互動流暢度、狀態正確性、或 hook/event 資料處理穩定性的項目。

## Acceptance Criteria

- AC1: 產出一份具體 issue 清單，至少涵蓋 `correctness` 與 `performance` 兩類，每個項目都必須附上受影響檔案、症狀、以及為何值得修。
- AC2: 只實作高信心、可局部修正、可回滾的問題；每一項修正都必須能對應回 issue 清單中的具體項目。
- AC3: 若修正涉及行為邏輯，必須補上或更新對應測試，且至少覆蓋 happy path、error path、或 boundary condition 其中適用者。
- AC4: 若修正涉及效能，必須提供至少一個可重現的 before/after 指標，例如 render 次數下降、重複 state update 減少、或不必要的運算/輪詢被消除。
- AC5: 不得破壞既有 backlog 已交付能力，特別是多 worktree session 顯示、hook 狀態寫入、designer/file routing、以及 webhook 事件處理。
- AC6: 本次交付的 target files 必須明確收斂，避免演變成整體架構重寫或視覺重設計。

## Non-goals

- 不新增 backlog feature，例如角色成長、Inspector 擴充欄位、可點擊辦公室物件。
- 不重新設計 pixel office 視覺、角色造型、或整體 UI 風格。
- 不在沒有明確 finding 的情況下重寫 store、事件模型、或 hook 協定。
- 不引入新的 runtime dependency，只為了做一般性效能優化。

## Constraints

- 維持現有 React + Vite + Zustand 架構與既有 ADR 決策。
- 修正需優先集中在現有高風險模組，例如 `src/components/`, `src/systems/store.js`, `src/systems/officeLife.js`, `src/inference/`, `public/hooks/`。
- 所有變更必須保持小而可逆，並能以 commit revert 或單一 patch 回退。
- 若發現問題牽涉更大範圍的設計債，先記錄成 follow-up，不在本次規格內擴張。

## API / Data Contract

- 本次規格不新增對外 API。
- 既有 hook payload、session slug、`_cwd` project isolation、以及 UI 對 agent status/mood/activity 的資料契約都視為相容性邊界。

## File Relationship

INDEPENDENT from `docs/specs/_product-backlog.md`.

這份 spec 定義的是一次 maintenance / remediation pass，而不是新增產品功能；backlog 仍然是產品需求索引，本 spec 則約束這次審查與修正工作的邊界。

## Domain Decisions

- [DECISION] 本次工作採用 finding-driven remediation，而不是先做大規模重構；只有被審查證據支持的問題才納入修正。
- [DECISION] 渲染 churn、store fan-out、以及 hook/event ingestion 是優先審查面向，因為它們直接影響畫面流暢度與狀態正確性。
- [CONSTRAINT] 已交付的多 worktree、routing、designer、webhook 行為屬於相容性邊界，不得在沒有明確 bug 證據時改變契約。
- [TRADEOFF] 優先接受局部、保守、可驗證的改善，而不是追求理想化的系統性清理，以降低回歸風險。
- [CONSTRAINT] 效能改善必須附帶可重現的 before/after 證據，不能只憑主觀感受宣稱變快。

## 2026-06-05 Documentation Baseline Consolidation

Routed from `docs/reviews/2026-06-05-audit.md` (read-only audit → `都處理` directive). Doc-only, reversible, no source/test change. validate.sh: 0 fail.

- **F1 — SSoT readability.** `.agentcortex/context/current_state.md` was 347 lines / >25k tokens (over the single-read cap). Rotated Ship History older than 2026-06-02 (142 lines) into `docs/specs/_ship-history-archive.md`; SSoT now 206 lines. Guarded CAS write.
- **F4 — ARCHITECTURE.md model drift.** The headline diagram describes the superseded Level-A/B + `inferStatus.sh` concept; the shipped model (`classify.js` 4-tier + `decideBehavior` + zustand) is the v1.1.0 section 540 lines down. Added a top-of-doc banner flagging this + the stale `docs/context/` → `.agentcortex/context/` path note. (Full re-draw deferred — would be an unauthorized large refactor.)
- **F5 — ADR-001 duplication.** `docs/adr/ADR-001` made canonical (fixed stale `docs/context/work/` → `.agentcortex/context/work/`); `.agentcortex/adr/ADR-001` reduced to a pointer stub per the `[path-separation]` Global Lesson.
- **F6 — ADR lifecycle.** Added YAML frontmatter + `lifecycle:` block (owner/cadence/trigger/supersedes/superseded_by) to ADR-001/002/003 — clears the grandfathered validator WARNs.
- F2/F3 (domain decision logs) and F7 (backlog baseline note) routed to their own canonical targets; see the audit snapshot.
- **F7 — branch hygiene (corrected in /review):** the ux-vibe-rebalance wave is ALREADY merged to `main` via squash PR #44 (`012d0f2`, v1.2.0). Git-verified: `main`↔`feat/ux-vibe-rebalance` `src/` byte-identical, `main` 3 commits ahead. The original "unmerged baseline divergence" claim was a stale-SSoT propagation error caught by an adversarial documentation-accuracy reviewer. No merge needed; `feat/ux-vibe-rebalance` is superseded dev history and has already been pruned from origin (2026-06-05 drift sweep — origin has only `main`).

## 2026-09-24 Audit Remediation Wave

Routed from `docs/reviews/2026-09-24-audit.md` (read-only audit findings). Focus on concurrency clock integrity and debug tooling parity without unauthorized refactoring:

- **F-01 (Monotonic Clock Parity)**: In `vite.config.mjs`, import `nextSeq` from `./src/utils/statusContract.mjs` and remove local duplicate counter. Guard with test in `tests/viteEventMiddlewareParity.test.js`.
- **F-05 (Bridge UI Parity)**: Add `planning` and `awaiting-approval` status toggle buttons to `public/bridge-ui.js` matching `statusContract.mjs` valid statuses.
- **F-04 (Spec Drift)**: Document wave closure and maintain living traceability.

## 2026-09-26 Dev-Server Parity Wave

Routed from a follow-up audit that re-derived the remaining dev-only (`vite.config.mjs`) divergences
from `server.mjs` (production) after the 2026-09-24 wave fixed the shared `_seq` clock. Branch
`fix/dev-server-parity`; behavioral tests in `tests/viteDevServerParity.test.js` (real
`vite.createServer()` harness) and `tests/cliDevLanWarning.test.js`; scope limited to
`vite.config.mjs` and the dev-start warning lines in `bin/cli.js` (no `server.mjs` or
`bin/cli.js` setup/uninstall changes — those belong to sibling remediation branches).

- **F-1 (file-watcher fallback scope leak)**: `officeStatusPlugin`'s `server.watcher.add(watchDir)`
  extends the SAME shared chokidar watcher to also cover `OFFICE_STATUS_DIR`, but
  `fileWatcherFallbackPlugin`'s `'change'` handler had no project-root check — any write under the
  status dir (a Claude Code transcript `projects/**/<uuid>.jsonl`, a `debug/*.txt` log, etc.) was
  misread as a project source edit and fabricated a fake, `_cwd`-less agent status that then showed
  up in *any* project's office. Fixed: the fallback now resolves `server.config.root` and ignores
  any file outside it, plus explicitly ignores the status dir itself (even when nested inside the
  project root) and `.claude/` (Claude Code state / nested worktrees).
  **Disclosure**: under `bin/cli.js`/npx, Vite's cwd — and therefore `server.config.root` — is the
  *installed package directory* (`bin/cli.js` resolves `root` from its own location and spawns Vite
  with `cwd: root`), not the end user's project (`OFFICE_PROJECT_ROOT` only affects `_cwd` stamping,
  a separate mechanism). So after this fix, the zero-config file-watcher fallback can only fire on
  edits inside the installed package — which CLI/npx users never touch — making it effectively inert
  for that install path. Before this fix it appeared to "work" for CLI users only via the very
  `OFFICE_STATUS_DIR` leak this fix closes (any of their own hook/transcript activity under
  `~/.claude` was being misread as a source edit). The fallback remains fully functional for in-repo
  `npm run dev`, where `server.config.root` is the real project. No further change made here —
  correct root-scoping honesty over a feature that only ever worked by relying on the bug.
- **F-2 (fallback overwrite window too short)**: the fallback's guard against overwriting a
  webhook/API-set **bare-file** status used a hardcoded 10s window; production (`server.mjs`) has
  no fallback at all, so a `blocked`/API-set status there simply persists until the real
  ~5-minute stale window. Fixed: that specific guard's window is now `FALLBACK_PROTECT_MS`, which
  imports `STALE_MS` from `src/server/scanSessions.mjs` (now exported — an in-scope import, since
  `vite.config.mjs` already imports other symbols from that module).
  **R-1 regression (caught in review) and fix**: the FIRST implementation of this finding also
  widened the SEPARATE "don't write while a hook is actively running" guard (which scans every
  slugged hook file in the shared status dir with no `_cwd` filter) from 10s to the same 5-minute
  window — since `~/.claude` is shared across every project, any OTHER project's hook file
  (written on every tool call, from a session that could sit idle for minutes) then silenced
  THIS project's fallback almost permanently. That guard did not need widening (the fallback
  never writes hook files, so F-2's overwrite scenario never applied to it) and is now a
  distinct, still-short `HOOK_ACTIVE_MS = 10_000` constant, unaffected by the `STALE_MS` import.
  Regression test: `tests/viteDevServerParity.test.js` "R-1 hook-file guard does not silence the
  fallback for a foreign project" — a 30s-old foreign-`_cwd` hook file must not suppress this
  project's own fallback write.
- **F-3 (watcher missed add/unlink)**: `officeStatusPlugin`'s SSE-push watcher only bound `'change'`;
  a brand-new or deleted session file waited for the next poll instead of an immediate push.
  Production's `fs.watch` fires on rename too. Fixed: also bind `'add'` and `'unlink'` to the same
  debounced handler.
- **F-4 (dev CORS preflight divergence)**: Vite registers its own permissive-loopback
  `server.cors` middleware *before* plugin middlewares, so it always answers OPTIONS itself and
  unconditionally adds `Access-Control-Allow-Origin` for loopback GETs — bypassing this file's own
  `isAllowedOrigin`/`OFFICE_API_ALLOWED_ORIGINS` logic entirely. An explicit non-loopback allowed
  origin failed preflight in dev (worked in prod); a loopback origin excluded by an explicit
  allowlist was still let through in dev (rejected in prod). Fixed: `server.cors: false`, so the
  plugin's own logic is the sole authority in dev too. Verified `npm run smoke` / `npm run
  smoke:panel` still pass (HMR/dev asset serving is same-origin, no preflight involved).
- **F-5 (unguarded `scanAndMerge` call sites)**: the `/api/status/stream` initial-snapshot read and
  the watcher-debounce broadcast callback called `scanAndMerge` with no try/catch, unlike every
  other call site in this file and in `server.mjs`. Fixed defensively (matches the existing
  pattern elsewhere in this file) — no forced-throw regression test was written since
  `scanAndMerge`/`readSessionFileCached` already guard per-file parse errors internally; the added
  tests instead confirm a corrupt session file does not crash the dev server end-to-end.
- **F-6 (no LAN-exposure warning in dev)**: `bin/cli.js` binds the dev server to `--host` (LAN,
  0.0.0.0) by default with no `OFFICE_API_TOKEN` warning, unlike `server.mjs`'s production
  warning. Fixed: the same warning now prints from the dev-start path under the same condition
  (LAN-bound, no token).
- Considered out of scope: dev never sweeps stale session files the way `server.mjs`'s 10-minute
  interval does. Not implemented — would need its own design (sweep cadence, dev-only lifecycle)
  rather than a copy-paste, and no correctness bug was found from its absence (stale files are
  already excluded from `scanAndMerge` by `_seq` age, they just aren't deleted from disk).
