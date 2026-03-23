export const Filesystem = {
  exists: async (path: string) => true,
  readText: async (path: string) => "",
  write: async (path: string, content: string) => {},
  stat: (path: string) => ({ isDirectory: () => false }),
  normalizePath: (path: string) => path
};
