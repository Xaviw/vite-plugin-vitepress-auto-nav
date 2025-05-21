import { defineConfig } from 'vitepress'
import { AutoNav } from '../../src'
import { comparer } from '../../src/comparer'
import { navItemHandler, sidebarItemHandler } from '../../src/handler'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  rewrites: {
    'zh/:rest*': ':rest*',
    ':path?/1-2/1-2-3/:any': 'test/:any',
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
        comparer: comparer({
          config: {
            '**/1-2': 0,
          },
        }),
        sidebarItemHandler: sidebarItemHandler(
          {
            '**/1-2/1-2-3': { collapsed: false },
          },
        ),
        navItemHandler: navItemHandler(
          {
            '**/1-4': { hide: true },
          },
          undefined,
          1,
        ),
      }),
    ],
  },
})
