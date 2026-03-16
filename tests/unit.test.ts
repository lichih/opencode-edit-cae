import { test, expect, describe } from "bun:test";
import { trimDiff, getLineEnding, normalize, LineTrimmedReplacer, BlockAnchorReplacer } from "../src/edit_cae.ts";

describe("Edit CAE Unit Tests", () => {
  describe("Helper Functions", () => {
    test("normalize: should convert CRLF to LF", () => {
      expect(normalize("line1\r\nline2")).toBe("line1\nline2");
    });

    test("trimDiff: should handle non-string input gracefully", () => {
      expect(trimDiff(null)).toBe("");
      expect(trimDiff(undefined)).toBe("");
      expect(trimDiff(123)).toBe("");
    });

    test("trimDiff: should remove common indentation from diff lines", () => {
      const diff = "Index: test.txt\n--- test.txt\n+++ test.txt\n@@ -1,3 +1,3 @@\n  line1\n- line2\n+ line2_new\n  line3";
      const trimmed = trimDiff(diff);
      expect(trimmed).toContain(" line1");
      expect(trimmed).toContain("-line2");
      expect(trimmed).toContain("+line2_new");
    });

    test("getLineEnding: should detect CRLF correctly", () => {
      expect(getLineEnding("line1\r\nline2")).toBe("\r\n");
      expect(getLineEnding("line1\nline2")).toBe("\n");
    });
  });

  describe("Replacers", () => {
    test("LineTrimmedReplacer: should find match ignoring indentation", () => {
      const content = "  if (true) {\n    console.log('test')\n  }";
      const find = "if (true) {\nconsole.log('test')\n}";
      const matches = Array.from(LineTrimmedReplacer(content, find));
      expect(matches.length).toBe(1);
      expect(matches[0]).toBe("  if (true) {\n    console.log('test')\n  }");
    });

    test("BlockAnchorReplacer: should find match with首尾錨點", () => {
      const content = "start\nmiddle part that changes\nend";
      const find = "start\nplaceholder\nend";
      const matches = Array.from(BlockAnchorReplacer(content, find));
      expect(matches.length).toBe(1);
      expect(matches[0]).toBe("start\nmiddle part that changes\nend");
    });
  });
});
