import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Routing Static Rewrites Case',
  description: '静态 rewrites 用例',
  rewrites: {
    'packages/pkg-a/src/pkg-a-docs.md': 'packages-docs/pkg-a/index.md',
    'packages/pkg-b/src/pkg-b-docs.md': 'packages-docs/pkg-b/index.md',
  },
  vite: {
    plugins: [
      AutoNav({
        include: '**/*.md',
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('routing-static-rewrites'),
    ],
  },
})
