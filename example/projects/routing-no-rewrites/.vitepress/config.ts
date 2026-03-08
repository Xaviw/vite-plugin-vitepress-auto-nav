import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Routing No Rewrites Case',
  description: '无 rewrites 用例',
  vite: {
    plugins: [
      AutoNav({
        include: '**/*.md',
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('routing-no-rewrites'),
    ],
  },
})
