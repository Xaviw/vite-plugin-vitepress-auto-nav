import typescript from "rollup-plugin-typescript2";
import terser from "@rollup/plugin-terser";

export default {
  input: "./src/index.ts",
  output: {
    file: "./dist/index.mjs",
    format: "esm",
  },
  plugins: [typescript(), terser()],
};
