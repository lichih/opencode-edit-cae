# Edit CAE (Coordinate-Anchored Editing)

`edit_cae` 是一個專為 Opencode 設計的高可靠性檔案編輯插件與核心增強套件。它解決了 AI 編輯中常見的檔案損壞、索引位移（CRLF Bug）與元數據抹除問題。

## 🌟 核心理念：V12 架構
1.  **修復核心 Bug**：透過 `patches/` 提供對 Opencode `registry.ts` 的修正，解開插件元數據的封鎖。
2.  **標準插件實現**：提供一個高品質、不依賴黑科技的 `edit_cae` 插件，產出精確的 Diff 與統計。
3.  **自動化維護**：透過 `Makefile` 管理上游更新與補丁注入。

## 🚀 快速開始 (全域安裝)

如果您擁有 Opencode 的源碼，請執行以下指令一鍵升級您的環境：

```bash
# 預設會尋找 ../_opencode 並安裝至 ~/.local/bin/
make all
```

### 手動安裝步驟
1.  **套用補丁**：`make patch`（修正平台元數據抹除 Bug）。
2.  **編譯核心**：`make build`（產生修正版的 Opencode 二進位檔）。
3.  **安裝核心**：`make install`（將 `opencode` 放入 `~/.local/bin`）。
4.  **安裝插件**：`make plugin-install`（將 `edit_cae` 放入 `~/.opencode/plugins`）。

## 🛠 功能特性
- **Aider 式語義匹配**：在內容偏移時依然能精確定位。
- **CRLF 深度感知**：修復了原生工具在 Windows 格式下每行 1-bit 的位移 Bug。
- **寫入安全鎖**：具備 Tail Integrity Check，確保編輯區以外的內容 100% 不受損。
- **原生 Diff 視窗**：透過 Registry 補丁，讓外部插件也能觸發紅綠對比渲染。

## 📚 文件導覽
- **[任務目標](docs/spec/mission.md)**
- **[維護指南](docs/project/MAINTENANCE.md)**
- **[技術規範](docs/spec/technical_spec.md)**

## 📄 授權協議
ISC License
