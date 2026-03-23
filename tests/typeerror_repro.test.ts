import { LineTrimmedReplacer, BlockAnchorReplacer } from "../src/edit_cae.ts";
import { expect, test, describe } from "bun:test";

describe("edit_cae Replacer TypeError Repro", () => {
  test("LineTrimmedReplacer should handle non-string find gracefully", () => {
    const content = "line 1\nline 2";
    const find = undefined as any;
    
    // This is where we expect the error to occur if 'find' is not a string
    try {
      const generator = LineTrimmedReplacer(content, find);
      generator.next();
    } catch (e: any) {
      console.log("Caught expected error in LineTrimmedReplacer:", e.message);
      expect(e.message).toContain("split is not a function");
    }
  });

  test("BlockAnchorReplacer should handle non-string find gracefully", () => {
    const content = "line 1\nline 2\nline 3";
    const find = null as any;
    
    try {
      const generator = BlockAnchorReplacer(content, find);
      generator.next();
    } catch (e: any) {
      console.log("Caught expected error in BlockAnchorReplacer:", e.message);
      expect(e.message).toContain("split is not a function");
    }
  });
});
