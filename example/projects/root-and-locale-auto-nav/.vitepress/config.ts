import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Root And Locale Auto Nav Case',
  description: 'root 与 locale 同时自动生成 nav/sidebar',
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
    },
    fr: {
      label: 'Français',
      lang: 'fr-FR',
      link: '/fr/',
    },
    ja: {
      label: '日本語',
      lang: 'ja-JP',
      link: '/ja/',
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
      autoNavTestProbePlugin('root-and-locale-auto-nav'),
    ],
  },
})
