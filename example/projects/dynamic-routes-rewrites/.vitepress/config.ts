import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Dynamic Routes Rewrites Case',
  description: '动态路由与 rewrites 组合',
  rewrites: {
    'packages/alpha/docs/overview.md': 'packages-runtime/alpha/overview.md',
    'packages/beta/docs/install.md': 'packages-runtime/beta/install.md',
  },
  vite: {
    plugins: [
      AutoNav({
        include: ['packages/**/*.md'],
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('dynamic-routes-rewrites'),
    ],
  },
})
