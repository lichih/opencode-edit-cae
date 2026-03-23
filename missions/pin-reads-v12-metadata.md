# Mission: Pin-Reads V12 - Metadata Migration & Priority Scoring

## 1. 核心願景 (Core Vision)
升級 Pin-Reads 系統，將其從「進程內記憶體管理」遷移至「Session Metadata 管理」，同時引入「生命值 (Score)」機制。此次更新的核心在於 **IPC 效能優化**：透過內存驅動與單點同步，實現高效且持久的 Context 管理。

## 2. 數據模型 (Data Model)
在 `Session.metadata.pinnedFiles` 中以對象形式存儲檔案狀態。
結構：`Record<string, PinnedFileState>`

### PinnedFileState:
```typescript
{
  mtime: number;          // 磁碟最後修改時間
  lastAccessTime: number; // 最後操作時間戳記
  lastAction: 'read' | 'edit' | 'sync'; // UI 著色標記
  score: number;          // 生命值 (0-100)，決定注入權重與存活期
}
```

## 3. 重要性評分與衰減邏輯 (Scoring & Decay)
-   **賦分 (Refill)**: `read` (全量) = 40, `edit` = 100.
-   **衰減 (Decay)**: 每一輪對話開始前，全體分數 **-20**。
-   **清理 (Purge)**: 當 `score <= 0` 時從 Metadata 移除。

## 4. 實作架構 (Optimized Architecture)

### Rule: Single-Point IPC Synchronization
為了避免頻繁的資料庫 I/O，實作必須遵循以下單點同步原則：

#### A. `src/tool/read.ts` (高效能讀取區)
-   **任務**：僅負責更新內存中的 `PinnedRegistry` (Map)。
-   **禁令**：**嚴禁**在此工具中呼叫 `Session.updateMetadata`。
-   **目的**：確保多檔案連續讀取時零延遲。

#### B. `src/session/prompt.ts` (核心同步閘口)
-   **觸發點**：`insertReminders` 函數。
-   **邏輯**：
    1.  **HP 衰減**：遍歷內存 `PinnedRegistry` 執行減分與過濾。
    2.  **JIT 注入**：按分數排序注入最新內容。
    3.  **快照同步 (唯一同步點)**：在注入結束後，執行 **一次性** 的 `Session.updateMetadata`，將內存狀態完整同步回資料庫，以供 TUI 右側面板顯示。
-   **持久化**：模組載入或 Session 啟動時，應先從 `Session.metadata` 恢復資料至內存。

## 5. 驗證 (Verification)
-   確認 `read` 多個檔案後，TUI 面板是在下一輪對話開始時「一次性」更新。
-   確認關閉重啟後，清單狀態能正確恢復。
