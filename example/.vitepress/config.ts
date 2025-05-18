import { defineConfig } from 'vitepress'
import { AutoNav, classicComparer, classicSidebarItemHandler } from '../../src'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  rewrites: {
    '1-4/:any': 'test1/test2/:any',
  },
  vite: {
    plugins: [
      AutoNav({
        comparer: classicComparer(),
        sidebarItemHandler: classicSidebarItemHandler(),
      }),
    ],
  },
})
