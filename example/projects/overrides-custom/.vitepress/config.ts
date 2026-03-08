import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Overrides Custom Case',
  description: 'overrides 自定义设置用例',
  vite: {
    plugins: [
      AutoNav({
        include: ['guide/**/*.md'],
        overrides: {
          guide: {
            displayName: '指南导航',
          },
          'guide/basic': {
            displayName: '基础目录',
            collapsed: true,
          },
          'guide/basic/alpha': {
            preferArticleTitle: true,
          },
          'guide/basic/hidden': {
            visible: false,
          },
        },
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('overrides-custom'),
    ],
  },
})
