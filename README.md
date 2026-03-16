# Edit CAE (Coordinate-Anchored Editing)

`edit_cae` 是一個專為 Opencode 設計的高可靠性檔案編輯插件。它採用了智慧搜尋算法與嚴格的數據完整性校驗，旨在徹底杜絕 AI 在編輯程式碼時可能發生的**檔案截斷**、**索引位移**與**縮進損壞**問題。

## 🌟 核心特性

- **零依賴運行**：已預先打包 (Bundled)，無需安裝 `node_modules` 即可在 Opencode 中直接運行。
- **高可靠性匹配**：採用多層搜尋邏輯，支援忽略空白匹配 (`LineTrimmed`) 與首尾錨點搜尋 (`BlockAnchor`)，有效對抗內容漂移。
- **檔案損壞防護**：
  - **Tail Integrity Guard**：自動校驗編輯點之後的內容，防止任何形式的意外截斷。
  - **CRLF Awareness**：智慧處理 `\r\n` 與 `\n`，修復了傳統工具在 Windows 環境下常見的索引累積位移 Bug。
- **極致安全寫入**：採用原子化操作與 `fsync` 實體刷盤，確保檔案在寫入過程中發生異常時仍能保持完整。
- **Python 專用守衛**：強制執行全檔縮進一致性檢查，禁止混用 Tab 與 Space。

## 🚀 安裝說明

### 使用者安裝
1. 下載本專案。
2. 在您的 Opencode 配置中載入 `opencode.json`，或將本目錄路徑加入 Opencode 插件掃描路徑。
3. 插件會自動載入 `dist/index.js`，無需額外安裝環境。

### 開發者安裝
如果您需要修改源碼或跑測試：
1. 安裝 [Bun](https://bun.sh/)。
2. 執行 `bun install` 安裝開發依賴。
3. 執行 `bun run test` 運行安全校驗測試。
4. 執行 `bun run build` 重新編譯。

## 🛠 使用方式

本工具註冊指令為 `edit_cae`，參數如下：

| 參數 | 類型 | 說明 |
| :--- | :--- | :--- |
| `filePath` | string | 檔案的絕對路徑 |
| `oldString` | string | 欲替換的舊程式碼塊 (建議包含 2-3 行上下文以增加準確性) |
| `newString` | string | 替換後的新程式碼 |
| `replaceAll` | boolean | (選填) 是否替換所有匹配項，預設為 `false` |

### 範例
```json
{
  "command": "edit_cae",
  "args": {
    "filePath": "/Users/user/project/main.py",
    "oldString": "def old_logic():\n    pass",
    "newString": "def new_logic():\n    print('Safe!')"
  }
}
```

## 📚 專案文件

詳細的設計規範與開發歷程請參考 `docs/` 目錄：

- **技術規範**：[`docs/spec/technical_spec.md`](docs/spec/technical_spec.md)
- **實作報告**：[`docs/project/completion.md`](docs/project/completion.md)
- **開發路線**：[`docs/project/roadmap.md`](docs/project/roadmap.md)
- **研究背景**：[`docs/research/research_plan.md`](docs/research/research_plan.md)

## 📄 授權協議
ISC License
