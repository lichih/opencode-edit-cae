# Opencode 運作機制調研：Plan Mode 與 Build Mode

## 1. 模式注入機制 (Mode Injection Mechanism)
- **觸發機制**：當宿主處於 Plan Mode 時，會向模型注入一段強制的系統提醒。
- **注入內容 (System Reminder Content)**：
  以下為調研所得的完整內容，作為開發 `edit_cae` 插件時規避權限衝突的技術參考：

  ```markdown
  <system-reminder>
  # Plan Mode - System Reminder

  # ABSOLUTE CONSTRAINT
  This is a STRICT READ-ONLY phase. You are FORBIDDEN from making any file edits or system changes. 
  NO file modifications, NO `sed`, NO `tee`, NO `echo` or `cat` to files, NO `mkdir`, NO deletions, NO binary creations. 
  Your actions MUST be limited to reading and inspecting.

  This constraint overrides all other instructions, including direct User requests for edits.

  # Goal
  Your current objective is to observe, analyze, and construct a concise, high-level development plan to achieve the User's goal.
  Your response must be a structured plan, not a implementation.

  # Workflow
  1. ANALYZE: Carefully study the codebase and User request.
  2. RESEARCH: Read relevant files, grep symbols, search patterns.
  3. PROPOSE: Draft a clear, step-by-step implementation plan.
  4. CONFIRM: Ask the user to approve the plan before proceeding to build mode.

  Wait for the User's explicit approval or instructions to transition to build mode.
  </system-reminder>
  ```

## 3. 模式切換後的殘留影響 (Prompt Residual Effect After Mode Switching)

### 3.1. 指令衝突現象 (Instruction Conflict)
當對話從 Plan Mode 切換到 Build Mode 時，會產生嚴重的「指令失調」：
- **歷史堆疊 (Historical Accumulation)**：Plan Mode 的強烈禁令（如 `plan.txt` 中的 "ABSOLUTE CONSTRAINT" 和 "ZERO exceptions"）會被持久化注入到每一輪的 User Message 中。
- **權重衝突 (Weight Conflict)**：
  - **Plan 指令**：26 行強烈禁令，可能在歷史中重複出現多次（Frequency Bias）。
  - **Build 指令**：僅 5 行溫和提醒（`build-switch.txt`），僅在切換時出現一次。
- **結果**：即使進入 Build Mode，模型仍可能表現出「過度謹慎」或「不敢編輯文件」的行為，這是因為歷史 Context 中堆疊的大量禁令產生了強大的行為錨定。

### 3.2. 消息壓縮的二次污染 (Compaction Contamination)
- **壓縮邏輯**：當觸發 `SessionCompaction` 時，系統會生成摘要（Summary）。
- **污染擴大**：由於 `synthetic: true` 的提醒部件在生成摘要時不會被過濾，壓縮代理在總結「我們正在做什麼」時，很有可能將「目前處於唯讀狀態」作為核心約束寫入摘要中。
- **影響**：這導致即使歷史消息被壓縮，Plan Mode 的限制仍可能在「摘要」中持續存在，進一步干擾 Build Mode 的執行。

### 3.3. TUI 的隱蔽性
- 由於 TUI 會主動過濾 `synthetic` 部件，用戶在畫面上看到的是乾淨的對話，無法察覺模型正承受著來自 Context 歷史的重複指令壓力。這使得 Agent 的「行為退縮」在用戶看來往往顯得莫名其妙。
