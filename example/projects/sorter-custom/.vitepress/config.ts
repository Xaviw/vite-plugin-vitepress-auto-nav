import { defineConfig } from 'vitepress'
import type { Item } from '../../../../src/types/public'
import AutoNav from '../../../../src/index'
import { autoNavTestProbePlugin } from '../../../../tests/support/plugins/autoNavTestProbe'

function customSorter(a: Item, b: Item) {
  const orderA =
    typeof a.options.order === 'number' ? a.options.order : undefined
  const orderB =
    typeof b.options.order === 'number' ? b.options.order : undefined

  if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
    return orderA - orderB
  }
  if (orderA !== undefined) return -1
  if (orderB !== undefined) return 1

  if (a.isFolder !== b.isFolder) {
    return a.isFolder ? 1 : -1
  }

  return b.name.localeCompare(a.name, 'zh-CN')
}

export default defineConfig({
  lang: 'zh-CN',
  title: 'Sorter Custom Case',
  description: '自定义 sorter 用例',
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
        include: ['guide/**/*.md', 'fr/guide/**/*.md'],
        sorter: customSorter,
        dev: {
          logLevel: 'silent',
        },
      }),
      autoNavTestProbePlugin('sorter-custom'),
    ],
  },
})
