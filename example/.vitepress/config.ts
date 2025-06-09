import { defineConfig } from 'vitepress'
import { autoNav } from '../../src'
import { comparer } from '../../src/comparer'
import { navItemHandler, sidebarItemHandler } from '../../src/handler'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  rewrites: {
    'zh/:rest*': ':rest*',
    'en/:path?/1-2-3/:any': 'en/test/:any',
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
      autoNav({
        comparer: comparer({
          config: {
            '**/1-2': 0,
          },
        }),
        sidebarItemHandler: sidebarItemHandler({
          config: {
            '**/1-2/1-2-3': { collapsed: false },
          },
        }),
        navItemHandler: navItemHandler({
          config: {
            '**/1-4': { hide: true },
          },
          depth: 1,
        }),
      }),
    ],
  },
})
