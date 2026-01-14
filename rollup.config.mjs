import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/main.ts",
  output: [
    { file: "dist/luxn.umd.js", format: "umd", name: "luxn", sourcemap: true },
    { file: "dist/luxn.esm.js", format: "es", sourcemap: true },
    {
      file: "dist/luxn.min.js",
      format: "iife",
      name: "luxn",
      plugins: [terser()],
      sourcemap: true,
    },
  ],
  plugins: [typescript()],
};
