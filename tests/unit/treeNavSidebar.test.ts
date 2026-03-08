import { describe, expect, it } from 'vitest'
import { buildNavByLocale } from '../../src/core/navBuilder'
import { buildSidebarByLocale } from '../../src/core/sidebarBuilder'
import { buildLocaleTree } from '../../src/core/treeBuilder'
import type { LocaleTree, PageContentMeta } from '../../src/types/model'

function createPage(
  input: Partial<PageContentMeta> & {
    rewrittenPage: string
    routePath: string
    sourcePage: string
    localeKey: string
    sourceOrder: number
    displayText: string
  }
): PageContentMeta {
  return {
    sourcePage: input.sourcePage,
    resolvedPage: input.rewrittenPage,
    rewrittenPage: input.rewrittenPage,
    localeKey: input.localeKey,
    routePath: input.routePath,
    sourceOrder: input.sourceOrder,
    absolutePath: `/repo/example/${input.rewrittenPage}`,
    frontmatter: {},
    itemMeta: {
      visible: true,
      preferArticleTitle: false,
    },
    displayText: input.displayText,
    ...input,
  }
}

describe('tree/nav/sidebar builders', () => {
  it('T204: standaloneIndex=false 时 index 提升为目录链接', () => {
    const pages: PageContentMeta[] = [
      createPage({
        rewrittenPage: 'guide/index.md',
        routePath: '/guide/',
        sourcePage: 'guide/index.md',
        localeKey: 'root',
        sourceOrder: 1,
        displayText: 'Guide',
      }),
      createPage({
        rewrittenPage: 'guide/getting-started.md',
        routePath: '/guide/getting-started',
        sourcePage: 'guide/getting-started.md',
        localeKey: 'root',
        sourceOrder: 2,
        displayText: 'Getting Started',
      }),
    ]

    const treeResult = buildLocaleTree(pages, {
      standaloneIndex: false,
    })
    const rootTree = treeResult.tree.root
    const guideNode = rootTree.find((item) => item.name === 'guide')
    expect(guideNode?.isFolder).toBe(true)
    expect(guideNode?.sourcePagePath).toBe('guide/index.md')
    expect(guideNode?.children).toHaveLength(1)
  })

  it('T204: standaloneIndex=true 时 index 作为独立页面保留', () => {
    const pages: PageContentMeta[] = [
      createPage({
        rewrittenPage: 'guide/index.md',
        routePath: '/guide/',
        sourcePage: 'guide/index.md',
        localeKey: 'root',
        sourceOrder: 1,
        displayText: 'Guide Index',
      }),
      createPage({
        rewrittenPage: 'guide/getting-started.md',
        routePath: '/guide/getting-started',
        sourcePage: 'guide/getting-started.md',
        localeKey: 'root',
        sourceOrder: 2,
        displayText: 'Getting Started',
      }),
    ]

    const treeResult = buildLocaleTree(pages, {
      standaloneIndex: true,
    })
    const guideNode = treeResult.tree.root.find((item) => item.name === 'guide')

    expect(guideNode?.sourcePagePath).toBeUndefined()
    expect(guideNode?.children.some((item) => item.isIndexPage)).toBe(true)
    expect(guideNode?.children).toHaveLength(2)
  })

  it('T205: 默认 sorter 与自定义 sorter 链路可控', () => {
    const pages: PageContentMeta[] = [
      createPage({
        rewrittenPage: 'guide/a.md',
        routePath: '/guide/a',
        sourcePage: 'guide/a.md',
        localeKey: 'root',
        sourceOrder: 2,
        displayText: 'A',
        frontmatter: { order: 10 },
      }),
      createPage({
        rewrittenPage: 'guide/b.md',
        routePath: '/guide/b',
        sourcePage: 'guide/b.md',
        localeKey: 'root',
        sourceOrder: 1,
        displayText: 'B',
        frontmatter: { order: 1 },
      }),
    ]

    const byDefault = buildLocaleTree(pages, {
      standaloneIndex: true,
    })
    const guide = byDefault.tree.root.find((item) => item.name === 'guide')
    expect(guide?.children.map((item) => item.name)).toEqual(['b.md', 'a.md'])

    const byCustomSorter = buildLocaleTree(pages, {
      standaloneIndex: true,
      sorter: () => 0,
    })
    const guideWithCustom = byCustomSorter.tree.root.find(
      (item) => item.name === 'guide'
    )
    expect(guideWithCustom?.children.map((item) => item.name)).toEqual([
      'b.md',
      'a.md',
    ])

    const byThrowingSorter = buildLocaleTree(pages, {
      standaloneIndex: true,
      sorter: () => {
        throw new Error('broken sorter')
      },
    })
    const guideWithThrowing = byThrowingSorter.tree.root.find(
      (item) => item.name === 'guide'
    )
    expect(guideWithThrowing?.children.map((item) => item.name)).toEqual([
      'b.md',
      'a.md',
    ])
  })

  it('忽略无效 folder displayName overrides，并在 locale 前缀不匹配时仍按归一化路径解析', () => {
    const pages: PageContentMeta[] = [
      createPage({
        rewrittenPage: 'guide/index.md',
        routePath: '/fr/guide/',
        sourcePage: 'guide/index.md',
        localeKey: 'fr',
        sourceOrder: 1,
        displayText: 'Guide FR',
      }),
    ]

    const treeResult = buildLocaleTree(pages, {
      standaloneIndex: false,
      overrides: {
        '': { displayName: 'Ignored Empty Key' },
        guide: { displayName: 1 as unknown as string },
        basic: { displayName: '   ' },
        'fr/guide': { displayName: 'Guide FR Override' },
      },
    })

    const guideNode = treeResult.tree.fr.find((item) => item.name === 'guide')
    expect(guideNode?.text).toBe('Guide FR Override')
    expect(guideNode?.sourcePagePath).toBe('guide/index.md')
  })

  it('T206: 生成多 locale 的 nav/sidebar，支持去重与 collapsed', () => {
    const pages: PageContentMeta[] = [
      createPage({
        rewrittenPage: 'README.md',
        routePath: '/README',
        sourcePage: 'README.md',
        localeKey: 'root',
        sourceOrder: 1,
        displayText: 'README',
      }),
      createPage({
        rewrittenPage: 'guide/index.md',
        routePath: '/guide/',
        sourcePage: 'guide/index.md',
        localeKey: 'root',
        sourceOrder: 2,
        displayText: 'Guide',
        itemMeta: {
          visible: true,
          preferArticleTitle: false,
          collapsed: true,
        },
      }),
      createPage({
        rewrittenPage: 'guide/getting-started.md',
        routePath: '/guide/getting-started',
        sourcePage: 'guide/getting-started.md',
        localeKey: 'root',
        sourceOrder: 3,
        displayText: 'Getting Started',
      }),
      createPage({
        rewrittenPage: 'guide/advanced/index.md',
        routePath: '/guide/advanced/',
        sourcePage: 'guide/advanced/index.md',
        localeKey: 'root',
        sourceOrder: 4,
        displayText: 'Advanced',
        itemMeta: {
          visible: true,
          preferArticleTitle: false,
          collapsed: true,
        },
      }),
      createPage({
        rewrittenPage: 'guide/advanced/topic.md',
        routePath: '/guide/advanced/topic',
        sourcePage: 'guide/advanced/topic.md',
        localeKey: 'root',
        sourceOrder: 5,
        displayText: 'Topic',
      }),
      createPage({
        rewrittenPage: 'zh/guide/index.md',
        routePath: '/zh/guide/',
        sourcePage: 'zh/guide/index.md',
        localeKey: 'zh',
        sourceOrder: 1,
        displayText: '指南',
      }),
      createPage({
        rewrittenPage: 'zh/guide/intro.md',
        routePath: '/zh/guide/intro',
        sourcePage: 'zh/guide/intro.md',
        localeKey: 'zh',
        sourceOrder: 2,
        displayText: '简介',
      }),
    ]

    const treeResult = buildLocaleTree(pages, {
      standaloneIndex: false,
    })

    const navResult = buildNavByLocale(treeResult.tree)
    const rootNavLinks = navResult.navByLocale.root.map((item) => item.link)
    expect(rootNavLinks).toContain('/README')
    expect(rootNavLinks).toContain('/guide/')
    expect(navResult.navByLocale.zh.map((item) => item.link)).toContain(
      '/zh/guide/'
    )
    expect(new Set(rootNavLinks).size).toBe(rootNavLinks.length)

    const sidebarResult = buildSidebarByLocale(treeResult.tree)
    const guideSection = sidebarResult.sidebarByLocale.root['/guide/']
    expect(Array.isArray(guideSection)).toBe(true)
    expect(guideSection).toHaveLength(2)
    expect(guideSection?.[1].collapsed).toBe(true)
    expect(sidebarResult.sidebarByLocale.zh['/zh/guide/']).toEqual([
      {
        text: '简介',
        link: '/zh/guide/intro',
      },
    ])
  })

  it('nav 目录项默认使用目录名，且支持 overrides.displayName 重命名', () => {
    const pages: PageContentMeta[] = [
      createPage({
        rewrittenPage: 'guide/index.md',
        routePath: '/guide/',
        sourcePage: 'guide/index.md',
        localeKey: 'root',
        sourceOrder: 1,
        displayText: 'index',
      }),
      createPage({
        rewrittenPage: 'guide/basic/index.md',
        routePath: '/guide/basic/',
        sourcePage: 'guide/basic/index.md',
        localeKey: 'root',
        sourceOrder: 2,
        displayText: 'index',
      }),
      createPage({
        rewrittenPage: 'docs/intro.md',
        routePath: '/docs/intro',
        sourcePage: 'docs/intro.md',
        localeKey: 'root',
        sourceOrder: 3,
        displayText: 'Intro',
      }),
    ]

    const defaultTree = buildLocaleTree(pages, {
      standaloneIndex: false,
    })
    const defaultNav = buildNavByLocale(defaultTree.tree).navByLocale.root
    expect(defaultNav).toEqual([
      { text: 'guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'docs', link: '/docs/intro', activeMatch: '/docs/' },
    ])

    const renamedTree = buildLocaleTree(pages, {
      standaloneIndex: false,
      overrides: {
        guide: { displayName: '指南' },
        'guide/basic': { displayName: '基础' },
        docs: { displayName: '文档' },
      },
    })
    const renamedNav = buildNavByLocale(renamedTree.tree).navByLocale.root
    expect(renamedNav).toEqual([
      { text: '指南', link: '/guide/', activeMatch: '/guide/' },
      { text: '文档', link: '/docs/intro', activeMatch: '/docs/' },
    ])

    const guideSection = buildSidebarByLocale(renamedTree.tree).sidebarByLocale
      .root['/guide/']
    expect(guideSection).toEqual([
      {
        text: '基础',
        items: [],
        link: '/guide/basic/',
      },
    ])
  })

  it('nav 会跳过无可用链接的空目录节点', () => {
    const tree: LocaleTree = {
      root: [
        {
          name: 'empty',
          text: 'Empty',
          isFolder: true,
          localeKey: 'root',
          routePath: '/empty/',
          children: [],
        },
      ],
    }

    const navResult = buildNavByLocale(tree)
    expect(navResult.navByLocale.root).toEqual([])
  })

  it('nav 会按 link 去重', () => {
    const tree: LocaleTree = {
      root: [
        {
          name: 'a',
          text: 'A',
          isFolder: false,
          localeKey: 'root',
          routePath: '/same/',
          children: [],
        },
        {
          name: 'b',
          text: 'B',
          isFolder: false,
          localeKey: 'root',
          routePath: '/same/',
          children: [],
        },
      ],
    }

    const navResult = buildNavByLocale(tree)
    expect(navResult.navByLocale.root).toHaveLength(1)
    expect(navResult.navByLocale.root[0].link).toBe('/same/')
  })

  it('sidebar 在同 section key 下会追加合并 items', () => {
    const tree: LocaleTree = {
      root: [
        {
          name: 'guide-a',
          text: 'Guide A',
          isFolder: true,
          localeKey: 'root',
          routePath: '/guide/',
          children: [
            {
              name: 'a.md',
              text: 'A',
              isFolder: false,
              localeKey: 'root',
              routePath: '/guide/a',
              children: [],
            },
          ],
        },
        {
          name: 'guide-b',
          text: 'Guide B',
          isFolder: true,
          localeKey: 'root',
          routePath: '/guide/',
          children: [
            {
              name: 'b.md',
              text: 'B',
              isFolder: false,
              localeKey: 'root',
              routePath: '/guide/b',
              children: [],
            },
          ],
        },
      ],
    }

    const sidebarResult = buildSidebarByLocale(tree)
    expect(sidebarResult.sidebarByLocale.root['/guide/']).toEqual([
      { text: 'A', link: '/guide/a' },
      { text: 'B', link: '/guide/b' },
    ])
  })

  it('同目录节点可处理 sourceOrder 缺失到存在的补齐分支', () => {
    const pages = [
      createPage({
        rewrittenPage: 'guide/first.md',
        routePath: '/guide/first',
        sourcePage: 'guide/first.md',
        localeKey: 'root',
        sourceOrder: undefined as unknown as number,
        displayText: 'First',
      }),
      createPage({
        rewrittenPage: 'guide/second.md',
        routePath: '/guide/second',
        sourcePage: 'guide/second.md',
        localeKey: 'root',
        sourceOrder: 2,
        displayText: 'Second',
      }),
    ]

    const tree = buildLocaleTree(pages, { standaloneIndex: true })
    const guide = tree.tree.root.find((node) => node.name === 'guide')
    expect(guide?.sourceOrder).toBe(2)
  })

  it('可过滤不可见页面并对空 localeKey 回退到 root', () => {
    const pages: PageContentMeta[] = [
      createPage({
        rewrittenPage: 'visible.md',
        routePath: '/visible',
        sourcePage: 'visible.md',
        localeKey: '',
        sourceOrder: 1,
        displayText: 'Visible',
      }),
      createPage({
        rewrittenPage: '',
        routePath: '/empty/',
        sourcePage: 'guide/hidden.md',
        localeKey: '',
        sourceOrder: 2,
        displayText: 'Hidden',
        itemMeta: {
          visible: false,
          preferArticleTitle: false,
        },
      }),
    ]

    const result = buildLocaleTree(pages, {
      standaloneIndex: true,
      sorter: () => Number.NaN,
    })
    expect(result.tree.root.some((item) => item.text === 'Visible')).toBe(true)
    expect(result.tree.root.some((item) => item.text === 'Hidden')).toBe(false)
  })

  it('sorter 分支覆盖：custom 非零优先、fallback tie-break 与空 frontmatter 兜底', () => {
    const pages: PageContentMeta[] = [
      createPage({
        rewrittenPage: '',
        routePath: '/alpha',
        sourcePage: 'alpha.md',
        localeKey: 'root',
        sourceOrder: undefined as unknown as number,
        displayText: 'Same',
        frontmatter: undefined,
      }),
      createPage({
        rewrittenPage: '',
        routePath: '/beta',
        sourcePage: 'beta.md',
        localeKey: 'root',
        sourceOrder: 2,
        displayText: 'Same',
        frontmatter: undefined,
      }),
    ]

    const customFirst = buildLocaleTree(pages, {
      standaloneIndex: true,
      sorter: () => -1,
    })
    expect(customFirst.tree.root.map((item) => item.routePath)).toEqual([
      '/beta',
      '/alpha',
    ])

    const fallbackTieBreak = buildLocaleTree(pages, {
      standaloneIndex: true,
      sorter: () => Number.NaN,
    })
    expect(fallbackTieBreak.tree.root.map((item) => item.routePath)).toEqual([
      '/alpha',
      '/beta',
    ])

    const duplicateNamePages: PageContentMeta[] = [
      createPage({
        rewrittenPage: 'dup.md',
        routePath: '/dup-a',
        sourcePage: 'dup-a.md',
        localeKey: 'root',
        sourceOrder: undefined as unknown as number,
        displayText: 'Dup',
        frontmatter: undefined,
      }),
      createPage({
        rewrittenPage: 'dup.md',
        routePath: '/dup-b',
        sourcePage: 'dup-b.md',
        localeKey: 'root',
        sourceOrder: undefined as unknown as number,
        displayText: 'Dup',
        frontmatter: undefined,
      }),
    ]

    const duplicateResult = buildLocaleTree(duplicateNamePages, {
      standaloneIndex: true,
      sorter: () => Number.NaN,
    })
    expect(duplicateResult.tree.root.map((item) => item.routePath)).toEqual([
      '/dup-a',
      '/dup-b',
    ])
  })

  it('nav 可跳过首个无链接子节点并命中后续可用链接', () => {
    const tree: LocaleTree = {
      root: [
        {
          name: 'group',
          text: 'Group',
          isFolder: true,
          localeKey: 'root',
          routePath: '/group/',
          children: [
            {
              name: 'nested-empty',
              text: 'Nested Empty',
              isFolder: true,
              localeKey: 'root',
              routePath: '/group/nested-empty/',
              children: [],
            },
            {
              name: 'page.md',
              text: 'Page',
              isFolder: false,
              localeKey: 'root',
              routePath: '/group/page',
              children: [],
            },
          ],
        },
      ],
    }

    const navResult = buildNavByLocale(tree)
    expect(navResult.navByLocale.root).toEqual([
      {
        text: 'Group',
        link: '/group/page',
        activeMatch: '/group/',
      },
    ])
  })

  it('sidebar 目录节点无 sourcePagePath 时不输出 link 字段', () => {
    const tree: LocaleTree = {
      root: [
        {
          name: 'group',
          text: 'Group',
          isFolder: true,
          localeKey: 'root',
          routePath: '/group/',
          children: [
            {
              name: 'nested',
              text: 'Nested',
              isFolder: true,
              localeKey: 'root',
              routePath: '/group/nested/',
              children: [
                {
                  name: 'intro.md',
                  text: 'Intro',
                  isFolder: false,
                  localeKey: 'root',
                  routePath: '/group/nested/intro',
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    }

    const sidebar = buildSidebarByLocale(tree).sidebarByLocale.root['/group/']
    expect(sidebar[0]).toEqual({
      text: 'Nested',
      items: [{ text: 'Intro', link: '/group/nested/intro' }],
    })
    expect('link' in sidebar[0]).toBe(false)
  })

  it('已存在目录节点在 sourceOrder 缺失时保持原顺序（覆盖 sourceOrder==null 分支）', () => {
    const pages = [
      createPage({
        rewrittenPage: 'guide/first.md',
        routePath: '/guide/first',
        sourcePage: 'guide/first.md',
        localeKey: 'root',
        sourceOrder: 1,
        displayText: 'First',
      }),
      createPage({
        rewrittenPage: 'guide/second.md',
        routePath: '/guide/second',
        sourcePage: 'guide/second.md',
        localeKey: 'root',
        sourceOrder: undefined as unknown as number,
        displayText: 'Second',
      }),
    ]

    const tree = buildLocaleTree(pages, { standaloneIndex: true })
    const guide = tree.tree.root.find((node) => node.name === 'guide')
    expect(guide?.sourceOrder).toBe(1)
  })

  it('folder nav link 取首个子链接，但 activeMatch 仍基于 section route', () => {
    const pages: PageContentMeta[] = [
      createPage({
        rewrittenPage: 'guide/intro.md',
        routePath: '/guide/intro',
        sourcePage: 'guide/intro.md',
        localeKey: 'root',
        sourceOrder: 1,
        displayText: 'Guide Intro',
      }),
      createPage({
        rewrittenPage: 'guide/advanced/topic.md',
        routePath: '/guide/advanced/topic',
        sourcePage: 'guide/advanced/topic.md',
        localeKey: 'root',
        sourceOrder: 2,
        displayText: 'Guide Topic',
      }),
    ]

    const tree = buildLocaleTree(pages, { standaloneIndex: true })
    const nav = buildNavByLocale(tree.tree).navByLocale.root

    expect(nav).toEqual([
      {
        text: 'guide',
        link: '/guide/intro',
        activeMatch: '/guide/',
      },
    ])
  })

  it('多顶层 section 与根级普通页面并存时可生成稳定 nav 结构', () => {
    const pages: PageContentMeta[] = [
      createPage({
        rewrittenPage: 'overview.md',
        routePath: '/overview',
        sourcePage: 'overview.md',
        localeKey: 'root',
        sourceOrder: 1,
        displayText: 'Overview',
      }),
      createPage({
        rewrittenPage: 'guide/getting-started.md',
        routePath: '/guide/getting-started',
        sourcePage: 'guide/getting-started.md',
        localeKey: 'root',
        sourceOrder: 2,
        displayText: 'Getting Started',
      }),
      createPage({
        rewrittenPage: 'api/reference.md',
        routePath: '/api/reference',
        sourcePage: 'api/reference.md',
        localeKey: 'root',
        sourceOrder: 3,
        displayText: 'Reference',
      }),
    ]

    const tree = buildLocaleTree(pages, { standaloneIndex: true })
    const nav = buildNavByLocale(tree.tree).navByLocale.root

    expect(nav).toEqual([
      {
        text: 'Overview',
        link: '/overview',
        activeMatch: '/overview',
      },
      {
        text: 'guide',
        link: '/guide/getting-started',
        activeMatch: '/guide/',
      },
      {
        text: 'api',
        link: '/api/reference',
        activeMatch: '/api/',
      },
    ])
  })

  it('root / fr / ja tree/nav/sidebar 完全隔离，且同名目录页面不会串值', () => {
    const pages: PageContentMeta[] = [
      createPage({
        rewrittenPage: 'guide/index.md',
        routePath: '/guide/',
        sourcePage: 'guide/index.md',
        localeKey: 'root',
        sourceOrder: 1,
        displayText: 'Guide Root Index',
      }),
      createPage({
        rewrittenPage: 'guide/intro.md',
        routePath: '/guide/intro',
        sourcePage: 'guide/intro.md',
        localeKey: 'root',
        sourceOrder: 2,
        displayText: 'Intro Root',
      }),
      createPage({
        rewrittenPage: 'fr/guide/index.md',
        routePath: '/fr/guide/',
        sourcePage: 'fr/guide/index.md',
        localeKey: 'fr',
        sourceOrder: 1,
        displayText: 'Guide FR Index',
      }),
      createPage({
        rewrittenPage: 'fr/guide/intro.md',
        routePath: '/fr/guide/intro',
        sourcePage: 'fr/guide/intro.md',
        localeKey: 'fr',
        sourceOrder: 2,
        displayText: 'Intro FR',
      }),
      createPage({
        rewrittenPage: 'ja/guide/index.md',
        routePath: '/ja/guide/',
        sourcePage: 'ja/guide/index.md',
        localeKey: 'ja',
        sourceOrder: 1,
        displayText: 'Guide JA Index',
      }),
      createPage({
        rewrittenPage: 'ja/guide/intro.md',
        routePath: '/ja/guide/intro',
        sourcePage: 'ja/guide/intro.md',
        localeKey: 'ja',
        sourceOrder: 2,
        displayText: 'Intro JA',
      }),
    ]

    const tree = buildLocaleTree(pages, {
      standaloneIndex: false,
      overrides: {
        guide: { displayName: 'Guide Root' },
        'fr/guide': { displayName: 'Guide FR' },
        'ja/guide': { displayName: 'Guide JA' },
      },
    })
    const nav = buildNavByLocale(tree.tree).navByLocale
    const sidebar = buildSidebarByLocale(tree.tree).sidebarByLocale

    expect(tree.tree.root[0]?.text).toBe('Guide Root')
    expect(tree.tree.fr[0]?.text).toBe('Guide FR')
    expect(tree.tree.ja[0]?.text).toBe('Guide JA')

    expect(nav.root).toEqual([
      { text: 'Guide Root', link: '/guide/', activeMatch: '/guide/' },
    ])
    expect(nav.fr).toEqual([
      { text: 'Guide FR', link: '/fr/guide/', activeMatch: '/fr/guide/' },
    ])
    expect(nav.ja).toEqual([
      { text: 'Guide JA', link: '/ja/guide/', activeMatch: '/ja/guide/' },
    ])

    expect(sidebar.root['/guide/']).toEqual([
      { text: 'Intro Root', link: '/guide/intro' },
    ])
    expect(sidebar.fr['/fr/guide/']).toEqual([
      { text: 'Intro FR', link: '/fr/guide/intro' },
    ])
    expect(sidebar.ja['/ja/guide/']).toEqual([
      { text: 'Intro JA', link: '/ja/guide/intro' },
    ])

    expect(sidebar.root['/fr/guide/']).toBeUndefined()
    expect(sidebar.fr['/guide/']).toBeUndefined()
    expect(sidebar.ja['/guide/']).toBeUndefined()
  })

  it('页面节点上的 collapsed 不会出现在最终 sidebar page item 上', () => {
    const pages: PageContentMeta[] = [
      createPage({
        rewrittenPage: 'guide/topic.md',
        routePath: '/guide/topic',
        sourcePage: 'guide/topic.md',
        localeKey: 'root',
        sourceOrder: 1,
        displayText: 'Topic',
        itemMeta: {
          visible: true,
          preferArticleTitle: false,
          collapsed: true,
        },
      }),
    ]

    const tree = buildLocaleTree(pages, { standaloneIndex: true })
    const sidebar = buildSidebarByLocale(tree.tree).sidebarByLocale.root[
      '/guide/'
    ]

    expect(sidebar).toEqual([{ text: 'Topic', link: '/guide/topic' }])
    expect('collapsed' in sidebar[0]).toBe(false)
  })
})
