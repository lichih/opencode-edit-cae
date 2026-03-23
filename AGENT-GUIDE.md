# AGENT ONBOARDING GUIDE (CRITICAL READ)

Listen up. You are taking over a high-precision project: **Opencode CAE (Context Aware Edit) Enhancements**. Your predecessor made some mistakes, so pay close attention to these rules. Failure to comply will disrupt the entire development workflow.

## 1. STOP THE PSEUDO-CODE SPAM
Do NOT output blocks of "suggested code" in your text responses.
- **Plan Mode**: Read, analyze, and describe the plan.
- **Build Mode**: **EXECUTE**. Use real tools (`edit`, `write`, `bash`).
- If you explain a change, implement it. Air-coding is a waste of tokens and time.

## 2. RESPECT THE DIRECTORY SYMMETRY
The `src/` directory is structured to mirror the core repository.
- `src/tool/` -> Maps to `packages/opencode/src/tool/`
- `src/session/` -> Maps to `packages/opencode/src/session/`
- `src/1.3.0/` -> This is your **Baseline**. NEVER modify anything inside here. It’s for diffing.
**Rule**: Keep relative imports (`../lsp`, `./tool`) working by maintaining this hierarchy. Do not use messy symlinks or root-level files.

## 3. YOUR MISSION: V12 METADATA MIGRATION
Read `missions/pin-reads-v12-metadata.md` immediately. Your primary task is to move the Pin-Reads state management:
- **From**: Memory-based global Map (`PinnedRegistry`).
- **To**: Persistent `Session.metadata.pinnedFiles`.
- **Why**: This enables cross-process sync for the upcoming TUI sidebar integration and persistence across restarts.
- **Logic**: Implement the **Priority Scoring (HP) System**. `read` gets 40, `edit` gets 100. Decay score by 20 every turn in `prompt.ts`. If score <= 0, purge from metadata.

## 4. SECURITY HANDSHAKE (1:1 PARITY)
Opencode relies on a delicate "Handshake" between `read` and `edit`.
- `read.ts` **MUST** call `FileTime.read()`.
- `edit.ts` **MUST** call `FileTime.assert()`.
- Both must call `LSP.touchFile()`.
If you break this by "cleaning up" code you don't understand, `edit` calls will fail because the session "hasn't read the latest version." Do NOT drop original side effects.

## 5. ARTIFACTS ARE NOT SOURCE
Files in `patches/` are **Artifacts**. They are generated results.
- Run `make build-patches` to generate them.
- Do NOT edit `.patch` files manually.
- Modify the `.ts` files in `src/` and let the Makefile do its job.

## 6. THE TOOL-CALL TRAP (STOP DOING THIS!)
Do NOT write out tool calls as text inside your response. 
**Example of FAILURE (FORBIDDEN):**
> "I will now execute: tool_call: read for filePath='...'"
**Why this is a failure**: The system does not execute your text. It only executes REAL tool dispatches sent via the system interface. If you need to research or read a file, **ACTUALLY CALL THE TOOL**. Do not describe it. 

## 7. PLAN MODE DISCIPLINE
- Even in **Plan Mode**, you are expected to use **read-only tools** (`read`, `grep`, `glob`, `webfetch`) to gather facts.
- Do not make assumptions or ask the user for information you can find yourself. 
- Execute your research tool calls in **parallel** and use the results to build a grounded plan.

## 8. GIT DISCIPLINE
- Always `git status` before finishing a task.
- Ensure all source files in `src/`, `tests/`, `bk/`, and `missions/` are properly tracked and committed.
- Keep the workspace clean. No temp files or broken symlinks.

**Now, read the Mission file, analyze the current `src/tool/read.ts` and `src/session/prompt.ts`, and get to work. No more talking, start tool-calling.**
