---
doc_state: snapshot
title: Project Review & Implementation Handoff for Claude
date: 2026-09-19
baseline_sha: 1.6.8-head
scope: Comprehensive Review covering Technical Debt, Visual/Rendering Defects, and Architectural Design Issues
target_implementer: Claude Code
status: resolved — triaged and remediated on `fix/review-2026-09-19` (PR #236)
resolved_by: fix/review-2026-09-19 (2026-09-19)
---

> [!NOTE]
> **Resolution (2026-09-19, `fix/review-2026-09-19`, PR #236).** Every finding was independently
> re-derived from source before any edit. This document is preserved **as written**, including its
> errors, because they are part of the record — do not edit the findings below. Outcome and corrections:
>
> - **Fixed:** REV-01, REV-02, REV-03, REV-08, REV-09. **Rejected:** REV-04, REV-06. **Backlog:** REV-10 is
>   AVO-193. **Own PRs:** REV-07, REV-05. Spec: `docs/specs/review-2026-09-19-remediation.md`.
> - **REV-02** is narrower than stated: desk agents (y ≥ 244) were never clipped; the top aisle and the north
>   doorway (y ≈ 176–180) were. Its suggested fix, applied as written, pulled off-crop meeting-room speakers'
>   bubbles into view (caught by a fresh-context review); the shipped rule guards both axes and the #47 clamp.
> - **REV-01's backdrop suggestion was rejected:** with `preserveAspectRatio="xMidYMid meet"` the visible area
>   can exceed the viewBox, so a bounds-sized backdrop shrinks the close target.
> - **REV-03's premise is wrong:** a page cannot observe another tab's title; the office never sets its own,
>   so the channel was dead code. It was deleted rather than put behind `OFFICE_ENABLE_TITLE_INFER`, which a
>   browser bundle cannot read.
> - **REV-04 rejected:** an above-head bubble cannot be covered by a later-painted (lower) agent; the remaining
>   cases are rare and the fix restructures a protected per-frame render path.
> - **REV-05's cause is misattributed:** the warnings come from Vite 8's config loader and Rolldown, not Node 22.
> - **REV-06 rejected:** `monolith-extraction-map.md`, which it cites, says it is "not a refactor request".
> - **REV-07 is understated:** 218 of 469 English bubble lines are truncated (5% in zh-TW), not an occasional one.
> - **REV-07 shipped** in PR #237 (width-budget fitting; owner-approved captures).
> - **REV-05 shipped** in PR #238 (`vite.config.mjs`; the cause was Vite 8's config loader, not Node 22). All ten findings now have a disposition.
> - **REV-08 and REV-09 are under-scoped:** the inspector's AVO-169 duration and the activity feed froze the
>   same way; the stale "KNOWN, UNFIXED" framing was also in `tests/doorCrossingSeparation.test.js`.
> - **Line references:** REV-01's `PixelOffice.jsx:978` and REV-03's `inferStatus.js:682-705` were accurate.

# Project Review & Implementation Handoff for Claude

> [!NOTE]
> **Audit Baseline Date:** 2026-09-19 | **Baseline Version:** `v1.6.8`  
> **Test Baseline:** 125 test files passed, 2,419 tests green, 0 failing (vitest)  
> **Purpose:** 此文檔專為 Claude Code 接手實作設計，系統性盤點專案內的**技術債**、**畫面呈現缺陷**與**架構設計問題**，提供明確的根因剖析、程式碼定位與具體可執行的修復方案。

---

## 1. 執行摘要 (Executive Summary)

本專案（Agent Virtual Office）是一個成熟且具備嚴格測試護航（超過 2,400 個單元/合約測試）的像素風 AI 代理人視覺化系統。專案核心理念強調 **「Honesty First（誠實反映系統狀態）」** 與 **「Calm-tech（低干擾平靜科技）」**。

經過深入的全域程式碼審查，目前專案雖運作良好，但隨版本迭代累積了數個顯著的**畫面破綻（特別是 Panel 模式下的視窗裁切）**、**巨石檔案難以維護的技術債**，以及**部分違背誠實性原則的設計隱患**。

### Claude 接手實作指引
1. **堅持小步變更與可逆性**：請勿盲目全盤重構巨石模組，優先遵循 `docs/architecture/monolith-extraction-map.md` 的 seam 切分指引。
2. **位置即狀態 (Position is State)**：移動與座標由真實渲染數據驅動，任何狀態切換不得引起角色瞬間瞬移 (teleport)。
3. **誠實原則高於裝飾性**：絕不捏造代理人工作或忙碌狀態；無真實信號時寧可安靜也不虛構。

---

## 2. 審查發現總覽矩陣 (Findings Matrix)

| 編號 | 嚴重度 | 類別 | 目標位置 | 核心問題摘要 | 建議優先順序 |
|---|---|---|---|---|---|
| **REV-01** | **P0** | 畫面呈現 / 設計 | `src/components/AgentInspector.jsx:122-128`, `src/components/PixelOffice.jsx:978` | **Panel Mode 下 Inspector 視窗溢出裁切**：Y 軸邊界完全寫死為 800x560，Panel 模式裁切 viewBox 下直接超出螢幕被切斷 | 最高（立即修復） |
| **REV-02** | **P0** | 畫面呈現 | `src/components/AgentCharacter.jsx:1749`, `src/components/BehaviorBubble.jsx:49-55` | **Panel Mode 下對話氣泡被頂部邊界切掉**：氣泡翻轉只判定 `y < 6`，未考慮 panel 裁切視窗起始 Y 軸 (minY=155) | 最高（立即修復） |
| **REV-03** | **P1** | 設計問題 / 誠實性 | `src/inference/inferStatus.js:682-705` | **Document Title 啟發式狀態推斷違反誠實性**：僅因標籤頁標題變更即捏造 `working` 狀態覆蓋真實 Hook | 高優先級 |
| **REV-04** | **P1** | 畫面呈現 | `src/components/PixelOffice.jsx:1357-1373`, `src/components/AgentCharacter.jsx` | **SVG DOM 繪製順序導致身軀覆蓋名牌/氣泡**：名牌與氣泡內建於各 Agent，後繪製的 Agent 會壓在先繪製者的氣泡之上 | 高優先級 |
| **REV-05** | **P2** | 技術債 / 構建 | `vite.config.js:1`, `src/utils/normalizePost.js:10`, `package.json:55` | **ESM / CommonJS 混用警告**：`"type": "commonjs"` 下 `.js` 檔含 `import/export`，Node 22+ 觸發警告 | 中優先級 |
| **REV-06** | **P2** | 技術債 / 維護性 | `src/components/AgentCharacter.jsx` (~1790 行), `src/components/PixelOffice.jsx` (~1435 行) | **核心組件高衝擊巨石問題 (Monolith files)**：Sprite 繪圖、物理移動、傢俱、場景全部混合在同一檔案中 | 中優先級（分步抽離） |
| **REV-07** | **P2** | 畫面呈現 / UX | `src/components/BehaviorBubble.jsx:123-130` | **中英文混合截斷與寬度失衡**：固定截斷 16 字元，導致英文動作過早被截成 `…`，中英排版體驗不佳 | 中優先級 |
| **REV-08** | **P2** | 畫面呈現 / 效能 | `src/components/NarrowRoster.jsx:61`, `presenceSig` | **清單視圖相對時間陳舊 (Stale Relative Time)**：因排除了每分時鐘訂閱，無事件時 "3m" 永遠不自動遞增 | 中優先級 |
| **REV-09** | **P3** | 技術債 / 文件漂移 | `src/systems/movementSystem.js:467-476` | **過期代碼註解誤導**：依然寫著「KNOWN, UNFIXED 門堆疊」，但 AVO-187/ADR-010 已在 8 月完成解決 | 低優先級（清理維護） |
| **REV-10** | **P3** | 設計問題 / 體驗 | `src/systems/officeLife.js`, `src/systems/store.js` (AVO-193) | **全忙碌狀態下可點擊物件反饋缺失**：咖啡機無可用 Agent 時點擊如同當機，缺乏誠實微反饋 | 低優先級（體驗優化） |

---

## 3. 詳細問題剖析與建議修復方案 (Detailed Breakdown)

### REV-01: Panel Mode 下 AgentInspector 視窗溢出與嚴重裁切 (P0)

#### 1. 問題根因剖析
在嵌入模式（IDE Side Panel、小型視窗）中，`PixelOffice.jsx` 會將 `viewBox` 動態裁切為局部區域（例如 `60 155 540 260`，即 X: 60~600, Y: 155~415）。
然而在 `AgentInspector.jsx:122-128` 中：
```javascript
let px = pos.x - Ws / 2
let py = pos.y - Hs - 56 * s
if (px < 10) px = 10
if (px + Ws > 790) px = 790 - Ws
if (py < 10) py = 10
if (py + Hs > 550) py = 550 - Hs
```
邊界值被硬編碼在 `10` 與 `790` (X 軸) 以及 `10` 與 `550` (Y 軸)。
同時，`PixelOffice.jsx:978` 呼叫 `setSceneBounds` 時僅傳入了 `parts[0]` (minX) 與 `parts[2]` (w)，將 `minY` 與 `h` 完全丟失。
結果：在 Panel 模式下點擊上方辦公桌（例如 PM、Arch、QA）時，Inspector 面板算出的 `py` 被 clamp 到 10，直接被推到 `Y < 155` 的視窗外不可見區域，造成**面板大半截或整個消失**。此外，背板關閉點擊區域 `rect` 寫死 `width={800} height={560}`，未對應當前 viewBox。

#### 2. 給 Claude 的建議實作步驟
1. **擴充 Store 的 `sceneBounds`**：
   在 `src/systems/store.js` 中將 `sceneBounds` 定義為 `{ minX: 0, minY: 0, w: 800, h: 560 }`，並讓 `setSceneBounds(minX, minY, w, h)` 支援 4 個參數。
2. **在 `PixelOffice.jsx` 更新發布**：
   解析 `viewBox.split(/\s+/)` 為 `[minX, minY, w, h]`，完整傳入 `setSceneBounds(parts[0], parts[1], parts[2], parts[3])`。
3. **在 `AgentInspector.jsx` 使用動態 Bounds**：
   訂閱 `sceneBounds`，並將 clamp 邏輯調整為：
   ```javascript
   const minX = sceneBounds.minX + 10
   const maxX = sceneBounds.minX + sceneBounds.w - 10
   const minY = sceneBounds.minY + 10
   const maxY = sceneBounds.minY + sceneBounds.h - 10
   
   px = Math.max(minX, Math.min(px, maxX - Ws))
   py = Math.max(minY, Math.min(py, maxY - Hs))
   ```
4. **將遮罩背景同步至當前邊界**：
   將背景 `<rect>` 設為 `x={sceneBounds.minX} y={sceneBounds.minY} width={sceneBounds.w} height={sceneBounds.h}`。

---

### REV-02: Panel Mode 下對話氣泡 (BehaviorBubble) 頂部裁切 (P0)

#### 1. 問題根因剖析
在 `AgentCharacter.jsx:1748-1749`：
```javascript
const bubbleTopAbove = pos.y - 68 - 34 * labelScale
const below = bubbleTopAbove < 6
```
系統判斷氣泡是否需要向下翻轉（Flip Below）只看 `bubbleTopAbove < 6`。
在 Panel 模式下，頂部可視起點是 `Y = 155`（或依比例變動）。一個位於 `Y = 200` 的 Agent，其 `bubbleTopAbove` 約為 `98`，判定 `below = false`，因此氣泡渲染在 `Y = 132`，剛好卡在 Panel 視窗上緣之外，對話文字被截斷。

#### 2. 給 Claude 的建議實作步驟
1. `AgentCharacter.jsx` 訂閱完整的 `sceneBounds`（包含 `sceneMinY`）。
2. 翻轉判定依據當前可視頂部：
   ```javascript
   const visibleTop = (sceneBounds.minY || 0) + 6
   const below = bubbleTopAbove < visibleTop
   ```
3. 確保向下翻轉時，下方亦有足夠空間（若下方接近 `minY + h`，則進行垂直偏移調整）。

---

### REV-03: Document Title 啟發式狀態推斷違反誠實性 (P1)

#### 1. 問題根因剖析
在 `src/inference/inferStatus.js:682-705`：
```javascript
const TITLE_PATTERNS = [
  { pattern: /implement|coding|writing code|building/i, role: 'dev', status: 'working' },
  { pattern: /testing|reviewing|linting/i, role: 'qa', status: 'working' },
  ...
]
```
`MutationObserver` 監聽 `document.title`。只要瀏覽器標籤頁名稱出現特定關鍵字，就會自動合成一個 `office-status` 事件，將對應角色強制設為 `working`。
- **風險**：當使用者在看其他網頁、或者網頁標題僅是靜態展示（例如 "Reviewing project"），虛擬辦公室就會**憑空捏造 agent 正在工作**。此外，它的訊息缺乏嚴謹的單調時序 `_seq`，會與真實 Hook 發送的狀態產生競態覆蓋。

#### 2. 給 Claude 的建議實作步驟
1. 評估是否徹底移除 `listenTitleChanges`，或者預設關閉、僅在明確由配置開啟時生效（`OFFICE_ENABLE_TITLE_INFER=1`）。
2. 在 `startStatusIntegration` 中停止無條件掛載 `listenTitleChanges`。
3. 增加測試以確保移除後不影響其他 4 種正規傳輸管道（URL params, postMessage, BroadcastChannel, /api/status）。

---

### REV-04: SVG DOM 繪製順序導致的身軀覆蓋名牌/氣泡 (P1)

#### 1. 問題根因剖析
在 `PixelOffice.jsx:1356-1375`：
```jsx
{agentList.map((agent) => (
  <AgentCharacter key={agent.id} agent={agent} />
))}
```
所有 Agent 按照 `sortByY` 依序繪製在 SVG 中。
但名牌 `<rect>` 與氣泡 `<BehaviorBubble>` 放在各個 `<AgentCharacter>` 內部的最頂層。
SVG 不具備 CSS `z-index`。當上方 Agent A（先繪製）的氣泡向下翻轉或其名牌延伸時，若下方 Agent B（後繪製）站在或走過該區域，**Agent B 的整隻腳或身體會直接畫在 Agent A 的名牌或氣泡之上**，產生極度不自然的視覺遮擋穿模。

#### 2. 給 Claude 的建議實作步驟
- **架構改進方針（分層渲染 Layering）**：
  - 將渲染拆為：
    1. `<AgentSpritesLayer />`：所有 Agent 的身體 Sprite 與陰影（依 Y 排序）。
    2. `<AgentLabelsLayer />`：所有 Agent 的名字標籤與狀態環。
    3. `<AgentBubblesLayer />`：所有 Agent 的對話與思考氣泡（永遠處於最高層）。
- 若初期不想過度重構 `AgentCharacter`，可優先利用獨立的 Portal 或將 Bubble 提取至 `PixelOffice` 層統一渲染。

---

### REV-05: ESM 與 CommonJS 混用警告 (P2)

#### 1. 問題根因剖析
- `package.json:55` 明確設定 `"type": "commonjs"`。
- 但 `vite.config.js` 與 `src/utils/normalizePost.js` 為 `.js` 檔名卻包含頂層 `import` / `export`。
- Node 22+ 啟動 Vitest 或執行 CLI 時會輸出警告：
  `ESM syntax in a file loaded as CommonJS (vite.config.js:1:1). Use a .mjs extension...`

#### 2. 給 Claude 的建議實作步驟
1. 將 `vite.config.js` 重命名為 `vite.config.mjs`。
2. 搜尋全專案測試與腳本中對 `vite.config.js` 的 `require`/`import` 引用（如 `tests/dockerRuntimeClosure.test.js` 等），同步更新副檔名。
3. 將 `src/utils/normalizePost.js` 改造為乾淨的 CommonJS 轉發或直接使用 `.mjs`。
4. 驗證 `npm test`，確認警告完全消失。

---

### REV-06: 核心組件高衝擊巨石檔案 (Monolith Extraction) (P2)

#### 1. 現況數據
- `src/components/AgentCharacter.jsx`：1,790 行，91KB。
- `src/components/PixelOffice.jsx`：1,435 行，78KB。
- `src/systems/store.js`：1,691 行，89KB。

#### 2. 給 Claude 的安全拆分步驟（嚴格遵守 `monolith-extraction-map.md`）
1. **第一步（純純量/靜態常數抽離）**：
   - 將 `AgentCharacter.jsx` 內部的 `CharacterPixelSprite`（約 600 行純 SVG 像素矩陣）抽離為 `src/components/character/CharacterPixelSprite.jsx`。
   - 將 `PixelOffice.jsx` 中的靜態裝飾家具（`WallWindow`, `FramedArt`, `ClockWidget`, `SprintKanban` 等）移至專門的 `src/components/decor/` 模組。
2. **第二步（純函數與 Helper 抽離）**：
   - 提取 `AgentCharacter.jsx` 中的 Door Journey 與 RAF 防護 Helper。
3. **要求**：每次抽離前後執行全量測試，並保證單一 commit 可完整 revert。

---

### REV-07: 中英文混合截斷與寬度失衡 (P2)

#### 1. 問題根因剖析
在 `BehaviorBubble.jsx:123`：
```javascript
const chars = Array.from(cleanMsg)
const maxLen = 16
const displayMsg = chars.length > maxLen ? chars.slice(0, maxLen).join('') + '…' : cleanMsg
```
截斷長度固定為 16 字元。
- 16 個中文字非常長（寬度約 176px）。
- 16 個英文字母很短（例如 `"Searching codeb…"` 僅約 100px 寬，且詞義被硬生生切掉）。

#### 2. 給 Claude 的建議實作步驟
採用「視覺加權長度」或依語言動態限制：
```javascript
// 計算加權視覺字元長度：CJK 算 2 單位，ASCII 算 1 單位
let visualUnits = 0
let cutIndex = chars.length
for (let i = 0; i < chars.length; i++) {
  visualUnits += chars[i].codePointAt(0) > 0x2E7F ? 2 : 1
  if (visualUnits > 28) {
    cutIndex = i
    break
  }
}
const displayMsg = cutIndex < chars.length ? chars.slice(0, cutIndex).join('') + '…' : cleanMsg
```
如此一來，英文可容納更多字母（約 24~28 字元），中文維持在 14 字元左右，排版更協調。

---

### REV-08: NarrowRoster 相對時間陳舊 (Stale Relative Time) (P2)

#### 1. 問題根因剖析
在 `NarrowRoster.jsx:61`：
```javascript
const since = changedAt && Date.now() - changedAt >= 10000 ? formatTimeAgo(changedAt, { compact: true }) : null
```
`since` 僅在組件 render 時計算一次。
為了防止代理人移動引起重繪，`NarrowRoster` 的 `presenceSig` 刻意排除了座標與時間更新。這導致若長時間沒有新事件發生，列表上的相對時間（如 "1m"）永遠不會遞增為 "2m"、"5m"，直到下一個事件進來才突然跳動。

#### 2. 給 Claude 的建議實作步驟
在 `NarrowRoster.jsx` 內部引入一個輕量級的 30 秒或 60 秒本地計時器（`useTicker(30000)`），僅觸發局部的相對時間更新，不影響全域 store。

---

### REV-09: 過期代碼註解誤導 (Comment Drift) (P3)

#### 1. 問題定位
`src/systems/movementSystem.js:467-476` 寫道：
`// KNOWN, UNFIXED (measured 2026-07-16 — characterized by tests/doorCrossingSeparation.test.js)... The fix must be TEMPORAL...`
這段註解是 7 月份的歷史殘留。AVO-187 早已在 8 月透過 `doorClaims.js` 實作完成。

#### 2. 給 Claude 的建議實作步驟
更新此處註解，註明「已由 AVO-187 (ADR-010) `doorClaims.js` 的時序鎖 (Temporal Claim) 解決」，消除認知負擔。

---

### REV-10: 全忙碌狀態下可點擊物件反饋缺失 (AVO-193) (P3)

#### 1. 問題定位
在 `_product-backlog.md` 中 AVO-193 記錄：
當辦公室內所有 Agent 都在工作或不可用時，點擊咖啡機（tea-break），由於 AVO-191 移除了強制所有 Agent 前往的 fallback，導致點擊後完全沒有任何反應，使用者會誤以為介面壞掉。

#### 2. 給 Claude 的建議實作步驟
1. 保持誠實性原則（不強制調動正在忙碌的 Agent）。
2. 在咖啡機本體增加本體視覺微互動（例如冒出一縷蒸汽動畫 1.5 秒，或發出咖啡機沖煮聲），讓操作者知道「系統有收到點擊，但目前同仁都在忙碌」。

---

## 4. 推薦實作路線 (Roadmap for Claude)

建議分為三個漸進式 PR，確保每一階段都有完整的測試保障：

### 階段一：緊急視覺與裁切修復 (P0/P1)
1. **PR 1: Fix Panel Mode Bounds & Clipping**
   - 修復 `store.js` 的 `sceneBounds`（加入 `minY`, `h`）。
   - 修復 `PixelOffice.jsx` 傳遞參數。
   - 修復 `AgentInspector.jsx` 與 `AgentCharacter.jsx` 的邊界 clamp 與氣泡 flip-below 邏輯。
   - 增加針對 Panel Mode 各種長寬比裁切下的單元/視覺回歸測試。

### 階段二：誠實性原則與建構警告修復 (P1/P2)
2. **PR 2: Deactivate Title Ingestion & Resolve ESM Warnings**
   - 關閉 `inferStatus.js` 的 `listenTitleChanges` 預設監聽，防範偽造狀態。
   - 將 `vite.config.js` 重構為 `.mjs`，消除 Node 22+ 的 CJS/ESM 混用警告。
   - 更新 `movementSystem.js` 過期註解。

### 階段三：視覺體驗優化與巨石檔案解耦 (P2/P3)
3. **PR 3: Visual Polish & Monolith Seams**
   - 優化 `BehaviorBubble.jsx` 中英文加權截斷演算法。
   - 修復 `NarrowRoster.jsx` 本地時間定時更新。
   - 依照 `monolith-extraction-map.md`，將 `CharacterPixelSprite` 從 `AgentCharacter.jsx` 中乾淨抽取至獨立檔案。
   - 補齊 AVO-193 咖啡機忙碌時的本地蒸汽微動效。

---
⚡ ACX
