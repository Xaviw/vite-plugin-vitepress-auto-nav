import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Hidden Pages Still Build Case',
  description: '隐藏页面仍保留在 VitePress runtime pages 中的用例',
  vite: {
    plugins: [
      AutoNav({
        include: ['guide/**/*.md'],
        exclude: ['guide/internal/**'],
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('hidden-pages-still-build'),
    ],
  },
})
