import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Root Auto Locale Manual Case',
  description: 'root 自动生成 nav/sidebar，locale 手写 nav',
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
      },
    },
    ja: {
      label: '日本語',
      lang: 'ja-JP',
      link: '/ja/',
      themeConfig: {
        nav: [{ text: 'Manual JA', link: '/ja/manual/' }],
      },
    },
  },
  themeConfig: {
    i18nRouting: true,
  },
  vite: {
    plugins: [
      AutoNav({
        include: ['guide/**/*.md', 'fr/guide/**/*.md', 'ja/guide/**/*.md'],
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('root-auto-locale-manual'),
    ],
  },
})
