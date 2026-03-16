import { edit_cae } from "./edit_cae.ts"

/**
 * Edit CAE Plugin Entry Point
 * Implements a "Black Magic" hook to bypass Opencode's metadata erasure.
 */
export const EditCaePlugin = async () => {
  return {
    tool: {
      edit_cae
    },
    hooks: {
      "tool.execute.after": async (input: any, output: any) => {
        if (input.tool === "edit_cae") {
          try {
            // Attempt to parse the JSON packet returned by edit_cae.execute
            const data = JSON.parse(output.output);
            
            if (data && data.__is_opencode_patch__) {
              // RE-INJECT METADATA: This bypasses the registry.ts:fromPlugin wrapper's erasure
              output.metadata = {
                ...output.metadata,
                diff: data.diff,
                filediff: data.filediff,
                title: data.relativeities || data.filename
              };
              
              // RESTORE USER-FRIENDLY OUTPUT: Don't let the LLM or user see the JSON
              output.output = `Edit applied successfully using high-reliability matching. [CAE-INTEGRATED]`;
              
              // Sync title if supported
              if (data.relativeities) {
                output.title = data.relativeities;
              }
            }
          } catch (e) {
            // If it's not JSON (e.g. an error message string), leave it alone
          }
        }
      }
    }
  }
}

export default EditCaePlugin
