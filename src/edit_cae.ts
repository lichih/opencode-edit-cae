import { tool } from "./plugin-tool.ts"
import { z } from "zod"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as crypto from "node:crypto"
import * as jsdiff from "diff"

// --- Helper Functions ---

function normalize(str: string): string {
  if (typeof str !== "string") return ""
  return str.replace(/\r\n/g, "\n")
}

function trimDiff(diff: any): string {
  if (typeof diff !== "string" || !diff) return ""
  const lines = diff.split("\n")
  const contentLines = lines.filter(line => (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) && !line.startsWith("---") && !line.startsWith("+++"))
  if (contentLines.length === 0) return diff
  let min = Infinity
  for (const line of contentLines) {
    const content = line.slice(1)
    if (content.trim().length > 0) {
      const match = content.match(/^(\s*)/)
      if (match) min = Math.min(min, match[1].length)
    }
  }
  if (min === Infinity || min === 0) return diff
  return lines.map(line => {
    if ((line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) && !line.startsWith("---") && !line.startsWith("+++")) {
      return line[0] + line.slice(1 + min)
    }
    return line
  }).join("\n")
}

async function safeWrite(filePath: string, content: string, originalContent: string, matchIndex: number, matchLength: number) {
  const tempPath = `${filePath}.${crypto.randomBytes(4).toString("hex")}.tmp`
  const originalTail = originalContent.substring(matchIndex + matchLength)
  const newTail = content.substring(content.length - originalTail.length)
  if (originalTail !== newTail) throw new Error("Safety Check Failed: File tail corruption detected.")
  try {
    const fileHandle = await fs.open(tempPath, "w")
    await fileHandle.writeFile(content, "utf8")
    await fileHandle.sync()
    await fileHandle.close()
    const writtenContent = await fs.readFile(tempPath, "utf8")
    if (writtenContent !== content) throw new Error("Verification failed: Written content mismatch.")
    await fs.rename(tempPath, filePath)
  } catch (error) {
    try { await fs.unlink(tempPath) } catch {}
    throw error
  }
}

function isPythonFile(filePath: string): boolean { return filePath.endsWith(".py") }
function getLineEnding(content: string): string { return content.includes("\r\n") ? "\r\n" : "\n" }

// --- Replacers ---
export type Replacer = (content: string, find: string) => Generator<string, void, unknown>
const SimpleReplacer: Replacer = function* (_content, find) { yield find }
const LineTrimmedReplacer: Replacer = function* (content, find) {
  const lineEnding = getLineEnding(content); const originalLines = content.split(/\r?\n/); const searchLines = find.split(/\r?\n/)
  if (searchLines[searchLines.length - 1] === "") searchLines.pop()
  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true
    for (let j = 0; j < searchLines.length; j++) { if (originalLines[i + j].trim() !== searchLines[j].trim()) { matches = false; break; } }
    if (matches) {
      let startIdx = 0; for (let k = 0; k < i; k++) startIdx += originalLines[k].length + lineEnding.length
      let endIdx = startIdx; for (let k = 0; k < searchLines.length; k++) endIdx += originalLines[i + k].length + (k < searchLines.length - 1 ? lineEnding.length : 0)
      yield content.substring(startIdx, endIdx)
    }
  }
}
const BlockAnchorReplacer: Replacer = function* (content, find) {
  const lineEnding = getLineEnding(content); const originalLines = content.split(/\r?\n/); const searchLines = find.split(/\r?\n/)
  if (searchLines.length < 3) return
  const first = searchLines[0].trim(); const last = searchLines[searchLines.length - 1].trim()
  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i].trim() !== first) continue
    for (let j = i + 2; j < originalLines.length; j++) {
      if (originalLines[j].trim() === last) {
        let startIdx = 0; for (let k = 0; k < i; k++) startIdx += originalLines[k].length + lineEnding.length
        let endIdx = startIdx; for (let k = i; j && k <= j; k++) endIdx += originalLines[k].length + (k < j ? lineEnding.length : 0)
        yield content.substring(startIdx, endIdx); break
      }
    }
  }
}

// --- Tool Definition ---

export const edit_cae = tool({
  description: "High-reliability file editing tool. Uses Aider-style semantic anchoring and atomic safety checks to prevent corruption.",
  args: {
    filePath: z.string().describe("The absolute path to the file to modify"),
    oldString: z.string().describe("The text to replace"),
    newString: z.string().describe("The text to replace it with"),
    replaceAll: z.boolean().optional().describe("Replace all occurrences of oldString (default false)"),
  },
  async execute(args, context) {
    const { filePath, oldString, newString, replaceAll = false } = args
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(context.directory, filePath)
    const contentOld = await fs.readFile(absPath, "utf8")
    const normalizedOld = normalize(oldString); const normalizedNew = normalize(newString)

    let foundMatch: { search: string; index: number } | null = null
    let contentNew = ""; let matchIndex = -1; let matchLength = -1; let notFound = true
    const replacers = [SimpleReplacer, LineTrimmedReplacer, BlockAnchorReplacer]

    for (const replacer of replacers) {
      for (const search of replacer(contentOld, normalizedOld)) {
        const index = contentOld.indexOf(search); if (index === -1) continue; notFound = false
        if (replaceAll) {
          contentNew = contentOld.replaceAll(search, normalizedNew); matchIndex = 0; matchLength = contentOld.length; foundMatch = { search, index: 0 }; break
        }
        if (contentOld.lastIndexOf(search) !== index) continue
        foundMatch = { search, index }; matchIndex = index; matchLength = search.length; contentNew = contentOld.substring(0, index) + normalizedNew + contentOld.substring(index + search.length); break
      }
      if (foundMatch) break
    }

    if (foundMatch) {
      const diff = trimDiff(jsdiff.createTwoFilesPatch(absPath, absPath, contentOld, contentNew))
      const diffResults = jsdiff.diffLines(contentOld, contentNew)
      const additions = diffResults.reduce((acc, c) => acc + (c.added ? (c.count || 0) : 0), 0)
      const deletions = diffResults.reduce((acc, c) => acc + (c.removed ? (c.count || 0) : 0), 0)

      // Mandatory platform ask
      await context.ask({ permission: "edit", patterns: [path.relative(context.worktree, absPath)], always: ["*"], metadata: { filepath: absPath, diff } })
      
      if (replaceAll) await fs.writeFile(absPath, contentNew, "utf8")
      else await safeWrite(absPath, contentNew, contentOld, matchIndex, matchLength)

      // Return structured object (enabled by our registry patch)
      return {
        title: path.relative(context.worktree, absPath),
        output: `Edit applied successfully (+${additions}/-${deletions} lines).`,
        metadata: {
          diff,
          filediff: { file: absPath, before: contentOld, after: contentNew, additions, deletions },
          kind: "diff.v1"
        }
      } as any // Cast to any because the wrapper might expect a string, but our patched registry will handle this object.
    }
    throw new Error(notFound ? "Could not find oldString." : "Multiple matches found. Need more context.")
  }
})
