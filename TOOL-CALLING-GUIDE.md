# TOOL-CALLING PROTOCOL (CRITICAL READ)

Listen up. This project requires extreme precision. If you want to survive this session without causing frustration, follow these rules. No exceptions.

## 1. STOP THE PSEUDO-CALLING (THE TRAP)
Do NOT write out tool calls as text in your response. The system only executes dispatches sent via the tool interface.
- **FORBIDDEN**: `"I will now run: tool_call: read for filePath='...'"`
- **REQUIRED**: Directly trigger the `read` tool in your response block.
If you find yourself typing the name of a tool in a numbered list instead of calling it, you are failing.

## 2. PLAN MODE = ACTIVE RESEARCH
Plan Mode is NOT for guessing. It is for establishing facts.
- **DO**: Use read-only tools (`read`, `grep`, `glob`, `webfetch`) to gather data.
- **DON'T**: Ask the user where a file is. Search for it yourself.
- **PARALLELISM**: Call multiple research tools in a single response to build a grounded plan quickly.

## 3. BUILD MODE = IMPLEMENT & VERIFY
Build Mode is for execution.
- **STEP 1**: Modify source files in `src/tool/` or `src/session/`.
- **STEP 2**: IMMEDIATELY run `make build-patches` to generate artifacts.
- **STEP 3**: Verify that the `.patch` files accurately reflect your changes.
- **STEP 4**: Commit your `src/` changes.

## 4. MAINTAIN SECURITY HANDSHAKES (1:1 PARITY)
Never "clean up" original side effects. Opencode depends on them.
- `read.ts` **MUST** call `FileTime.read()`.
- `edit.ts` **MUST** call `FileTime.assert()`.
If you drop these calls to save space, the "Security Handshake" breaks, and the next tool call will fail.

## 5. DIRECTORY SYMMETRY
The `src/` directory mirrors `packages/opencode/src/`.
- **ALWAYS** keep this hierarchy: `src/tool/`, `src/session/`, etc.
- This ensures relative imports (`../lsp`, `./tool`) work during unit tests without messy symlinks.

## 6. NEVER HALLUCINATE APIS (THE CRITICAL RULE)
If a mission document or a previous message mentions an API that does not exist in the baseline (`src/1.3.0/`), **IT IS A BUG**. 
- **FORBIDDEN**: Do NOT implement missing core APIs (like `Session.updateMetadata`) unless specifically instructed to refactor the core model.
- **REQUIRED**: Report the discrepancy and use existing mechanisms (like `Part.metadata` or existing setters). Always verify the existence of an API in the native source before calling it.

**Now, read the specific Mission file for your current task and START TOOL-CALLING. Less talk, more dispatch.**
