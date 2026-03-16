import { edit_cae } from "./edit_cae.ts"

/**
 * Edit CAE Plugin Entry Point
 * Automatically registers the edit_cae tool in Opencode.
 */
export const EditCaePlugin = async () => {
  return {
    tool: {
      edit_cae
    }
  }
}

export default EditCaePlugin
