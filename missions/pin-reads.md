# Mission: Pin-Reads Context System (Dynamic Context Scheduler) - V4

## 1. 核心願景 (Core Vision)
解決 LLM 在 **Plan Mode** 下由於嚴格的唯讀限制所導致的「行為遲疑」。透過建立一個動態的、受控的「工作記憶區」，讓模型在每一輪對話中都能獲取關鍵檔案的最新狀態，同時確保 Context Token 不會因為重複注入而爆炸。

本功能採用 **「核心補丁化 (Patch-based Integration)」** 的維護策略，所有對 `opencode` 核心的修改都將封裝為 `Makefile` 自動套用的 patch，以維持核心的清潔。

## 2. 核心功能規格 (Technical Specs)

### A. LLM 自主工具 (`pin-reads`)
- **功能**：允許模型傳入 `paths: string[]`。
- **作用**：將檔案路徑存入 `Session.metadata.pinnedFiles`，初始分數設定為 100。
- **清空**：傳入 `[]` 時，清空所有釘選紀錄。

### B. 瞬態注入機制 (Ephemeral Injection & JIT)
- **注入點**：`prompt.ts -> insertReminders`。
- **清理歷史**：在注入新內容前，遍歷並剔除對話歷史中舊有的 `pinned-reads` 標記節點，確保 Token 總數受控。
- **即時讀取 (JIT)**：不將檔案內容存入 DB，僅在發送 Request 前從硬碟讀取最新原始碼，確保 LLM 看到的是實時狀態。
- **配額管理 (Quota)**：上限 50,000 字元。依分數高低排序讀取，超出則執行截斷 (Truncation)。

### C. 衰減與心跳續約 (Decay & Heartbeat)
- **每輪衰減 (Turn Decay)**：每過一個回合，所有釘選檔案分數 -20。
- **心跳標籤**：模型需在輸出中包含 `<pin-heartbeat>path/to/file</pin-heartbeat>`。
- **續約邏輯**：被標記的路徑分數 +40 (上限 100)。
- **生命週期**：分數歸零的檔案將從 `metadata` 中自動移除。

### D. UI 整合 (TUI Sidebar)
- 修改 `sidebar.tsx` 訂閱 `session.metadata.pinnedFiles`。
- 視覺化顯示：綠色 (60-100)、黃色 (20-59)、紅色 (<20) 的分數健康度。

## 3. 實作路徑 (Implementation Roadmap)

- **Phase 1: 核心開發 (opencode/ 子目錄)**
  - 在 `prompt.ts` 實作 JIT 注入與歷史清理。
  - 在 `processor.ts` 實作心跳標籤解析與分數衰減邏輯。
  - 在 `tool/` 實作 `pin-reads` 工具並註冊。
  - 更新側邊欄組件。

- **Phase 2: 補丁生成與整合 (Makefile Integration)**
  - 於 `opencode/` 執行 `git diff` 生成 `patches/pin_reads_scheduler.patch`。
  - 修改根目錄 `Makefile` 的 `patch` target，將新補丁加入自動套用清單。

- **Phase 3: 自動化驗證 (Validation)**
  - 執行 `make clean && make all`。
  - 驗證系統重置後能成功自動套用 `Pin-Reads` 功能，且編譯成功。

## 4. 驗證機制 (Verification)

### A. 資料庫狀態審計 (SQL Audit)
- **目的**：驗證分數系統與持久化。
- **操作**：使用 `sqlite3` 檢查 `SessionTable` 的 `metadata`。
- **指令參考**：
  ```bash
  sqlite3 "$HOME/Library/Application Support/opencode/opencode.db" \
  "SELECT metadata FROM session ORDER BY time_updated DESC LIMIT 1;"
  ```

### B. Context 膨脹檢查 (Part Integrity)
- **目的**：驗證「瞬態注入」是否成功避免 Token 爆炸。
- **操作**：查詢 `PartTable` 中 `type='text'` 且包含 `pinned-files` 標記的內容，確認歷史紀錄中無重複大塊內容。

### C. 自動化單元測試 (Unit Testing)
- **位置**：`opencode/packages/opencode/test/session/pin-reads.test.ts` (待建立)
- **測試點**：`insertReminders` JIT 邏輯、心跳標籤正則提取、分數衰減邊界處理。

### D. 整合驗證 (Integration Verification)
- 確保補丁無衝突套用，且 TUI 側邊欄能正確呈現釘選清單與分數。
