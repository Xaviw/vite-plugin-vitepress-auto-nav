import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Top Level Multi Sections Case',
  description: '多个顶层 section 与根级页面并存',
  vite: {
    plugins: [
      AutoNav({
        include: ['guide/**/*.md', 'api/**/*.md', 'overview.md'],
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('top-level-multi-sections'),
    ],
  },
})
