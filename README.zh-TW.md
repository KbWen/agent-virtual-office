<div align="center">

# Agent Virtual Office

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![React 19](https://img.shields.io/badge/react-19-61dafb.svg)](https://react.dev)

**AI 忙著寫程式，小辦公室也開張了。**

![Agent Virtual Office — 本機辦公室畫面，擷取時八位角色都在閒置](https://raw.githubusercontent.com/KbWen/agent-virtual-office/main/docs/screenshot-zh-TW.jpg)

<sub><i>擷取時本機工作階段已連線，八位角色都在閒置。</i></sub>

接上 Claude Code、Codex、Gemini CLI 或 CI，就能在像素辦公室裡看見工作中、卡關與閒置。休息時，捏捏紙星星，或把明信片拿下來看看。

[快速開始](#快速開始) · [他們在幹嘛](#他們在幹嘛) · [常見問答](#常見問答) · [English](README.md)

</div>

---

## ✨ 隨手看看

<table>
<tr>
<td width="50%" align="center">
<img src="https://raw.githubusercontent.com/KbWen/agent-virtual-office/main/docs/screenshot-zh-TW.jpg" alt="像素辦公室畫面" /><br>
<sub><b>辦公室一覽。</b>看看角色與空間配置。</sub>
</td>
<td width="50%" align="center">
<img src="https://raw.githubusercontent.com/KbWen/agent-virtual-office/main/docs/assets/office-poke.gif" alt="動畫：戳一下角色，他會晃一下並顯示目前狀態" /><br>
<sub><b>戳一下角色</b>就能看目前在做什麼，位置不會改變。</sub>
</td>
</tr>
<tr>
<td width="50%" align="center">
<img src="https://raw.githubusercontent.com/KbWen/agent-virtual-office/main/docs/assets/cozy-postcard.jpg" alt="已選用小貓咪貼紙的辦公室明信片預覽" /><br>
<sub><b>辦公室明信片。</b>從佈告欄拿起來，可加貼紙，再下載 PNG。</sub>
</td>
<td width="50%" align="center">
<img src="https://raw.githubusercontent.com/KbWen/agent-virtual-office/main/docs/screenshot.jpg" alt="英文介面的像素辦公室畫面" /><br>
<sub><b>也有英文介面。</b>可在應用程式中切換語言。</sub>
</td>
</tr>
</table>

## 他們在幹嘛？

| 角色 | 小小個性 |
|------|----------|
| **PM** | 把根本不用調的甘特圖再調一次 |
| **建築師** | 貝雷帽，意見很多，講到一半就衝去白板 |
| **開發者** | 雙馬尾，五個空杯，正在沖第六杯咖啡 |
| **QA** | 放大鏡一拿：這個 bug 千真萬確 |
| **DevOps** | 戴好安全帽，深呼吸，再按下大紅按鈕 |
| **研究員** | 躲在書堆後面，再添一本書 |
| **門神** | 盾牌一舉：「前置條件不夠。」重來。 |
| **設計師** | 對 padding 很有意見，色票再往左兩格 |

各角色會依工具動作呈現不同動畫：Bash 會讓 QA 拿出放大鏡、讓 Ops 走向部署按鈕；Edit 會讓設計師走到白板。只有工具有回報時，辦公室才會顯示卡關原因，例如測試、建置或安裝失敗；沒有回報就維持未知。重複失敗會出現記號；45 秒沒有新訊號時，工作中的角色可能轉為思考。八位角色都是手繪 SVG，不需 canvas 或 GPU。

## 辦公室日常

工作中與卡關狀態依工具回報顯示。日常小演出按時間出現，忙碌時會減少；部分演出也會回應工作階段事件。顏色環與工作符號呈現狀態，對話泡泡則是角色碎念。

- **茶歇時間** — 有人溜去咖啡機旁
- **站立會議** — PM 把大家叫到白板前
- **外送到了** — 紙袋一進門，工作先等等
- **Review 開吵** — Dev 和 QA 對 bug 各有看法
- **靈感時刻** — 建築師衝向白板

從 IDE 側欄到完整視窗，辦公室都會填滿可用寬度。按 **☰** 打開名冊，查看工作中、卡關的角色與最近活動。

## 場景互動

- **角色：** 點一下查看目前動作；按 `Space` 再戳一次，右鍵直接戳、不開啟檢視窗。
- **紙星星：**在休息區桌上；短按、稍微按住和長按各有不同反應。
- **明信片：**從佈告欄拿下來，可加小盆栽或小貓咪貼紙，再按「下載 PNG」。貼紙只會套用在明信片上。

摸摸小夥伴、盆栽互動與閒置揮手都是選用功能，預設關閉，可在設定中開啟。

→ 分類器、移動與行為引擎的說明：**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**。

---

## 快速開始

```bash
# 直接從公開的 GitHub repo 跑 —— 不用 clone、不用安裝：
npx github:KbWen/agent-virtual-office

# 用 Claude Code？一行指令接好自動狀態：
npx github:KbWen/agent-virtual-office setup
```

打開它彈出的瀏覽器分頁，你的小人們已經在位子上了。就這樣 —— 不需要後端、不需要資料庫、不需要 WebSocket。

<details>
<summary>想用 clone，或需要更多選項？</summary>

```bash
git clone https://github.com/KbWen/agent-virtual-office.git
cd agent-virtual-office
npm install
npm run dev
```

CLI 旗標：`--port=PORT` · `--lang=en|zh-TW` · `--no-open` · `--no-host`（只綁 localhost；dev 伺服器預設會綁定所有網路介面）。

> dev 伺服器沒有任何驗證，且預設對 LAN 開放。要只在本機請用 `--no-host`，或改用 production `serve` 模式搭配
> `OFFICE_API_TOKEN` 做有保護的部署。

**架給團隊用**（production build、Docker、Nginx、PM2、TLS）→ **[docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)**。

</details>

## 接上你的 Agent

任何能發 HTTP 請求的工具都能驅動辦公室：

```bash
# 告訴辦公室某個 agent 正在工作：
curl -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{"dev":"working","workflow":"Sprint 42"}'

# 或推一個一次性的 CI 時刻：
curl -X POST http://localhost:5174/api/event -d '{"event":"deploy-success"}'
```

- **Claude Code** → `npx agent-virtual-office setup`，之後每個工具呼叫都會自己路由。搞定。
- **Codex CLI / Codex App / Gemini CLI / GitHub Actions / 任何 CI** → 見 **[整合指南](docs/INTEGRATIONS.md)**。

### `setup` 會註冊的 hook 事件

| 事件 | 需要的能力 | 會看到什麼 |
|---|---|---|
| `PreToolUse` / `PostToolUse` | 核心 hooks | 每個工具呼叫的 working／done／blocked 狀態 |
| `SubagentStart` / `SubagentStop` | 核心 hooks | 子代理的工作流橫幅 |
| `UserPromptSubmit` | 核心 hooks | PM 進入 planning 模式 |
| `Stop` | 核心 hooks | 一輪結束後的 idle 狀態 |
| `PermissionDenied` *(AVO-148)* | Hooks v1.x+ | 權限系統擋下工具呼叫時，把該負責的 agent 標成 `blocked`，原因 `permission-denied`。你的 Claude Code 版本若不發這個事件也無妨 —— handler 單純不會被呼叫。 |
| `StopFailure` *(AVO-148)* | Hooks v1.x+ | 一輪以 Claude API 錯誤收尾時，把當下所有 working 的 session agent 標成 `blocked`，原因 `api-rate-limit` 或 `api-auth-failed`（讀 `matcher` enum 欄位，完全不做文字解析）。沒有這個事件也無妨。 |

### 選擇性開啟的事件擷取模式 *(AVO-153)*

hook 可以把原始事件錄下來，用於產生 fixture 與驗證 schema：

1. **開啟**：`touch ~/.claude/office-hook-capture`（Linux／macOS）或 `New-Item ~/.claude/office-hook-capture`（PowerShell）
2. **照常使用 Claude Code** —— 每次工具呼叫都會往 `~/.claude/office-hook-capture.jsonl` 追加一行 JSON
3. **清理**：`node scripts/sanitize-hook-capture.mjs` → 產出 `tests/fixtures/hook-events/*.json`
4. **檢查**：commit 前確認 fixture 裡沒有殘留的敏感字串
5. **關閉**：刪掉那個標記檔；原始擷取留在 `~/.claude`（永遠不會被 commit）

擷取路徑整段包在 `try/catch` 裡 —— 開或關都不會影響 hook 的正常行為。

## 嵌入與語言

```
http://localhost:5174?mode=panel     # IDE 側邊欄用的精簡面板
http://localhost:5174?lang=zh-TW     # 強制繁體中文
```

預設英文；繁體中文可透過 `?lang=zh-TW`、應用內 **EN/中** 切換、`--lang` 旗標，或瀏覽器自動偵測（`zh-TW` / `zh-Hant`）啟用。

## 命名與換色角色

把角色改成你的團隊或自訂名稱（也可換色）。兩種方式，都是**覆寫既有角色**（`pm`、`arch`、`dev`、`qa`、`ops`、`res`、`gate`、`designer`）：

```
# URL 參數 — 依角色改名（name:role，逗號分隔）：
http://localhost:5174?agents=Alice:dev,Bob:qa,Chen:pm
```

```js
// 在 app 載入前（例如自訂頁面的 inline <script>）— 改名 + 換色：
window.__office_config__ = {
  agents: {
    dev: { name: 'Alice', color: '#E8927C' },
    qa:  { name: 'Bob',   color: '#7CA7E8' },
  },
}
```

`?agents=` 只改**名字**；`window.__office_config__` 可改**名字 + 顏色**。這是改既有角色「是誰」，不是改它們的像素外觀——自訂 sprite 美術（帽子、服裝、配件）是另一條**尚未實作**的軌道（見 `docs/SPRITE_REQUIREMENTS.md`）。

---

## 診斷與 soak 測試

視覺／湧現性的 bug（小人疊在一起、瞬移、走到一半凍住）活在**幾分鐘的執行時間裡**，
不會出現在任何單一函式裡 —— 所以這個 repo 自己帶了觀測工具：

| 指令 | 做什麼 |
|---|---|
| `npm run soak` | **Soak 閘門。** 無頭跑辦公室 5 分鐘（`--minutes N` 可調），違反世界不變式就失敗：瞬移、持續站位重疊、凍住的行走者、站在家具裡面。CI 也會每晚跑（`sim-soak` workflow）。 |
| `node scripts/overlap-recorder.mjs 12` | 重疊鑑識：兩個小人完全重疊 ≥2 秒時，把雙方最近約 12 秒的狀態鏈（位置、目標、行為）倒出來，讓機制看得見。 |
| `node scripts/zone-audit.mjs` | 移動節奏稽核：3 分鐘的區域佔用、房間造訪次數，以及同時有 0／1／2+ 人在走動的比例。它的 `--organic` 旗標會**改名你真正的 `~/.claude/office-status*.json`** 來隔離，正常結束才還原 —— 建議改用下面的 `npm run rhythm`，它不用碰你的檔案就能隔離。 |
| `npm run rhythm` | **辦公室是「活著」還是只是「很忙」？** 天生封閉（自己起一台 dev server 指向空的 `OFFICE_STATUS_DIR`，一旦有外部狀態進來就拒絕報數字）。它用精確的 Poisson-binomial **獨立模型**來對照靜止率 —— 這個落差說的是移動有沒有**成團**（有爆發也有真安靜 = 節奏）還是**攤平**（永遠有人在走 = 雜訊），這是任何速率指標都分不出來的。也會標出過期的行為標籤（AVO-195）。只報告，不當閘門。 |

以上全部都會重用執行中的 `npm run dev`（:5173），沒有就自己起一台。看到視覺異常時，
**先跑**對應的錄製器再談理論 —— v1.4.0 裡每一個重疊／節奏修正都是從這些捕捉開始的。

> **怎麼讀節奏數字。** 只引用單次執行的靜止**落差**；靜止**水位**單跑一次不可重現。
> 同一份程式碼跑兩次 8 分鐘，水位是 1.4% 和 11.8%，但落差穩定在 −12.3 與 −10.5 點。
> 任何關於水位的說法都需要在未改動的版本上做一次配對對照。
>
> **要比「比值」，不是比點數落差。** 絕對落差**受限於**獨立水位 —— 平均移動 16.8% 時獨立靜止是
> 22.3%，−10 點的落差有可能；到了 23.5% 獨立靜止只剩 9.2%，同樣的落差在算術上就不可能發生。
> 兩個一樣「攤平」但移動量不同的辦公室，會報出天差地遠的落差。請看 `stillnessRatio`
> （<1 攤平、≈1 獨立、>1 成團），並確認 `run context mood=… hour=…` 這行：光是 mood 就會讓
> ambient 出門比例從 26%（`normal`）→ 35%（`idle`）→ 40%（`smooth`）。

---

## 疑難排解

<details>
<summary><b>常見問題</b></summary>

**辦公室一片空白 — 沒有小人**
1. 沒裝 hook？跑 `npx agent-virtual-office setup`。
2. 目錄不對？辦公室只顯示「啟動它的那個目錄」的 session —— 請在專案根目錄執行，或用
   `OFFICE_PROJECT_ROOT=/path/to/project` 指到別處。
3. 狀態過期？閒置 5 分鐘後狀態會過期 —— 開一個新 session。
4. 沒在用 Claude Code？用 `curl` 推狀態（見[接上你的 Agent](#接上你的-agent)）。

**埠 5174 被佔用** → `npx agent-virtual-office --port=5175`

**瀏覽器沒自動打開**（headless Linux / WSL / 遠端）→ 手動打開 `http://localhost:5174`。

**同事看不到（LAN）** → 設定 `OFFICE_API_ALLOWED_ORIGINS=http://192.168.1.100:5174`，或用 `--no-host` 只在本機。

**Windows 防火牆提示** → dev 伺服器綁定所有網路介面；用 `--no-host` 可避免。

**Node 版本錯誤** → 需要 Node ≥ 22（`node --version`）。

**嚴格 CSP — 動畫消失** → 允許 `style-src 'self' 'unsafe-inline'`（例外只適用於 `style=` 屬性）。沒有它辦公室仍可運作 ——
只是天氣／移動的視覺裝飾會消失。完整說明在 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

</details>

## 常見問答

### Agent Virtual Office 是什麼?

一個開源的像素風 AI coding agent 視覺化工具:把進行中的 Claude Code / Codex / Gemini CLI session
變成一間迷你辦公室,每個 agent 都是一個會工作、會卡關、會出貨的小人 —— 全部即時、只由 session 的
真實訊號驅動。React + 純 SVG,完全在你的機器上跑,零後端。

### 怎麼把 Claude Code 的活動視覺化?

跑一次 `npx github:KbWen/agent-virtual-office setup`。它會註冊 Claude Code hooks,之後每個工具呼叫、
subagent、回合都會自動更新辦公室 —— 不用手動接線、不用 API key。

### 支援 Codex、Gemini CLI 或 CI 嗎?

支援。任何能發 HTTP POST 的工具都能驅動辦公室 —— Codex CLI / Codex App、Gemini CLI、GitHub Actions,
或你自己的腳本。見[整合指南](docs/INTEGRATIONS.md)。

### 它是儀表板或 token/成本追蹤器嗎?

不是。它不畫 token、花費或生產力圖表。它是誠實的視覺化:只有真實訊號證明時才顯示狀態,絕不造假活動。
它是桌上小玩具,不是指標系統。

### 它會把我的程式碼或資料傳出去嗎?

不會。沒有後端、沒有資料庫、沒有遙測、沒有外部服務。狀態更新只在你自己的機器上以 HTTP 傳遞 ——
預設 localhost,LAN 曝露可用 `--no-host` 關閉。

### 需要安裝什麼嗎?

不用。`npx github:KbWen/agent-virtual-office` 直接從公開 GitHub repo 跑起來,唯一需求是 Node.js ≥ 22。

## 技術選型

React 19 + Vite 8 · SVG（不用 canvas、不吃 GPU）· Zustand · Tailwind CSS v4 · `requestAnimationFrame` · 零後端。
2000+ 個測試（分類器、推論、store、移動、事件誠實性）。深入細節 → **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**。

## 貢獻

歡迎 PR —— 辦公室永遠需要更多生命力。動手前先翻翻 [docs](docs/) 了解技術全貌。

## License

MIT

---

<div align="center">

**[English](README.md)** · **[中文](README.zh-TW.md)**

用像素和咖啡做的。

</div>
