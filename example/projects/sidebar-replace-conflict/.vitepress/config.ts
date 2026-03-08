import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Sidebar Replace Conflict Case',
  description: 'sidebar replace 冲突用例',
  themeConfig: {
    sidebar: {
      '/guide/': [{ text: 'Manual Guide', link: '/guide/manual-entry' }],
      '/manual/': [{ text: 'Manual Keep', link: '/manual/' }],
    },
  },
  vite: {
    plugins: [
      AutoNav({
        include: ['guide/**/*.md'],
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('sidebar-replace-conflict'),
    ],
  },
})
