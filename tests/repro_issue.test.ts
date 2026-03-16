import * as fs from "node:fs/promises"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { edit_cae } from "../src/index.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// --- Mock of the old tool's problematic index calculation ---
// Sourced from reference/edit.ts line 226/233
function oldToolReplace(content: string, find: string, replaceWith: string): string {
  const originalLines = content.split("\n")
  const searchLines = find.split("\n")
  if (searchLines[searchLines.length - 1] === "") searchLines.pop()

  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true
    for (let j = 0; j < searchLines.length; j++) {
      if (originalLines[i + j].trim() !== searchLines[j].trim()) {
        matches = false
        break
      }
    }
    if (matches) {
      let matchStartIndex = 0
      // BUG: Always uses + 1 regardless of \r\n
      for (let k = 0; k < i; k++) matchStartIndex += originalLines[k].length + 1
      
      let matchEndIndex = matchStartIndex
      for (let k = 0; k < searchLines.length; k++) {
        matchEndIndex += originalLines[i + k].length
        if (k < searchLines.length - 1) matchEndIndex += 1
      }
      
      const search = content.substring(matchStartIndex, matchEndIndex)
      return content.substring(0, matchStartIndex) + replaceWith + content.substring(matchEndIndex)
    }
  }
  return content
}

async function runRepro() {
  console.log("=== Scenario: CRLF (\\r\\n) Truncation Bug ===")
  
  // File with CRLF line endings
  const content = "node_modules/\r\n.DS_Store\r\ndist/\r\n"
  const find = ".DS_Store"
  const replaceWith = "OUT/"
  
  console.log("Original content (hex):", Buffer.from(content).toString("hex"))
  
  const oldResult = oldToolReplace(content, find, replaceWith)
  console.log("Old Tool Result (hex):", Buffer.from(oldResult).toString("hex"))
  console.log("Old Tool Result text:", JSON.stringify(oldResult))
  
  // The bug: matchStartIndex will be off by 1 for the second line (.DS_Store)
  // because it assumed line 1 ended with \n (1 char) instead of \r\n (2 chars).
  // So it will start the replacement 1 char too early.
  
  if (oldResult.includes("\rOUT")) {
    console.log("❌ REPRODUCED: Old tool miscalculated index and corrupted the file (left a stray \\r and potentially ate chars).")
  }

  console.log("\n=== Testing New Tool (edit_cae) ===")
  const testFilePath = path.join(__dirname, "fixtures/repro.gitignore")
  await fs.writeFile(testFilePath, content)
  
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

  try {
    await edit_cae.execute({
      filePath: testFilePath,
      oldString: find,
      newString: replaceWith
    }, context as any)
    
    const newContent = await fs.readFile(testFilePath, "utf8")
    console.log("New Tool Result (hex):", Buffer.from(newContent).toString("hex"))
    console.log("New Tool Result text:", JSON.stringify(newContent))
    
    if (newContent === "node_modules/\r\nOUT/\r\ndist/\r\n") {
       console.log("✅ SUCCESS: New tool correctly handled CRLF and preserved file integrity.")
    } else {
       console.log("❌ FAILURE: New tool result mismatch.")
    }
  } catch (e: any) {
    console.log("❌ ERROR:", e.message)
  }
}

runRepro()
