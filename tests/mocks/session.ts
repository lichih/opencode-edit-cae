export const Session = {
  get: async (id: string) => ({ metadata: {} }),
  updateMetadata: async (data: any) => {}
};

export const InstructionPrompt = {
  resolve: async (messages: any[], filepath: string, messageID: string) => {
    // Return a mock instruction if the filename contains 'instruct'
    if (filepath.includes("instruct")) {
      return [{ content: "Mock Instruction", filepath }];
    }
    return [];
  }
};
