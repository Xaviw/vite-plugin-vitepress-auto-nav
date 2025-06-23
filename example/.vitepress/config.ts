import { defineConfig } from 'vitepress'
// import { autoNav } from '../../src'
// import { defaultComparer } from '../../src/comparer'
// import { defaultNavItemHandler, defaultSidebarItemHandler } from '../../src/handler'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  rewrites: {
    'zh/:rest*': ':rest*',
  },
  locales: {
    root: {
      label: '简体中文',
      themeConfig: {
        sidebar: {
          '1-3': [
            {
              text: '1-3-1',
              link: '/1-3/1-3-1',
            },
          ],
          '/': [
            {
              text: '1-2',
              link: '/1-2',
            },
            {
              text: '1-2-1',
              link: '/1-2/1-2-1',
            },
          ],
        },
      },
    },
    en: {
      label: 'English',
    },
  },
  vite: {
    plugins: [
      // autoNav({
      //   comparer: defaultComparer({
      //     config: {
      //       '**/1-2': 0,
      //     },
      //   }),
      //   sidebarItemHandler: defaultSidebarItemHandler({
      //     config: {
      //       '**/1-2/1-2-3': { collapsed: false },
      //     },
      //   }),
      //   navItemHandler: defaultNavItemHandler({
      //     config: {
      //       '**/1-4': { hide: true },
      //     },
      //     depth: 1,
      //   }),
      // }),
    ],
  },
})
