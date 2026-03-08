import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Frontmatter Custom Case',
  description: 'frontmatter 自定义设置用例',
  vite: {
    plugins: [
      AutoNav({
        include: ['guide/**/*.md'],
        frontmatterKeyPrefix: 'nav',
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('frontmatter-custom'),
    ],
  },
})
