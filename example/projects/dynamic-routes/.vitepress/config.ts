import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Dynamic Routes Case',
  description: '动态路由用例',
  vite: {
    plugins: [
      AutoNav({
        include: '**/*.md',
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('dynamic-routes'),
    ],
  },
})
