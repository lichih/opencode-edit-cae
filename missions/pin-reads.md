# Mission: Pin-Reads Context System (Dynamic Context Scheduler) - V11

## 1. 核心願景 (Core Vision)
解決 LLM 在 **Plan Mode** 與 **Build Mode** 下由於檔案內容陳舊或 Context 膨脹導致的行為遲疑與錯誤。透過「透明釘選 (Transparent Pinning)」機制，將 `read` 工具轉化為動態監控引擎，自動追蹤關鍵檔案的最新狀態，並在每輪對話中智慧地管理 Context 注入。

## 2. 核心技術規格 (Technical Specs)

### A. 工具替代與安全門檻 (`read` Tool Override)
- **1:1 參數相容**：維持原始 `read` 參數 `filePath`, `offset`, `limit`。
- **安全邊界 (Safety Boundary)**：**50 KB** 或 **2000 行**。
- **讀取行為分支**：
    1.  **全量讀取 (Full Read)** (`offset` 為空/1 且未指定 `limit`)：
        -   **小於邊界**：讀取內容，不直接輸出給模型，改為返回 `[File pinned: /path/to/file]`。同步更新全域 `PinnedRegistry`。
        -   **超過邊界**：**強制失敗 (Hard Fail)**。返回檔案資訊（大小與總行數），要求模型帶入 `offset`/`limit` 進行分段精讀。
    2.  **局部讀取 (Partial Read)** (指定了 `offset > 1` 或 `limit`)：
        -   執行原生讀取邏輯，返回原始 XML 格式內容。
        -   **不執行釘選**，但若檔案已在 `PinnedRegistry` 中，則更新其 `lastAccessTime`（LRU 續約）。

### B. 全域追蹤器 (`PinnedRegistry`)
- **存放位置**：實作於 `src/read.ts` 的模組層級全域變數。
- **資料結構**：`Map<string, { mtime: number, lastAccess: number }>`。
- **容量限制**：最多 100 個檔案，採 **LRU (Least Recently Used)** 淘汰機制。

### C. 智慧注入與歷史抑制 (`prompt.ts -> insertReminders`)
- **每輪巡檢**：在準備 Prompt 前，遍歷 Registry，透過 `fs.stat` 取得最新 `mtime`。
- **歷史抑制 (Suppression)**：
    - 掃描對話歷史 (`ctx.messages`)。
    - 若發現任何 `read` 工具產出的釘選標記或舊有的 `<pinned-file>` 標記，若其對應路徑已有更新或已存在於當前輪次注入計畫中，則將其隱藏或抑制，防止重複與過期內容。
- **JIT 注入 (Just-In-Time)**：
    - 在最新輪次的 Reminders 中，注入所有釘選檔案的最新內容。
    - 使用 XML 標籤包裹：`<pinned-file path="...">...</pinned-file>`。
- **Token 配額**：注入總量上限設為 50,000 字元。超出時依 `lastAccess` 排序截斷。

## 3. 實作路徑 (Implementation Roadmap)

### Phase 1: 基準建立 (Baseline Sync)
- 將 `opencode` 的 `read.ts` 與 `read.txt` 複製到 `src/1.3.0/` 作為 patch 基準。

### Phase 2: 核心開發 (Plugin Development)
- 在 `src/read.ts` 實作 `PinnedRegistry` 與「安全邊界/強制失敗」邏輯。
- 在 `src/prompt.ts`（透過 Patch 模式）實作歷史抑制與增量注入。

### Phase 3: 補丁生成與驗證 (Integration)
- 執行 `git diff` 產生 `patches/edit_cae_v1.3.0.patch`。
- 驗證 `make patch && make build` 流程。
- 執行單元測試，確保大檔案讀取會觸發正確的失敗引導與大小提示。

## 4. 驗證機制 (Verification)
- **行為驗證**：模型呼叫 `read` 大檔案時是否收到大小提示並重新精讀。
- **Context 驗證**：檢查發送給模型的最後一個 Prompt，確認是否有重複的檔案內容，以及內容是否隨磁碟變動而更新。
- **性能驗證**：確認 100 個檔案的 `fs.stat` 巡檢不會造成顯著延遲。
