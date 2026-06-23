<div align="center">

# Agent Virtual Office

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![React 19](https://img.shields.io/badge/react-19-61dafb.svg)](https://react.dev)

**一個讓你的 coding agent 活過來的迷你像素辦公室。**

![Agent Virtual Office — 像素風虛擬辦公室,即時視覺化 AI coding agent(Claude Code、Codex、Gemini CLI)的工作、卡關與出貨狀態](https://raw.githubusercontent.com/KbWen/agent-virtual-office/main/docs/screenshot-zh-TW.png)

<sub><i>整間辦公室，session 進行中 —— 有人埋頭、有人卡關、有人剛出貨。全是即時的。</i></sub>

當 Claude Code 在你的 codebase 裡埋頭苦幹，一個像素版的它正坐在桌前做一樣的事 —— 打字、卡關、氣呼呼地跑去跟
QA 吵那到底算不算 bug。把它接上你的 Claude Code / Codex / CI session，你的 agent 就真的來上班了 —— `working`、
`blocked`、出貨、鬥嘴，即時上演。它不是儀表板，對工作毫無幫助，但你就是會一整天開著它。

[快速開始](#快速開始) · [他們在幹嘛](#他們在幹嘛) · [常見問答](#常見問答) · [English](README.md)

</div>

---

## 他們在幹嘛？

| 小人 | 個性 | 通常會看到他… |
|------|------|-----------------|
| **PM** | 開會是一種愛的語言 | 把根本不用調的甘特圖再調一次 |
| **建築師** | 貝雷帽。意見很多。 | 講到一半突然衝去白板大喊「有了！」 |
| **開發者** | 雙馬尾、咖啡續命 | 桌上五個空杯，正在沖第六杯 |
| **QA** | 什麼都不信、放大鏡隨身 | 跟 Dev 說這 bug 是真的。它就是真的。 |
| **DevOps** | 安全帽一戴、天不怕地不怕 | 深吸一口氣，然後按下那顆大紅按鈕 |
| **研究員** | 住在書堆後面 | 一直疊書，疊到某個瞬間突然懂了 |
| **門神** | 你 pipeline 的保鑣 | 盾牌一舉：「前置條件不夠。」重來。 |
| **設計師** | 粉紅頭髮、對 padding 很有意見 | 把一個色票往左移 2px，這是第三次了 |

## 辦公室日常

開著放著，事情就自己發生了。有些事件由你 session 的**真實訊號**觸發 —— 真的部署成功才放煙火、卡關連續發生才開吵；
社交橋段則照計時器出現，而且 live session 忙碌時會自動降頻，不會蓋過真實工作：

- **茶歇時間** — 幾個人溜去咖啡機旁，聊其他人的八卦
- **站立會議** — PM 把所有人趕到白板前。沒人逃得掉。
- **外送到了** — 有人舉著紙袋進來。生產力結束。
- **Review 開吵** — Dev：「沒 bug。」QA：「你看這裡。」Dev：「…好啦。」
- **部署成功** — Ops 一巴掌拍下按鈕，全場炸開
- **靈感時刻** — 建築師定格三秒，然後衝去白板

…還有稀有的：有人帶狗來上班、冷氣掛了全場搧風、老闆來巡視、全辦公室*瞬間看起來超忙*。

辦公室會填滿你停靠的任何寬度 —— IDE 側欄、半螢幕、全視窗，左右不留死白。按 **☰** 切換直式名冊：誰在工作、誰卡關，
還有一條「剛剛發生了什麼」的即時動態。

## 為什麼它很療癒

- **純 SVG 像素藝術** — 8 個手繪角色。不用 canvas、不吃 GPU、bundle 不肥。
- **角色感知動畫** — 同一工具、不同角色、不同場景：`qa + Bash` → 放大鏡、`ops + Bash` → 部署按鈕、`designer + Edit` → 白板。
- **誠實、由訊號驅動的生命力** — 事件由你的*真實* session 觸發，角色的真實狀態永遠不造假。
- **每個角色有自己的口吻** — 對話氣泡只放聲音（懷疑的 QA、俐落的 PM、埋頭的研究員各有腔調），狀態一律走顏色環 + 工作符號。有個性，但不假造它們其實沒有的對話或交情。
- **以「安靜」為設計** — 情緒驅動天氣、閒置推論（`working+45s` → thinking）、減少動態 + a11y，以及永不卡死的行為看門狗。

→ 完整內部機制（分類器層級、移動、行為引擎、天氣、推論）在 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**。

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

## 疑難排解

<details>
<summary><b>常見問題</b></summary>

**辦公室一片空白 — 沒有小人**
1. 沒裝 hook？跑 `npx agent-virtual-office setup`。
2. 目錄不對？辦公室以 `process.cwd()` 過濾 —— 請在和 session 相同的目錄跑它。
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
