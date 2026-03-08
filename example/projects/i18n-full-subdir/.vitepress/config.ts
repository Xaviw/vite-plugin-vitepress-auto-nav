import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'I18n Full Subdir Case',
  description: '全语言子目录 i18n 用例',
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
        include: ['fr/**/*.md', 'ja/**/*.md'],
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('i18n-full-subdir'),
    ],
  },
})
