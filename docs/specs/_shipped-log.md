---
status: living
title: Agent Virtual Office — Shipped Log
created: 2026-05-29
last_updated: 2026-06-02
---

# Agent Virtual Office — Shipped Log

> Historical archive of shipped backlog items. Rotated out of `_product-backlog.md`
> on 2026-05-29 after the v0.10 + classifier + observability feature wave brought
> the active backlog to ~100% Done. New items continue to live in `_product-backlog.md`;
> when they ship, the entry rotates here.
>
> Read order: see `_product-backlog.md` for current/pending work; this file is
> reference-only for tracing shipped feature provenance.

---

## 🎭 辦公室生命感

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| 1 | **角色成長系統** — `done` 事件累積工作量，桌上咖啡杯 / 便利貼 / 書堆跟真實 tool call 次數連動 | P1 | Done | shipped 2026-05-16; spec: docs/specs/character-growth-system.md |
| 2 | **角色間關係動態** — dev×arch「設計不對」、ops×dev「能不能 deploy」、pm×全員「開個小會被翻白眼」等新對話事件 | P2 | Done | shipped via PR #19; `officeLife.js:104–458` 含 dev-arch-disagree、ops-dev-deploy-check、pm-all-meeting 等 15 個多角色事件；stateless（無跨 session 關係記憶） |
| 3 | **時間感豐富化** — 週五 happy hour、月底 deadline 週（rushing 鎖定 + 便利貼爆炸）、早上有人遲到走進辦公室 | P2 | Done | shipped via PR #19; `officeLife.js:587–682` 含午休、下午茶、週五 social boost；`behaviorEngine.js:203–208` 依時段調整行為權重 |

---

## 📊 資訊密度

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| 4 | **Sprint 進度看板** — 辦公室牆上小 Kanban，格子隨 `done` 事件填滿 | P2 | Done | shipped via PR #19; `PixelOffice.jsx:18–60` SVG kanban on north wall，動態顯示 `totalDoneToday`，最多 6 格 + overflow indicator |
| 5 | **Inspector 資訊加強** — 顯示今日完成數、當前 mood 指示、`activeWorkflow` 名稱 | P1 | Done | shipped with durable same-day count + Codex parity follow-up; specs: `docs/specs/agent-inspector-info-enhancement.md`, `docs/specs/codex-status-parity-and-done-count.md` |
| 6 | **底部效能指標** — status bar 顯示今日 done / blocked 比率 | P3 | Done | shipped 2026-05-29; `store.js` 新增 `dailyBlockedLedger` (transition counter，與 `dailyDoneLedger` 平行)；`ControlPanel.jsx` Full + Panel 模式各加 `✓N / ✗M` chip，i18n + sr-only + tooltip 齊備 |

---

## 🎪 互動性

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| 7 | **可點擊辦公室物件** — 點咖啡機觸發角色走去拿咖啡、點白板觸發 eureka、點紅色按鈕觸發 deploy-success | P1 | Done | shipped in v0.10 (commit 5b79616); spec: docs/specs/clickable-office-objects.md |
| 8 | **桌面通知** — blocked 超過 30s 發瀏覽器 Notification | P2 | Done | shipped 2026-05-29; `src/inference/desktopNotifier.js` polls 5s, fires Notification at 30s blocked + tab hidden + permission granted; per-episode dedupe (tag=`office-blocked-<id>`); ControlPanel 🔔 button requests permission on user gesture; i18n + sr-only |
| 9 | **辦公室廣播 Workflow Banner** — `activeWorkflow` 觸發牆上大字動畫 + PM 拿麥克風 | P2 | Done | shipped via PR #19; `PixelOffice.jsx:1056–1089` 含 pulse 動畫 + broadcast tower icon，訂閱 `store.activeWorkflow` |

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
| 13 | **夜間模式辦公室** — 22:00+ 燈光變暗、部分角色加班、窗外月亮 | P2 | Done | shipped via PR #19; `PixelOffice.jsx:215–223` 6 層光線 overlay（早晨→黃昏→深夜），`NightSky` 元件含星星 + 月亮，`WallWindow` 依時段調整亮度 |
| 14 | **天氣系統** — 窗外晴/雨/雷雨跟 mood 呼應（`frustrated` → 下雨） | P3 | Done | shipped 2026-05-29; `TopDownFurniture.jsx` 加 `moodToWeather()` + `WeatherOverlay`（rain/cloudy/thunderstorm）；`PixelOffice.jsx` subscribe `mood`+`reducedMotion`，inject keyframes 一次；`stuck`→thunderstorm, `frustrated`→rain, `rushing`→cloudy；lightning capped 0.35/5s 防 photosensitivity |
| 15 | **白板手寫動畫** — eureka 事件時線條慢慢出現 | P2 | Done | confirmed pre-existing on 2026-05-29 — `PixelOffice.jsx:146` `WhiteboardAnimation` subscribes `activeEvent`, triggers on `eureka`, animates 3 lines + circle + `!` over 3000ms via `stroke-dashoffset`；closure-documented at #14 ship time (similar to #7 closure pattern) |

---

## 🛡️ 安裝穩定性 / DX

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| 16 | **靜態部署無 /api/status** — `npm run build` → dist/ 部署到 S3/Nginx 後，/api/status 不存在，hook 整合全斷。需要 standalone API server 或改用純 hash/postMessage 模式 | P1 | Done | ✅ `server.mjs` 純 Node.js built-in 實作，`npx agent-virtual-office serve` 或 `npm run serve`，自動 build 若 dist/ 不存在 |
| 17 | **file:// 協定下 fetch 失敗** — 直接開 dist/index.html 時 fetch('/api/status') 報 CORS。偵測 file:// 並跳過 polling | P2 | Done | ✅ `inferStatus.js` 加 protocol guard，file:// 和 HTTPS cross-origin 自動跳過 polling |
| 18 | **README 缺 Troubleshooting 章節** — port 衝突、npm install 失敗、git 未安裝、瀏覽器沒打開等常見問題無文件 | P1 | Done | ✅ README 加 Troubleshooting `<details>` 段落 |
| 19 | **README 缺 Gemini CLI 具體整合步驟** — 標題寫支援 Gemini 但沒有實際整合教學 | P1 | Done | ✅ README 加 Gemini CLI Integration 子段落含 curl + generic-llm-bridge 範例 |
| 20 | **Hook read-modify-write 非完全 atomic** — 已用 PID 隔離 tmp + rename fallback 降低風險，但高並行 subagent 仍可能丟狀態。需 file lock 或 append-only 設計 | P3 | Deferred | 目前 PID 隔離 + direct write fallback 已大幅降低風險，完美方案複雜度高 |
| 21 | **Hook 語音泡泡永遠是中文** — hook 讀 `~/.claude/office-lang` 切換語系，前端切語言時寫入偏好檔 | P1 | Done | ✅ hook 加 `detectHookLang()` 雙語標籤；`i18n.js` 寫 lang 到 `/api/lang`；`vite.config.js` 加 `/api/lang` endpoint |
| 22 | **CORS 擋 LAN 存取** — 自動偵測本機 LAN IP 加入 CORS 允許清單 | P1 | Done | ✅ `vite.config.js` 加 `getServerIPs()` + `SERVER_IPS` 自動允許本機所有 IP |
| 23 | **Async 錯誤逃逸 ErrorBoundary** — 加全域錯誤處理器 | P2 | Done | ✅ `main.jsx` 加 `window.addEventListener('unhandledrejection'/'error')` |
| 24 | **HTTPS 混合內容阻擋** — 偵測 file:///HTTPS 環境時跳過 polling | P2 | Done | ✅ `inferStatus.js` `startFilePolling` 加 protocol guard |
| 25 | **`--host` 預設開啟的防火牆問題** — 加網路暴露警告和 Windows 防火牆提示 | P2 | Done | ✅ `cli.js` 啟動時印出 LAN 模式警告 + Windows Firewall 提示 |
| 26 | **企業 Proxy 環境 npm install 失敗無文件** — README Troubleshooting 含 proxy 設定 | P2 | Done | ✅ README Troubleshooting 段落含 npm proxy config 範例 |
| 27 | **CSP 相容性** — 嵌入嚴格 CSP 的企業內網時，inline styles 可能被擋導致排版崩壞 | P3 | Done | shipped 2026-05-29; weather keyframes 從 inline `<style>` 移到 `src/index.css` 由 Vite bundle 進去；production JS 內已無 `@keyframes`；README Troubleshooting 加上 CSP 章節說明推薦 `style-src 'self' 'unsafe-inline'` 並列出進階 nonce 方案 |
| 28 | **`_cwd` 路徑洩漏** — 從 API 回應中移除 `_cwd` | P2 | Done | ✅ 單 session 路徑 shallow copy + delete `_cwd` |
| 29 | **Hook 自動更新** — `setup` 每次比對內容，自動覆蓋舊版 hook | P1 | Done | ✅ hook 加 `HOOK_VERSION`，cli.js setup 比對後覆蓋，顯示 installed/updated/up-to-date |
| 30 | **prefers-reduced-motion 支援** — 偵測用戶偏好，停止動畫 | P1 | Done | ✅ store 加 `reducedMotion`，AgentCharacter 跳過 interval，FlyingDocuments return null |
| 31 | **色盲友善狀態指示** — 顏色旁加 sr-only 文字標籤 | P1 | Done | ✅ ControlPanel 加 `<span className="sr-only">{agent.status}</span>` |
| 32 | **ARIA 標籤** — 互動元素加 role/aria-label/tabIndex/onKeyDown | P2 | Done | ✅ 按鈕加 aria-label，agent `<g>` 加 role="button" + 鍵盤支援 |
| 33 | **手機可用性** — SVG 加 minWidth + 外層 overflow-auto | P2 | Done | ✅ 手機可水平捲動查看完整辦公室 |
| 34 | **handoffs 陣列上限** — cap 20 | P2 | Done | ✅ `addHandoff` 加 `slice(-20)` |
| 35 | **Rate limiter 記憶體清理** — 過期 IP 清掃 | P3 | Done | ✅ `checkRateLimit` 加 stale sweep when >50 entries |
| 36 | **CRLF 換行符導致 hook 比對失敗** — Windows `autocrlf=true` 使 hookSrc/hookDest 內容不同，每次 setup 都覆蓋 | P2 | Done | ✅ `cli.js` 比對前 `.replace(/\r\n/g, '\n')` 正規化 |
| 37 | **`preventDefault()` 壓制 console 錯誤** — `unhandledrejection` handler 吃掉瀏覽器紅色錯誤，開發時難 debug | P2 | Done | ✅ `main.jsx` 移除 `e.preventDefault()` |
| 38 | **`_seq` 同毫秒碰撞** — 兩個 hook 同時觸發 `Date.now()` 相同，第二筆被 polling 當重複跳過 | P2 | Done | ✅ hook 加 `_seqCounter` 單調遞增，`_seq` 格式改為 `${Date.now()}-${++counter}` |
| 39 | **跨 tab 暫停狀態不同步** — 一個 tab 暫停，另一個繼續動畫 | P2 | Done | ✅ `store.js` 加 `window.addEventListener('storage')` 監聯 `office-paused` 跨 tab 同步 |
| 40 | **settings.json 無效 JSON 靜默覆蓋** — parse 失敗時 `settings={}` 覆蓋用戶所有設定 | P1 | Done | ✅ `cli.js` 改為 abort + 清楚錯誤訊息 |
| 41 | **hooks 非陣列 `.some()` TypeError** — 其他工具寫入物件格式 hooks 導致 setup 崩潰 | P1 | Done | ✅ `cli.js` 改用 `Array.isArray()` 檢查 |
| 42 | **`UserPromptSubmit`/`Stop` 未註冊** — hook 有 handler 但 setup 未註冊這兩個事件 | P1 | Done | ✅ `cli.js` setup/uninstall 加入 `UserPromptSubmit` + `Stop` |
| 43 | **Windows Ctrl+C 留下 zombie vite** — `shell:true` + SIGINT 不殺子進程樹 | P2 | Done | ✅ `cli.js` Windows 用 `taskkill /T /F`，其他平台用 SIGTERM |
| 44 | **`strictPort:false` 開錯瀏覽器** — port 被佔時 Vite 靜默換 port，CLI 開舊 URL | P2 | Done | ✅ `vite.config.js` 改 `strictPort: true` |
| 45 | **NaN `_seq` 繞過 staleness filter** — 無 `_seq` 的檔案永遠不被過濾 | P2 | Done | ✅ `vite.config.js` 改 `!seq \|\| now - seq > 300000` |
| 46 | **~/.claude/ 累積 stale 檔案** — 舊 branch 的 status 檔永遠不刪 | P2 | Done | ✅ GET handler 掃到 >1hr stale 檔自動 `unlinkSync` |
| 47 | **Codex hook 缺 EBUSY fallback** — Windows 防毒鎖檔時 renameSync 崩潰 | P2 | Done | ✅ `office-status-codex.js` 加 try/catch + direct write fallback |
| 48 | **"No connection" 提示不可見** — 8px/0.6 opacity 在暗背景上幾乎看不到 | P2 | Done | ✅ `PixelOffice.jsx` 改 11px/0.85 opacity/#d4c8a0 暖色 |
| 49 | **file-watcher 過早清除 setup 提示** — 編輯檔案觸發 file-watcher 就消掉提示 | P2 | Done | ✅ `inferStatus.js` 加 `skipHintDismiss`，file-watcher 不觸發 |
| 50 | **settings.json 寫入無 try/catch** — 權限不足時 unhandled crash | P2 | Done | ✅ `cli.js` writeFileSync 加 try/catch + 權限錯誤訊息 |
| 51 | **port 參數未驗證** — `--port=abc` 或注入字串可透過 shell 執行 | P2 | Done | ✅ `cli.js` 加數字驗證 1-65535 |
| 52 | **`--include=dev` global install 失敗** — 系統目錄 EACCES | P2 | Done | ✅ `cli.js` 改為 `npm install`（不含 --include=dev） |
| 53 | **hook mkdirSync 在 try 外** — 權限錯誤無 catch + 無 stderr 輸出 | P2 | Done | ✅ hook mkdirSync 移入 try，外層 catch 加 stderr log |
| 54 | **CWD fallback slug 可能空字串** — 非英數目錄名產生 `office-status-.json` | P2 | Done | ✅ hook slug 加 `replace(/^-+\|-+$/g,'')` + `\|\| 'default'` |
| 55 | **`/api/lang` POST 無 body size limit** — 可傳送任意大 body | P3 | Done | ✅ `vite.config.js` 加 16 byte `MAX_LANG_BODY` 限制 |
| 56 | **`spawn('npx','vite')` 不可靠** — npx 解析可能找到全域 vite 或跨版本衝突 | P1 | Done | ✅ `cli.js` 改為直接呼叫 `node_modules/.bin/vite` |
| 57 | **首次 `npm install` 慢且無優化** — 每次都跑完整 audit + fund | P2 | Done | ✅ `cli.js` 加 `--prefer-offline --no-audit --no-fund` |
| 58 | **同 branch 名兩專案寫同一檔** — `main` slug 碰撞導致狀態互相覆蓋 | P1 | Done | ✅ hook slug 加 CWD 4-char MD5 hash 區分專案 |
| 59 | **`Stop` 事件首次無檔靜默失敗** — 角色卡 working 15 秒才消 | P1 | Done | ✅ hook Stop catch 寫入空 agents idle 狀態 |
| 60 | **`dist/` 在 npm files 浪費 444KB** — dev mode 不用 dist | P2 | Done | ✅ `package.json` files 移除 `dist/` |
| 61 | **uninstall 殘留 status/lang/skill 檔** — `~/.claude/` 垃圾累積 | P2 | Done | ✅ `cli.js` uninstall 掃描刪除 `office-*` 系列檔案 |
| 62 | **`STATUS_POLL_INTERVAL` 死碼** — 匯出 2000 但實際用 1000 | P3 | Done | ✅ 統一為 1000 且 inferStatus.js 改用常數 |
| 63 | **extensionless import 脆弱** — `normalizePost.js` 匯入 constants 沒 .js 副檔名 | P2 | Done | ✅ 加 `.js` 副檔名 |
| 64 | **hooks-config.json 缺 2 事件** — 手動安裝用戶漏 UserPromptSubmit/Stop | P2 | Done | ✅ 加入 6 事件完整設定 |
| 65 | **setup 沒提示需 Claude Code** — 新用戶不知為何辦公室沒動靜 | P2 | Done | ✅ setup 成功訊息加 Claude Code 安裝連結 |
| 66 | **`strictPort:true` 報錯無引導** — port 被佔只有 Vite 錯誤 | P2 | Done | ✅ `cli.js` vite exit 時印出 `--port=` 建議 |
| 67 | **`normalizePost` 透傳未知 JSON 屬性** — 任意 key 寫入磁碟並回傳客戶端 | P1 | Done | ✅ 重建乾淨物件，僅保留已知屬性；字串加 200 字元上限；agents 上限 50 |
| 68 | **`/api/event` label/workflow 無長度限制** — 可灌大量資料到磁碟 | P2 | Done | ✅ label/workflow 加 `.slice(0, 200)` 上限 |
| 69 | **`/api/event` aborted 檢查順序錯** — body 可暫時超過 8KB | P2 | Done | ✅ `if (aborted) return` 移到 `body += chunk` 之前 |
| 70 | **worker/planner/checker 沒有 contextBubbles** — 永遠顯示通用泡泡 | P2 | Done | ✅ 兩語系加入 worker/planner/checker 8 組泡泡文字 |
| 71 | **`officeEvents.json` fallback 全中文** — bubbleMessages 中文 fallback 給英文用戶看 | P2 | Done | ✅ 移除 `bubbleMessages`（i18n 已完整覆蓋所有 key） |
| 72 | **6 個死翻譯 key** — inspector.recentActivity/noActivity、standup-lead/agree、gate-block、toilet-return | P3 | Done | ✅ 從 en.json/zh-TW.json 移除 |
| 73 | **`PixelOffice` useMemo 讀 stale getState()** — 新 agent 短暫消失數秒 | P2 | Done | ✅ 改用 reactive `agents` subscription 取代 `getState()` |

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

---

## 🚀 AVO-101+ Wave (rotated 2026-06-15)

> 54 Done/Shipped rows rotated out of `_product-backlog.md` on 2026-06-15, plus AVO-156 and
> AVO-157 (shipped earlier but tracked only in the SSoT Spec Index) folded in for a complete
> wave archive — 56 rows total. Covers the real-AI-behavior / multi-agent / info-density /
> game-feel / vibe-rebalance / chill-fun waves plus the hardening (H1–H6), stability (W1–W5),
> and tech-debt audit (#120–#128) waves. Full detail lives in each item's spec + the SSoT Spec
> Index + Ship History (`current_state.md`). Off-mission items closed in the same cleanup are in
> `_product-backlog.md → Deferred / Closed` (ADR-006), not here.

| # | Feature | Tier | Ship ref / note |
|---|---------|------|-----------------|
| AVO-101 | Plan-Mode visualization | feature | `92198e5` — hook emits `status:'planning'` on plan mode; scrolling-outline polish deferred |
| AVO-102 | Extended-thinking aura | feature | `a62cd14` — violet aura from `effort.level` |
| AVO-103 | Tool inventory label | feature | 2026-05-29; `AgentCharacter` TaskLabel; spec `tool-inventory-label.md` |
| AVO-104 | Skill activation badge | feature | #30; transient skill bubble (panel Option B); spec `skill-activation-badge.md` |
| AVO-105 | Handoff arrows | feature | 2026-05-29; `workflowHandoff.js`; spec `workflow-handoff-arrows.md` |
| AVO-106 | Pair-programming huddle | feature | PR #80; co-editing pair overlay; spec `pair-programming-huddle.md` |
| AVO-107 | Review-gate queue | feature | #112; honest gate-desk "waiting" in-tray; spec `review-gate-waiting.md` |
| AVO-108 | Token & cost meter (honest core) | feature | `11c73f8` — 🪙 ctx + model chip (demoted to inspector per AVO-127). $/rolling/sparkline remainder descoped (ADR-006) |
| AVO-110 | Blocked-reason tags | feature | spec `blocked-reason-tags.md`; unblocks AVO-117 |
| AVO-111 | Time-of-day lighting | quick-win | chill-fun wave; `src/systems/lighting.js` (smooth 24h grade) |
| AVO-115 | Shareable daily card | feature | #31; cozy pixel-art postcard; spec `shareable-daily-card.md` |
| AVO-117 | Recurring failure-mode detection | feature | spec `recurring-failure-detection.md` (downstream of AVO-110) |
| AVO-121 | Office pet (signal-driven barometer) | feature | PR #62; spec `office-pet-barometer.md` |
| AVO-122 | Ambient soundscape (toggle) | feature | chill-fun wave; 0-KB procedural Web Audio; spec `ambient-soundscape.md` |
| AVO-123 | Office theme / skin selector | feature | #41; light overlay tints; spec `office-theme-selector.md` |
| AVO-125 | Cozy micro-interactions | feature | chill-fun wave; spec `cozy-micro-interactions.md` |
| AVO-126 | Bubble register unification | quick-win | spec `ux-vibe-rebalance.md` |
| AVO-127 | Token meter off the default view | quick-win | spec `ux-vibe-rebalance.md` (amends AVO-108) |
| AVO-128 | Name pills → reveal-on-active | feature | spec `ux-vibe-rebalance.md` |
| AVO-129 | Done/blocked KPI off the persistent bar | quick-win | spec `ux-vibe-rebalance.md` |
| AVO-130 | Control-bar reduction (gear menu + single health dot) | feature | #116; spec `control-bar-reduction.md` |
| AVO-131 | TaskLabel pill → inspector-only | quick-win | spec `ux-vibe-rebalance.md` (amends AVO-103) |
| AVO-132 | ThinkingAura → fold into glow ring | quick-win | spec `ux-vibe-rebalance.md` (amends AVO-102) |
| AVO-133 | Blocked reads from posture | quick-win | physical legibility (relates AVO-110) |
| AVO-134 | BehaviorIndicator micro-telegraphs | quick-win | anticipation pop-in / squash |
| AVO-135 | Status-ring distance encoding (breathe/flash) | quick-win | pre-attentive far-read |
| AVO-136 | Event juice pass (confetti / sparkle / desk-slam shake) | feature | #117; spec `event-juice-pass.md` |
| AVO-138 | Subagent helper huddle | feature | spec `subagent-helper-huddle.md` (downstream of AVO-106) |
| AVO-139 | Responsive office width-fill + readable labels | feature | spec `responsive-office-roster.md` |
| AVO-140 | Living-office honest events (L2 team-affect + honesty gating) | feature | spec `living-office-events.md` |
| AVO-143 | applyExternalStatus: skip no-op agent re-allocation | quick-win | hardening H6a; 2026-06-10 |
| AVO-145 | CI render-smoke gate | feature | hardening H1; spec `ci-render-smoke.md` |
| AVO-146 | Transport field-whitelist unification | feature | hardening H2; spec `status-field-schema-unification.md` |
| AVO-147 | Validator zero-noise + repo hygiene | quick-win | hardening H4; 2026-06-10 (branch `chore/hardening-h4-zero-noise`) — was stale-"In Progress", reconciled to Done 2026-06-15 |
| AVO-148 | Structured error payload for blocked reasons | feature | hardening H5; spec `structured-error-reasons.md` |
| AVO-149 | CI reproducibility: npm install → npm ci | quick-win | stability W1; 2026-06-10 |
| AVO-150 | Transport-spine e2e in CI | feature | stability W2; spec `transport-spine-e2e.md` |
| AVO-151 | npm-pack install smoke | feature | stability W3; spec `npm-pack-install-smoke.md` |
| AVO-152 | Bundle-size budget gate in CI | quick-win | stability W5; baseline 450069 B |
| AVO-153 | Hook-runtime payload fixture corpus | feature | stability W4; spec `hook-runtime-contract.md` (found AVO-154) |
| AVO-154 | Reconcile hook result-field reads with runtime truth | quick-win | 2026-06-11; `tool_response`/`tool_result` divergence + 26-fixture corpus |
| AVO-155 | Same-pick guarantee test for socialTargetOverride | quick-win | #131; de-flaked #148, BOM-stripped #147 |
| AVO-156 | Standing-overlap deconfliction (5-channel root cause) | feature | PR #105; spec `standing-overlap-deconfliction.md` |
| AVO-157 | Sim-soak gate (nightly world-invariant soak) | infra | spec `sim-soak-gate.md` |
| AVO-158 | Poke / acknowledge micro-interaction | feature | #158; spec `poke-acknowledge.md` (replaces rejected AVO-142 per ADR-005) |
| AVO-159 | Render-path perf: bubble memo + order-signature + tray narrow | feature | 2026-06-14 perf audit; +10 bubbleVisibility tests |
| #20 | Hook read-modify-write atomic | quick-win | hardening H3; spec `hook-status-write-lock.md` |
| #120 | Prepublish build-before-test contract | quick-win | `0a1aa93`; `prepublishOnly` runs build before test |
| #121 | Monolith extraction map | quick-win | doc-only; `docs/architecture/monolith-extraction-map.md` |
| #122 | normalizePost.mjs runtime mirror → statusContract.mjs single source | feature | PR #163; node-safe single source; −224 lines |
| #123 | Bridge dynamic rendering hardening | quick-win | `0a1aa93`; external `bridge-ui.js`, no inline handlers |
| #124 | Silent catch observability classification | quick-win | `docs/architecture/silent-catch-policy.md` |
| #125 | Dependency maintenance wave | quick-win | vite 6→8 + plugin-react 6 + vitest 4 (clears esbuild RCE advisory) |
| #126 | Semgrep baseline + fail-on-new serious findings | feature | #136; security.yml two-pass (ERROR-severity blocks) |
| #127 | Architecture overview refresh | quick-win | `docs/ARCHITECTURE.md` |
| #128 | Resolve audit routing_actions | quick-win | audit findings routed to backlog + architecture decision logs |
