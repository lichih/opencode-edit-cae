針對您開發 `edit_cae` 插件時遇到的 `metadata` 抹除問題，我已深入檢索 GitHub Issues 與技術文件。

目前的關鍵衝突點在於：`packages/opencode/src/tool/registry.ts` 中的 `fromPlugin` 封裝器（Wrapper）確實會將插件工具的回傳值強行轉化為一個固定的 `ToolResult` 對象，導致您在 `context.metadata()` 中設定的數據被 `truncated: false` 給覆蓋掉。這在 Issue **#12527** 中已被確認為框架設計缺陷（1.1.x 版本）。 [SOURCE: 95%]

在「不修改 Opencode 核心」的前提下，我為您設計了兩套「黑科技」穿透方案：

---

### 方案一：`tool.execute.after` 攔截補償法 (推薦)

根據 Issue #13575 的技術細節，雖然 `registry.ts` 會抹除 `metadata`，但插件系統的 **Hook** 觸發順序是在 `fromPlugin` 的內部邏輯完成「之後」。這意味著我們可以在 Hook 階段，對已經被封裝好的 `output` 物件進行二次手術。

**實作原理：**

1. 在插件的 `execute` 函式中，將 Diff 資料透過 `JSON.stringify` 塞進 `output` 字串回傳。
2. 利用 `tool.execute.after` 勾子攔截該字串，解構出資料，並直接寫入 `output.metadata`。

```typescript
// .opencode/plugins/edit-cae-fix.ts
import type { Plugin } from "@opencode-ai/plugin";

export const EditCaeFixPlugin: Plugin = async () => {
  return {
    // 註冊全局 Hook，這會繞過 fromPlugin 的初始賦值
    "tool.execute.after": async (input, output) => {
      if (input.tool === "edit_cae") {
        try {
          // 嘗試解析被封裝在 output 裡的 JSON
          const data = JSON.parse(output.output);
          
          if (data.__is_opencode_patch__) {
            // 關鍵黑科技：補回被抹除的 metadata
            // 根據 Issue #15451，TUI 渲染 Side-by-Side 需要 filediff 欄位
            output.metadata = {
              ...output.metadata,
              diff: data.diff,
              filediff: data.filediff,
              title: `Edit: ${data.filename}`
            };
            
            // 將輸出還原為純文字，避免 LLM 看到混亂的 JSON
            output.output = `Successfully applied changes to ${data.filename}.`;
          }
        } catch (e) {
          // 非 JSON 格式則不處理
        }
      }
    }
  };
};

```

---

### 方案二：利用 `ctx.client.session.updatePart` 帶外更新

如果方案一因為特定版本的 Hook 隔離而失效，您可以利用 Opencode 內建的 Event Bus 進行「帶外更新（Out-of-band Update）」。這種做法是直接繞過 `return` 路徑，從插件內部直接通訊給 Server。 [INFERENCE: 85%]

**實作代碼：**

```typescript
// 在 edit_cae 的 execute 實作中
async execute(args, ctx) {
  const result = await yourDiffLogic(args);

  // 1. 取得當前的 callId (通常是 ToolPart 的 ID)
  const partId = (ctx as any).callId;

  // 2. 透過 client SDK 直接更新該 Part 的狀態
  // 這樣即便最後 return 會被 registry.ts 覆寫，但 UI 可能已經接收到這次 Update
  if (partId) {
    await ctx.client.session.updatePart({
      path: { id: ctx.sessionId },
      body: {
        partId: partId,
        state: {
          metadata: {
            filediff: result.filediff,
            diff: result.diff
          }
        }
      }
    });
  }

  return "Diff window triggered via background update.";
}

```

---

### 方案三：偽裝成 `apply_patch` (極致黑科技)

Opencode 的 TUI 在判斷是否顯示 Diff 時，有時會硬編碼檢查 `tool_id`。
在 `opencode.json` 中註冊時，您可以嘗試將 `edit_cae` 的別名或名稱暫時修改為 `apply_patch_v2` 或類似字串，看是否能觸發 UI 內建的 `diff.v1` 渲染器。根據 Issue #15451 的討論，未來版本將支持 `metadata.kind = 'diff.v1'`，您可以提前嘗試注入此欄位。

---

### 技術總結與建議

* **失效主因**：`fromPlugin` 封裝器在 `registry.ts:72` 行附近（版本 1.1.53）強行返回了固定的 metadata 對象。
* **建議路徑**：優先嘗試 **方案一**。因為 `tool.execute.after` 擁有修改 `output` 參考（Reference）的最高權限，且對代碼侵入性最小。

若您需要我針對 `opencode.json` 的配置進行優化以確保 Hook 正確加載，請告訴我您的專案目錄結構。