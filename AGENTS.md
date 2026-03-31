# Technical Source of Truth for Opencode Plugin Development

## 1. Log Output Parameters
- **Parameters**: 
  - `--print-logs`: A boolean flag to output logs directly to `stderr`.
  - `--log-level`: Sets the logging level (choices: `DEBUG`, `INFO`, `WARN`, `ERROR`).
- **Default Behavior**: If `--print-logs` is not set, logs are written to timestamped files (or `dev.log` in local mode).
- **Log Directory**: Logs are stored in `Global.Path.log`, which resolves to `xdgData/opencode/log/`. On macOS, this is typically `~/Library/Application Support/opencode/log/`.
- **Implementation Files**:
  - `opencode/packages/opencode/src/util/log.ts`: Implements `Log.init` and stream writing logic.
  - `opencode/packages/opencode/src/index.ts`: Defines the CLI parameters using `yargs`.
  - `opencode/packages/opencode/src/global/index.ts`: Defines the `Global.Path.log` base path.

## 2. Plan Mode vs. Build Mode 運作機制調研 (Technical Research)
- **機制描述**：當宿主處於 Plan Mode 時，會向模型注入一段 `<system-reminder>`。
- **調研成果歸檔**：
  - 完整調研報告（包含注入源碼分析、提醒全文、TUI 過濾邏輯）已歸檔至：`docs/research/opencode_modes.md`。
  - **技術事實要點**：
    - **注入點**：`opencode/packages/opencode/src/session/prompt.ts` 的 `insertReminders`。
    - **數據形式**：`synthetic: true` 的消息部件，附加在 User Message 之後。
    - **隱藏邏輯**：TUI 會過濾所有 `synthetic` 內容，對用戶隱身。

## 3. Project Topology
- The host application (`opencode`) source code is located in the `opencode/` subdirectory of this repository.
- This project (`edit_cae`) is a plugin developed to enhance file editing reliability within that host.

## 4. Patch-Based Workflow (Development Standard)
- **Host vs. Mirror**: Development occurs in `src/` (Mirror), NOT `opencode/` (Host).
- **Base Reference**: `src/1.3.9/` stores the clean host source (e.g., `v1.3.9`).
- **Development Cycle**:
  1. Modify logic in `src/` (e.g., `src/tool/read.ts`).
  2. Validate with **Unit Tests** (Crucial) in `tests/`.
  3. Run `make build-patches` to generate `.patch` files from `diff -u src/1.3.9 src/`.
  4. Run `make patch` to reset `opencode/` and apply the generated patches.
  5. Run `make build` within `opencode/` to produce the final executable.
- **Physical Safety**: `make patch` ensures a clean environment by running `git reset --hard` on the host before injection.

## 5. Session Context & Pinned Files Audit (Technical Guide)
To debug or audit the context state of a specific session (e.g., `ses_2e4e77053ffeE5y6SkSAnY3QCe`), use the following methods to access physical facts:

### A. Physical Pinned Registry (Current State)
- **Path**: `~/.local/share/opencode/pinned-files.json` (or the `Global.Path.data` resolved path).
- **Format**: A JSON map of `filepath -> { mtime, score, lastAccess }`.
- **Command**: `cat ~/.local/share/opencode/pinned-files.json` to see currently active files and their HP (score).

### B. Database Audit (Historical Injections)
- **Database Path**: `opencode/packages/opencode/opencode.db` (Drizzle/SQLite).
- **Command (Turn-based Audit)**:
  ```bash
  # View all synthetic context parts injected into a session
  sqlite3 opencode/packages/opencode/opencode.db "SELECT p.id, p.text, m.time FROM part p JOIN message m ON p.message_id = m.id WHERE m.session_id = 'YOUR_SESSION_ID' AND p.synthetic = 1 AND p.text LIKE '%<pinned-file%' ORDER BY m.time DESC;"
  ```
- **Command (Metadata Evolution)**:
  ```bash
  # View the V12 Debug Metadata (HP decay, turn stats) stored in parts
  sqlite3 opencode/packages/opencode/opencode.db "SELECT p.metadata FROM part p JOIN message m ON p.message_id = m.id WHERE m.session_id = 'YOUR_SESSION_ID' AND p.metadata LIKE '%debugV12%' ORDER BY m.time DESC LIMIT 5;"
  ```

### C. Log Analysis (Real-time Facts)
- **Log Path**: `~/.Library/Application Support/opencode/log/` (macOS) or `~/.local/share/opencode/log/` (Linux).
- **Search**: `grep -i "pin" dev.log` or `grep -i "syncPinnedFiles" dev.log` to trace physical `mtime` comparisons and HP decay events.
