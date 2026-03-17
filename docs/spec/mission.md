# Edit CAE: Mission Statement

## Core Objective
To implement a high-reliability file editing system for Opencode that combines **Aider-style semantic anchoring** with **Industrial-grade data safety**, while ensuring a **seamless native visual experience**.

---

## Technical Goals

### 1. Fix Platform Deficiencies (The Registry Patch)
- Address the "Metadata Erasure" bug in Opencode's `registry.ts`.
- Ensure that external plugins can pass structured metadata (Diff, FileStats) to the TUI.
- Maintain this fix as a surgical patch to minimize upstream maintenance burden.

### 2. High-Reliability Editing (The CAE Logic)
- **Coordinate Drift Resilience**: Use multi-layer fuzzy matching (LineTrimmed, BlockAnchor) to locate targets even after content has shifted.
- **CRLF Awareness**: Eliminate the legacy `+1` indexing bug by dynamically detecting and respecting line endings.
- **Tail Integrity Guard**: Validate that content following the edit area remains bit-identical after the operation.
- **Atomic fsync Writes**: Ensure data is physically committed to disk before finalizing the edit.

---

## Success Criteria

### Reliability & Safety
- [ ] ZERO accidental file truncations in edge cases (.gitignore without trailing newlines, CRLF files).
- [ ] Automatic rollback if post-write verification fails.
- [ ] Consistent Python indentation enforcement (prevent mixing tabs/spaces).

### User Experience (Visual Parity)
- [ ] Native Side-by-Side Diff window triggers automatically in the Opencode TUI.
- [ ] Accurate addition/deletion statistics reported to the agent.
- [ ] Seamless integration where the AI prioritizes `edit_cae` via system instructions.

---

## Maintenance & Distribution Strategy
- **Standard Plugin Architecture**: `edit_cae` remains a standard plugin following the `@opencode-ai/plugin` spec.
- **Patch-Driven Workflow**: Use a `Makefile` to automate the `Pull -> Patch -> Build -> Install` cycle for the Opencode core.
- **Future-Proof**: If Opencode fixes the registry bug, the plugin survives without modification by simply dropping the patch.
