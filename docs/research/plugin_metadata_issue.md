# 技術問題報告：Opencode 外部插件 Metadata 遺失與 Diff 渲染失效分析

## 1. 背景 (Context)
我們正在開發一個名為 `edit_cae` 的外部插件，旨在取代 Opencode 內建的 `edit` 工具。核心需求是：**「在行為與視覺回饋上與原版 100% 一致，但內部實作具備更高可靠性（Aider 風格、CRLF 修復、Tail 保全）。」**

目前 `edit_cae` 已能成功執行並修改檔案，但在 TUI 渲染層遇到了障礙。

## 2. 問題描述 (Problem Statement)
*   **內建工具行為**：執行 `edit` 後，Opencode TUI 會自動彈出一個 Side-by-Side 或 Unified Diff 的視覺化視窗。
*   **外部插件行為**：執行 `edit_cae` 後，無論我們如何回傳 `metadata.diff`，TUI 僅顯示 `output` 欄位的純文字訊息，完全沒有 Diff 視窗出現。

## 3. 深度診斷 (Technical Investigation)
透過審計 `_opencode` 的內部 `registry.ts` 源碼，我們發現外部插件的執行路徑被一個 `fromPlugin` 函式包裝：

```typescript
// 來源：packages/opencode/src/tool/registry.ts
function fromPlugin(id: string, def: ToolDefinition): Tool.Info {
  return {
    id,
    init: async (initCtx) => ({
      // ... 略
      execute: async (args, ctx) => {
        const result = await def.execute(args as any, pluginCtx) // 我們的插件執行處
        const out = await Truncate.output(result, {}, initCtx?.agent)
        
        // 關鍵點：這裡硬編碼了回傳結構，導致 result 中的 metadata 被丟棄
        return {
          title: "", 
          output: out.truncated ? out.content : result,
          metadata: { 
            truncated: out.truncated, 
            outputPath: out.truncated ? out.outputPath : undefined 
          },
        }
      },
    }),
  }
}
```

相比之下，內建工具使用 `Tool.define`，它會保留原始的 `result.metadata` 並執行 `merge`：

```typescript
// 來源：packages/opencode/src/tool/tool.ts
const result = await execute(args, ctx)
return {
  ...result,
  output: truncated.content,
  metadata: {
    ...result.metadata, // 這裡正確保留了 metadata！
    truncated: truncated.truncated,
  },
}
```

## 4. 嘗試過的方案
1.  **結構化回傳**：讓插件 `execute` 回傳 `{ metadata: { diff: "..." }, output: "..." }`，但被 `fromPlugin` 包裝器強行轉為純字串。
2.  **呼叫 `context.metadata()`**：插件內部呼叫 `ctx.metadata({ metadata: { diff: "..." } })`。雖然這會更新內部的 `Part` 狀態，但似乎無法觸發 TUI 的即時 Diff 渲染。

## 5. 核心疑問 (Question for Gemini)
在**「不修改 Opencode 核心源碼」**（避免維護 Patch）的前提下，是否有任何黑科技或隱藏路徑，可以讓外部插件的 `metadata` (特別是 `diff` 與 `filediff`) 被 Opencode 的 TUI 識別並渲染成標準的 Diff 視窗？

例如：
*   是否有特定的字串格式（Ansi Escaped? Markdown?）寫在 `output` 裡能被 UI 自動解析？
*   是否有其他 Hook 可以在不更動 `registry.ts` 的情況下，攔截並修改回傳值？
*   如何正確使用 `Plugin.trigger` 或 `Bus` 事件來「補寄」Diff 資訊？
