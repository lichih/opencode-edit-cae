import { mock } from "bun:test"
export const FileTime = {
  withLock: async (p: string, fn: any) => await fn(),
  assert: async () => {},
  read: mock(() => {})
};
