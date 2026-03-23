import { describe, it, expect } from "bun:test";
import { replace as baseReplace } from "./workspace/base_edit.ts";
import { replace as srcReplace } from "./workspace/src_edit.ts";

const testCases = [
  {
    name: "Simple Exact Match",
    content: "line 1\nline 2\nline 3",
    oldStr: "line 2",
    newStr: "line TWO"
  },
  {
    name: "Multi-line Exact Match",
    content: "function foo() {\n  return 1;\n}",
    oldStr: "  return 1;",
    newStr: "  return 100;"
  },
  {
    name: "Line Trimmed Match (Indentation ignore)",
    content: "    line 2",
    oldStr: "line 2",
    newStr: "line TWO"
  }
];

describe("Consistency Test: 1.3.0 vs SRC", () => {
  testCases.forEach((tc) => {
    it(tc.name, () => {
      const baseResult = baseReplace(tc.content, tc.oldStr, tc.newStr);
      const srcResult = srcReplace(tc.content, tc.oldStr, tc.newStr);
      
      // 核心要求：成功時輸出必須完全一致
      expect(srcResult).toBe(baseResult);
    });
  });
});
