---
doc_state: snapshot
title: Project Review and Audit Handoff for Claude
date: 2026-09-08
baseline_sha: 438da3b
scope: verified defects, contract drifts, and documentation discrepancies; no runtime changes
status: open — handoff for Claude Code triage & execution
---

# Project Review and Audit Handoff for Claude

> [!NOTE]
> **Audit Baseline Date:** 2026-09-08 | **Baseline SHA:** `438da3b` (`main`)  
> **Scope:** Full-repo static and dynamic audit covering server, client, hooks, Docker, build pipeline, and documentation. No production code was modified during this audit.

---

## 1. TL;DR & Verification Baseline

The repository is healthy, with comprehensive unit tests and automated smoke gates:
- `npm test`: 119 test files, 2,362 tests passing (vitest).
- `npm run build`: Clean production bundle (dist: 496,392 bytes, passing bundle budget at -0.02% margin).
- `npm run smoke`, `smoke:panel`, `smoke:pack`: All green across 4 viewports with zero unhandled exceptions.

However, recent feature iterations (notably AVO-146 multi-session server refactor, AVO-148 hook events, and AVO-153 capture payloads) have introduced **contract drift, deployment breakage in Docker, and visual/state inconsistencies** in secondary components.

### Guidance for Claude Code
Do not perform broad refactorings or treat the proposed solutions as rigid dogma. For each item below, assess the codebase, review existing tests, weigh the architectural trade-offs, and implement targeted, reversible changes.

---

## 2. Findings Matrix

| ID | Sev | Category | Target Location | Summary | Suggested Triage |
|---|---|---|---|---|---|
| **F-01** | **P0** | Runtime / Docker | [Dockerfile:37-43](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/Dockerfile#L37-L43) | Runner stage misses `src/` directory; `server.mjs` crashes on startup with `MODULE_NOT_FOUND` | Must fix before container deployment |
| **F-02** | **P1** | Server Config | [server.mjs:68](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/server.mjs#L68) | Production server ignores `OFFICE_STATUS_DIR` env var (supported in `vite.config.js:35`) | High priority parity fix |
| **F-03** | **P1** | Contract Drift | [public/hooks/office-status-codex.js:7,60-67,89](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/public/hooks/office-status-codex.js#L7) | Codex hook drops `planning` and `awaiting-approval`, undercounts `activeCount`, and strips carry fields | Align with `statusContract.mjs` |
| **F-04** | **P1** | Contract Drift | [public/bridge.js:30,55-60](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/public/bridge.js#L30) | `VALID_STATUSES` missing `planning`/`awaiting-approval`; `{ dev: 'planning' }` misclassified as task name | Align status whitelist |
| **F-05** | **P1** | UX / Animation | [src/utils/classify.js:488](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/src/utils/classify.js#L488), [src/utils/contextBubble.js:124](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/src/utils/contextBubble.js#L124) | `awaiting-approval` agent falls back to frantic `typing` animation and random working chat bubbles | Introduce dedicated behavior/bubbles |
| **F-06** | **P2** | Documentation | [docs/INTEGRATIONS.md:38,94,118-129](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/docs/INTEGRATIONS.md#L94) | Hook docs claim "all 6 events", missing `PermissionDenied` and `StopFailure` (AVO-148) | Update docs |
| **F-07** | **P2** | Documentation | [README.zh-TW.md](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/README.zh-TW.md) vs [README.md](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/README.md) | zh-TW translation misses recent additions (Hook table, AVO-153 capture mode, Soak diagnostics) | Sync documentation |
| **F-08** | **P2** | UI Consistency | [public/bridge-ui.js:1-10](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/public/bridge-ui.js#L1-L10) | Role color palette contradicts canonical [src/config/characters.json](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/src/config/characters.json) | Sync colors or source dynamically |
| **F-09** | **P2** | Script Compatibility | [public/hooks/office-status-hook.sh:22-23](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/public/hooks/office-status-hook.sh#L22-L23) | macOS BSD `date +%s%N` outputs trailing `N`, failing numeric regex validation | Cross-platform timestamp fallback |
| **F-10** | **P2** | Localization | [public/hooks/generic-llm-bridge.js:65,72-74](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/public/hooks/generic-llm-bridge.js#L65) | Status strings hardcoded in Traditional Chinese without fallback or `detectHookLang()` | Add locale flexibility |
| **F-11** | **P3** | Build Hygiene | [package.json](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/package.json), [vite.config.js:145](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/vite.config.js#L145) | Vite ESM vs CJS warnings, `[MIXED_EXPORTS]`, and deprecated Rollup `inlineDynamicImports` | Clean up build warnings |
| **F-12** | **P3** | Documentation | [docs/ARCHITECTURE.md:90-98](file:///c:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/docs/ARCHITECTURE.md#L90-L98) | ASCII room layout diagram misses Designer and Gate stations | Update ASCII diagram |

---

## 3. Detailed Breakdown & Design Options

### F-01: Dockerfile Runner Stage Missing `src/` (P0)
- **Problem**: `server.mjs` imports modules from `./src/server/scanSessions.mjs` and `./src/utils/normalizePost.mjs`. In the Dockerfile's stage 2 (`runner`), only `dist`, `server.mjs`, and `package.json` are copied. Any container spun up from this image immediately crashes on startup.
- **Evidence**:
  ```dockerfile
  # Dockerfile:37-40
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/server.mjs ./server.mjs
  COPY --from=builder /app/package.json ./package.json
  ```
- **Options for Claude to Evaluate**:
  - *Option A (Direct & Low Risk)*: Add `COPY --from=builder /app/src ./src` to the runner stage. Simple, matches local development structure.
  - *Option B (Bundled Distribution)*: Bundle `server.mjs` and its internal dependencies into a standalone single-file server artifact during build stage, reducing container file footprint.

---

### F-02: `OFFICE_STATUS_DIR` Ignored in `server.mjs` (P1)
- **Problem**: `vite.config.js:35` allows overriding the status directory via `process.env.OFFICE_STATUS_DIR || path.join(os.homedir(), '.claude')`. In `server.mjs:68`, the path is hardcoded as `path.join(os.homedir(), '.claude', 'office-status.json')`.
- **Evidence**:
  ```javascript
  // server.mjs:68
  const STATUS_FILE = path.join(os.homedir(), '.claude', 'office-status.json');
  ```
  Tests like `tests/serverTransportE2E.test.js` currently have to spoof `HOME`/`USERPROFILE` environment variables in child processes to redirect status reading.
- **Options for Claude to Evaluate**:
  - *Option A*: Adopt the exact same logic as `vite.config.js`:
    ```javascript
    const STATUS_DIR = process.env.OFFICE_STATUS_DIR || path.join(os.homedir(), '.claude');
    const STATUS_FILE = path.join(STATUS_DIR, 'office-status.json');
    ```
  - Verify whether `scanSessions` also relies on `STATUS_DIR` and ensure consistent path resolution across both session scanning and root status reading.

---

### F-03: `office-status-codex.js` Contract Drift (P1)
- **Problem**:
  1. `VALID_STATUSES` is `['idle', 'working', 'blocked', 'done']`, omitting `'planning'` and `'awaiting-approval'`.
  2. Any agent status of `'planning'` or `'awaiting-approval'` is discarded in `normalizeAgent()`.
  3. `activeCount` calculation in `summarizeOffice()` only filters `working` and `blocked`, whereas `statusContract.mjs:18-24` and `server.mjs:17` consider `working`, `blocked`, `planning`, and `awaiting-approval` as active agents.
  4. `normalizeAgent()` does not preserve carry fields (`reasonCode`, `activeFile`, `skill`).
- **Options for Claude to Evaluate**:
  - *Option A*: Share or mirror `VALID_STATUSES` and `ACTIVE_STATUSES` constants from `src/utils/statusContract.mjs`.
  - Check if `office-status-codex.js` is intended to be a standalone vanilla Node script without relative imports from `src/`. If standalone, mirror the contract constants and add unit tests to ensure parity.

---

### F-04: `public/bridge.js` Status Parameter Confusion (P1)
- **Problem**:
  `VALID_STATUSES` in `bridge.js:30` only includes 4 statuses. In lines 55-60:
  ```javascript
  if (VALID_STATUSES.includes(value)) {
    patch[role] = { status: value };
  } else {
    patch[role] = { status: 'working', task: value };
  }
  ```
  Calling `setOfficeStatus({ dev: 'planning' })` or `{ dev: 'awaiting-approval' }` misclassifies the status as a task description, forcing `status: 'working'` and `task: 'planning'`.
- **Options for Claude to Evaluate**:
  - Update `VALID_STATUSES` array in `public/bridge.js` to include `'planning'` and `'awaiting-approval'`.
  - Consider whether `value === ''` or nullish checks need hardening.

---

### F-05: `awaiting-approval` Animation & Bubble Disconnect (P1)
- **Problem**:
  - In `src/utils/classify.js:488` (`decideBehavior`), if `task` is not provided and status is `awaiting-approval`, it does not match `blocked`, `done`, or `planning`, falling through to `'typing'`.
  - In `src/utils/contextBubble.js:124`, `awaiting-approval` is not treated as waiting/blocked, falling into the active `working` branch which renders humorous productivity remarks ("快了...快了~", "code first, think later!") while waiting for human permission.
- **Options for Claude to Evaluate**:
  - *Behavior*: Map `awaiting-approval` to a distinct behavior (e.g., `'alert'`, `'idle'`, or a dedicated waiting state) rather than default `'typing'`.
  - *Bubbles*: Add an `awaiting-approval` category to `contextBubble.js` with context-appropriate lines (e.g. "Waiting for user confirmation...", "Permission prompt active...").

---

### F-06 ~ F-10: Ecosystem, Documentation & Script Refinements (P2)
- **F-06 (`INTEGRATIONS.md`)**:
  - Update event list from 6 to 8 events (`PermissionDenied`, `StopFailure`).
  - Add `awaiting-approval` to list of recognized statuses.
- **F-07 (`README.zh-TW.md`)**:
  - Translate and synchronize new sections from `README.md` (Hook event table, AVO-153 `CAPTURE_PAYLOADS`, Soak & rhythm diagnostics table).
- **F-08 (`public/bridge-ui.js`)**:
  - Harmonize `ROLE_COLORS` with `src/config/characters.json` or query it dynamically if feasible.
- **F-09 (`public/hooks/office-status-hook.sh`)**:
  - Replace `date +%s%N` with a portable timestamp (e.g., check `python3`/`perl`/`node` or use `$(date +%s)000`) so BSD date on macOS does not append literal `N`.
- **F-10 (`public/hooks/generic-llm-bridge.js`)**:
  - Support bilingual labels or allow language configuration via `HOOK_LANG` / `detectHookLang()`.

---

## 4. Suggested Execution Order for Claude

1. **Step 1 (P0)**: Fix `Dockerfile` and verify container build (`docker build .`).
2. **Step 2 (P1)**: Fix `server.mjs` path resolution and align status lists in `office-status-codex.js` and `public/bridge.js`.
3. **Step 3 (P1)**: Enhance `awaiting-approval` behavior and bubble handling in `classify.js` and `contextBubble.js`, verifying with existing vitest suites.
4. **Step 4 (P2/P3)**: Update documentation (`INTEGRATIONS.md`, `README.zh-TW.md`, `ARCHITECTURE.md`) and refine helper scripts.
5. **Step 5 (Validation)**: Run `npm test`, `npm run build`, and `npm run smoke` to ensure zero regressions.

---
⚡ ACX
