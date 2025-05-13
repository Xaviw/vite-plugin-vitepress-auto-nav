import { defineConfig } from 'vitepress'
import AutoNav from '../../src'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  vite: {
    plugins: [AutoNav()],
  },
})
