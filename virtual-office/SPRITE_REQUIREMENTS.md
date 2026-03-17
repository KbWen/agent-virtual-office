# Sprite Asset Requirements / 精靈圖素材需求規格書

> 本文件定義 Agent Virtual Office 專案中所有角色精靈圖的製作規格。
> 目前系統使用 SVG 即時渲染的像素風格作為備用方案，最終目標是以手繪像素圖取代。

---

## Characters / 角色清單

### AgentCortex Mode（7 位角色）

完整功能模式下的 AI 代理角色，每位都有獨特的視覺風格與配件。

| 角色 | ID | 主題色 | 視覺風格 | 配件 |
|---|---|---|---|---|
| PM | `pm` | `#378ADD` (藍色) | 整齊髮型、乾淨俐落 | 剪貼板、甘特圖 |
| 建築師 Architect | `arch` | `#7F77DD` (紫色) | 方帽/貝雷帽 | 白板筆 |
| 開發者 Developer | `dev` | `#1D9E75` (綠色) | 雙馬尾髮型 | 到處都是咖啡杯 |
| QA Engineer | `qa` | `#BA7517` (琥珀色) | 短髮 | 放大鏡 |
| DevOps | `ops` | `#D85A30` (橘色) | 安全帽 | 部署按鈕 |
| 研究員 Researcher | `res` | `#5DCAA5` (青色) | 瀏海髮型 | 書本 |
| 門神 Gatekeeper | `gate` | `#E24B4A` (紅色) | 嚴肅表情、短髮 | 盾牌 |

### Lightweight Mode（3 位角色）

輕量模式下的精簡角色組合，適用於小型團隊或示範用途。

| 角色 | ID | 主題色 |
|---|---|---|
| 規劃師 Planner | `planner` | `#378ADD` (藍色) |
| 執行者 Worker | `worker` | `#1D9E75` (綠色) |
| 檢查員 Checker | `checker` | `#BA7517` (琥珀色) |

輕量模式的角色不需要額外配件，但仍需透過髮型或服裝顏色做出區別。

---

## Size & Format / 尺寸與格式

| 項目 | 規格 |
|---|---|
| 畫布尺寸 | **32x32 像素**（每格動畫幀）；如偏好小尺寸可用 16x24 |
| 檔案格式 | PNG，含透明背景（建議使用 sprite sheet 合併圖） |
| 畫風 | 可愛 Q 版像素風（大頭小身體，類似星露谷物語 / RPG Maker 風格） |
| 視角 | **俯視 / 3/4 視角**（非側面視角、非等距視角） |

---

## Required Animation States / 必要動畫狀態

每位角色都需要以下動畫幀：

| # | 狀態 | 英文名稱 | 幀數 | 說明 |
|---|---|---|---|---|
| 1 | 待機（面朝下） | Idle (facing down) | 2 幀 | 呼吸或微幅晃動的循環動畫 |
| 2 | 向下走路 | Walk Down | 4 幀 | 面朝螢幕方向行走 |
| 3 | 向上走路 | Walk Up | 4 幀 | 背對螢幕方向行走 |
| 4 | 向左走路 | Walk Left | 4 幀 | 向右走路直接水平翻轉即可 |
| 5 | 坐下工作 | Sitting / Working | 2-4 幀 | 坐在桌前打字的動畫 |
| 6 | 喝咖啡 | Drinking Coffee | 2-3 幀 | 舉杯喝咖啡的動作 |
| 7 | 聊天對話 | Talking / Chat | 2-3 幀 | 說話時嘴巴開合或手勢 |
| 8 | 睡覺打盹 | Sleeping / Nap | 2 幀 | 趴在桌上或打瞌睡，搭配 Zzz 效果 |

總計每角色約 **22-26 幀**。

---

## Sprite Sheet Layout / 精靈圖排列方式

建議每位角色一張 PNG sprite sheet。列（row）代表動畫狀態，行（column）代表幀序。

以 32x32 每格為例，sprite sheet 大小為 **128 x 256 像素**（4 欄 x 8 列）：

```
Row 0: Idle          [frame0] [frame1] [     ] [     ]
Row 1: Walk Down     [frame0] [frame1] [frame2] [frame3]
Row 2: Walk Up       [frame0] [frame1] [frame2] [frame3]
Row 3: Walk Left     [frame0] [frame1] [frame2] [frame3]
Row 4: Working       [frame0] [frame1] [frame2] [frame3]
Row 5: Coffee        [frame0] [frame1] [frame2] [     ]
Row 6: Chat          [frame0] [frame1] [frame2] [     ]
Row 7: Nap           [frame0] [frame1] [     ] [     ]
```

空白格留透明即可。若某狀態不足 4 幀，剩餘格位留空。

---

## Color Palette / 色彩規範

### 通用色彩

| 用途 | 色碼 | 說明 |
|---|---|---|
| 膚色 | `#FFE0C0` 或相近暖色 | 所有角色共用基底膚色 |
| 輪廓線 | 深色（比填色深 2-3 階） | 不用純黑，用深色版主題色更自然 |
| 眼睛 | 深色 + 高光點 | 小像素圖中眼睛通常是 1-2 px |

### 角色主題色對應

每位角色的**服裝主色調**應使用其主題色，可搭配明暗變化做出層次：

- `pm`: `#378ADD` 藍色系服裝
- `arch`: `#7F77DD` 紫色系服裝
- `dev`: `#1D9E75` 綠色系服裝
- `qa`: `#BA7517` 琥珀色系服裝
- `ops`: `#D85A30` 橘色系服裝
- `res`: `#5DCAA5` 青色系服裝
- `gate`: `#E24B4A` 紅色系服裝

### 調色盤限制

為了維持正統像素風格，每位角色建議使用 **16-32 色**。包含：
- 服裝主色 + 1-2 階明暗
- 膚色 + 1 階陰影
- 髮色 + 1 階明暗
- 配件色
- 輪廓色

---

## File Naming Convention / 檔案命名規範

```
virtual-office/public/sprites/
├── pm.png              # PM 角色 sprite sheet
├── arch.png            # 建築師
├── dev.png             # 開發者
├── qa.png              # QA 工程師
├── ops.png             # DevOps
├── res.png             # 研究員
├── gate.png            # 門神
├── planner.png         # 規劃師（輕量模式）
├── worker.png          # 執行者（輕量模式）
└── checker.png         # 檢查員（輕量模式）
```

檔名全小寫，使用角色 ID 作為主檔名。若需要分開的單幀圖片（而非 sprite sheet），可用子目錄：

```
virtual-office/public/sprites/
├── pm_spritesheet.png
└── pm/
    ├── idle_0.png
    ├── idle_1.png
    ├── walk_down_0.png
    └── ...
```

---

## Integration Notes / 整合注意事項

### 載入方式

精靈圖將透過 SVG `<image>` 標籤或 CSS `background-image` 載入。目前程式碼中已有 SVG 像素風格的備用渲染器（fallback），當偵測到外部精靈圖檔案時，會自動優先使用圖片素材。

### 放置路徑

將完成的 PNG 檔案放入以下目錄：

```
virtual-office/public/sprites/
```

程式碼會自動偵測並使用這些檔案，取代 SVG fallback 渲染。

### 運動與縮放參數

| 參數 | 數值 | 說明 |
|---|---|---|
| 行走速度 | ~100px/sec | 在辦公室 SVG 中的移動速度 |
| SVG ViewBox | 800 x 560 | 辦公室場景的座標系統 |
| 動畫幀率 | 4-8 FPS | 像素動畫的播放速度 |
| 渲染大小 | 約 28-36px 高 | 角色在 SVG 中的實際顯示尺寸 |

### 程式碼整合步驟

1. 將 sprite sheet PNG 放入 `virtual-office/public/sprites/` 目錄
2. 確認檔名與角色 ID 對應（如 `pm.png` 對應 `pm` 角色）
3. 程式碼會在載入時檢查 `sprites/` 目錄下是否有對應檔案
4. 若找到圖片，自動切換為圖片渲染模式，取代 SVG 備用方案
5. 若圖片載入失敗，自動降級回 SVG fallback，確保系統穩定運作

---

## Expression Overlays (Optional) / 表情圖示（選用）

如果可能的話，額外提供小型表情圖示（16x16 像素），可疊加顯示在角色頭頂：

| 表情 | 英文 | 使用情境 |
|---|---|---|
| 開心 | Happy | 任務完成、收到好消息 |
| 普通 | Normal | 一般狀態 |
| 困惑 | Confused | 遇到問題、等待回應 |
| 想睡 | Sleepy | 長時間工作、深夜時段 |
| 驚訝 | Surprised | 收到緊急任務、突發事件 |
| 疲累 | Tired | 高負載狀態 |
| 專注 | Focused | 深度工作模式 |

表情圖示檔案建議放在：

```
virtual-office/public/sprites/expressions/
├── happy.png
├── normal.png
├── confused.png
├── sleepy.png
├── surprised.png
├── tired.png
└── focused.png
```

---

## Visual References / 視覺參考

製作精靈圖時，可以參考以下遊戲的角色風格：

| 參考作品 | 風格特點 | 參考重點 |
|---|---|---|
| **Stardew Valley** | 32x32 Q 版像素角色 | 比例、行走動畫、表情系統 |
| **RPG Maker MV/MZ** | 角色產生器輸出 | Sprite sheet 排列格式、動畫幀數 |
| **Animal Crossing** | 可愛村民像素圖 | 角色個性化、配件設計 |
| **Octopath Traveler** | HD-2D 風格 | 進階版本的質感參考（premium look） |

整體風格目標：**可愛、辨識度高、色彩鮮明**，讓使用者一眼就能分辨不同角色的身份與職能。

---

## Priority / 製作優先順序

建議按以下順序製作：

1. **第一批**（核心角色）：`pm`, `dev`, `arch` — 最常出現的三位
2. **第二批**（完整團隊）：`qa`, `ops`, `res`, `gate` — 補齊 AgentCortex 七人組
3. **第三批**（輕量模式）：`planner`, `worker`, `checker` — 輕量模式專用
4. **第四批**（選用）：表情圖示 — 提升互動體驗

每完成一位角色就可以整合進系統測試，不需要等全部完成。
