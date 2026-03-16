# Edit Cae

Build a high-reliability file editing plugin for Opencode.

---

Define goals

Implement `edit_cae` as a high-reliability Opencode plugin.
Address coordinate drift, truncation issues, and Python indentation sensitivity.

---

Verify results

Prevent accidental loss of file content outside target ranges.
Maintain correct indentation and PEP 8 compliance for Python files.

Successfully apply edits even if line numbers shift.
Replace the default tool functionality through `opencode.json` integration.

---

Observe constraints

Develop using TypeScript or Node.js with Bun.
Operate as an external plugin within this directory.

Prioritize safety with atomic write patterns and post-write validation.
