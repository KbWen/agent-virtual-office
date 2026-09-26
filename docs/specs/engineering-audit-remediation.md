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

## 2026-09-26 Server Hardening Wave

Routed from a 2026-09-26 server audit of `server.mjs` (hotfix `fix/server-hardening`, security escalation per `engineering_guardrails.md` §10.4 — touches access-control logic). Findings re-derived from source before fixing; all four confirmed as real:

- **F1 (P1 crash)**: `new URL(req.url, 'http://x')` in the main request listener (`server.mjs`, then ~L470) and in `serveStatic` (~L421) had no guard. A raw-socket request whose request-target makes the WHATWG URL parser throw (e.g. `GET http://a:b:c/ HTTP/1.1`) threw synchronously inside the `http.createServer` callback — outside any `req`/`res` `'error'` listener — crashing the whole process. Reproduced with a raw `net` socket before fixing (`proc.exitCode === 1`). Fix: `safeParseUrl()` helper wrapping `new URL()` in try/catch, used at both call sites; malformed input now gets `400 Bad Request` and the process stays up. Test: `tests/serverCrashHardening.test.js` (F1 block), red→green, evidence in Work Log `.agentcortex/context/work/fix-server-hardening.md`.
- **F2 (SSE dropped ~every 60s)**: `server.setTimeout(30000)` (idle-socket timeout) and the SSE heartbeat interval were both 30s and not phase-locked, so a connection would go idle for the full 30s window before the next heartbeat and get destroyed — client (`src/inference/inferStatus.js`) observed this as a reconnect/degraded-health blip roughly every 60s. Fix: `req.socket.setTimeout(0)` on the `/api/status/stream` route only (slowloris guards `headersTimeout`/`requestTimeout` untouched for every other route), plus heartbeat lowered to 15s as a second line of defense against the shipped `docs/deployment/nginx.conf` reverse-proxy's own 30s `proxy_read_timeout`.
- **F3 (DNS-rebinding read)**: prod `server.mjs` never validated the `Host` header (Origin-based CORS does not protect a same-origin GET reached via DNS rebinding to 127.0.0.1). Fix: `isAllowedHost()` modeled on (not identical to) Vite's `allowedHosts` semantics — `localhost`/`*.localhost`, any IP literal (v4, or v6 in bracket notation — an unbracketed IPv6 Host is deliberately rejected, see "Review Remediation round 3"), the server's own IPs, plus a new `OFFICE_ALLOWED_HOSTS` env allowlist — applied once at the top of the request handler (before routing), so it covers the API, the SSE stream, and static assets consistently. **Behavior change**: a LAN colleague reaching the office by hostname (not IP) now needs `OFFICE_ALLOWED_HOSTS` set — documented in `README.md` and `docs/deployment/DEPLOYMENT.md#environment-variables`. See "Review Remediation" sections below for corrections (it also broke the documented Nginx/Docker deployment, fixed across two review rounds).
- **F4 (dependency CVE)**: `vitest@4.1.10` / `@vitest/mocker` carried GHSA-82fw-gwwq-j7x9 (moderate, dev-only path-traversal in mock redirection). Bumped to `vitest@^4.1.11`; `npm audit` clean; full suite (2529 tests / 135 files) green on the new version.

Target files: `server.mjs`, `tests/serverCrashHardening.test.js` (new), `tests/sseSocketTimeoutGuard.test.js` (new), `package.json`, `package-lock.json`, `README.md`, `docs/deployment/DEPLOYMENT.md`.

### Review Remediation (round 2, same day)

A fresh independent `/review` returned NOT READY. F1/F2/F4 were PROVEN; F3 was PARTIAL — the Host-header guard was correct in isolation but broke the documented production deployment path, and two documentation/wording issues plus a test-isolation gap were also found. All fixed on the same branch, same spec:

- **HIGH-1 (blocking — compat/availability)**: `docs/deployment/nginx.conf` forwards the client's Host via `proxy_set_header Host $host` (for a legitimate request this equals whichever `server_name` alias was used, e.g. `office.example.com`), so the documented Nginx reverse-proxy setup got 403 on every request the moment F3 shipped — verified live by the reviewer. Fixed by: (a) documenting `OFFICE_ALLOWED_HOSTS=<server_name>` in `DEPLOYMENT.md`'s Nginx section, as a comment in `nginx.conf` next to `server_name`, and as a commented env example in `office.service` and `pm2.config.cjs`; (b) logging one line per distinct rejected hostname, capped at 50 for the process's lifetime (not a time-window rate limit), naming both the host and `OFFICE_ALLOWED_HOSTS`, so a misconfigured proxy is visible in server logs instead of a silent wall of 403s; (c) this note; (d) `tests/serverCrashHardening.test.js` — a proxy-style Host is 403 by default, and a new "F3 round 2" describe block spawns a second server instance with `OFFICE_ALLOWED_HOSTS` set and proves the same Host is then allowed.
- **LOW-1 (accuracy)**: reworded "mirrors Vite" → "modeled on (not identical to) Vite" everywhere it appeared (`server.mjs`, this spec, `DEPLOYMENT.md`), since AVO's allowlist genuinely differs: it supports a leading-dot suffix entry (`.example.com` matches the bare suffix AND any subdomain) and strips a trailing `:port` from env entries (both tested in the "F3 round 2" block). Also made an explicit, documented decision on a missing `Host` header: **allowed through** — an HTTP/1.1 request without `Host` never reaches our code at all (Node's own parser 400s it first per RFC 7230), and an HTTP/1.0 request without `Host` does reach `isAllowedHost`, where it is allowed because a DNS-rebinding attack requires the *browser* to send an attacker-chosen `Host`; an absent one can't be part of that attack. Both paths are tested.
- **LOW-2 (doc drift)**: corrected this file's stated test/file counts (2525/134 → 2529/135) and added the missing `tests/sseSocketTimeoutGuard.test.js` to Target Files above.
- **LOW-3 (test isolation)**: `tests/serverCrashHardening.test.js`'s spawned child now sets `OFFICE_STATUS_DIR` to the temp dir explicitly (an inherited value previously could have pointed it at the developer's real status dir) and clears `OFFICE_ALLOWED_HOSTS` (an inherited value could have silently widened the F3 403 assertions).
- **LOW-4 (advisory — SSE client cap)**: with the per-socket idle timeout disabled for SSE (F2), concurrent SSE connections had no ceiling. Added `OFFICE_MAX_SSE_CLIENTS` (default 500) — beyond it, new `/api/status/stream` connections get `503` instead of being accepted. Tested in `tests/sseClientCap.test.js` (spawns with a cap of 3 to keep the test fast; red→green and mutation-checked).

### Review Remediation (round 3, same day)

Round 2's fixer verified round-1's items as bypass-free, bounded, and leak-free, but a second fresh review still returned NOT READY: the Docker path was a second silent-outage case, an integration example was left broken, and a code-level gap (a `.` allowlist entry) plus several doc-accuracy issues surfaced from an adversarial probe. All fixed on the same branch, same spec:

- **HIGH-2 (blocking — same class as HIGH-1)**: `docker-compose.yml`'s `environment:` only forwarded `OFFICE_API_TOKEN`/`NODE_ENV` — compose never auto-forwards an arbitrary shell variable, so `OFFICE_ALLOWED_HOSTS=x docker compose up` silently never reached the container, and `DEPLOYMENT.md`'s Docker section never mentioned the var at all. Fixed: `docker-compose.yml` now forwards `OFFICE_ALLOWED_HOSTS: ${OFFICE_ALLOWED_HOSTS:-}`; the `docker run` example gets `-e OFFICE_ALLOWED_HOSTS=...`; the Nginx-section note now names Docker explicitly.
- **MEDIUM-2 (design decision)**: `docs/INTEGRATIONS.md`'s GitHub Actions example posts to a hostname URL and would silently 403 (`curl -s`, no `-f`). Rather than force every CI caller to also manage `OFFICE_ALLOWED_HOSTS`, a request carrying a **valid** `OFFICE_API_TOKEN` is now exempt from the Host check entirely (`hasValidApiToken()`, evaluated with the existing constant-time compare) — a DNS-rebinding browser cannot know that token, so proof of it is proof the caller isn't one. Token-less requests still get the full Host check. The CI example already sends the token; changed `curl -s` → `curl -fsS` so a failure surfaces, and documented the exemption inline.
- **LOW-5 (code fix)**: an `OFFICE_ALLOWED_HOSTS` entry of just `.` (e.g. a stray trailing comma) would make `host.endsWith('.')` true for every trailing-dot FQDN, re-opening rebinding via `http://attacker.com.:<port>`. `ALLOWED_HOSTS_ENV` now filters out `.`/empty entries after normalization.
- **LOW-6 (doc accuracy)**: corrected three overstatements — unbracketed IPv6 in `Host` is deliberately **rejected** (RFC 3986/7230 require brackets; not a bug, now stated as a choice, not an omission); the rejected-Host log is a **50-entry lifetime cap per process**, not a rate limit; Nginx's `$host` forwards the **client's** Host header (which for a legitimate request equals whichever `server_name` alias was used — every alias needs listing if there's more than one), not a literal copy of `server_name` itself. Also stated explicitly that an **empty** `Host:` header (not just a missing one) is allowed through.
- **LOW-7 (tests)**: added suffix-boundary-rejection tests (`evilsuffix.example` / `suffix.example.evil.com` vs `.suffix.example`) and a log-cap test (60 distinct rejected hosts → ≤50 log lines, server stays alive).
- **LOW-8 (accepted, out of scope)**: SSE writes ignore backpressure — a slow/zero-window reader can make `broadcastSSE` buffer indefinitely per client even with the connection count capped (LOW-4). Recorded as a known, accepted limitation; not fixed here (would need a `res.writableLength` bound and a drop/close policy, which is a larger behavioral change than this hotfix's scope).
