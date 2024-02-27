import typescript from "rollup-plugin-typescript2";
import terser from "@rollup/plugin-terser";
import nodeResolve from "@rollup/plugin-node-resolve";

export default {
  input: "./src/index.ts",
  output: {
    file: "./dist/index.mjs",
    format: "esm",
  },
  plugins: [typescript(), nodeResolve(), terser()],
  external: ["fast-glob", "gray-matter"],
};
