# Mission: Pin-Reads V12 - Priority Visibility & TUI Bridge

## 1. 核心任務 (The Delta)
本任務專注於「評分機制」的引入與「Session 資料橋接」，不涉及基礎 LRU 100 或 Registry 的重構。

## 2. 評分與可見度 (Priority & Visibility Logic)
透過「分數 (HP)」來精確控制檔案在 Reminders 中的曝光權。

-   **HP 賦予**：
    -   `read` (全量): 40 HP
    -   `edit` (修改): 100 HP
-   **HP 衰減**：
    -   在 `prompt.ts` 的 `insertReminders` 執行時，全體 Pinned 檔案 **-20 HP**。
-   **可見度判定**：
    -   **Score > 0**: 執行 JIT 注入，檔案內容出現在最新的 Reminders 中。
    -   **Score <= 0**: **停止主動注入**。檔案依然保留在 PinnedRegistry 中（直到被 LRU 踢出），但僅存在於對話歷史。

## 3. 單點同步協議 (The Sync Protocol)
為極小化 IPC 成本並確保 TUI (右側面板) 感知狀態：

-   **Read/Edit 工具端**：僅更新 `PinnedRegistry` 內存變數（包含 `score` 與 `lastAction`），**嚴禁**呼叫 `Session.updateMetadata`。
-   **Prompt 調度端**：
    -   在 `insertReminders` 執行衰減後，獲取 `PinnedRegistry` 快照。
    -   執行 **唯一一次** 的 `Session.updateMetadata`，將狀態同步至資料庫。

## 4. 實作檢查表
- [ ] 擴充 `PinnedRegistry` 的 Value 結構，納入 `score` 與 `lastAction`。
- [ ] 修改 `prompt.ts`：實作分數衰減邏輯。
- [ ] 修改 `prompt.ts`：將 JIT 注入的門檻改為 `score > 0`。
- [ ] 修改 `prompt.ts`：加入單點 Metadata 同步呼叫。
