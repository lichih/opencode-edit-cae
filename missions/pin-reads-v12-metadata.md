# Mission: Pin-Reads V12 - TUI Data Bridge (Minimalist)

## 1. 核心願景 (Core Vision)
透過最精簡的代碼變動，將 Pinned Files 狀態同步至 Session Metadata。此舉是為了讓 TUI 面板能感知後端狀態，同時引入評分機制以自動優化 Context，但不改變 `read.ts` 以內存全域變數為核心的架構。

## 2. 實作架構 (Minimalist Architecture)

### A. 維持內存為唯一真相 (In-Memory Source of Truth)
- **`src/tool/read.ts`**: 繼續維護 `export const PinnedRegistry` (Map)。
- **變動**：在 Registry 的 Value 中追加 `score` (HP) 與 `lastAction` 欄位。
- **禁令**：**嚴禁**在 `read.ts` 中呼叫 `Session.updateMetadata`。

### B. 單點狀態同步 (Single-Point State Sync)
- **實作點**：`src/session/prompt.ts` 的 `insertReminders`。
- **邏輯步驟**：
    1.  **HP 衰減**：遍歷 `PinnedRegistry` 執行 `score -= 20` 並刪除歸零檔案。
    2.  **JIT 注入**：按 `score` 排序執行 Context 注入。
    3.  **鏡像更新 (The Bridge)**：僅在此處執行 **一次性** 的 `Session.updateMetadata`。
    4.  **內容**：將 `PinnedRegistry` 的內容轉為 JSON 並存入 `metadata.pinnedFiles`。

## 3. 重要性評分規則 (Scoring Rules)
-   **賦分**: `read` = 40 HP, `edit` = 100 HP.
-   **衰減**: 每輪對話開始前 **-20 HP**。
-   **清理**: 分數歸零則從 Registry 移除，同步也會從 Session 消失。

## 4. 實作路徑 (Roadmap)
1.  **`read.ts`**: 確保 `PinnedRegistry` 在更新時正確賦予 `score`。
2.  **`prompt.ts`**: 在 `insertReminders` 中實作 HP 遞減與 `Session.updateMetadata` 調用。
3.  **驗證**: 觀察 `make build-patches` 產出的補丁，確保 `read.ts` 的變動極小。
