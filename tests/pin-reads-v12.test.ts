import { test, expect, describe } from "bun:test"

// --- 模擬後端狀態 (read.ts / prompt.ts 邏輯) ---
const PinnedRegistry = new Map<string, any>()

function simulateInsertReminders(userMessage: any) {
  // 1. HP Decay
  for (const [filepath, meta] of PinnedRegistry.entries()) {
    meta.score -= 20
    if (meta.score <= 0) {
      PinnedRegistry.delete(filepath)
    }
  }

  // 2. Metadata Bridge Injection
  userMessage.parts.push({
    type: "text",
    text: "", 
    synthetic: true,
    metadata: {
      pinnedFiles: Object.fromEntries(PinnedRegistry),
    },
  })
}

// --- 模擬前端提取邏輯 (sidebar.tsx 邏輯) ---
function extractPinnedFiles(messages: any[]) {
  const lastWithPins = messages.findLast((m) =>
    m.parts?.some((p: any) => p.metadata?.pinnedFiles),
  )
  if (!lastWithPins) return []
  const part = lastWithPins.parts.findLast((p: any) => p.metadata?.pinnedFiles)
  if (!part) return []
  return Object.entries(part.metadata!.pinnedFiles as Record<string, any>).map(([path, meta]) => ({
    path,
    ...meta,
  }))
}

describe("Pin-Reads V12 Full Scenario Sync", () => {
  test("Complete flow: Backend decay -> Metadata injection -> Frontend extraction", () => {
    // [Backend] Initial State: 2 files pinned with 100HP
    PinnedRegistry.clear()
    PinnedRegistry.set("file1.ts", { score: 100, lastAction: "read" })
    PinnedRegistry.set("file2.ts", { score: 100, lastAction: "read" })

    // [Session] First User Message
    const msg1 = { role: "user", parts: [{ type: "text", text: "Hello" }] }
    simulateInsertReminders(msg1)

    // Verify Backend State after 1st message (Decay to 80)
    expect(PinnedRegistry.get("file1.ts").score).toBe(80)
    
    // [Frontend] Extract from msg1
    const pinsAfterMsg1 = extractPinnedFiles([msg1])
    expect(pinsAfterMsg1.length).toBe(2)
    expect(pinsAfterMsg1.find(p => p.path === "file1.ts")?.score).toBe(80)

    // [Session] Second User Message (file2 reaches 60, file1 updated by new read)
    // Simulating file1 being read again (reset to 100)
    PinnedRegistry.set("file1.ts", { score: 100, lastAction: "read" })
    
    const msg2 = { role: "user", parts: [{ type: "text", text: "Read file1 again" }] }
    simulateInsertReminders(msg2)

    // Verify Backend State: file1 (100 -> 80), file2 (80 -> 60)
    expect(PinnedRegistry.get("file1.ts").score).toBe(80)
    expect(PinnedRegistry.get("file2.ts").score).toBe(60)

    // [Session] Third User Message (file2 reaches 40, simulate decay)
    const msg3 = { role: "user", parts: [{ type: "text", text: "Third message" }] }
    simulateInsertReminders(msg3)
    
    // [Frontend] Test "Latest Message" extraction logic
    const allMessages = [msg1, msg2, msg3]
    const latestPins = extractPinnedFiles(allMessages)
    
    expect(latestPins.length).toBe(2)
    expect(latestPins.find(p => p.path === "file2.ts")?.score).toBe(40)
  })

  test("HP Expiration: File should disappear from extraction when HP reaches 0", () => {
    PinnedRegistry.clear()
    PinnedRegistry.set("dying_file.ts", { score: 20, lastAction: "read" })

    const msg = { role: "user", parts: [] }
    simulateInsertReminders(msg)

    // Backend should have deleted it
    expect(PinnedRegistry.has("dying_file.ts")).toBe(false)

    // Frontend extraction should be empty
    const pins = extractPinnedFiles([msg])
    expect(pins.length).toBe(0)
  })
})
