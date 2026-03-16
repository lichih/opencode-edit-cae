import { edit_cae } from "./edit_cae.ts"

/**
 * Edit CAE Plugin Entry Point
 * Implements an "Override Protocol" to bypass Opencode's metadata erasure.
 */
export const EditCaePlugin = async () => {
  return {
    tool: {
      edit_cae
    },
    // Direct hook property to intercept tool execution results
    "tool.execute.after": async (input: any, output: any) => {
      if (input.tool === "edit_cae") {
        const rawOutput = output.output || "";
        
        // Look for the specific delimiters
        const startMarker = "<<<CAE_DATA_START>>>";
        const endMarker = "<<<CAE_DATA_END>>>";
        
        const startIndex = rawOutput.indexOf(startMarker);
        const endIndex = rawOutput.indexOf(endMarker);
        
        if (startIndex !== -1 && endIndex !== -1) {
          try {
            // Extract the hidden JSON packet
            const jsonStr = rawOutput.substring(startIndex + startMarker.length, endIndex);
            const data = JSON.parse(jsonStr);
            
            if (data && data.__is_opencode_patch__) {
              // OVERRIDE METADATA: Complete replacement to avoid erasure issues
              output.metadata = {
                ...output.metadata,
                diff: data.diff,
                filediff: data.filediff,
                // Top-level stats for compatibility
                additions: data.filediff.additions,
                deletions: data.filediff.deletions,
                kind: "diff.v1" // Hint for TUI rendering
              };
              
              // Set the title which is often required for Side-by-Side rendering
              output.title = data.relativeities || data.filename;
              
              // CLEANUP: Remove the JSON blob from the user-visible output
              const cleanOutput = rawOutput.substring(0, startIndex).trim();
              output.output = cleanOutput || "✅ Edit applied successfully (Aider-style CAE).";
              
              console.log(`[CAE-HOOK] Successfully re-injected metadata for ${output.title}`);
            }
          } catch (e) {
            console.error(`[CAE-HOOK] Failed to parse CAE packet: ${e}`);
          }
        }
      }
    }
  }
}

export default EditCaePlugin
