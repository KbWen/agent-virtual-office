---
status: draft
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
