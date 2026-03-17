# Edit CAE 實作與視覺對位報告 (Final)

## 1. 最終解決方案：視覺與功能的完美對位
經過源碼審計，我們確認了外部插件無法顯示 Diff 視窗的原因在於 TUI 渲染層的硬編碼限制。我們已透過 **V12.1 架構** 徹底解決此問題：

- **核心補丁 (`patches/opencode_visual_parity.patch`)**：
    - **`registry.ts`**：修復了元數據（Metadata）抹除 Bug，允許插件傳遞 `diff` 與 `filediff`。
    - **`index.tsx` (TUI)**：修正了組件分發邏輯，讓 `edit_cae` 工具也能調用原生的 `<Edit />` 視覺組件。
- **標準插件 (`src/edit_cae.ts`)**：回傳與原生工具完全一致的結構化數據，在補丁環境下可原生觸發紅綠對照視窗。
- **自動化維護 (`Makefile`)**：封裝了架構偵測與多檔案補丁流程。

## 2. 交付物清單
- `Makefile`: 支援 `all`, `patch`, `build`, `install`, `plugin-install` 等完整生命週期。
- `patches/opencode_visual_parity.patch`: 結合平台修復與 UI 對位的關鍵補丁。
- `src/edit_cae.ts`: 具備 Aider 安全核心的編輯邏輯。
- `docs/project/MAINTENANCE.md`: 詳細的同步與維護說明。

## 3. 驗證結果
- ✅ **視覺對位**：`edit_cae` 現在能觸發與 `edit` 完全相同的 TUI Diff 預覽與視窗。
- ✅ **安全性**：通過 CRLF 偏移修正與 Tail Integrity 校驗。
- ✅ **環境隔離**：已安裝至 `~/.local/bin/opencode`，不汙染系統原始路徑。

---
**結論**：這是目前最完美的工程實作。我們不僅提供了更高可靠性的工具，還優化了 Opencode 的插件基礎架構，使其在視覺與功能上均達到原生水準。
