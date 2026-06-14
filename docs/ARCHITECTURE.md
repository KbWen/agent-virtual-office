# 技術架構 — Agent Virtual Office

---

## 核心原則

1. **AgentCortex 零改動** — 辦公室是唯讀觀察者
2. **標準化狀態契約** — hook、bridge、API 都收斂成 `office-status`
3. **誠實可觀測** — 只呈現真實訊號或明確標示的保守推論
4. **SVG 場景優先** — 800×560 office scene 是主體；控制列和 inspector 是輔助層

---

## 系統架構

```
Claude/Codex hooks      Bridge page/API       File/session scanner
        │                    │                    │
        └──────────────┬─────┴──────────────┬─────┘
                       ▼                    ▼
             normalize/sanitize      scanAndMerge(_cwd)
                       │                    │
                       └────────────┬───────┘
                                    ▼
                         inferStatus.applyMessage
                                    │
                                    ▼
                         store.applyExternalStatus
                                    │
                                    ▼
        decideBehavior({ task, role, status, workflow })
          priority: status > workflow > role > family-default
                                    │
                                    ▼
                         Zustand office store
                                    │
             ┌──────────────────────┼──────────────────────┐
             ▼                      ▼                      ▼
       PixelOffice SVG        AgentCharacter ×8       ControlPanel /
       800×560 scene          RAF movement +          ActivityFeed /
       `meet` fit             behavior overlays       Inspector
```

---

## 技術選型

| 層面 | 選擇 | 原因 |
|------|------|------|
| 框架 | React + Vite | 快速開發、artifact 相容 |
| 繪圖 | SVG（內嵌在 React） | 輕量、不需 GPU、dark mode 友好 |
| 動畫 | requestAnimationFrame + SVG animate | 角色移動用 RAF 插值（60px/s），行為指示器 25 種 SVG 動畫圖標 |
| 狀態管理 | zustand | 輕量、簡單、不需 Redux 那麼重 |
| 樣式 | Tailwind CSS | 快速迭代面板 UI |
| 時間 | `new Date()` | 不需要伺服器，純本地 |

### 不用的東西

| 不用 | 原因 |
|------|------|
| Canvas / WebGL | 太重，iframe 沙盒限制 |
| WebSocket | 不需要即時推送 |
| 後端 / 資料庫 | 不需要 |
| MCP Server | Phase 99 才考慮 |
| Three.js | GPU 需求、打包太大 |

---

## 辦公室佈局與移動系統

### SVG ViewBox

`800 × 560`，所有座標都在這個空間內。

### 房間配置

```
  ┌────────────────────────────────┬──────────┐
  │  Entrance + Hallway            │ Meeting  │
  │  y=10~133, x=10~593           │ Room     │
  │  門口、走廊、佈告欄             │ x=628~785│
  ├════════════════════════════════┤ y=15~413 │
  │  ▒▒▒ 北牆 (y=138~163, 25px) ▒▒│          │
  │  窗戶×4 + 時鐘嵌在牆內          │◄ 東牆    │
  │  門口開口: x=88~140            │  x=598   │
  ├────────────────────────────────┤  ~623    │
  │  Main Office                   │  25px    │
  │  y=163~399, x=15~593          │  門口:    │
  │                                │  y=185   │
  │  ┌PM─┐  ┌Arch┐   ┌QA──┐ ┌Res─┐│  ~235   │
  │  │140│  │260 │   │400 │ │520 ││          │
  │  │240│  │240 │   │220 │ │220 ││          │
  │  └───┘  └────┘   └────┘ └────┘│          │
  │                                │          │
  │       ┌Dev─┐  ┌Ops─┐          │          │
  │       │340 │  │460 │  白板     │          │
  │       │340 │  │340 │  x=535   │          │
  │       └────┘  └────┘          │          │
  ├════════════════════════════════┤══════════┤
  │  ▒▒▒ 南牆 (y=399~419, 20px) ▒▒▒▒▒▒▒▒▒▒▒│
  │  門口: x=213~267    門口: x=508~562      │
  ├──────────────────────┬─────────┬──────────┤
  │  Lounge              │ 隔牆    │ Research │
  │  x=15~451            │ x=456  │ x=469    │
  │  y=424~545           │ ~464   │ ~785     │
  │  沙發 咖啡機 WC       │        │ 書架     │
  │                      │        │ 電話亭   │
  └──────────────────────┴────────┴──────────┘
```

### 移動系統核心架構 (`movementSystem.js`)

**三層約束：**

```
位置生成 → clampToFloor() → 最終位置
                │
         ┌──────┴──────┐
         │ FLOOR_ZONES │  角色只能站在地板上
         │ (可行走區域)  │  不能站在牆壁、房間外
         └──────┬──────┘
                │
         ┌──────┴──────────┐
         │ OBSTACLE_RECTS  │  角色不能站在家具上
         │ (障礙物)         │  桌子、會議桌、WC 等
         └─────────────────┘
```

**FLOOR_ZONES（可行走地板）：**

| 區域 | x 範圍 | y 範圍 | 說明 |
|------|--------|--------|------|
| entrance | 15~593 | 15~133 | 入口 + 走廊 |
| mainOffice | 15~593 | 168~394 | 主辦公區（牆內側） |
| meetingRoom | 628~785 | 15~413 | 會議室 |
| lounge | 15~451 | 424~545 | 休息區 |
| research | 469~785 | 424~545 | 研究區 |
| door-entrance | 90~138 | 133~168 | 入口→辦公室通道 |
| door-lounge | 215~266 | 394~424 | 辦公室→休息區通道 |
| door-research | 510~561 | 394~424 | 辦公室→研究區通道 |
| door-meeting | 593~628 | 187~233 | 辦公室→會議室通道 |

**OBSTACLE_RECTS（障礙物）：**

| 障礙物 | x1,y1 ~ x2,y2 | 說明 |
|--------|----------------|------|
| PM 桌 | 105,215 ~ 175,260 | |
| Arch 桌 | 225,215 ~ 295,260 | |
| QA 桌 | 365,195 ~ 435,240 | |
| Res 桌 | 485,195 ~ 555,240 | |
| Dev 桌 | 305,315 ~ 375,360 | |
| Ops 桌 | 425,315 ~ 495,360 | |
| Designer 桌 | 105,315 ~ 175,360 | 設計角落，iPad + 色盤 + 尺 |
| 會議桌 | 650,128 ~ 760,195 | |
| 白板 | 525,278 ~ 590,342 | |
| WC | 338,443 ~ 422,502 | |
| 書架(休) | 278,438 ~ 412,458 | |
| 咖啡機 | 15,438 ~ 70,465 | |

**修改指南：**
- 要移動家具 → 同時更新 `PixelOffice.jsx`（視覺）和 `movementSystem.js`（OBSTACLE_RECTS）
- 要加房間 → 加 FLOOR_ZONES + ZONES + DOORS + ROUTE
- 要加目的地 → 加 WAYPOINTS + BEHAVIOR_LOCATIONS
- 所有位置都會經過 `clampToFloor()` 校正，不需手動檢查

### 移動動畫系統（RAF-based）

角色移動使用 `requestAnimationFrame` 而非 CSS transition，消除了跳躍/瞬移問題：

```
visualPosRef (真實渲染位置) → RAF 每幀插值 → renderPos (React state → SVG transform)
                                    ↑
targetPosRef (目標位置) ← startWalkTo() ← doSchedule()
```

- 移動速度：60px/秒，恆速直線
- 到達判定：距離 < 1.5px 時繼續移動，< 0.1px 時 snap 到目標
- 多段路徑：`pathRef` 儲存剩餘 waypoints，到達後自動切換下一段
- `movingRef`：防止行為排程在走路中觸發新行為

### 行為排程容錯機制（doSchedule）

每個角色獨立運行一條 `setTimeout` 鏈，以下機制確保鏈永遠不會斷：

```
doSchedule() {
  try {
    if (isPaused) → 2s 後重試
    if (inGroupEvent) → 2s 後重試（群體事件控制中）
    if (isMoving) → 1.5s 後重試 + 卡住計數器
      └─ 連續 10 次仍在走 → 強制重置移動狀態
    正常流程：getNextBehavior() → 播放行為 → setTimeout(doSchedule, duration)
  } catch (error) {
    console.error(error)
  }
  // ← setTimeout 在 try/catch 外面，即使出錯也會重新排程
}
```

**看門狗計時器**（每 10 秒檢查一次）：
- 如果同一個行為持續超過 120 秒沒變 → 強制清除所有移動狀態 → 重啟 doSchedule
- 防止任何未預期的情況導致角色永久卡住

### 群體事件系統（officeLife.js）

群體事件讓多個角色同時參與一個有劇情的互動：

```
officeLife.js 定時觸發事件
  ↓
pickParticipants() → 選擇參與角色
  ↓
EVENT_HANDLERS[eventId](store, participants)
  ↓
對每個參與者呼叫 setAgentGroupEvent(id, {
  behavior,        // 事件專屬行為
  expression,      // 事件專屬表情
  bubble,          // 事件專屬對話
  groupTarget,     // 移動目標位置
})
  ↓
AgentCharacter 偵測到 groupTarget 變化
  → calculatePath() → RAF 走路動畫
  ↓
doSchedule 偵測到 inGroupEvent
  → 跳過，2s 後重試
  ↓
event.duration 到期後
  → clearAgentGroupEvent() → 角色恢復自主行為
```

**已實作的 8 個事件處理器：**

| 事件 | 演出描述 |
|------|---------|
| tea-break | 2-3 人走到咖啡機旁聊天 |
| standup | 全員聚到白板前，PM 主持，8 秒後有人報告 |
| food-delivery | 一人送外賣到中間，2 秒後其他人開心反應 |
| coffee-spill | 一人打翻咖啡困惑，1.5 秒後鄰座走來幫忙 |
| eureka | 建築師衝到白板，冒出💡 |
| review-debate | Dev + QA 走到中間對峙，三段式劇情（爭論→檢查→修好） |
| deploy-success | Ops 按按鈕，2 秒後全場慶祝 |
| group-meeting | 2-3 人走到會議室椅子開會，8 秒後討論 |

### 防重疊系統

```js
// 分離契約是「視覺橢圓」而非 35px 圓（#103 幾何教訓：35px 垂直其實仍重疊）。
const SPRITE_CLEAR_RX = 32, SPRITE_CLEAR_RY = 44   // (dx/32)² + (dy/44)² < 1 視為重疊
avoidOverlap(pos, occupied) // 檢查其他角色位置，依橢圓偏移避免重疊（target-time 去衝突）
```

### 走廊路由系統

角色不會穿牆，跨房間時經由門口 waypoint：
- `nearestCorridor()` — 找最近的走廊節點
- `calculatePath()` — 自動加入門口中繼點
- 遠距離移動時先走到走廊，再走到門口，再進入目標房間

### 行為指示器圖標（BehaviorIndicator）

角色坐在桌前時，右側 (+14, -8) 處顯示一個 7-9px 的小動畫圖標：

共 25 個行為圖標，完整清單見 `DESIGN_SPEC.md`。核心圖標：

| behavior ID | 圖標 | 動畫效果 |
|-------------|------|---------|
| `typing` | 迷你鍵盤 | 游標閃爍 |
| `reading-screen` | 白色文件 | 藍色掃描線移動 |
| `writing-notes` | 鉛筆 | 筆尖微動 |
| `research` | 綠色放大鏡 | 上下微晃 |
| `gantt-chart` | 彩色條狀圖 | 寬度微變 |
| `magnifier` | 棕色放大鏡 + ✓ | 打勾閃爍 |
| `shield-verify` | 紅色盾牌 | 透明度呼吸 |
| `deploy-button` | 按鈕 + 指示燈 | 綠燈閃爍 |
| `drink-coffee` | 咖啡杯 | 蒸汽飄動 |
| `chat` | 雙對話泡 | 交替閃爍 |
| `whiteboard` | 白板筆 | 筆跡延伸 |
| `meeting` | 多人圖標 | 微縮放 |
| `nap` | ZZZ | 上飄消散 |
| `scratch-head` | 問號 + 螺旋 | 旋轉 |
| `phone-call` | 電話 + 音波 | 音波擴散 |

新增行為時需要：
1. 在 `behaviorEngine.js` 的 `behaviors` 添加行為定義
2. 在 `BehaviorIndicator` 的 switch 添加對應圖標
3. 在 `movementSystem.js` 的 `BEHAVIOR_LOCATIONS` 添加目的地（如需離開桌子）

### 工作交接動畫（FlyingDocument）

`pass-document` 行為觸發飛行文件動畫：

```
發送者 → FlyingDocument（拋物線 + 火花尾跡，800ms）→ 接收者
                                                        ↓
                                              接收者顯示「收到!」氣泡
```

- Store 管理：`handoffs[]`, `addHandoff(from, to)`, `removeHandoff(id)`
- 渲染：`PixelOffice.jsx` 中的 `<FlyingDocuments />` 組件

### Zustand Store 群體事件 Actions

```javascript
// 鎖定角色進入群體事件
setAgentGroupEvent(id, { behavior, expression, bubble, groupTarget })

// 釋放角色，恢復自主行為
clearAgentGroupEvent(id)

// 每個 agent 的群體事件狀態
agent.inGroupEvent  // boolean — doSchedule 檢查此旗標
agent.groupTarget   // { x, y } — AgentCharacter useEffect 監聽此值觸發移動
```

### 角色座位（HOME_POSITIONS）

角色坐在椅子上（桌子 y + 24px），不是桌子中心：

| 角色 | 性別 | 桌子位置 | 椅子位置 (Home) |
|------|------|---------|----------------|
| PM | 男 | (140, 240) | (140, 264) |
| Arch | 男 | (260, 240) | (260, 264) |
| Dev | **女** | (340, 340) | (340, 364) |
| Ops | 男 | (460, 340) | (460, 364) |
| QA | 男 | (400, 220) | (400, 244) |
| Res | **女** | (520, 220) | (520, 244) |
| Gate | 男 | — | (100, 80) 門口 |
| Designer | **女** | (140, 340) | (140, 364) |

### Pixel Art 精靈系統

角色使用 16×20 像素格繪製（每像素 2×2 SVG units = 32×40 total）：
- 髮型：neat, beret, twin-tails, hard-hat, long, spiky, bangs
- 性別：male（褲子 + 寬肩）/ female（A 字裙 + 窄肩 + 睫毛）
- 表情：normal, happy, focused, sleepy, surprised, tired, confused
- 走路：兩幀交替（250ms 週期），女性保持裙擺只動腳

### 會議室座位

角色不會站在會議桌上，而是坐在桌子周圍 8 個椅子位置：

```
  (660,120)  (700,120)  (745,120)   ← 桌子上方
  (645,160)  ┌─────────┐ (765,160)  ← 桌子兩側
  (660,205)  (700,205)  (745,205)   ← 桌子下方
```

---

## 多 Worktree 會話架構

See also: [ADR-002 — Multi-Worktree Session Design](../adr/ADR-002-multi-worktree-session-design.md)

### 會話文件命名

每個 worktree 的 hook 寫入獨立的 session 文件，文件名使用 branch slug：

```
~/.claude/office-status-feat-my-feature.json   # worktree: feat/my-feature
~/.claude/office-status-fix-auth-bug.json       # worktree: fix/auth-bug
~/.claude/office-status.json                    # 向下相容 fallback
```

### 跨專案隔離（`_cwd` 過濾）

每個 session 文件包含 `_cwd`（hook 的 `process.cwd()`）。GET `/api/status` handler 過濾規則：

```
session 文件
  ├── _cwd 存在且 resolve 後 ≠ projectRoot → 丟棄（其他專案的 session）
  ├── _cwd 不存在且文件名不是 office-status.json → 丟棄
  └── 其他 → 納入合併
```

### GET /api/status 多 Session 合併流程

```
讀取 ~/.claude/office-status*.json
  ↓
按 _cwd 過濾（只保留本專案）
  ↓
按 slug 分組（每個 branch 一組）
  ↓
每組選 1 個代表（blocked > working，跳過 done/idle）
  ↓
超出 8 個角色的代表 → OVERFLOW_POSITIONS（入口大廳展示）
  ↓
合併回傳給前端
```

### 前端角色 ID 格式

Worktree 角色的 ID 格式為 `{slug}~{role}`（例如 `feat-auth~dev`）。
- `AgentCharacter` 顯示時去掉 slug 前綴，只看 role 決定外觀
- name tag 上方顯示 branch slug 小標籤
- 到期（5 分鐘無活動）後從 store 刪除（不是改為 idle）

---

## Legacy Lightweight Inference Concept

```typescript
// Legacy concept only. Current production status flows through
// office-status hooks / bridge / API plus inferStatus.applyMessage.
interface OfficeVibe {
  mode: 'agentcortex' | 'lightweight' | 'demo';
  activeAgent: string | null;     // 'pm' | 'dev' | 'qa' | ... | null
  activeCommand: string | null;   // '/plan' | '/implement' | ... | null
  phase: string | null;           // 'planning' | 'implementing' | ...
}

// 推斷函數（前端 JS 版，讀本地檔案）
async function inferStatus(projectRoot: string): Promise<OfficeVibe> {
  // 試著讀 .agentcortex/context/current_state.md
  // 讀不到就回傳 demo 模式
  // 讀到了就 grep 出 phase 和 active workflow
  // 完全不寫入任何檔案
}
```

### 推斷流程

```
1. 檢查 .agent/workflows/ 是否存在
   ├── 存在 → AgentCortex 完整模式（7 角色）
   └── 不存在
       ├── 有任何 skill/workflow 檔案 → 輕量模式（3 角色）
       └── 都沒有 → Demo 模式（3 角色，純動畫）

2. 如果是 AgentCortex 模式：
   讀 .agentcortex/context/current_state.md
   ├── grep "Current Phase" → 推斷目前階段
   ├── grep "Active Workflow" → 推斷目前 command
   └── 對應到角色 → 調整該角色的行為權重

3. 調整頻率：
   每 30 秒重新推斷一次（fs.watch 或 setInterval）
   不需要更即時 — 這是氛圍工具，不是即時監控
```

---

## 打包模式

### 模式 1：單一 HTML 檔（最簡單）

```bash
npm run build:single
# 輸出 dist-single/index.html（inline 所有 CSS + JS + SVG）
# 直接雙擊就能開
```

用途：丟進任何專案、本地開啟、嵌入網頁。

### 模式 2：React 元件（規劃中，尚未實作）

目前沒有 `build:lib` script。嵌入其他 React 應用請直接 import `src/` 元件（如 `PixelOffice`、`ControlPanel`），或先用模式 1 的單一 HTML 以 iframe 嵌入。一個正式的 library build（`import { VirtualOffice } from 'agent-virtual-office'`）尚未實作。

### 模式 3：Claude Desktop Artifact

把辦公室做成一個自包含的 React artifact：
- Claude 在聊天中產生 artifact
- 用 `sendPrompt()` 實現角色互動
- 不需要 MCP，Claude 自己就是狀態源

```jsx
// 在 artifact 中的用法
<VirtualOffice
  mode="demo"
  onAgentClick={(agent) => sendPrompt(`告訴我 ${agent.name} 在做什麼`)}
/>
```

---

## Claude Desktop 整合路徑（legacy concept）

### 現在（Phase 1-2）

```
你跟 Claude 聊天
  ↓
Claude 執行你的 slash command
  ↓
Claude 順便產出/更新辦公室 artifact
  ↓
artifact 中對應角色的動畫改變
```

不需要任何基礎設施。Claude 同時是工作引擎和狀態源。

### 以後（Phase 99，如果真的需要）

```
辦公室 artifact 中點按鈕
  ↓
sendPrompt('刷新辦公室狀態')
  ↓
Claude 呼叫輕量 MCP 工具 get_office_vibe
  ↓
MCP 工具讀 .agentcortex/context/current_state.md（唯讀）
  ↓
Claude 更新 artifact
```

MCP Server 極簡版（未來才需要）：

```typescript
// 整個 server 不到 50 行
const server = new Server({ name: 'virtual-office', version: '0.1.0' });

server.tool('get_office_vibe', { project_root: 'string' }, async ({ project_root }) => {
  const state = readFileSync(join(project_root, '.agentcortex/context/current_state.md'), 'utf8');
  const phase = state.match(/Current Phase:\s*(\w+)/)?.[1] || 'idle';
  const active = state.match(/Active Workflow:\s*(\S+)/)?.[1] || null;
  
  const agentMap = {
    '/plan': 'pm', '/implement': 'dev', '/test': 'qa',
    '/review': 'qa', '/ship': 'ops', '/research': 'res'
  };
  
  return { phase, activeAgent: agentMap[active] || null, command: active };
});
```

但這是以後的事。先把辦公室做活、做可愛。

---

## v1.1.0 — Classifier + Inference Layer (2026-05-29)

This section appends the architectural additions shipped in the v1.1.0
classifier + observability wave. The pre-v1.1 sections above describe
the original status/behavior/movement runtime — that layer is unchanged.
v1.1.0 adds **a classification pipeline above the existing store
subscriptions and a polling-based inference layer alongside the existing
SSE/poll integration**.

```
                                          ┌─────────────────────────┐
                                          │   Hook events (status)  │
                                          └────────────┬────────────┘
                                                       │
                                                       ▼
                                          ┌─────────────────────────┐
                                          │  inferStatus.applyMessage │
                                          └────────────┬────────────┘
                                                       │
                          ┌────────────────────────────┼────────────────────────────┐
                          ▼                            ▼                            ▼
              ┌──────────────────────┐  ┌─────────────────────────┐  ┌──────────────────────────┐
              │  applyExternalStatus │  │   pushEventBatch (mood)  │  │  startWorkflowHandoffs   │
              │  (store mutation)    │  │   moodEngine sliding-win │  │  (subscription watcher)  │
              └──────────┬───────────┘  └────────────┬─────────────┘  └────────────┬─────────────┘
                         │                            │                            │
                         │              ┌─────────────┴─────────────┐               │
                         ▼              ▼                           ▼               ▼
                  ┌─────────────┐ ┌──────────────┐         ┌──────────────┐ ┌──────────────────┐
                  │decideBehavior│ │moodToWeather │         │  Weather     │ │  addHandoff      │
                  │  resolver   │ │  delegator   │         │  Overlay     │ │  (subtle: true)  │
                  └──────┬──────┘ └──────┬───────┘         └──────────────┘ └──────────────────┘
                         │               │
                         ▼               ▼
                ┌──────────────┐ ┌──────────────┐
                │ classifyTask │ │ classifyMood │
                │  + Role +    │ │              │
                │  Workflow    │ │              │
                └──────────────┘ └──────────────┘

Meanwhile, two polling watchers run on a separate cadence:

  desktopNotifier (5s tick)     idleGapInfer (10s tick)
  ──────────────────────         ──────────────────────
  blocked ≥ 30s                  working+45s gap → 'thinking'
  + tab.hidden                   blocked+90s gap → 'awaiting-approval'
  + permission granted           Routes inferred status back through
  → browser Notification         applyExternalStatus(meta.source='idle-gap-infer')
```

### Layer 1 — Standards-aligned classifier (`src/systems/classify.js`)

**Four-tier waterfall.** Every raw signal (task name, status, mood,
role, workflow) is classified into a `{ tier, family, severity, visualLabel, a11yLabel, raw }` shape:

- **Tier 0** — Built-in registry: Claude Code's 11 canonical tools
  (Bash / Read / Edit / Write / Grep / Glob / Task / WebFetch /
  WebSearch / NotebookEdit / ExitPlanMode) + TodoRead / TodoWrite.
  Hand-mapped to FAMILIES.
- **Tier 3** — Verb heuristic: word-boundary regex on the tool name
  using **[W3C Activity Streams 2.0](https://www.w3.org/TR/activitystreams-vocabulary/)
  verb taxonomy** (Read / Create / Update / Delete / Search / Execute /
  Auth / Communicate / Navigate / Dispatch / Memory). Word-boundary
  matters: `redo` must not match `read*`, `delegate` must not match
  `delete*`. Tested explicitly.
- **Tier 4** — MCP namespace: `mcp__server__tool` is parsed into
  `(server, tool)`; the inner tool name is then re-classified via
  Tier 3 verbs so the *family* bubbles up (`mcp__notion__create_page`
  → `family: CREATE, subFamily: notion`). Was Tier 4 → flat EXTERNAL
  in initial #A2; promoted to inner-verb routing in the follow-up fix.
- **Tier 5** — Unknown: preserves the raw string, truncates the
  visualLabel to 16 chars, marks `family: 'unknown'`. Also notifies
  `unknownLog` (see Layer 4 below).

**The 4-priority resolver** (`decideBehavior({task, role, status, workflow})`)
combines four classifier outputs in a strict precedence order:

```
status > workflow > role > family-default
```

Rationale: a `blocked` agent must look confused regardless of role
or workflow (status is immediate reality); a `/ship` phase overrides
QA's default magnifier with a deploy-button (phase context is more
specific than role); a `qa` role overrides the default typing
animation with `magnifier` (role describes how this agent works).

**Role profiles** are derived from **AgentCortex skill associations**
(`.agent/skills/`):
- `pm`, `arch` own writing-plans, dispatching-parallel-agents → CREATE/UPDATE
  bias toward `gantt-chart`
- `qa`, `checker` own test-driven-development, red-team-adversarial,
  verification-before-completion → EXECUTE/READ/SEARCH bias toward `magnifier`
- `ops` owns finishing-a-development-branch → EXECUTE bias toward
  `deploy-button`
- `gate` owns auth-security, red-team-adversarial → EXECUTE bias toward
  `shield-verify`; READ/SEARCH toward `magnifier`
- `designer` owns frontend-patterns → CREATE/UPDATE bias toward `whiteboard`
- `dev`/`worker` are generalists with zero overrides (byte-identical to pre-#A2.1)

### Layer 2 — Mood-driven weather (`src/components/TopDownFurniture.jsx`)

`moodToWeather(mood)` delegates to `classifyMood(mood).family` so the
mapping lives in one place:

| mood | weather family | visual |
|---|---|---|
| `frustrated` | rain | 5 raindrop `<line>` per window with CSS `weather-raindrop-fall` |
| `stuck` | thunderstorm | rain + lightning `<rect>` flash, opacity capped 0.35 |
| `rushing` | cloudy | 2 drifting `<ellipse>` per window |
| `smooth`/`intense`/`normal`/`idle`/`unknown` | clear | null overlay |

12 `WallWindow` instances each receive `weather` and `reducedMotion`
props. Photosensitivity safety: lightning fires twice per 5-second
cycle and caps opacity at 0.35 — well below the 3 Hz seizure threshold.

CSP compatibility (#27): `@keyframes` definitions live in
`src/index.css` (bundled by Vite into the regular stylesheet) instead
of an inline `<style>` tag inside the SVG, so strict `style-src 'self'`
environments serve the animations without `'unsafe-inline'`.

### Layer 3 — Inference modules (`src/inference/`)

Two polling watchers extend the existing SSE/poll status integration
without modifying it:

- **`desktopNotifier.js`** — 5-second tick. Per-agent tracks
  `blockedSince[id]` timestamp and `notifiedFor[id]` dedupe marker.
  When an agent stays `status === 'blocked'` ≥ 30 seconds AND
  `document.hidden === true` AND `Notification.permission === 'granted'`,
  fires `new Notification()` with `tag: office-blocked-<agentId>` so
  the OS replaces older notifications for the same agent. Transition
  out of blocked clears both maps so the next episode is independent.
  jsdom-safe: every browser-API access is `typeof`-checked.
- **`idleGapInfer.js`** — 10-second tick. Subscribes to the store with
  a `(status, task)` signature so the watcher re-stamps `lastUpdatedAt`
  only on meaningful changes (not on 60 Hz movement ticks). When
  `now - lastUpdatedAt[id] ≥ 45s` AND status is `working`, injects
  `status: 'thinking'` through `applyExternalStatus(meta.source =
  'idle-gap-infer')`. Same for blocked ≥ 90s → `awaiting-approval`.
  Reversibility by construction: real hook events flow through the
  same `applyExternalStatus` and overwrite the inferred state, no
  cleanup needed. Closes [Pixel Agents'](https://github.com/pablodelucca/pixel-agents)
  publicly admitted heuristic gap with deliberately conservative
  thresholds (the 30-60s typical `npm test` doesn't misfire).
- **`workflowHandoff.js`** — subscription watcher (not polling).
  Maps 7 specific `activeWorkflow` phase transitions to
  `(fromRole, toRole)` pairs and fires `addHandoff(from, to, {subtle: true})`.
  `subtle` flag tells `FlyingDocument` to render the calm variant
  (no sparkle, 60° rotation, no scale pulse) so workflow handoffs
  coexist with organic officeLife pass-document handoffs without
  visual clash.

### Layer 4 — Self-improving classifier (`src/systems/unknownLog.js`)

Dev-mode aggregator following the **LangSmith auto-clustering pattern**:
every Tier 5 fallback from any `classify*` function records the raw
input into a per-kind bucket (task / status / mood / role / workflow,
capped at 200 entries per kind, oldest-evict). Exposes
`window.__office_unknownLog` (raw Maps) and `window.__office_logUnknowns()`
(sorted console reporter) for DevTools introspection. Production
zero-cost: `isDevMode()` returns false when `import.meta.env.PROD ===
true` and `recordUnknown` becomes a no-op.

Operational pattern: over time, high-frequency entries in the log are
candidates for promotion to Tier 0 in `classify.js`. The
`feedback_classification_rigor` memory note also reminds future
classifier work to check `.agent/skills/` + `.agent/workflows/` before
defaulting to generic W3C verbs.

### Per-feature specs

Detailed rationale + acceptance criteria + rollback for each shipped
piece live in `docs/specs/`:
- [[classifier-foundation]] · [[classifier-wiring]] · [[classifier-unknown-log]] · [[mcp-inner-verb-fix]]
- [[weather-system]] · [[csp-compatibility]]
- [[desktop-notifications]] · [[idle-gap-inference]] · [[workflow-handoff-arrows]]
- [[tool-inventory-label]] · [[perf-metrics-chip]]

## Brand & interaction wave (2026-06-14)

Player-facing additions shipped after v1.4.0. Both are pure-logic-first and honesty-bound (numbers/quips derive only from real signals; the live office store is never faked).

### Shareable daily card (`src/systems/dailyCard.js`, AVO-115)

Client-side `canvas` → PNG "cozy postcard" of the day. Split design: pure `buildCardModel(input)` (copy + number selection, empty-day variant, `safeCount` integer guard so the body can never render a fractional/garbage number) is vitest-testable; `renderDailyCard` paints it to a canvas (DOM-only, Playwright-verified — vitest has no canvas). Honest by construction: numbers come only from the existing `dailyDoneLedger` / `dailyBlockedLedger` + live `mood` (no new counters; `store.js` untouched). Opt-in Share in the ⚙ menu; download + feature-detected Web Share. Spec: [[shareable-daily-card]].

### Poke / acknowledge (`src/systems/pokeReaction.js` + `AgentCharacter.jsx`, AVO-158)

An honest in-place "it noticed you" reaction layered onto the existing agent click (Model A — no new gesture; decided in ADR-005 after user drag-to-move was rejected). Pure `pickPokeReaction(status, history, now)` maps the agent's REAL status to a quip pool (idle fallback, no cross-status leak) and computes cozy repeat-escalation (3rd → longer bob, 5th → brief turn-away, reset after 10 s idle). The component fires a reduced-motion-gated `<animateTransform>` bob (`aria-hidden`) + a `role=status aria-live` quip bubble that preempts the ambient bubble slot. **ZERO position/status write** — guarded by a store-level no-mutation test + a live DOM proof (status + transform unchanged across a poke). Click = inspector + poke; `Space` = poke-only; right-click = poke + `preventDefault`. Spec: [[poke-acknowledge]]; decision: ADR-005.

### Per-feature specs (cont.)

- [[shareable-daily-card]] · [[poke-acknowledge]] · ADR-005 (user drag rejected → poke redirect)
