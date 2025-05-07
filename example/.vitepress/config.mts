import { defineConfig } from 'vitepress'
import AutoNav from '../../src'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcExclude: ['**/c.md'],
  vite: {
    plugins: [AutoNav({ a: 1 })],
  },
})
