import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Output Preserve Case',
  description: 'output=preserve 用例',
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
    },
    fr: {
      label: 'Français',
      lang: 'fr-FR',
      link: '/fr/',
      themeConfig: {
        nav: [{ text: 'Manual FR', link: '/fr/manual/' }],
        sidebar: {
          '/fr/manual/': [{ text: 'Manual FR Intro', link: '/fr/manual/' }],
        },
      },
    },
  },
  themeConfig: {
    nav: [{ text: 'Manual Root', link: '/manual-root/' }],
    sidebar: {
      '/manual-root/': [{ text: 'Manual Root Intro', link: '/manual-root/' }],
    },
    i18nRouting: true,
  },
  vite: {
    plugins: [
      AutoNav({
        include: ['guide/**/*.md', 'fr/index.md', 'fr/guide/**/*.md'],
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('output-preserve'),
    ],
  },
})
