# Edit CAE (Coordinate-Anchored Editing)

`edit_cae` 是一個專為 Opencode 設計的高可靠性檔案編輯插件。它採用了智慧搜尋算法與嚴格的數據完整性校驗，旨在徹底杜絕 AI 在編輯程式碼時可能發生的**檔案截斷**、**索引位移**與**縮進損壞**問題。

## 🌟 核心特性

- **零依賴運行**：已預先打包至 `plugin/index.js`，Opencode 會自動掃描並載入，無需手動配置路徑。

...

### 使用者安裝
1. 下載本專案。
2. 在您的 Opencode 專案根目錄放置本專案，或將其目錄路徑加入掃描。
3. 插件會自動載入 `plugin/index.js`，無需額外安裝環境。


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
