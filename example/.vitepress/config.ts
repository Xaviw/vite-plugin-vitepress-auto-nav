import { defineConfig } from 'vitepress'
import { AutoNav, classicComparer, classicSidebarItemHandler } from '../../src'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  rewrites: {
    '1-2/1-2-3/:any': 'test/:any',
  },
  locales: {
    root: {
      label: '简体中文',
    },
    en: {
      label: 'English',
    },
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
