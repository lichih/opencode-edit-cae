import { edit_cae } from "./src/index.js"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const context = {
  directory: process.cwd(),
  worktree: process.cwd(),
  sessionID: "test-session",
  messageID: "test-msg",
  agent: "test-agent",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {}
}

async function runTest(name: string, args: any) {
  console.log(`\n--- Test: ${name} ---`)
  try {
    const result = await edit_cae.execute(args, context as any)
    console.log("Result:", result)
  } catch (error: any) {
    console.error("Error:", error.message)
  }
}

async function setup() {
  await fs.writeFile("test_data/test_file.txt", "line1\nline2\nline3\nline4\nline5\n")
}

async function main() {
  await setup()

  // 1. Layer 1: Strict match
  await runTest("Layer 1 Strict", {
    filePath: "test_data/test_file.txt",
    oldString: "line2\nline3",
    newString: "line2_updated\nline3_updated",
    startLine: 2,
    endLine: 3
  })

  // 2. Layer 2: Windowed Search (shift lines)
  // Current file: line1, line2_updated, line3_updated, line4, line5
  await runTest("Layer 2 Windowed (Moved)", {
    filePath: "test_data/test_file.txt",
    oldString: "line4",
    newString: "line4_moved",
    startLine: 1, // Wrong start line (should be 4)
    endLine: 1
  })

  // 3. Layer 3: Global Unique
  // Insert 200 lines to push it out of Layer 2 window (WINDOW_SIZE = 100)
  const padding = "\n".repeat(200)
  await fs.writeFile("test_data/test_file_layer3.txt", `line1${padding}unique_global_string\n`)
  await runTest("Layer 3 Global Unique", {
    filePath: "test_data/test_file_layer3.txt",
    oldString: "unique_global_string",
    newString: "global_success",
    startLine: 1, // Way off
    endLine: 1
  })

  // 4. Python Safety
  await runTest("Python Indentation (Fail)", {
    filePath: "test_data/sample.py",
    oldString: '    print("Inner scope")',
    newString: '\tprint("Inner scope")', // Tab instead of 4 spaces
    startLine: 4,
    endLine: 4
  })

  // 5. Global Multiple (Fail)
  await fs.appendFile("test_data/test_file.txt", "\nduplicate\nduplicate\n")
  await runTest("Global Multiple (Fail)", {
    filePath: "test_data/test_file.txt",
    oldString: "duplicate",
    newString: "replaced",
    startLine: 1,
    endLine: 1
  })
}

main()
