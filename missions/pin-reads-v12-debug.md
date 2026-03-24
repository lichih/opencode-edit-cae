# Mission: Pin-Reads V12 & CAE Debug Dashboard

## Goal
Implement a transparent [DEBUG] Pin-Reads & CAE dashboard in the TUI sidebar to track context evolution and edit reliability.

## Status: Completed

## Metrics Definition (This Turn / Lifetime)

### Pin-Reads (Context Management)
- [x] **Fresh**: New reads or `mtime` changes (HP reset to 100).
- [x] **Stale**: No `mtime` change (HP decreasing: 80, 60...).
- [x] **Removed**: HP hit 0 or file vanished.

### Edit CAE (Action Feedback)
- [x] **CAE Done**: Successful `oldString` matching and replacement.
- [x] **CAE Fail**: `oldString` mismatch intercepted by CAE.

## Implementation Steps
- [x] **Data Infrastructure**: Added `PinnedStats` to `read.ts` and `EditStats` to `edit.ts`.
- [x] **Turn Sync**: Updated `prompt.ts` to reset turn stats and snapshot them into `metadata.debugV12` during `insertReminders`.
- [x] **TUI Rendering**: Modified `sidebar.tsx` to display the 5-metric matrix (Turn / Lifetime).
- [x] **CAE Integration**: Integrated `EditStats` into `edit.ts`'s `replace` logic.
- [x] **Build**: Verified with `bun run build`.

## Current Progress
- [x] Metrics correctly implemented and visualized in TUI sidebar.
- [x] Session-level (InMemory) stats confirmed.
- [x] Turn-based reset (per User Prompt) confirmed.
