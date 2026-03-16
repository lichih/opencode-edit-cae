# Edit Cae

Secure file editing using coordinates and semantic locking

---

Summarize context

The opencode project requires a more reliable file editing tool.
Current methods suffer from coordinate drift and accidental file truncation.

---

Diagnose failures

Legacy editing caused critical data loss in .gitignore files by truncating content.
Python files often break due to subtle indentation mismatches during replacement.

---

Design layers

Implement a three-layer search strategy for maximum reliability.
Start with strict coordinate matching then expand to heuristic local search.

---

Lock semantics

Fall back to global uniqueness checking if local searches fail.
Reject any edit where the target string appears multiple times without explicit instruction.

---

Protect logic

Apply strict indentation rules for Python files to prevent syntax errors.
Ensure the tool performs bit-by-bit validation before executing any write operation.

---

Verify integrity

Validate the file tail after every edit to prevent accidental truncation.
Use precise byte-level slicing instead of fuzzy string replacement patterns.

---

Explore improvements

Research how Aider handles multi-line blocks and indentation migration.
Investigate atomic write patterns in Node.js to ensure filesystem stability.

---

Optimize feedback

Reduce diagnostic output to avoid saturating the model's context window.
Provide concise diffs that highlight specific whitespace or line-ending discrepancies.
