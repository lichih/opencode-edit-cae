# Edit CAE 實作與維護報告 (V12)

## 1. 核心架構：平台修補與標準插件分流
我們放棄了依賴黑科技勾子（Hook）或 Runtime 注入的方案，改用最符合開源維護規範的 **「補丁驅動型架構」**：

- **平台層 (Core Patch)**：針對 `registry.ts` 產出 `fix_registry_metadata.patch`。此補丁解開了 Opencode 插件系統對元數據（Metadata）的限制，使外部插件能像原生工具一樣觸發紅綠 Diff 視窗。
- **工具層 (Pure Plugin)**：`edit_cae` 回歸為一個純淨、標準的插件，不再使用隱藏封包或 Hook。它專注於產出高品質的 Aider 式編輯數據。
- **自動化 (Makefile)**：透過 `Makefile` 封裝整個上游同步流程，實現一鍵化更新。

## 2. 交付物清單

### 核心檔案
- `Makefile`: 專案核心控制器。支援 `OPENCODE_REPO` 與 `PREFIX` 參數。
- `patches/fix_registry_metadata.patch`: 平台修復補丁。
- `src/edit_cae.ts`: 高可靠性編輯邏輯。
- `src/plugin.ts`: 標準插件進入點。
- `opencode.json`: 專案級配置。

### 文件
- `README.md`: 快速上手與安裝說明。
- `docs/project/MAINTENANCE.md`: 上游同步與維護指南。
- `docs/spec/mission.md`: 重新定義的任務目標。

## 3. 已驗證流程
執行 `make all` 已確認可完成以下循環：
1.  **還原**：將 `_opencode` 目標檔案還原為乾淨狀態。
2.  **修補**：套用 Registry 補丁。
3.  **編譯**：使用 `bun` 編譯修正版的 Opencode。
4.  **安裝核心**：安裝至 `~/.local/bin/opencode`。
5.  **安裝插件**：編譯並安裝 `edit_cae` 至 `~/.opencode/plugins/`。

## 4. 維護建議
- **當 Opencode 官方更新時**：只需執行 `git pull` 並再次執行 `make all` 即可。
- **當官方修復 Bug 時**：停止套用補丁（`make clean`），我們的插件無需任何修改即可繼續運作。

---
**結論**：`edit_cae` 現在不僅是一個強大的工具，更配套了一套專業的維護體系，徹底解決了視覺與可靠性的不對稱問題。
