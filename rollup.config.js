import nodeResolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import { dts } from 'rollup-plugin-dts'
import typescript from 'rollup-plugin-typescript2'

export default defineConfig([
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.mjs',
      format: 'es',
    },
    plugins: [typescript(), nodeResolve()],
    external: ['vite', 'vitepress', 'front-matter', 'minimatch'],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
])
