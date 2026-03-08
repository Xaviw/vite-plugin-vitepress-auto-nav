import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Routing Param Rewrites Case',
  description: '参数 rewrites 用例',
  rewrites: {
    'packages/:pkg/src/index.md': 'packages-param/:pkg/index.md',
  },
  vite: {
    plugins: [
      AutoNav({
        include: '**/*.md',
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('routing-param-rewrites'),
    ],
  },
})
