import { edit_cae } from "../src/index.ts"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, "fixtures")

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
  await fs.mkdir(FIXTURES_DIR, { recursive: true })
  await fs.writeFile(path.join(FIXTURES_DIR, "test_file.txt"), "line1\nline2\nline3\nline4\nline5\n")
}

async function main() {
  await setup()

  // 1. Layer 1: Strict match
  await runTest("Layer 1 Strict", {
    filePath: path.join(FIXTURES_DIR, "test_file.txt"),
    oldString: "line2\nline3",
    newString: "line2_updated\nline3_updated"
  })

  // 2. Layer 2: Windowed Search (Moved/Shifted)
  // In the new API, this works the same as Layer 1 because we search the whole file.
  await runTest("Layer 2 Moved Content", {
    filePath: path.join(FIXTURES_DIR, "test_file.txt"),
    oldString: "line4",
    newString: "line4_moved"
  })

  // 3. Layer 3: Global Unique
  const padding = "\n".repeat(200)
  const layer3Path = path.join(FIXTURES_DIR, "test_file_layer3.txt")
  await fs.writeFile(layer3Path, `line1${padding}unique_global_string\n`)
  await runTest("Layer 3 Global Unique", {
    filePath: layer3Path,
    oldString: "unique_global_string",
    newString: "global_success"
  })

  // 4. Python Safety
  const pythonPath = path.join(FIXTURES_DIR, "sample.py")
  await fs.writeFile(pythonPath, 'def test():\n    print("First line")\n    print("Second line")\n')
  await runTest("Python Indentation (Fail)", {
    filePath: pythonPath,
    oldString: '    print("Second line")',
    newString: '\tprint("Mixed line")' // Mixed tabs and spaces
  })

  // 5. Global Multiple (Fail)
  await fs.appendFile(path.join(FIXTURES_DIR, "test_file.txt"), "\nduplicate\nduplicate\n")
  await runTest("Global Multiple (Fail)", {
    filePath: path.join(FIXTURES_DIR, "test_file.txt"),
    oldString: "duplicate",
    newString: "replaced"
  })
}

main()
