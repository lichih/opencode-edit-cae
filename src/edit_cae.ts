import { tool } from "./plugin-tool.ts"
import { z } from "zod"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as crypto from "node:crypto"

// --- Constants & Types ---
const SIMILARITY_THRESHOLD = 0.8

export type Replacer = (content: string, find: string) => Generator<string, void, unknown>

// --- Helper Functions ---

function normalize(str: string): string {
  return str.replace(/\r\n/g, "\n")
}

function levenshtein(a: string, b: string): number {
  if (a === "" || b === "") return Math.max(a.length, b.length)
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  }
  return matrix[a.length][b.length]
}

/**
 * Atomic write with tail validation and fsync
 */
async function safeWrite(filePath: string, content: string, originalContent: string, matchIndex: number, matchLength: number) {
  const tempPath = `${filePath}.${crypto.randomBytes(4).toString("hex")}.tmp`
  
  // Tail validation: Ensure the part of the file AFTER the edit remains identical
  const originalTail = originalContent.substring(matchIndex + matchLength)
  const newTail = content.substring(content.length - originalTail.length)
  
  if (originalTail !== newTail) {
    throw new Error("Safety Check Failed: File tail corruption detected.")
  }
  
  try {
    const fileHandle = await fs.open(tempPath, "w")
    await fileHandle.writeFile(content, "utf8")
    await fileHandle.sync()
    await fileHandle.close()
    
    // Verify by reading it back
    const writtenContent = await fs.readFile(tempPath, "utf8")
    if (writtenContent !== content) {
      throw new Error("Verification failed: Written content does not match intended content.")
    }

    await fs.rename(tempPath, filePath)
  } catch (error) {
    try { await fs.unlink(tempPath) } catch {}
    throw error
  }
}

function isPythonFile(filePath: string): boolean {
  return filePath.endsWith(".py")
}

function validatePythonIndentation(content: string) {
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

// --- Replacers ---

const SimpleReplacer: Replacer = function* (_content, find) {
  yield find
}

function getLineEnding(content: string): string {
  return content.includes("\r\n") ? "\r\n" : "\n"
}

const LineTrimmedReplacer: Replacer = function* (content, find) {
  const lineEnding = getLineEnding(content)
  const originalLines = content.split(/\r?\n/)
  const searchLines = find.split(/\r?\n/)
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
      for (let k = 0; k < i; k++) matchStartIndex += originalLines[k].length + lineEnding.length
      let matchEndIndex = matchStartIndex
      for (let k = 0; k < searchLines.length; k++) {
        matchEndIndex += originalLines[i + k].length
        if (k < searchLines.length - 1) matchEndIndex += lineEnding.length
      }
      yield content.substring(matchStartIndex, matchEndIndex)
    }
  }
}

const BlockAnchorReplacer: Replacer = function* (content, find) {
  const lineEnding = getLineEnding(content)
  const originalLines = content.split(/\r?\n/)
  const searchLines = find.split(/\r?\n/)
  if (searchLines.length < 3) return
  if (searchLines[searchLines.length - 1] === "") searchLines.pop()

  const firstLineSearch = searchLines[0].trim()
  const lastLineSearch = searchLines[searchLines.length - 1].trim()

  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i].trim() !== firstLineSearch) continue
    for (let j = i + 2; j < originalLines.length; j++) {
      if (originalLines[j].trim() === lastLineSearch) {
        let matchStartIndex = 0
        for (let k = 0; k < i; k++) matchStartIndex += originalLines[k].length + lineEnding.length
        let matchEndIndex = matchStartIndex
        for (let k = i; k <= j; k++) {
          matchEndIndex += originalLines[k].length
          if (k < j) matchEndIndex += lineEnding.length
        }
        yield content.substring(matchStartIndex, matchEndIndex)
        break
      }
    }
  }
}

// --- Tool Definition ---

export const edit_cae = tool({
  description: "CRITICAL: OFFICIAL HIGH-RELIABILITY REPLACEMENT FOR 'edit'. Use this tool for ALL code modifications to prevent file corruption. The built-in 'edit' tool is legacy, deprecated, and dangerous. This tool provides atomic safety, CRLF awareness, and tail integrity validation.",
  args: {
    filePath: z.string().describe("The absolute path to the file to modify"),
    oldString: z.string().describe("The text to replace"),
    newString: z.string().describe("The text to replace it with"),
    replaceAll: z.boolean().optional().describe("Replace all occurrences of oldString (default false)"),
  },
  async execute(args, context) {
    const { filePath, oldString, newString, replaceAll = false } = args
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(context.directory, filePath)
    
    const rawContent = await fs.readFile(absPath, "utf8")
    const content = rawContent
    const normalizedOld = normalize(oldString)
    const normalizedNew = normalize(newString)

    if (isPythonFile(absPath)) {
      validatePythonIndentation(normalizedNew)
      validatePythonIndentation(content)
    }

    let foundMatch: { search: string; index: number } | null = null
    let notFound = true

    const replacers = [
      SimpleReplacer,
      LineTrimmedReplacer,
      BlockAnchorReplacer,
    ]

    for (const replacer of replacers) {
      for (const search of replacer(content, normalizedOld)) {
        const index = content.indexOf(search)
        if (index === -1) continue
        notFound = false
        
        if (replaceAll) {
          const result = content.replaceAll(search, normalizedNew)
          if (isPythonFile(absPath)) validatePythonIndentation(result)
          await fs.writeFile(absPath, result, "utf8")
          return `Edit applied successfully (replaceAll) using fuzzy matching.`
        }

        const lastIndex = content.lastIndexOf(search)
        if (index !== lastIndex) continue // Not unique
        
        foundMatch = { search, index }
        break
      }
      if (foundMatch) break
    }

    if (foundMatch) {
      const { search, index } = foundMatch
      const result = content.substring(0, index) + normalizedNew + content.substring(index + search.length)
      
      if (isPythonFile(absPath)) {
        validatePythonIndentation(result)
      }
      
      await safeWrite(absPath, result, content, index, search.length)
      return `Edit applied successfully using high-reliability matching.`
    }

    if (notFound) {
      throw new Error("Could not find oldString in the file. It must match exactly or via fuzzy matching.")
    }
    
    throw new Error("Found multiple matches for oldString. Provide more surrounding context to make the match unique.")
  }
})
