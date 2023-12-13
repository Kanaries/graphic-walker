import { defineConfig } from "vite";
import typescript from "@rollup/plugin-typescript";
import path from "path";

export default defineConfig({
  plugins: [
    {
      ...typescript({
        tsconfig: path.resolve(__dirname, "./tsconfig.json"),
      }),
      apply: "build",
    },
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "./src/index.ts"),
      name: "DuckdbComputation",
      formats: ["es", "cjs"],
    },
    minify: "esbuild",
    sourcemap: true,
  },
});
