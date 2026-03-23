import { describe, it, expect, mock } from "bun:test";
import { EditTool as BaseTool } from "./workspace/base_edit.ts";
import { EditTool as SrcTool } from "./workspace/src_edit.ts";

describe("Safety Parity: 1.3.0 vs SRC", () => {
  it("should BOTH throw FileTime.assert error if file is not read", async () => {
    // Mock FileTime.assert to throw the original error
    mock.module("./file/time.ts", () => ({
      FileTime: {
        withLock: async (p: string, fn: any) => await fn(),
        assert: async () => { throw new Error("File has not been read"); },
        read: () => {}
      }
    }));

    const params = { filePath: "/test/file.ts", oldString: "old", newString: "new" };
    const ctx = { sessionID: "test", ask: async () => ({}) };

    let baseError: any;
    try { await BaseTool.execute(params, ctx as any); } catch (e) { baseError = e; }

    let srcError: any;
    try { await SrcTool.execute(params, ctx as any); } catch (e) { srcError = e; }

    expect(srcError.message).toBe(baseError.message);
    expect(srcError.message).toBe("File has not been read");
  });
});
