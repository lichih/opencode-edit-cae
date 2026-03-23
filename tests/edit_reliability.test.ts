import { describe, it, expect } from "bun:test"

//Similarity thresholds for block anchor fallback matching
const SINGLE_CANDIDATE_SIMILARITY_THRESHOLD = 0.0
const MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD = 0.3

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

type Replacer = (content: string, find: string) => Generator<string, void, unknown>

const SimpleReplacer: Replacer = function* (_content, find) {
  yield find
}

const LineTrimmedReplacer: Replacer = function* (content, find) {
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
      let matchStartIndex = originalLines.slice(0, i).join("\n").length + (i > 0 ? 1 : 0)
      let matchEndIndex = matchStartIndex + originalLines.slice(i, i + searchLines.length).join("\n").length
      yield content.substring(matchStartIndex, matchEndIndex)
    }
  }
}

const BlockAnchorReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n")
  const searchLines = find.split("\n")
  if (searchLines.length < 3) return
  if (searchLines[searchLines.length - 1] === "") searchLines.pop()
  const firstLineSearch = searchLines[0].trim()
  const lastLineSearch = searchLines[searchLines.length - 1].trim()
  const searchBlockSize = searchLines.length
  const candidates: Array<{ startLine: number; endLine: number }> = []
  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i].trim() !== firstLineSearch) continue
    for (let j = i + 2; j < originalLines.length; j++) {
      if (originalLines[j].trim() === lastLineSearch) {
        candidates.push({ startLine: i, endLine: j })
        break
      }
    }
  }
  if (candidates.length === 0) return
  if (candidates.length === 1) {
    const { startLine, endLine } = candidates[0]
    const actualBlockSize = endLine - startLine + 1
    let similarity = 0
    let linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2)
    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const originalLine = originalLines[startLine + j].trim()
        const searchLine = searchLines[j].trim()
        const maxLen = Math.max(originalLine.length, searchLine.length)
        if (maxLen === 0) continue
        const distance = levenshtein(originalLine, searchLine)
        similarity += (1 - distance / maxLen) / linesToCheck
      }
    } else similarity = 1.0
    if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) {
        let matchStartIndex = originalLines.slice(0, startLine).join("\n").length + (startLine > 0 ? 1 : 0)
        let matchEndIndex = matchStartIndex + originalLines.slice(startLine, endLine + 1).join("\n").length
        yield content.substring(matchStartIndex, matchEndIndex)
    }
    return
  }
  let bestMatch: { startLine: number; endLine: number } | null = null
  let maxSimilarity = -1
  for (const candidate of candidates) {
    const { startLine, endLine } = candidate
    const actualBlockSize = endLine - startLine + 1
    let similarity = 0
    let linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2)
    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const originalLine = originalLines[startLine + j].trim()
        const searchLine = searchLines[j].trim()
        const maxLen = Math.max(originalLine.length, searchLine.length)
        if (maxLen === 0) continue
        const distance = levenshtein(originalLine, searchLine)
        similarity += 1 - distance / maxLen
      }
      similarity /= linesToCheck
    } else similarity = 1.0
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity
      bestMatch = candidate
    }
  }
  if (maxSimilarity >= MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD && bestMatch) {
    const { startLine, endLine } = bestMatch
    let matchStartIndex = originalLines.slice(0, startLine).join("\n").length + (startLine > 0 ? 1 : 0)
    let matchEndIndex = matchStartIndex + originalLines.slice(startLine, endLine + 1).join("\n").length
    yield content.substring(matchStartIndex, matchEndIndex)
  }
}

function replace(content: string, oldString: string, newString: string, replaceAll = false): string {
  if (oldString === newString) throw new Error("No changes to apply")
  let notFound = true
  const replacers = [SimpleReplacer, LineTrimmedReplacer, BlockAnchorReplacer]
  for (const replacer of replacers) {
    for (const search of replacer(content, oldString)) {
      const index = content.indexOf(search)
      if (index === -1) continue
      notFound = false
      if (replaceAll) {
        return content.split(search).join(newString)
      }
      const lastIndex = content.lastIndexOf(search)
      if (index !== lastIndex) continue
      return content.substring(0, index) + newString + content.substring(index + search.length)
    }
  }
  if (notFound) throw new Error("Could not find oldString")
  throw new Error("Found multiple matches")
}

describe("EditTool Core Logic Reliability", () => {
  it("Exact Match should work like original", () => {
    const content = "const x = 1\nconst y = 2"
    expect(replace(content, "const x = 1", "const x = 100")).toBe("const x = 100\nconst y = 2")
  })

  it("Line Trimmed Match should handle indentation mismatches", () => {
    const content = "  function foo() {\n    return true\n  }"
    const find = "return true"
    const next = "return false"
    // Result should be: "  function foo() {\nreturn false\n  }" because we replaced the whole "    return true" line.
    expect(replace(content, find, next)).toBe("  function foo() {\nreturn false\n  }")
  })

  it("Block Anchor Match should handle minor content changes (Aider-style)", () => {
    const content = "import a\nimport b\nimport c\nimport d"
    const find = "import a\nimport XXX\nimport d"
    const next = "import a\nimport ZZZ\nimport d"
    expect(replace(content, find, next)).toBe("import a\nimport ZZZ\nimport d")
  })

  it("Should throw error on multiple matches to prevent accidental overwrites", () => {
    const content = "foo\nfoo\nfoo"
    expect(() => replace(content, "foo", "bar")).toThrow("Found multiple matches")
  })

  it("Should allow replaceAll when requested", () => {
    const content = "foo\nfoo\nfoo"
    expect(replace(content, "foo", "bar", true)).toBe("bar\nbar\nbar")
  })
})
