import { defineConfig } from 'vitepress'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Complex Combo Multi-Level Case',
  description: '复杂配置组合与多层路径用例',
  rewrites: {
    'packages/core/alpha/docs/index.md': 'reference/core/alpha/index.md',
    'packages/core/alpha/docs/overview.md': 'reference/core/alpha/overview.md',
    'packages/core/alpha/docs/deep/getting-started.md':
      'reference/core/alpha/deep/getting-started.md',
    'fr/packages/core/alpha/docs/index.md': 'fr/reference/core/alpha/index.md',
    'fr/packages/core/alpha/docs/overview.md':
      'fr/reference/core/alpha/overview.md',
    'fr/packages/core/alpha/docs/deep/getting-started.md':
      'fr/reference/core/alpha/deep/getting-started.md',
  },
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
    },
    fr: {
      label: 'Français',
      lang: 'fr-FR',
      link: '/fr/',
    },
  },
  themeConfig: {
    i18nRouting: true,
  },
  vite: {
    plugins: [
      AutoNav({
        include: ['packages/**/*.md', 'fr/packages/**/*.md'],
        exclude: ['**/draft.md'],
        frontmatterKeyPrefix: 'nav',
        overrides: {
          reference: {
            displayName: '参考中心',
          },
          'reference/core': {
            displayName: '核心分组',
          },
          'reference/core/alpha': {
            displayName: 'Alpha 模块',
            collapsed: true,
          },
          'fr/reference': {
            displayName: 'Référence',
          },
          'fr/reference/core/alpha': {
            displayName: 'Alpha FR',
            collapsed: true,
          },
        },
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('complex-combo-multi-level'),
    ],
  },
})
