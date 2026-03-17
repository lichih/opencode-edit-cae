# 維護指南 (Maintenance Guide)

## 1. 上游更新同步 (Syncing with Upstream)
當 Opencode 官方釋出更新時，請遵循以下流程以確保可靠性層能正確運作：

1.  **拉取更新**：
    ```bash
    cd ../_opencode && git pull
    ```
2.  **重新套用補丁**：
    在 `diff-edit-tool` 目錄下：
    ```bash
    make all
    ```

## 2. 補丁失效處理 (Handling Patch Conflicts)
如果 `registry.ts` 的源碼發生重大結構變更導致 `make patch` 失敗：

1.  **手動修復**：進入 `../_opencode/packages/opencode/src/tool/registry.ts` 手動修正 `fromPlugin` 的回傳邏輯。
2.  **重新產生 Patch**：
    ```bash
    cd ../_opencode
    git diff packages/opencode/src/tool/registry.ts > ../diff-edit-tool/patches/fix_registry_metadata.patch
    ```

## 3. 插件開發
所有的編輯演算法核心位於 `src/edit_cae.ts`。修改後請務必執行：
```bash
make plugin-install
```
以同步至使用者空間。
