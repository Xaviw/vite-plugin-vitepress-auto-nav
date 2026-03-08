import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Frontmatter Default Fields Case',
  description: '默认 frontmatter 字段用例',
  vite: {
    plugins: [
      AutoNav({
        include: ['guide/**/*.md'],
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('frontmatter-default-fields'),
    ],
  },
})
