import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Override Key Collision Case',
  description: '验证 overrides key collision 与相对路径优先级',
  vite: {
    plugins: [
      AutoNav({
        include: ['guide/**/*.md', 'reference/**/*.md'],
        overrides: {
          basic: {
            displayName: '短名 basic',
          },
          'guide/basic': {
            displayName: 'Guide Basic',
          },
          'reference/basic': {
            displayName: 'Reference Basic',
          },
          intro: {
            displayName: '短名 Intro',
          },
          'guide/basic/intro': {
            displayName: 'Guide Intro',
          },
          'reference/basic/intro': {
            displayName: 'Reference Intro',
          },
        },
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('override-key-collision'),
    ],
  },
})
