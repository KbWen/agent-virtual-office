<div align="center">

# Agent Virtual Office

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![React 19](https://img.shields.io/badge/react-19-61dafb.svg)](https://react.dev)
[![Vite 6](https://img.shields.io/badge/vite-6-646cff.svg)](https://vitejs.dev)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/KbWen/agent-virtual-office/pulls)

**你的 AI Agent 團隊不只是在跑 code — 他們在上班。**

![Virtual Office Screenshot](https://raw.githubusercontent.com/KbWen/agent-virtual-office/main/docs/screenshot.png)

一個像素風的虛擬辦公室，AI agent 小人在裡面工作、偷喝咖啡、為了 code review 吵架、開站立會議。
他們不知道你在看，但你看了會嘴角上揚。

*這不是監控面板，是氛圍工具。*

[快速開始](#快速開始) · [狀態 API](#狀態-api) · [English](README.md)

</div>

---

## 他們在幹嘛？

| 小人 | 個性 | 你可能會看到他... |
|------|------|-----------------|
| **PM** | 愛開會、桌上整齊 | 在甘特圖前沈思人生 |
| **建築師** | 戴貝雷帽的哲學家 | 突然衝到白板大喊「有了！」 |
| **開發者** | 雙馬尾、咖啡成癮 | 桌上 5 杯咖啡，還在倒第 6 杯 |
| **QA** | 拿放大鏡的完美主義者 | 跟 Dev 面對面爭論 bug 存不存在 |
| **DevOps** | 戴安全帽的行動派 | 深呼吸，然後按下那個大紅按鈕 |
| **研究員** | 長髮書蟲 | 書堆越疊越高，偶爾恍然大悟 |
| **門神** | 刺蝟頭守門員 | 舉著盾牌說「前置條件不夠」 |
| **設計師** | 粉紅頭髮的創意人、設計角落 | 排列色票、在 iPad 上塗鴉 |

---

## 辦公室日常

每隔 1-3 分鐘，辦公室會隨機發生群體事件：

- **茶歇時間** — 幾個人溜去咖啡機旁聊八卦
- **站立會議** — 全員被 PM 拉到白板前報告進度
- **外送到了** — 有人舉著紙袋進場，全場歡呼
- **打翻咖啡** — 桌上冒驚嘆號，鄰座英勇救援
- **Review 爭論** — Dev 和 QA 的經典三幕劇：「沒 bug！」→「你看這裡」→「好吧修了」
- **部署成功** — Ops 按下按鈕，全場放煙火慶祝
- **靈感時刻** — 建築師突然頓悟，衝去白板畫架構
- **小組會議** — 幾個人走進會議室，開始「嗯嗯同意」

偶爾還會出現稀有事件：有人帶狗來上班、空調壞了全場搧風、老闆巡視所有人假裝認真...

---

## 快速開始

### 方式一：npx（推薦）

```bash
# 直接從公開的 GitHub repo 跑 — 不用 clone、不用等 npm 發佈：
npx github:KbWen/agent-virtual-office

# 等套件發佈到 npm 後，短指令也可以用：
npx agent-virtual-office
```

選項：
```
--port=PORT    埠號（預設 5174）
--lang=LANG    語言：en, zh-TW（預設自動偵測）
--no-open      不要自動開啟瀏覽器
--no-host      只綁定 localhost（dev 伺服器預設會綁定所有網路介面）
```

> **注意：** dev 伺服器（`npx agent-virtual-office`）預設會對 LAN 開放且沒有任何驗證。用 `--no-host` 可限制只在 localhost，或改用 `serve` 模式搭配 `OFFICE_API_TOKEN` 做有保護的部署。

### 方式二：Clone & 開發

```bash
git clone https://github.com/KbWen/agent-virtual-office.git
cd agent-virtual-office
npm install
npm run dev
```

打開瀏覽器，看你的小人們上班。就這樣。不需要後端、不需要資料庫、不需要 WebSocket。

### 方式三：Production build（serve dist/）

當你想把編譯好的辦公室架在伺服器上、或分享給同事、又不想跑 Vite 時用這個。

```bash
# 先 build 一次
npm run build

# 啟動獨立的 production 伺服器（serve dist/ + /api/status）
npx agent-virtual-office serve

# 或用 npm script
npm run serve
```

`serve` 指令需要先 build 出 `dist/` — 請先跑 `npm run build`（缺 `dist/` 會直接報錯退出）。選項：
```
--port=PORT    埠號（預設 5174）
--host         對 LAN 開放（預設只有 localhost）
--no-open      不要自動開啟瀏覽器
--lang=LANG    語言：en, zh-TW
```

**環境變數**（選用）：

| 變數 | 說明 | 範例 |
|----------|-------------|---------|
| `OFFICE_API_TOKEN` | POST/event 請求需在 `X-Office-Token` 或 `Authorization: Bearer` header 帶的 token | `mysecret123` |
| `OFFICE_API_ALLOWED_ORIGINS` | 逗號分隔的允許 CORS 來源（預設：loopback + 伺服器 IP） | `http://office.internal:5174` |

```bash
OFFICE_API_TOKEN=secret npx agent-virtual-office serve --host
```

**健康檢查：** `GET /api/health` 回傳 `{ ok: true, uptime: <秒數> }`。

### 方式四：Docker

在容器裡跑 production 伺服器。採多階段 build — Vite 在 builder image 編譯出 `dist/`，runtime image 只帶 `server.mjs`（零執行期相依套件）。

```bash
docker compose up -d
```

然後打開 `http://localhost:5174`。

compose 檔會把 `~/.claude` 以讀寫方式掛進容器，伺服器才能讀 hook 寫的狀態檔，也能接受 POST 寫入。

> **前置（只有第一次）：** 容器以 UID 1000 執行。請讓 `~/.claude` 可被該 UID 寫入（不是 `$USER`，可能不同）：
> ```bash
> mkdir -p ~/.claude && sudo chown 1000 ~/.claude
> ```

可傳入選用的 `OFFICE_API_TOKEN` 來保護 POST/event 請求：

```bash
OFFICE_API_TOKEN=secret docker compose up -d
```

> Nginx 反向代理、PM2、systemd service 的設定，請見 [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)。

---

## 狀態 API

任何工具都能透過 HTTP 推送即時狀態到辦公室：

```bash
# 簡短格式：直接設定角色狀態
curl -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{"dev":"working","qa":"blocked","workflow":"Sprint 42"}'

# 完整格式：明確的 agent 列表
curl -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{
    "type": "office-status",
    "agents": [
      {"role":"dev","task":"implement-auth","status":"working","label":"寫認證模組中..."}
    ],
    "workflow": "Build Feature"
  }'
```

### 支援的角色
`pm` · `arch` · `dev` · `qa` · `ops` · `res` · `gate` · `designer`

### 支援的狀態
`idle` · `working` · `blocked` · `done`

### Webhook — 一次性事件

CI/CD pipeline 和外部工具可以透過 `POST /api/event` 推送一次性事件：

```bash
# 觸發部署成功慶祝
curl -X POST http://localhost:5174/api/event \
  -H "Content-Type: application/json" \
  -d '{"event":"deploy-success"}'

# 把某個角色標記為 blocked 並附上說明
curl -X POST http://localhost:5174/api/event \
  -H "Content-Type: application/json" \
  -d '{"event":"custom","role":"dev","status":"blocked","label":"等 API keys"}'
```

**支援的事件：** `pr-merged` · `pr-opened` · `pr-reviewed` · `review-approved` · `test-passed` · `test-failed` · `build-success` · `build-failed` · `deploy-start` · `deploy-success` · `deploy-failed` · `release` · `release-cut` · `rollback` · `incident-start` · `incident-resolved` · `custom`

具名事件使用預定義的 agent — `role` 和 `status` 只有 `custom` 事件才需要（會驗證，不合法的值回 HTTP 400）。

#### GitHub Actions 範例

在任何 workflow 加一個步驟，讓辦公室在 CI 事件時亮起來：

```yaml
# .github/workflows/deploy.yml
- name: Notify office — deploy started
  run: |
    curl -s -X POST ${{ vars.OFFICE_URL }}/api/event \
      -H "Content-Type: application/json" \
      -H "X-Office-Token: ${{ secrets.OFFICE_API_TOKEN }}" \
      -d '{"event":"deploy-start"}'

- name: Deploy
  run: npm run deploy

- name: Notify office — deploy result
  if: always()
  run: |
    EVENT=$([[ "${{ job.status }}" == "success" ]] && echo "deploy-success" || echo "deploy-failed")
    curl -s -X POST ${{ vars.OFFICE_URL }}/api/event \
      -H "Content-Type: application/json" \
      -H "X-Office-Token: ${{ secrets.OFFICE_API_TOKEN }}" \
      -d "{\"event\":\"$EVENT\"}"
```

把 `OFFICE_URL`（例如 `http://office.internal:5174`）設成 repository variable、`OFFICE_API_TOKEN` 設成 secret。同一 LAN 的 self-hosted runner 不需額外通道就能連到伺服器。

### Claude Code Hook 安裝

一鍵設定指令會把 hook 複製到 `~/.claude/office-status-hook.js`，並自動在 `~/.claude/settings.json` 為全部 6 個事件註冊（具冪等性 — 可安全重跑）：

```bash
# 如果你 clone 了 repo：
node bin/cli.js setup

# 直接從公開 GitHub repo 跑（不用 clone、不用發佈 npm）：
npx github:KbWen/agent-virtual-office setup

# 等套件發佈到 npm 後：
npx agent-virtual-office setup
```

**手動安裝**（如果你偏好）：

```bash
# 從 clone：
cp public/hooks/office-status-hook.js ~/.claude/office-status-hook.js
# 或從 npm 安裝：
cp node_modules/agent-virtual-office/public/hooks/office-status-hook.js ~/.claude/office-status-hook.js
```

在 `~/.claude/settings.json` 註冊它（hook 從 stdin 讀事件，不需參數）：

```json
{
  "hooks": {
    "PreToolUse":       [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "PostToolUse":      [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "SubagentStart":    [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "SubagentStop":     [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "Stop":             [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }]
  }
}
```

hook 會自動偵測目前的 git branch slug，寫入 `~/.claude/office-status-{slug}.json`，辦公室再以 `process.cwd()` 過濾，所以其他專案的 session 不會出現。

### Codex CLI 狀態橋接

Codex CLI 現在可以直接走和 Claude 一樣的 file-backed runtime 路徑，只要用 helper script 寫入標準化的 `office-status` payload：

```bash
node public/hooks/office-status-codex.js '{"dev":"working","workflow":"Build Feature"}'

# 也支援完整 payload
node public/hooks/office-status-codex.js '{
  "type": "office-status",
  "source": "codex-cli",
  "agents": [
    {"role":"dev","task":"Edit","status":"working","label":"正在改 auth"}
  ],
  "workflow": "Build Feature"
}'
```

這支 helper 會寫入 `~/.claude/office-status-{slug}.json`，辦公室會沿用既有 `/api/status` 輪詢路徑讀到它。這是目前最穩定的 Codex CLI producer path，適合 task runner、wrapper script 或自動化工具。

### Codex App 橋接

如果 Codex App 所在的 host 能執行或嵌入瀏覽器 JavaScript，可以直接使用內建 bridge：

```html
<script src="http://localhost:5174/bridge.js"></script>
<script>
  officeBridge.send({
    source: 'codex-app',
    workflow: 'Reviewing PR',
    dev: 'working',
  })
</script>
```

也可以直接打開 [bridge.html](http://localhost:5174/bridge.html)，透過內建 UI 發送 `codex-app` 更新。

限制說明：這個專案本身目前拿不到 Codex 桌面 app 的自動 host tool events。要做到完全自動同步，仍需要 host 端主動發事件；如果 host 無法提供，`bridge.js` / `bridge.html` 就是支援的 Codex App 路徑。

### 多 Worktree 支援

平行跑多個 worktree？每個 worktree 的 agent 會在大廳顯示成各自獨立的小人：

```bash
# Worktree 1：主專案
git worktree add ../feat-auth feat/auth
cd ../feat-auth && npx agent-virtual-office --port=5175

# Worktree 2：目前專案（不同埠、同一個辦公室視圖）
# 兩個 worktree 共用同一個 ~/.claude/ 目錄，但以 branch slug 隔離
```

打開 `http://localhost:5174?session=feat-auth` 可只看某個 session 的小人。辦公室每個 active worktree 顯示一個代表。

### 平台整合

| 平台 | 整合方式 |
|----------|-----------------|
| **Claude Code** | 安裝 hook（見上）— 自動逐工具路由 |
| **Gemini CLI** | 從 shell hooks `curl POST /api/status` |
| **Codex CLI** | `node public/hooks/office-status-codex.js ...` 或 `curl POST /api/status` |
| **任何 CI/CD** | `curl POST /api/event` 推一次性事件 |
| **Codex App** | `bridge.js` / `bridge.html` host bridge（全自動需 host 端 emitter） |
| **瀏覽器** | `postMessage` 或 `BroadcastChannel('agent-office')` |

---

## 嵌入模式

```
http://localhost:5174?mode=panel    # IDE 側邊欄用的精簡面板
http://localhost:5174?lang=zh-TW   # 強制中文
```

---

## 多語系

預設語言為英文，可切換繁體中文：

- URL 參數：`?lang=zh-TW`
- 應用內切換：控制面板的 EN/中 按鈕
- CLI 旗標：`--lang=zh-TW`
- 自動偵測：瀏覽器語言為 `zh-TW` / `zh-Hant` 時自動使用中文

---

## 疑難排解

<details>
<summary><b>常見問題</b></summary>

### 埠 5174 已被佔用
```bash
npx agent-virtual-office --port=5175
```

### npm install 失敗（公司 proxy）
```bash
npm config set proxy http://your-proxy:8080
npm config set https-proxy http://your-proxy:8080
npm install
```

### 瀏覽器沒有自動打開
在 headless Linux、WSL 或遠端伺服器上可能發生。請手動打開：
```
http://localhost:5174
```

### 辦公室一片空白 — 沒有小人出現
1. **沒裝 hook？** 跑 `npx agent-virtual-office setup` 安裝 Claude Code hook。
2. **不同目錄？** 辦公室以 `process.cwd()` 過濾。請在和 Claude Code session 相同的目錄跑辦公室。
3. **狀態過期？** 狀態在閒置 5 分鐘後過期 — 開一個新的 Claude session。
4. **沒在用 Claude Code？** 用 `curl` 手動推狀態：
   ```bash
   curl -X POST http://localhost:5174/api/status \
     -H "Content-Type: application/json" \
     -d '{"dev":"working","workflow":"Hello Office"}'
   ```

### LAN 連不上（同事看不到辦公室）
設定 `OFFICE_API_ALLOWED_ORIGINS` 環境變數：
```bash
OFFICE_API_ALLOWED_ORIGINS=http://192.168.1.100:5174 npx agent-virtual-office
```
或用 `--no-host` 限制只在 localhost。

### Windows 防火牆擋住伺服器
辦公室預設綁定所有網路介面（`--host`）。Windows 可能會跳出允許存取的提示。用 `--no-host` 可避免：
```bash
npx agent-virtual-office --no-host
```

### Node.js 版本錯誤
需要 Node.js 22 以上：
```bash
node --version  # 必須 >= 22
```

### 嚴格 Content Security Policy (CSP) — 動畫消失或版面跑掉
辦公室用 CSS 動畫做天氣覆蓋、小人移動、動態 UI 狀態。在嚴格 CSP 下這些可能被擋：

- **CSS keyframes**（雨滴、雲、閃電）放在 `src/index.css`，會被打包進一般的 `assets/index-*.css`。在 `style-src 'self'` 下就能運作，不需額外設定。
- **React 行內 `style={{ ... }}`**（Tailwind 工具類計算、動態定位、天氣透明度、暗色模式切換）會以 DOM `style` 屬性套用。現代瀏覽器把這些當成 DOM 層級的屬性寫入，而非 CSP 相關的 inline style，但最嚴格的解讀仍可能標記它們。

**建議的 CSP：**
```
style-src 'self' 'unsafe-inline';
```
`'unsafe-inline'` 例外只適用於 `style=` 屬性 — 打包後的樣式表仍受 CSP 保護。如果你的環境完全禁止 `'unsafe-inline'`，可考慮：

1. 用 nonce：自訂 React renderer 為每個會輸出 inline style 的元件注入 `nonce` 屬性（超出本專案範圍 — 需要協助請開 issue）。
2. 把靜態 build 嵌入改成 live `npx agent-virtual-office serve` 路徑，因為 SPA 從同源載入，不需嚴格 CSP。

動畫本身只是視覺裝飾；在完全擋 inline style 的環境，辦公室仍可運作（狀態顏色、小人位置、行為動畫都走打包後的 CSS 路徑）。

</details>

### Gemini CLI 整合

Gemini CLI 沒有像 Claude Code 那樣的內建 hook 系統。請在 wrapper script 裡用 `curl`：

```bash
# 在你的 Gemini CLI 流程裡推狀態：
curl -s -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{"dev":"working","workflow":"Gemini Session"}'

# 完成時：
curl -s -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{"dev":"done"}'
```

或用通用 LLM bridge 的檔案監看模式：
```bash
node node_modules/agent-virtual-office/public/hooks/generic-llm-bridge.js --port=5174
```
它會監看檔案變動並自動更新辦公室。

---

## 技術亮點

| 特色 | 細節 |
|---------|--------|
| **純 SVG 像素藝術** | 16×20 手繪角色，7 種髮型 + 7 種表情 + 2 種性別 |
| **標準對齊的分類器** | W3C Activity Streams 2.0 動詞 + MCP namespace + 角色/workflow 優先序解析器（`src/systems/classify.js`） |
| **角色感知動畫** | `qa+Bash`→放大鏡、`ops+Bash`→部署按鈕、`gate+Bash`→盾牌驗證、`designer+Edit`→白板 — 同一工具、不同角色、不同視覺 |
| **情緒驅動天氣** | `frustrated`→下雨、`stuck`→雷雨、`rushing`→多雲，透過 12 扇牆面窗戶顯示；CSP-safe 打包 keyframes |
| **閒置推論** | `working+45s`→`thinking`、`blocked+90s`→`awaiting-approval`（補上 Pixel Agents 自承的啟發式缺口） |
| **桌面通知** | blocked ≥30s + 分頁隱藏 + 已授權時發瀏覽器通知；同一段事件去重 |
| **自我改進分類器** | `unknownLog` 聚合 Tier 5 fallback（LangSmith 模式）；production 透過 `import.meta.env.PROD` gate 零成本 |
| **今日 done/blocked 指標** | 底部列 `✓N / ✗M` 指標，含 i18n + sr-only 鏡像；跨日原子重置 |
| **RAF 移動 + 走廊路由** | requestAnimationFrame 驅動 80px/s 走路，小人會穿過門口和走廊不卡牆 |
| **行為引擎** | 權重隨機：工作 65% / 日常 12% / 社交 13% / 離席 10% — 依角色、情緒、時段調整 |
| **狀態感知對話** | working 說「衝衝衝！」、blocked 說「救命...」，情緒著色的對話泡 |
| **真實時鐘 + 日夜循環** | 中午午休，天氣/光線隨時間變化，只有 Dev 留到很晚還亮著一盞燈 |
| **永不卡死保證** | try/catch + 看門狗計時器，行為鏈永遠不會斷 |
| **減少動態 + a11y** | 尊重 `prefers-reduced-motion`，每個視覺指標都有 sr-only 標籤，支援暗色模式 |

---

## 架構

```
.
├── bin/
│   └── cli.js                       # npx 進入點
├── src/
│   ├── components/
│   │   ├── AgentCharacter.jsx       # 角色 sprite + 行為排程 + RAF 移動
│   │   ├── PixelOffice.jsx          # 主場景（SVG 辦公室 + 家具 + 天氣覆蓋）
│   │   ├── AgentInspector.jsx       # 單一 agent 詳情面板（點小人 → 詳情）
│   │   ├── BehaviorBubble.jsx       # 對話泡
│   │   ├── TopDownFurniture.jsx     # 桌子/家具 SVG + WallWindow + WeatherOverlay
│   │   └── ControlPanel.jsx         # 底部狀態面板 + ✓N/✗M 指標 + 🔔 通知
│   ├── systems/
│   │   ├── classify.js              # 4 層分類器（built-in / W3C 動詞 / MCP / 角色+workflow）
│   │   ├── unknownLog.js            # Dev 模式 Tier 5 聚合器（LangSmith 模式，prod no-op）
│   │   ├── behaviorEngine.js        # 權重隨機行為引擎
│   │   ├── moodEngine.js            # 滑動視窗情緒（rushing/frustrated/stuck/...）
│   │   ├── movementSystem.js        # 地板區域 + 障礙物 + 路徑尋找
│   │   ├── officeLife.js            # 群體事件系統（eureka/meeting/deploy-success/...）
│   │   ├── contextBubble.js         # 狀態 × 情緒 × 角色感知的對話生成
│   │   ├── constants.js             # 共用 enum（VALID_STATUSES / VALID_MOODS / STATUS_COLORS）
│   │   ├── store.js                 # Zustand state + dailyDoneLedger + dailyBlockedLedger
│   │   └── platformDetect.js        # 瀏覽器 / CLI / 桌面平台偵測
│   ├── inference/
│   │   ├── inferStatus.js           # 外部狀態整合（hook 事件 + SSE/poll）
│   │   ├── desktopNotifier.js       # blocked ≥30s + 分頁隱藏時發瀏覽器通知
│   │   ├── idleGapInfer.js          # 推論 'thinking'（45s gap）/ 'awaiting-approval'（90s gap）
│   │   ├── agentRouter.js           # Agent 路由邏輯
│   │   └── workflowHandoff.js       # Workflow 階段轉換的交接箭頭
│   ├── utils/
│   │   ├── normalizePost.js         # POST /api/status payload 清理
│   │   └── formatTime.js            # 時間/日期格式化
│   ├── server/
│   │   └── scanSessions.mjs         # 多 worktree session 掃描器
│   ├── i18n.js                      # 輕量 i18n（~90 行）
│   ├── locales/
│   │   ├── en.json                  # 英文字串（含 notify.* + ui.todayMetrics*）
│   │   └── zh-TW.json               # 繁體中文字串
│   ├── index.css                    # 打包 keyframes（CSP-safe）+ Tailwind import
│   ├── App.jsx                      # 根元件（辦公室場景 + 控制面板）
│   ├── main.jsx                     # React root + error boundary
│   └── config/
│       ├── characters.json          # 角色定義（8 個角色 + 3 個輕量）
│       └── officeEvents.json        # 事件池 + 訊息庫
├── public/
│   ├── bridge.html                  # iframe 嵌入用的狀態橋
│   └── hooks/                       # 範例 hook 設定（PreToolUse/PostToolUse/Stop/...）
├── server.mjs                       # Production 獨立伺服器（只用 Node 內建模組）
├── docs/                            # Specs、ADR、架構文件
│   ├── specs/                       # 功能 spec + product backlog + shipped log
│   ├── adr/                         # 架構決策紀錄
│   ├── architecture/                # 各領域決策 log
│   └── deployment/                  # Docker / nginx / pm2 / systemd 設定
├── tests/                           # vitest — 1025 個測試涵蓋分類器、推論、store、ledger
├── vite.config.js                   # Vite + 狀態 API middleware（/api/status, /api/event, /api/lang）
└── package.json
```

---

## 技術選型

<table>
<tr><th>用了什麼</th><th>為什麼</th></tr>
<tr><td>React 19 + Vite 6</td><td>開發快、build 快</td></tr>
<tr><td>SVG</td><td>輕量、不需 GPU</td></tr>
<tr><td>requestAnimationFrame</td><td>平滑移動、不卡頓</td></tr>
<tr><td>Zustand</td><td>比 Redux 輕 100 倍</td></tr>
<tr><td>Tailwind CSS v4</td><td>UI 快速迭代</td></tr>
<tr><td><code>new Date()</code></td><td>時段效果，不需伺服器</td></tr>
</table>

<details>
<summary><b>沒用什麼（以及為什麼）</b></summary>

| 技術 | 為什麼不用 |
|-----------|---------|
| Canvas / WebGL | 對這個用途太重 |
| WebSocket | 不需要 — 輪詢 + postMessage 就夠 |
| 後端 / 資料庫 | 純前端、零基礎設施 |
| Three.js | bundle 太大 |

</details>

---

## 文件

- [技術架構](https://github.com/KbWen/agent-virtual-office/blob/main/docs/ARCHITECTURE.md) — 系統架構、移動系統、行為引擎內部細節
- [設計規格書](https://github.com/KbWen/agent-virtual-office/blob/main/docs/DESIGN_SPEC.md) — 視覺風格、精靈系統、動畫狀態、事件腳本
- [精靈圖需求](https://github.com/KbWen/agent-virtual-office/blob/main/docs/SPRITE_REQUIREMENTS.md) — 給貢獻者的像素藝術素材規格

---

## 貢獻

歡迎 PR！動手前請先看 [docs](docs/) 資料夾的技術細節。

---

## License

MIT

---

<div align="center">

**[English](README.md)** · **[中文](README.zh-TW.md)**

用像素和咖啡做的。

</div>
