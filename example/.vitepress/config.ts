import { defineConfig } from 'vitepress'
import { AutoNav, legacyComparer } from '../../src'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  vite: {
    plugins: [AutoNav({ comparer: legacyComparer() })],
  },
})
