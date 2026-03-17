import { tool } from "./plugin-tool.ts"
import { z } from "zod"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as crypto from "node:crypto"
import * as jsdiff from "diff"

// --- Helper Functions ---

export function normalize(text: string): string {
  if (typeof text !== "string") return ""
  return text.replaceAll("\r\n", "\n")
}

function isPythonFile(filePath: string): boolean {
  return filePath.endsWith(".py")
}

export function validatePythonIndentation(content: string) {
  const lines = content.split("\n")
  let usesTabs = false
  let usesSpaces = false
  for (const line of lines) {
    const match = line.match(/^[\t ]+/)
    if (!match) continue
    if (match[0].includes("\t")) usesTabs = true
    if (match[0].includes(" ")) usesSpaces = true
    if (usesTabs && usesSpaces) {
      throw new Error("Mixed tabs and spaces detected in Python file. Indentation must be consistent.")
    }
  }
}

export function getLineEnding(text: string): "\n" | "\r\n" {
  if (typeof text !== "string") return "\n"
  return text.includes("\r\n") ? "\r\n" : "\n"
}

export function convertToLineEnding(text: string, ending: "\n" | "\r\n"): string {
  if (typeof text !== "string") return ""
  if (ending === "\n") return text
  return text.replaceAll("\n", "\r\n")
}

/**
 * CAE: Secure Atomic Write with Tail Integrity Check
 */
async function safeWrite(filePath: string, content: string, originalContent: string, matchIndex: number, matchLength: number) {
  const tempPath = `${filePath}.${Math.random().toString(36).substring(7)}.tmp`
  
  // Tail validation: Ensure the part of the file AFTER the edit remains identical
  const originalTail = originalContent.substring(matchIndex + matchLength)
  const newTail = content.substring(content.length - originalTail.length)
  
  if (originalTail !== newTail) {
    throw new Error("CAE Safety Check Failed: File tail corruption detected. Aborting write.")
  }
  
  try {
    const fileHandle = await fs.open(tempPath, "w")
    await fileHandle.writeFile(content, "utf8")
    await fileHandle.sync()
    await fileHandle.close()
    
    // Verify by reading it back
    const writtenContent = await fs.readFile(tempPath, "utf8")
    if (writtenContent !== content) {
      throw new Error("CAE Verification failed: Written content mismatch.")
    }

    await fs.rename(tempPath, filePath)
  } catch (error) {
    try { await fs.unlink(tempPath) } catch {}
    throw error
  }
}

export function trimDiff(diff: string): string {
  if (typeof diff !== "string" || !diff) return ""
  const lines = diff.split("\n")
  const contentLines = lines.filter(
    (line) =>
      (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) &&
      !line.startsWith("---") &&
      !line.startsWith("+++"),
  )

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
  const trimmedLines = lines.map((line) => {
    if (
      (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) &&
      !line.startsWith("---") &&
      !line.startsWith("+++")
    ) {
      const prefix = line[0]
      const content = line.slice(1)
      return prefix + content.slice(min)
    }
    return line
  })

  return trimmedLines.join("\n")
}

// --- Replacers ---
export type Replacer = (content: string, find: string) => Generator<string, void, unknown>

export const SimpleReplacer: Replacer = function* (_content, find) {
  yield find
}

export const LineTrimmedReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n")
  const searchLines = find.split("\n")
  const leLen = content.includes("\r\n") ? 2 : 1

  if (searchLines[searchLines.length - 1] === "") searchLines.pop()

  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true
    for (let j = 0; j < searchLines.length; j++) {
      if (originalLines[i + j].trim() !== searchLines[j].trim()) {
        matches = false; break
      }
    }
    if (matches) {
      let startIdx = 0; for (let k = 0; k < i; k++) startIdx += originalLines[k].length + leLen
      let endIdx = startIdx; for (let k = 0; k < searchLines.length; k++) endIdx += originalLines[i + k].length + (k < searchLines.length - 1 ? leLen : 0)
      yield content.substring(startIdx, endIdx)
    }
  }
}

export const BlockAnchorReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n"); const searchLines = find.split("\n")
  const leLen = content.includes("\r\n") ? 2 : 1
  if (searchLines.length < 3) return
  if (searchLines[searchLines.length - 1] === "") searchLines.pop()
  const first = searchLines[0].trim(); const last = searchLines[searchLines.length - 1].trim()
  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i].trim() !== first) continue
    for (let j = i + 2; j < originalLines.length; j++) {
      if (originalLines[j].trim() === last) {
        let startIdx = 0; for (let k = 0; k < i; k++) startIdx += originalLines[k].length + leLen
        let endIdx = startIdx; for (let k = i; k <= j; k++) endIdx += originalLines[k].length + (k < j ? leLen : 0)
        yield content.substring(startIdx, endIdx); break
      }
    }
  }
}

// --- Tool Definition ---

export const edit_cae = tool({
  description: "REQUIRED for all file modifications. High-reliability tool using Aider-style semantic anchoring and atomic safety checks to prevent code corruption. Standard 'edit' is legacy and dangerous.",
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
    const ending = getLineEnding(contentOld)
    const normalizedOld = normalize(oldString)
    const normalizedNew = normalize(newString)

    if (isPythonFile(absPath)) {
      validatePythonIndentation(normalizedNew)
      validatePythonIndentation(contentOld)
    }

    let foundMatch: { search: string; index: number } | null = null
    let notFound = true
    const replacers = [SimpleReplacer, LineTrimmedReplacer, BlockAnchorReplacer]

    let contentNew = ""
    let matchIndex = -1
    let matchLength = -1

    for (const replacer of replacers) {
      for (const search of replacer(contentOld, normalizedOld)) {
        const index = contentOld.indexOf(search)
        if (index === -1) continue
        notFound = false
        
        if (replaceAll) {
          contentNew = contentOld.replaceAll(search, normalizedNew)
          foundMatch = { search, index: 0 }
          break
        }

        const lastIndex = contentOld.lastIndexOf(search)
        if (index !== lastIndex) continue // Not unique
        
        foundMatch = { search, index }
        contentNew = contentOld.substring(0, index) + normalizedNew + contentOld.substring(index + search.length)
        matchIndex = index
        matchLength = search.length
        break
      }
      if (foundMatch) break
    }

    if (foundMatch) {
      if (isPythonFile(absPath)) {
        validatePythonIndentation(contentNew)
      }
      const diff = trimDiff(jsdiff.createTwoFilesPatch(absPath, absPath, normalize(contentOld), normalize(contentNew)))
      const diffResults = jsdiff.diffLines(contentOld, contentNew)
      const additions = diffResults.reduce((acc, c) => acc + (c.added ? (c.count || 0) : 0), 0)
      const deletions = diffResults.reduce((acc, c) => acc + (c.removed ? (c.count || 0) : 0), 0)

      // Mandatory platform ask
      await context.ask({
        permission: "edit",
        patterns: [path.relative(context.worktree, absPath)],
        always: ["*"],
        metadata: { filepath: absPath, diff }
      })

      if (replaceAll) {
        await fs.writeFile(absPath, contentNew, "utf8")
      } else {
        await safeWrite(absPath, contentNew, contentOld, matchIndex, matchLength)
      }

      // Return structured response for the patched registry
      return {
        title: path.relative(context.worktree, absPath),
        output: `Edit applied successfully (+${additions}/-${deletions} lines).`,
        metadata: {
          diff,
          filediff: { file: absPath, before: contentOld, after: contentNew, additions, deletions },
          kind: "diff.v1"
        }
      } as any
    }

    if (notFound) {
      throw new Error("Could not find oldString in the file. It must match exactly or via fuzzy matching.")
    }
    
    throw new Error("Found multiple matches for oldString. Provide more surrounding context to make the match unique.")
  }
})
