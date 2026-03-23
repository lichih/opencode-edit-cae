# Mission: Pin-Reads V12 - Metadata Migration & Priority Scoring

## 1. 核心願景 (Core Vision)
升級 Pin-Reads 系統，將其從「進程內記憶體管理」遷移至「Session Metadata 管理」。此舉旨在達成：
1.  **跨進程同步**：讓 TUI 介面能透過 Session 數據流即時顯示 Pinned Files 狀態。
2.  **智慧 Context 淘汰**：引入「生命值 (Score)」機制，根據檔案操作類型（讀/寫）自動管理 Context 的存活與權重，確保模型專注於施工現場。
3.  **1:1 原生相容**：維持 read 工具原生行為，並在其基礎上無感增強。

## 2. 數據模型 (Data Model)
在 `Session.metadata.pinnedFiles` 中以對象形式存儲檔案狀態。
路徑：`Record<string, PinnedFileState>`

### PinnedFileState 結構：
```typescript
{
  mtime: number;          // 磁碟最後修改時間（用於變動偵測）
  lastAccessTime: number; // 最後操作時間戳記
  lastAction: 'read' | 'edit' | 'sync'; // UI 著色標記：read(綠), edit(紅), sync(灰/藍)
  score: number;          // 生命值 (0-100)，決定注入權重與存活期
  turnIndex: number;      // 最後操作發生的對話輪次索引
}
```

## 3. 重要性評分與衰減邏輯 (Scoring & Decay)

### A. 賦分規則 (Score Refill)
-   **Read (Full)**: 被 `read` 工具全量讀取時，賦予 **40 分**。
-   **Edit**: 被 `edit` 工具成功修改時，賦予 **100 分**（核心現場）。
-   **Sync**: `prompt.ts` 偵測到 mtime 變動並自動更新內容時，加 **20 分** (上限 100)。

### B. 衰減規則 (Dynamic Decay)
-   **每輪遞減**：在 `insertReminders` (每一輪對話開始前) 執行。
-   所有釘選檔案的 `score` 自動 **減少 20 分**。

### C. 清理機制 (Automatic Purge)
-   **歸零移除**：當 `score <= 0` 時，從 `metadata.pinnedFiles` 中刪除該檔案。
-   **LRU 保底**：若檔案數量超過 100 筆，優先移除 `lastAccessTime` 最舊者。

## 4. 實作路徑 (Implementation Guidelines)

### Phase 1: `src/tool/read.ts` 更新
-   **移除**：模組層級的 `PinnedRegistry` 全域變數。
-   **邏輯**：
    -   使用 `Session.get(ctx.sessionID)` 讀取現有 metadata。
    -   Pin 成功時，更新 `pinnedFiles` 清單並設定初始分數 (40)。
    -   使用 `Session.updateMetadata` 保存。
-   **補全**：確保 Pin 成功後依然附加 `<system-reminder>`。

### Phase 2: `src/session/prompt.ts` 更新
-   **數據源**：從 `input.session.metadata.pinnedFiles` 讀取。
-   **引擎**：
    -   遍歷清單，執行 `score -= 20`。
    -   檢查 `mtime` 變動，執行 JIT 注入。
    -   過濾歸零檔案。
    -   保存更新後的 metadata。
-   **排序**：按 `score` 降序注入，遵循 50,000 字元 Quota。

### Phase 3: `src/tool/edit.ts` 整合 (推薦)
-   在編輯成功後，主動為該路徑「充能」：更新 `score = 100`, `lastAction = 'edit'`。

## 5. 驗證 (Verification)
-   確認 `read` 過的檔案在連續 2 輪不被碰觸後自動消失。
-   確認修改過的檔案能持續存活至少 5 輪。
-   執行 `make build-patches` 驗證產物完整性。
