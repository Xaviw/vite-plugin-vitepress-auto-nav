import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Standalone Index True Case',
  description: 'standaloneIndex=true 用例',
  vite: {
    plugins: [
      AutoNav({
        include: ['guide/**/*.md'],
        standaloneIndex: true,
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('standalone-index-true'),
    ],
  },
})
