import z from "zod";
export const Tool = {
  define: (name: string, def: any) => ({ name, ...def })
};
