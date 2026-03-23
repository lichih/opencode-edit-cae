import { describe, it, expect } from "bun:test";
import { replace } from "./workspace/base_edit.ts";

describe("Mocking Proof (Workspace Strategy)", () => {
  it("should run replace logic from 1.3.0 without modifications via symlink", () => {
    const content = "const a = 1;\nconst b = 2;";
    const find = "const a = 1;";
    const next = "const a = 100;";
    const result = replace(content, find, next);
    expect(result).toBe("const a = 100;\nconst b = 2;");
  });

  it("should prove 1.3.0 internal Replacers are accessible", () => {
    const content = "  trimmed  ";
    const find = "trimmed";
    const next = "REPLACED";
    // LineTrimmedReplacer in 1.3.0 should handle this
    const result = replace(content, find, next);
    expect(result).toBe("  REPLACED  ");
  });
});
