import { test, expect, describe, beforeEach } from "bun:test"

// --- Mocking Backend Logic (src/tool/read.ts, src/tool/edit.ts, src/session/prompt.ts) ---

interface PinnedFileState {
  mtime: number
  score: number
}

const PinnedRegistry = new Map<string, PinnedFileState>()
const PinnedStats = {
  turn: { fresh: 0, stale: 0, removed: 0 },
  life: { fresh: 0, stale: 0, removed: 0 },
}

const EditStats = {
  turn: { done: 0, fail: 0 },
  life: { done: 0, fail: 0 },
}

function resetTurnStats() {
  PinnedStats.turn = { fresh: 0, stale: 0, removed: 0 }
  EditStats.turn = { done: 0, fail: 0 }
}

function simulateRead(filepath: string, mtime: number) {
  PinnedRegistry.set(filepath, { mtime, score: 100 })
  PinnedStats.turn.fresh++
  PinnedStats.life.fresh++
}

function simulateEdit(success: boolean) {
  if (success) {
    EditStats.turn.done++
    EditStats.life.done++
  } else {
    EditStats.turn.fail++
    EditStats.life.fail++
  }
}

function simulateSyncPinnedFiles(filesOnDisk: Record<string, number>) {
  for (const [filepath, meta] of PinnedRegistry.entries()) {
    const diskMtime = filesOnDisk[filepath]
    if (diskMtime === undefined) {
      PinnedRegistry.delete(filepath)
      PinnedStats.turn.removed++
      PinnedStats.life.removed++
      continue
    }

    if (diskMtime > meta.mtime) {
      meta.score = 100
      meta.mtime = diskMtime
      PinnedStats.turn.fresh++
      PinnedStats.life.fresh++
    } else {
      meta.score -= 20
      if (meta.score <= 0) {
        PinnedRegistry.delete(filepath)
        PinnedStats.turn.removed++
        PinnedStats.life.removed++
      } else {
        PinnedStats.turn.stale++
        PinnedStats.life.stale++
      }
    }
  }
}

function simulateInsertReminders(userMessage: any, filesOnDisk: Record<string, number>) {
  // resetTurnStats() // Don't reset before sync if we want to capture pre-sync events like simulateRead/simulateEdit
  simulateSyncPinnedFiles(filesOnDisk)

  userMessage.parts.push({
    type: "text",
    synthetic: true,
    metadata: {
      debugV12: {
        pin: JSON.parse(JSON.stringify(PinnedStats)),
        cae: JSON.parse(JSON.stringify(EditStats)),
      }
    }
  })
  
  resetTurnStats() // Reset AFTER snapshot for next turn
}

// --- Mocking Frontend Extraction (src/cli/cmd/tui/routes/session/sidebar.tsx) ---

function extractDebugV12(messages: any[]) {
  const lastWithDebug = messages.findLast((m) =>
    m.parts?.some((p: any) => p.metadata?.debugV12),
  )
  if (!lastWithDebug) return null
  const part = lastWithDebug.parts.findLast((p: any) => p.metadata?.debugV12)
  return part.metadata.debugV12
}

// --- Unit Tests ---

describe("Pin-Reads & CAE Debug Dashboard V12", () => {
  beforeEach(() => {
    PinnedRegistry.clear()
    PinnedStats.turn = { fresh: 0, stale: 0, removed: 0 }
    PinnedStats.life = { fresh: 0, stale: 0, removed: 0 }
    EditStats.turn = { done: 0, fail: 0 }
    EditStats.life = { done: 0, fail: 0 }
  })

  test("Initial Read should count as Fresh", () => {
    simulateRead("main.ts", 1000)
    expect(PinnedStats.turn.fresh).toBe(1)
    expect(PinnedStats.life.fresh).toBe(1)
  })

  test("Turn Transition: Persistence (Stale) vs Removal", () => {
    // 1. Setup: 2 files
    simulateRead("active.ts", 1000)
    simulateRead("expiring.ts", 1000)
    PinnedRegistry.get("expiring.ts")!.score = 20

    // 2. New Turn
    const msg = { parts: [] }
    const disk = { "active.ts": 1000, "expiring.ts": 1000 }
    simulateInsertReminders(msg, disk)

    const debug = extractDebugV12([msg])
    expect(debug.pin.turn.stale).toBe(1) // active.ts
    expect(debug.pin.turn.removed).toBe(1) // expiring.ts
    expect(PinnedRegistry.has("active.ts")).toBe(true)
    expect(PinnedRegistry.has("expiring.ts")).toBe(false)
  })

  test("mtime change should trigger Fresh injection in a Turn", () => {
    // 1. Setup: file is stale
    simulateRead("meta.ts", 1000)
    
    // 2. Turn 1 (Stale)
    simulateInsertReminders({ parts: [] }, { "meta.ts": 1000 })
    
    // 3. File modified on disk
    // 4. Turn 2 (Fresh)
    const msg2 = { parts: [] }
    simulateInsertReminders(msg2, { "meta.ts": 2000 })

    const debug = extractDebugV12([msg2])
    expect(debug.pin.turn.fresh).toBe(1)
    expect(debug.pin.turn.stale).toBe(0)
    expect(PinnedRegistry.get("meta.ts")!.score).toBe(100)
  })

  test("CAE Done/Fail tracking across Turns", () => {
    // 1. Turn 1: 2 successful edits, 1 fail
    simulateEdit(true)
    simulateEdit(true)
    simulateEdit(false)

    const msg1 = { parts: [] }
    simulateInsertReminders(msg1, {})
    
    const debug1 = extractDebugV12([msg1])
    expect(debug1.cae.turn.done).toBe(2)
    expect(debug1.cae.turn.fail).toBe(1)
    expect(debug1.cae.life.done).toBe(2)
    expect(debug1.cae.life.fail).toBe(1)

    // 2. Turn 2: 1 new success
    simulateEdit(true)
    const msg2 = { parts: [] }
    simulateInsertReminders(msg2, {})

    const debug2 = extractDebugV12([msg2])
    expect(debug2.cae.turn.done).toBe(1)
    expect(debug2.cae.turn.fail).toBe(0)
    expect(debug2.cae.life.done).toBe(3)
    expect(debug2.cae.life.fail).toBe(1)
  })

  test("TUI Extraction logic (Last Message)", () => {
    const msg1 = { parts: [{ metadata: { debugV12: { pin: { turn: { fresh: 5 } } } } }] }
    const msg2 = { parts: [{ text: "No debug here" }] }
    const msg3 = { parts: [{ metadata: { debugV12: { pin: { turn: { fresh: 10 } } } } }] }

    const extracted = extractDebugV12([msg1, msg2, msg3])
    expect(extracted.pin.turn.fresh).toBe(10)
  })
})
