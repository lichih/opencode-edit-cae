import { tool } from "./plugin-tool.ts"
import { z } from "zod"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as crypto from "node:crypto"
import * as jsdiff from "diff"

// Use a more robust import check for bundled environments
const createPatch = (jsdiff.createTwoFilesPatch || (jsdiff as any).default?.createTwoFilesPatch || (() => "")) as any;
const diffLinesFunc = (jsdiff.diffLines || (jsdiff as any).default?.diffLines || (() => [])) as any;

// --- Constants & Types ---
const SIMILARITY_THRESHOLD = 0.8

export type Replacer = (content: string, find: string) => Generator<string, void, unknown>

// --- Helper Functions ---

/**
 * Normalizes line endings to \n
 */
export function normalize(str: string): string {
  if (typeof str !== "string") return ""
  return str.replace(/\r\n/g, "\n")
}

/**
 * Ported from reference/edit.ts to ensure clean diff output
 */
export function trimDiff(diff: any): string {
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

/**
 * Atomic write with tail validation and fsync
 */
async function safeWrite(filePath: string, content: string, originalContent: string, matchIndex: number, matchLength: number) {
  const tempPath = `${filePath}.${crypto.randomBytes(4).toString("hex")}.tmp`
  
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

export function getLineEnding(content: string): string {
  return content.includes("\r\n") ? "\r\n" : "\n"
}

// --- Replacers ---

export const SimpleReplacer: Replacer = function* (_content, find) {
  yield find
}

export const LineTrimmedReplacer: Replacer = function* (content, find) {
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

export const BlockAnchorReplacer: Replacer = function* (content, find) {
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
    
    const contentOld = await fs.readFile(absPath, "utf8")
    const normalizedOld = normalize(oldString)
    const normalizedNew = normalize(newString)

    if (isPythonFile(absPath)) {
      validatePythonIndentation(normalizedNew)
      validatePythonIndentation(contentOld)
    }

    let foundMatch: { search: string; index: number } | null = null
    let notFound = true

    const replacers = [
      SimpleReplacer,
      LineTrimmedReplacer,
      BlockAnchorReplacer,
    ]

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
          matchIndex = 0
          matchLength = contentOld.length
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
      
      // Generate Diff for UI and Metadata
      const rawPatch = createPatch(absPath, absPath, contentOld, contentNew);
      const diff = trimDiff(rawPatch);
      
      const diffResults = diffLinesFunc(contentOld, contentNew)
      const additions = diffResults.reduce((acc: number, c: any) => acc + (c.added ? (c.count || 0) : 0), 0)
      const deletions = diffResults.reduce((acc: number, c: any) => acc + (c.removed ? (c.count || 0) : 0), 0)

      // Mandatory platform ask for behavior consistency (TUI Diff Preview)
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

      // Send structured metadata via the context function
      context.metadata({
        title: path.relative(context.worktree, absPath),
        metadata: {
          diff,
          filediff: { file: absPath, before: contentOld, after: contentNew, additions, deletions }
        }
      });

      // BLACK MAGIC: Return JSON string for tool.execute.after hook to intercept
      return JSON.stringify({
        __is_opencode_patch__: true,
        diff,
        filediff: { file: absPath, before: contentOld, after: contentNew, additions, deletions },
        filename: path.basename(absPath),
        relativeities: path.relative(context.worktree, absPath)
      });
    }

    if (notFound) {
      throw new Error("Could not find oldString in the file. It must match exactly or via fuzzy matching.")
    }
    
    throw new Error("Found multiple matches for oldString. Provide more surrounding context to make the match unique.")
  }
})
