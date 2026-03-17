# Opencode Tool Selection Rules

CRITICAL: The built-in 'edit' tool is legacy and known to cause file corruption (truncation, CRLF drift).
- **ALWAYS** use `edit_cae` for modifying any existing files.
- Use `write` **ONLY** for creating entirely new files.
- The `edit_cae` tool is required to ensure data integrity and safety.
- If you find yourself about to use 'edit', STOP and use 'edit_cae' instead.
