# Mission: Pin-Reads V12 - TUI Bridge via Message Metadata

## 1. 核心願景 (Core Vision)
在「不修改 Session 模型」且「不 Patch 資料庫 Schema」的前提下，實現 Pinned Files 狀態與 TUI 右側面板的同步。我們將利用 Opencode 現有的訊息同步機制，將後端狀態「隱形地」注入到訊息流中。

## 2. 實作架構 (Invisible Sync Architecture)

### A. 邏輯核心 (Backend Logic)
- **Source of Truth**: 依然是 `src/tool/read.ts` 中的 `PinnedRegistry` (Memory Map)。
- **變動**：擴充 Registry 項目的結構，納入 `score` (HP) 與 `lastAction`。
- **禁令**：**嚴禁**修改 `Session` 模型或調用任何不存在的 `updateMetadata` API。

### B. 隱形同步橋樑 (The Data Bridge)
- **實作點**: `src/session/prompt.ts` 的 `insertReminders`。
- **邏輯步驟**:
    1.  **HP 衰減**: 執行 `score -= 20`。
    2.  **快照注入 (The Hook)**:
        在函數末尾，為當前的 `userMessage` 建立一個全新的 `synthetic` Part：
        ```typescript
        userMessage.parts.push({
          id: PartID.ascending(),
          type: "text",
          text: "", // 內容為空，對用戶與模型不可見
          synthetic: true,
          metadata: { 
            pinnedFiles: Object.fromEntries(PinnedRegistry) 
          }
        });
        ```
- **優點**: 利用訊息系統的自動同步能力，將狀態帶給前端 TUI。

### C. UI 呈現 (Frontend Display)
- **實作點**: `packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx` (透過 Patch)。
- **邏輯**:
    - 從 `sync.data.message` 獲取最後幾則訊息。
    - 尋找帶有 `pinnedFiles` metadata 的 Part。
    - 根據該清單渲染「Pinned Files」區域。

## 3. 實作檢查表
- [ ] 修改 `read.ts`: 更新內存 Registry 結構。
- [ ] 修改 `prompt.ts`: 在 `insertReminders` 實作隱形 Part 注入。
- [ ] (後續任務) 建立 `sidebar.tsx` 的 UI 補丁。
