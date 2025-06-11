import { defineConfig } from 'vitepress'
import { autoNav } from '../../src'
import { defaultComparer } from '../../src/comparer'
import { defaultNavItemHandler, defaultSidebarItemHandler } from '../../src/handler'

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
        comparer: defaultComparer({
          config: {
            '**/1-2': 0,
          },
        }),
        sidebarItemHandler: defaultSidebarItemHandler({
          config: {
            '**/1-2/1-2-3': { collapsed: false },
          },
        }),
        navItemHandler: defaultNavItemHandler({
          config: {
            '**/1-4': { hide: true },
          },
          depth: 1,
        }),
      }),
    ],
  },
})
