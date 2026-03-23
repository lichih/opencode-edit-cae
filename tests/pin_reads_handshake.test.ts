import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ReadTool, PinnedRegistry } from "../src/read.ts";
import { FileTime } from "./mocks/time";
import * as path from "path";

// Mock ctx
const createCtx = () => ({
  sessionID: "test-session",
  messageID: "test-msg",
  extra: {},
  ask: mock(async () => {}),
  metadata: mock(() => {}),
  messages: []
});

describe("ReadTool Pin-Reads Handshake", () => {
  beforeEach(() => {
    PinnedRegistry.clear();
    (FileTime.read as any).mockClear();
  });

  it("should pin small file and update FileTime (Full Read)", async () => {
    const ctx = createCtx();
    const result = await (ReadTool as any).execute({
      filePath: "small.ts",
    }, ctx);

    // Assert Pinning logic
    expect(result.output).toContain("[File pinned: small.ts]");
    expect(PinnedRegistry.has("small.ts")).toBe(true);

    // Assert Handshake (FileTime.read must be called even on Pin)
    expect(FileTime.read).toHaveBeenCalled();
  });

  it("should NOT pin large file but still update FileTime (Hard Fail)", async () => {
    const ctx = createCtx();
    // Simulate a large file by mocking stats or providing a large file (mocked in our system)
    // Note: Our current mock filesystem might need adjustment if it doesn't support size
    
    // For this test, we assume the internal logic sees it as truncated
    // In our src/read.ts, if lines > 2000 or bytes > 50KB, it sets truncated=true
    
    // Let's test with a manual 'truncated' case if possible, 
    // but the best is to let the tool's logic run.
    
    // If the file is 100KB, it should fail
    const result = await (ReadTool as any).execute({
      filePath: "large.ts", // In our mock, large.ts is handled to be > 50KB
    }, ctx);

    expect(result.output).toContain("[Error: File too large for direct read: large.ts]");
    expect(PinnedRegistry.has("large.ts")).toBe(false);
    
    // Even on fail, FileTime.read should be called to maintain the 1:1 mechanism
    expect(FileTime.read).toHaveBeenCalled();
  });

  it("should update lastAccess on partial read of pinned file", async () => {
    // 1. First pin it
    PinnedRegistry.set("pinned.ts", { mtime: 123, lastAccess: 100 });
    
    const ctx = createCtx();
    await (ReadTool as any).execute({
      filePath: "pinned.ts",
      offset: 10, // Partial read
    }, ctx);

    expect(PinnedRegistry.get("pinned.ts")?.lastAccess).toBeGreaterThan(100);
    expect(FileTime.read).toHaveBeenCalled();
  });
});
