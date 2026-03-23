import { test, expect, beforeEach, describe } from "bun:test"
import { PinnedRegistry } from "../src/tool/read"
import { insertReminders } from "../src/session/prompt"

describe("Pin-Reads V12 Logic", () => {
  beforeEach(() => {
    PinnedRegistry.clear()
  })

  test("HP Decay: Score should decrease by 20 on each insertReminders call", async () => {
    PinnedRegistry.set("test.ts", {
      mtime: 0,
      lastAccess: 0,
      score: 100,
      lastAction: "read"
    })

    const mockInput = {
      messages: [{ info: { role: "user", id: "1", sessionID: "s1" }, parts: [] }],
      agent: { name: "build" },
      session: {}
    }

    // @ts-ignore
    await insertReminders(mockInput)
    expect(PinnedRegistry.get("test.ts")?.score).toBe(80)

    // @ts-ignore
    await insertReminders(mockInput)
    expect(PinnedRegistry.get("test.ts")?.score).toBe(60)
  })

  test("LRU Removal: File should be removed when score reaches 0", async () => {
    PinnedRegistry.set("test.ts", {
      mtime: 0,
      lastAccess: 0,
      score: 20,
      lastAction: "read"
    })

    const mockInput = {
      messages: [{ info: { role: "user", id: "1", sessionID: "s1" }, parts: [] }],
      agent: { name: "build" },
      session: {}
    }

    // @ts-ignore
    await insertReminders(mockInput)
    expect(PinnedRegistry.has("test.ts")).toBe(false)
  })

  test("Metadata Injection: User message should contain pinnedFiles metadata", async () => {
    PinnedRegistry.set("test.ts", {
      mtime: 0,
      lastAccess: 0,
      score: 100,
      lastAction: "read"
    })

    const messages = [{ info: { role: "user", id: "1", sessionID: "s1" }, parts: [] }]
    const mockInput = {
      messages,
      agent: { name: "build" },
      session: {}
    }

    // @ts-ignore
    await insertReminders(mockInput)

    const lastPart = messages[0].parts.at(-1) as any
    expect(lastPart.type).toBe("text")
    expect(lastPart.text).toBe("")
    expect(lastPart.metadata.pinnedFiles).toBeDefined()
    expect(lastPart.metadata.pinnedFiles["test.ts"].score).toBe(80)
  })
})
