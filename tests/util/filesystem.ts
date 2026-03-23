export const Filesystem = { 
  exists: async () => true, 
  readText: async () => "", 
  write: async () => {}, 
  stat: () => ({ isDirectory: () => false }),
  normalizePath: (p: string) => p
};
