import { edit_cae } from "./edit_cae.ts"

/**
 * Edit CAE Plugin Entry Point
 * Provides the high-reliability edit_cae tool.
 */
export const EditCaePlugin = async () => {
  return {
    tool: {
      edit_cae
    }
  };
}

export default EditCaePlugin;
