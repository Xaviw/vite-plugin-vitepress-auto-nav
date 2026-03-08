import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Exclude Only Case',
  description: '仅验证 exclude 行为',
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
  },
  themeConfig: {
    i18nRouting: true,
  },
  vite: {
    plugins: [
      AutoNav({
        include: ['guide/**/*.md', 'fr/guide/**/*.md'],
        exclude: ['**/private/**'],
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('exclude-only'),
    ],
  },
})
