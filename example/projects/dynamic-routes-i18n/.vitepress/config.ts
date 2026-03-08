import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Dynamic Routes I18n Case',
  description: '动态路由与 i18n 组合',
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
        include: ['blog/**/*.md', 'fr/blog/**/*.md'],
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('dynamic-routes-i18n'),
    ],
  },
})
