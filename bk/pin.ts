import { z } from "zod"
import { Tool } from "./tool"
import { Session } from "../session"
import { Filesystem } from "../util/filesystem"

export const PinReadsTool = Tool.define("pin-reads", {
  description: "Pin a list of files to the context for continuous monitoring and as a safety prerequisite for the 'edit' tool. This ensures the model has a full, up-to-date view of the file before modification. Use an empty array to unpin all files.",
  parameters: z.object({
    paths: z.array(z.string()).describe("Absolute paths of files to pin."),
  }),
  execute: async (args, ctx) => {
    const session = await Session.get(ctx.sessionID)
    const metadata = (session as any).metadata ?? {}
    const pinnedFiles = (metadata.pinnedFiles as Record<string, any>) ?? {}

    if (args.paths.length === 0) {
      delete metadata.pinnedFiles
      await (Session as any).updateMetadata({ sessionID: ctx.sessionID, metadata })
      return {
        title: "Pin Reads",
        metadata: { pinnedCount: 0 },
        output: "All files unpinned.",
      }
    }

    const results: string[] = []
    const now = Date.now()
    
    for (const path of args.paths) {
      if (!(await Filesystem.exists(path))) {
        results.push(`Error: File ${path} does not exist.`)
        continue
      }
      
      const content = await Filesystem.readText(path)
      const hash = Bun.hash(content).toString()
      
      pinnedFiles[path] = {
        path,
        hash,
        lastAccessTime: now,
      }
      results.push(`Pinned: ${path}`)
    }

    const entries = Object.entries(pinnedFiles)
    if (entries.length > 100) {
      entries.sort((a, b) => (a[1].lastAccessTime || 0) - (b[1].lastAccessTime || 0))
      const toRemove = entries.slice(0, entries.length - 100)
      for (const [key] of toRemove) {
        delete pinnedFiles[key]
      }
    }

    metadata.pinnedFiles = pinnedFiles
    await (Session as any).updateMetadata({ sessionID: ctx.sessionID, metadata })
    return {
      title: "Pin Reads",
      metadata: { pinnedCount: Object.keys(pinnedFiles).length },
      output: results.join("\n"),
    }
  },
})
