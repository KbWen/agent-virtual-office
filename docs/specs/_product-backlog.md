# Agent Virtual Office — Product Backlog

> Living index of planned features. Bootstrap reads this to detect ongoing product work.
> Status: `Pending` | `In Progress` | `Done` | `Deferred`
> Priority: P0 (must) → P3 (nice to have)

---

## 🎭 辦公室生命感

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| 1 | **角色成長系統** — `done` 事件累積工作量，桌上咖啡杯 / 便利貼 / 書堆跟真實 tool call 次數連動 | P1 | Pending | dev 咖啡杯已有基礎（`deskItemCount`），需串接 hook 計數 |
| 2 | **角色間關係動態** — dev×arch「設計不對」、ops×dev「能不能 deploy」、pm×全員「開個小會被翻白眼」等新對話事件 | P2 | Pending | 擴展 `officeEvents.json` + 對應 handler |
| 3 | **時間感豐富化** — 週五 happy hour、月底 deadline 週（rushing 鎖定 + 便利貼爆炸）、早上有人遲到走進辦公室 | P2 | Pending | 擴展 `officeLife.js` 時間事件分支 |

---

## 📊 資訊密度

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| 4 | **Sprint 進度看板** — 辦公室牆上小 Kanban，格子隨 `done` 事件填滿 | P2 | Pending | SVG 靜態元件 + store `doneCount` |
| 5 | **Inspector 資訊加強** — 顯示今日完成數、當前 mood 指示、`activeWorkflow` 名稱 | P1 | Done | shipped with durable same-day count + Codex parity follow-up; specs: `docs/specs/agent-inspector-info-enhancement.md`, `docs/specs/codex-status-parity-and-done-count.md` |
| 6 | **底部效能指標** — status bar 顯示今日 done / blocked 比率 | P3 | Pending | 需在 store 中累積 session 統計 |

---

## 🎪 互動性

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| 7 | **可點擊辦公室物件** — 點咖啡機觸發角色走去拿咖啡、點白板觸發 eureka、點紅色按鈕觸發 deploy-success | P1 | Pending | `PixelOffice.jsx` 加 onClick handler，呼叫 officeLife event |
| 8 | **桌面通知** — blocked 超過 30s 發瀏覽器 Notification | P2 | Pending | `Notification API`，需用戶授權；inferStatus.js 加計時 |
| 9 | **辦公室廣播 Workflow Banner** — `activeWorkflow` 觸發牆上大字動畫 + PM 拿麥克風 | P2 | Pending | `activeWorkflow` 已存 store，需加 SVG 動畫元件 |

---

## 🔌 整合延伸

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| 10 | **智能 file_path 路由** — `*.test.*` → qa、`*.yml/Dockerfile` → ops、`*.md` → res | P1 | Done | ✅ fileToRole() in hook, 含 designer 路由 |
| 11 | **多 worktree 支援** — `?session=foo` 讓不同 worktree 的 agent 同時出現 | P3 | Done | ✅ session 用 branch slug 命名檔案，merge 時 1 session = 1 代表角色 |
| 12 | **Webhook 事件端點** — `POST /api/event` 接受一次性事件（PR merged → deploy-success），CI/CD 可推資料 | P2 | Done | ✅ /api/event 支援 11 種事件 + custom，含 role/status 驗證 |

---

## 🎨 視覺升級

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| 13 | **夜間模式辦公室** — 22:00+ 燈光變暗、部分角色加班、窗外月亮 | P2 | Pending | `PixelOffice.jsx` 加 `hour` 觸發的 SVG filter / 色調調整 |
| 14 | **天氣系統** — 窗外晴/雨/雷雨跟 mood 呼應（`frustrated` → 下雨） | P3 | Pending | 純裝飾 SVG 動畫，連接 `store.mood` |
| 15 | **白板手寫動畫** — eureka 事件時線條慢慢出現 | P2 | Pending | SVG `stroke-dashoffset` 動畫，觸發於 eureka handler |

---

## 已完成

| Feature | Done Date | Branch |
|---------|-----------|--------|
| hooks crash fix (useMemo before early return) | 2026-03-xx | `fix/agent-inspector-hooks-crash` |
| STATUS_COLORS / VALID_STATUSES 集中化 | 2026-04-02 | `fix/agent-inspector-hooks-crash` |
| TTL expiry 競態修復 | 2026-04-02 | `fix/agent-inspector-hooks-crash` |
| AgentInspector 移動中 position lag 修復 | 2026-04-02 | `fix/agent-inspector-hooks-crash` |
| **#10 智能 file_path 路由** — *.test.* → qa、*.css/svg → designer、Dockerfile → ops | 2026-04-02 | `fix/agent-inspector-hooks-crash` |
| **#12 Webhook 事件端點** — POST /api/event 接受 12 種 CI/CD 事件 | 2026-04-02 | `fix/agent-inspector-hooks-crash` |
| **設計師角色** — 粉色女生角色，設計角落，對 CSS/SVG/設計檔案有感 | 2026-04-02 | `fix/agent-inspector-hooks-crash` |
| **#11 多 worktree 支援** — 每個 session 寫獨立 JSON，merge 時 1 session = 1 代表角色，入口大廳展示訪客 | 2026-04-02 | `fix/agent-inspector-hooks-crash` |
| **#5 Inspector 資訊加強** — durable done count、mood / workflow rows、Codex CLI/App parity | 2026-04-08 | `main` |
