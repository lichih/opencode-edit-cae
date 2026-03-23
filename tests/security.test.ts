import { describe, it, expect, mock } from "bun:test";
import { EditTool } from "./workspace/src_edit.ts";
import { Session } from "./session.ts";
import { Filesystem } from "./util/filesystem.ts";

describe("Security Check (pin-reads enforcement)", () => {
  it("should refuse to edit if file is not pinned", async () => {
    const params = {
      filePath: "/test/file.ts",
      oldString: "old",
      newString: "new"
    };

    // Mock Session to return NO pinned files
    mock.module("./session.ts", () => ({
      Session: {
        get: async () => ({ metadata: { pinnedFiles: {} } })
      }
    }));

    const ctx = {
      sessionID: "test-session",
      ask: async () => ({})
    };

    try {
      await EditTool.execute(params, ctx as any);
      expect(true).toBe(false); // Should not reach here
    } catch (e: any) {
      expect(e.message).toContain("has not been fully read via 'pin-reads'");
    }
  });

  it("should allow edit if file is pinned", async () => {
    const params = {
      filePath: "/test/file.ts",
      oldString: "old",
      newString: "new"
    };

    // Mock Session to return pinned files including our file
    // Note: In our mock/filesystem.ts, exists is always true.
    mock.module("./session.ts", () => ({
      Session: {
        get: async () => ({ 
          metadata: { 
            pinnedFiles: { "/test/file.ts": { lastAccessTime: 123 } } 
          } 
        }),
        updateMetadata: async () => {}
      }
    }));

    const ctx = {
      sessionID: "test-session",
      ask: async () => ({}),
      metadata: () => {}
    };

    // This should NOT throw the "pin-reads" error
    // It might throw other errors related to mock implementation (like content mismatch), 
    // but the security check should pass.
    try {
      await EditTool.execute(params, ctx as any);
    } catch (e: any) {
      expect(e.message).not.toContain("has not been fully read via 'pin-reads'");
    }
  });
});
