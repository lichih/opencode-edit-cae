# Edit CAE (Coordinate-Anchored Editing)

`edit_cae` 是一個專為 Opencode 設計的高可靠性檔案編輯插件。它採用了智慧搜尋算法與嚴格的數據完整性校驗，旨在徹底杜絕 AI 在編輯程式碼時可能發生的**檔案截斷**、**索引位移**與**縮進損壞**問題。

## 🌟 核心特性

- **零依賴運行**：已預先打包至 `plugin/index.js`，符合 Opencode 自動載入規範。
- **高可靠性匹配**：採用多層搜尋邏輯，支援忽略空白匹配 (`LineTrimmed`) 與首尾錨點搜尋 (`BlockAnchor`)，有效對抗內容漂移。
- **檔案損壞防護**：
  - **Tail Integrity Guard**：自動校驗編輯點之後的內容，防止任何形式的意外截斷。
  - **CRLF Awareness**：智慧處理 `\r\n` 與 `\n`，修復了傳統工具在 Windows 環境下常見的索引累積位移 Bug。
- **極致安全寫入**：採用原子化操作與 `fsync` 實體刷盤，確保檔案在寫入過程中發生異常時仍能保持完整。
- **Python 專用守衛**：強制執行全檔縮進一致性檢查，禁止混用 Tab 與 Space。

## 🚀 安裝說明

### 方案 A：局部安裝 (僅在目前專案生效)
1. 將本專案放置在您的工作目錄下。
2. 確認 `opencode.json` 已設定 `"edit": false` 以停用舊工具，並啟用 `"edit_cae": true`。

### 方案 B：全域安裝 (所有專案生效)
1. 在本專案目錄下執行實體複製指令：
   ```bash
   npm run build && npm run install-global
   ```
2. 修改您的全域設定檔 `~/.config/opencode/opencode.json`，加入建議的引導指令：
   ```json
   {
     "instructions": [
       "CRITICAL: The 'edit' tool is legacy and prone to file corruption. ALWAYS use 'edit_cae' for modifying existing files. Use 'write' ONLY for creating new files."
     ],
     "tools": {
       "edit_cae": true
     }
   }
   ```
   *這將讓 `edit_cae` 在所有專案中可用，並透過系統指令引導 AI 優先使用它。*

### 方案 C：遠端安裝 (快速試用)
如果您不想下載源碼，可以直接在 `opencode.json` 中引用 GitHub 上的編譯版本：
```json
{
  "plugin": [
    "https://raw.githubusercontent.com/lichih/opencode-edit-cae/main/plugin/index.js"
  ],
  "tools": {
    "edit": false,
    "edit_cae": true
  }
}
```

## 🛠 使用方式

本工具註冊指令為 `edit_cae`（或在全域取代後作為主要編輯工具）。參數如下：

| 參數 | 類型 | 說明 |
| :--- | :--- | :--- |
| `filePath` | string | 檔案的絕對路徑 |
| `oldString` | string | 欲替換的舊程式碼塊 |
| `newString` | string | 替換後的新程式碼 |
| `replaceAll` | boolean | (選填) 是否替換所有匹配項，預設為 `false` |

## 🧪 測試與驗證
如果您需要修改源碼或跑測試：
1. 安裝 [Bun](https://bun.sh/)。
2. 執行 `bun install` 安裝開發依賴。
3. 執行 `npm run test` 運行安全校驗測試。

## 📚 專案文件
詳細的設計規範與開發歷程請參考 `docs/` 目錄。

## 📄 授權協議
ISC License
