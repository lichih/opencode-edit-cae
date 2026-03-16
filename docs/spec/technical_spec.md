---
title: Edit Case
description: Technical guide for building robust file modification systems
---

This guide outlines requirements for building reliable file modification tools.

---

Use search layers

Start with a strict physical slice check. This matches the line range exactly against the target string to apply immediate changes.

Look within a window of 100 lines if the first check fails. A similarity threshold helps find blocks that moved during earlier edits.

Fallback to a global search for unique strings. Reject any edit where the target string appears more than once in the file.

---

Handle Python files

Detect Python files by their extension to trigger specific strictness rules. This ensures indentation remains consistent across the entire file.

Manage indentation automatically for both old and new strings. Always reject edits that mix tabs and spaces or break the scope.

---

Ensure data safety

Validate the file tail after writing to prevent accidental middle-erases. This confirms that the end of the file remains intact after changes.

Perform atomic writes using temporary files and disk syncing. Read the file back immediately to verify bit-level integrity.
