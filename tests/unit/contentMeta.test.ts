import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { DefaultTheme, SiteConfig } from 'vitepress'
import type { ResolvedPage } from '../../src/types/model'
import { resolveContentMeta } from '../../src/core/contentMeta'

function createSiteConfig(): SiteConfig<DefaultTheme.Config> {
  return {
    root: '/repo/example',
    srcDir: '/repo/example',
    cacheDir: '/repo/example/.vitepress/cache',
    outDir: '/repo/example/.vitepress/dist',
    pages: [],
    rewrites: { map: {}, inv: {} },
    dynamicRoutes: { routes: [] },
    site: {
      base: '/',
      lang: 'zh-CN',
      title: 'test',
      description: '',
      head: [],
      themeConfig: {},
      locales: {},
      customData: {},
    } as unknown as SiteConfig<DefaultTheme.Config>['site'],
  } as SiteConfig<DefaultTheme.Config>
}

function createPage(input: {
  sourcePage: string
  rewrittenPage?: string
  routePath: string
  content?: string
  localeKey?: string
}): ResolvedPage {
  return {
    sourcePage: input.sourcePage,
    resolvedPage: input.sourcePage,
    rewrittenPage: input.rewrittenPage ?? input.sourcePage,
    routePath: input.routePath,
    localeKey: input.localeKey ?? 'root',
    content: input.content,
  }
}

async function importFreshContentMetaWithMatterSpy() {
  vi.resetModules()
  const actualMatter =
    await vi.importActual<typeof import('gray-matter')>('gray-matter')
  const matterSpy = vi.fn(actualMatter.default)
  vi.doMock('gray-matter', () => ({ default: matterSpy }))

  const freshModule = await import('../../src/core/contentMeta')

  return {
    matterSpy,
    resolveFreshContentMeta: freshModule.resolveContentMeta,
    cleanup() {
      vi.doUnmock('gray-matter')
      vi.resetModules()
    },
  }
}

describe('resolveContentMeta', () => {
  it('T202: 正确处理 visible/order/displayName 优先级与标题回退链路', async () => {
    const pages = [
      createPage({
        sourcePage: 'guide/alpha.md',
        routePath: '/guide/alpha',
        content: `---
displayName: 前置展示名
order: 2
visible: false
---
# Alpha H1
`,
      }),
      createPage({
        sourcePage: 'guide/bravo.md',
        routePath: '/guide/bravo',
        content: `---
preferArticleTitle: true
---
# Bravo 标题
`,
      }),
      createPage({
        sourcePage: 'guide/charlie.md',
        routePath: '/guide/charlie',
        content: `---
order: 8
---
正文
`,
      }),
    ]

    const result = await resolveContentMeta(pages, createSiteConfig(), {
      preferArticleTitle: false,
      overrides: {
        'guide/alpha': {
          visible: true,
          order: 9,
          displayName: '覆盖展示名',
          preferArticleTitle: true,
        },
      },
    })

    const alpha = result.pages.find(
      (item) => item.sourcePage === 'guide/alpha.md'
    )
    const bravo = result.pages.find(
      (item) => item.sourcePage === 'guide/bravo.md'
    )
    const charlie = result.pages.find(
      (item) => item.sourcePage === 'guide/charlie.md'
    )

    expect(alpha?.itemMeta.visible).toBe(false)
    expect(alpha?.itemMeta.order).toBe(2)
    expect(alpha?.displayText).toBe('前置展示名')

    expect(bravo?.displayText).toBe('Bravo 标题')
    expect(bravo?.itemMeta.preferArticleTitle).toBe(true)

    expect(charlie?.displayText).toBe('charlie')
    expect(charlie?.itemMeta.order).toBe(8)
  })

  it('T203: frontmatter 前缀字段优先于同名字段与 overrides', async () => {
    const pages = [
      createPage({
        sourcePage: 'guide/prefixed.md',
        routePath: '/guide/prefixed',
        content: `---
visible: false
navVisible: true
order: 1
navOrder: 7
displayName: 普通标题
navDisplayName: 前缀标题
preferArticleTitle: false
navPreferArticleTitle: true
collapsed: false
navCollapsed: true
---
# Prefix H1
`,
      }),
    ]

    const result = await resolveContentMeta(pages, createSiteConfig(), {
      frontmatterKeyPrefix: 'nav',
      preferArticleTitle: false,
      overrides: {
        'guide/prefixed': {
          visible: false,
          order: 99,
          displayName: '覆盖标题',
          preferArticleTitle: false,
          collapsed: false,
        },
      },
    })

    const prefixed = result.pages[0]
    expect(prefixed.itemMeta.visible).toBe(true)
    expect(prefixed.itemMeta.order).toBe(7)
    expect(prefixed.itemMeta.preferArticleTitle).toBe(true)
    expect(prefixed.itemMeta.collapsed).toBe(true)
    expect(prefixed.displayText).toBe('前缀标题')
  })

  it('frontmatter 变量替换与缓存命中仍按当前字段工作', async () => {
    const page = createPage({
      sourcePage: 'guide/current.md',
      routePath: '/guide/current',
      content: `---
displayName: 当前字段标题
preferArticleTitle: true
---
# {{$frontmatter.missing}}
`,
    })

    const first = await resolveContentMeta([page], createSiteConfig(), {
      preferArticleTitle: false,
    })
    const second = await resolveContentMeta([page], createSiteConfig(), {
      preferArticleTitle: false,
    })

    expect(first.pages[0].itemMeta.visible).toBe(true)
    expect(first.pages[0].itemMeta.order).toBeUndefined()
    expect(first.pages[0].itemMeta.preferArticleTitle).toBe(true)
    expect(first.pages[0].displayText).toBe('当前字段标题')
    expect(second.pages[0].displayText).toBe('当前字段标题')
  })

  it('当 frontmatter 未定义可见性/排序/标题时回退 overrides', async () => {
    const pages = [
      createPage({
        sourcePage: 'guide/override.md',
        rewrittenPage: 'guide/override',
        routePath: '/guide/override',
        content: '# Override',
      }),
    ]

    const result = await resolveContentMeta(pages, createSiteConfig(), {
      overrides: {
        'guide/override': {
          visible: false,
          order: 11,
          displayName: 'From Override',
        },
      },
    })

    expect(result.pages[0].itemMeta.visible).toBe(false)
    expect(result.pages[0].itemMeta.order).toBe(11)
    expect(result.pages[0].displayText).toBe('From Override')
  })

  it('目录索引页默认名称回退目录名，并支持目录 overrides.displayName', async () => {
    const pages = [
      createPage({
        sourcePage: 'guide/index.md',
        routePath: '/guide/',
        content: '# Guide',
      }),
      createPage({
        sourcePage: 'guide/basic/index.md',
        routePath: '/guide/basic/',
        content: '# Basic',
      }),
      createPage({
        sourcePage: 'fr/guide/index.md',
        routePath: '/fr/guide/',
        localeKey: 'fr',
        content: '# Guide FR',
      }),
    ]

    const defaultResult = await resolveContentMeta(pages, createSiteConfig(), {
      preferArticleTitle: false,
    })
    expect(defaultResult.pages.map((item) => item.displayText)).toEqual([
      'guide',
      'basic',
      'guide',
    ])

    const overrideResult = await resolveContentMeta(pages, createSiteConfig(), {
      overrides: {
        guide: { displayName: '指南' },
        'guide/basic': { displayName: '基础' },
        'fr/guide': { displayName: 'Guide Français' },
      },
    })
    expect(overrideResult.pages.map((item) => item.displayText)).toEqual([
      '指南',
      '基础',
      'Guide Français',
    ])
  })

  it('prefix 字段非法时回退普通字段，普通字段仍优先于 overrides', async () => {
    const pages = [
      createPage({
        sourcePage: 'guide/invalid-prefix.md',
        routePath: '/guide/invalid-prefix',
        content: `---
visible: false
navVisible: invalid
order: 3
navOrder: bad
displayName: 普通标题
navDisplayName: 123
preferArticleTitle: false
navPreferArticleTitle: wrong
collapsed: true
navCollapsed: wrong
---
# Invalid Prefix H1
`,
      }),
    ]

    const result = await resolveContentMeta(pages, createSiteConfig(), {
      frontmatterKeyPrefix: 'nav',
      preferArticleTitle: true,
      overrides: {
        'guide/invalid-prefix': {
          visible: true,
          order: 9,
          displayName: '覆盖标题',
          preferArticleTitle: true,
          collapsed: false,
        },
      },
    })

    const item = result.pages[0]
    expect(item.itemMeta.visible).toBe(false)
    expect(item.itemMeta.order).toBe(3)
    expect(item.itemMeta.preferArticleTitle).toBe(false)
    expect(item.itemMeta.collapsed).toBe(true)
    expect(item.displayText).toBe('普通标题')
  })

  it('prefix 字段非法且普通字段缺失时回退 overrides', async () => {
    const pages = [
      createPage({
        sourcePage: 'guide/prefix-override.md',
        routePath: '/guide/prefix-override',
        content: `---
navVisible: wrong
navOrder: bad
navDisplayName: 123
navPreferArticleTitle: wrong
navCollapsed: wrong
---
# Override Title
`,
      }),
    ]

    const result = await resolveContentMeta(pages, createSiteConfig(), {
      frontmatterKeyPrefix: 'nav',
      preferArticleTitle: false,
      overrides: {
        'guide/prefix-override': {
          visible: true,
          order: 11,
          displayName: '来自覆盖',
          preferArticleTitle: true,
          collapsed: false,
        },
      },
    })

    const item = result.pages[0]
    expect(item.itemMeta.visible).toBe(true)
    expect(item.itemMeta.order).toBe(11)
    expect(item.itemMeta.preferArticleTitle).toBe(true)
    expect(item.itemMeta.collapsed).toBe(false)
    expect(item.displayText).toBe('来自覆盖')
  })

  it('目录 index frontmatter 的 collapsed 优先于 overrides，非法值回退 overrides', async () => {
    const pages = [
      createPage({
        sourcePage: 'guide/index.md',
        routePath: '/guide/',
        content: `---
collapsed: true
---
# Guide
`,
      }),
      createPage({
        sourcePage: 'guide/advanced/index.md',
        routePath: '/guide/advanced/',
        content: `---
collapsed: wrong
---
# Advanced
`,
      }),
    ]

    const result = await resolveContentMeta(pages, createSiteConfig(), {
      overrides: {
        guide: { collapsed: false },
        'guide/advanced': { collapsed: true },
      },
    })

    expect(result.pages[0].itemMeta.collapsed).toBe(true)
    expect(result.pages[1].itemMeta.collapsed).toBe(true)
  })

  it('顶层 index 页面默认显示为 index，并覆盖空父目录分支', async () => {
    const pages = [
      createPage({
        sourcePage: 'index.md',
        routePath: '/',
        content: '# Root Index',
      }),
    ]

    const result = await resolveContentMeta(pages, createSiteConfig())

    expect(result.pages[0].displayText).toBe('index')
    expect(result.pages[0].itemMeta.visible).toBe(true)
  })

  it('文件内容缓存命中时复用已解析结果', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'auto-nav-content-cache-hit-')
    )
    const { matterSpy, resolveFreshContentMeta, cleanup } =
      await importFreshContentMetaWithMatterSpy()

    try {
      const srcDir = path.join(tempRoot, 'docs')
      await mkdir(path.join(srcDir, 'guide'), { recursive: true })
      await writeFile(
        path.join(srcDir, 'guide', 'cache.md'),
        `---
displayName: Cache Title
---
# Cache Title
`,
        'utf-8'
      )

      const siteConfig = createSiteConfig()
      siteConfig.srcDir = srcDir
      const page = createPage({
        sourcePage: 'guide/cache.md',
        routePath: '/guide/cache',
      })

      const first = await resolveFreshContentMeta([page], siteConfig)
      const second = await resolveFreshContentMeta([page], siteConfig)

      expect(first.pages[0].displayText).toBe('Cache Title')
      expect(second.pages[0].displayText).toBe('Cache Title')
      expect(matterSpy).toHaveBeenCalledTimes(1)
    } finally {
      cleanup()
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('文件内容变化后会使缓存失效并重新解析', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'auto-nav-content-cache-invalidate-')
    )
    const { matterSpy, resolveFreshContentMeta, cleanup } =
      await importFreshContentMetaWithMatterSpy()

    try {
      const srcDir = path.join(tempRoot, 'docs')
      const filePath = path.join(srcDir, 'guide', 'cache.md')
      await mkdir(path.join(srcDir, 'guide'), { recursive: true })
      await writeFile(
        filePath,
        `---
displayName: Cache A
---
# Cache A
`,
        'utf-8'
      )

      const siteConfig = createSiteConfig()
      siteConfig.srcDir = srcDir
      const page = createPage({
        sourcePage: 'guide/cache.md',
        routePath: '/guide/cache',
      })

      const first = await resolveFreshContentMeta([page], siteConfig)
      await writeFile(
        filePath,
        `---
displayName: Cache Updated Title
---
# Cache Updated Title
`,
        'utf-8'
      )
      const second = await resolveFreshContentMeta([page], siteConfig)

      expect(first.pages[0].displayText).toBe('Cache A')
      expect(second.pages[0].displayText).toBe('Cache Updated Title')
      expect(matterSpy).toHaveBeenCalledTimes(2)
    } finally {
      cleanup()
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('dev.cache = false 时不会复用文件缓存', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'auto-nav-content-cache-disabled-')
    )
    const { matterSpy, resolveFreshContentMeta, cleanup } =
      await importFreshContentMetaWithMatterSpy()

    try {
      const srcDir = path.join(tempRoot, 'docs')
      await mkdir(path.join(srcDir, 'guide'), { recursive: true })
      await writeFile(
        path.join(srcDir, 'guide', 'cache.md'),
        `---
displayName: Cache Disabled
---
# Cache Disabled
`,
        'utf-8'
      )

      const siteConfig = createSiteConfig()
      siteConfig.srcDir = srcDir
      const page = createPage({
        sourcePage: 'guide/cache.md',
        routePath: '/guide/cache',
      })

      await resolveFreshContentMeta([page], siteConfig)
      await resolveFreshContentMeta([page], siteConfig, {
        dev: { cache: false },
      })
      await resolveFreshContentMeta([page], siteConfig)

      expect(matterSpy).toHaveBeenCalledTimes(3)
    } finally {
      cleanup()
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('未参与本轮解析的缓存项会被回收', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'auto-nav-content-cache-prune-')
    )
    const { matterSpy, resolveFreshContentMeta, cleanup } =
      await importFreshContentMetaWithMatterSpy()

    try {
      const srcDir = path.join(tempRoot, 'docs')
      await mkdir(path.join(srcDir, 'guide'), { recursive: true })
      await writeFile(
        path.join(srcDir, 'guide', 'alpha.md'),
        `---
displayName: Alpha
---
# Alpha
`,
        'utf-8'
      )
      await writeFile(
        path.join(srcDir, 'guide', 'beta.md'),
        `---
displayName: Beta
---
# Beta
`,
        'utf-8'
      )

      const siteConfig = createSiteConfig()
      siteConfig.srcDir = srcDir
      const alpha = createPage({
        sourcePage: 'guide/alpha.md',
        routePath: '/guide/alpha',
      })
      const beta = createPage({
        sourcePage: 'guide/beta.md',
        routePath: '/guide/beta',
      })

      await resolveFreshContentMeta([alpha], siteConfig)
      await resolveFreshContentMeta([beta], siteConfig)
      await resolveFreshContentMeta([alpha], siteConfig)

      expect(matterSpy).toHaveBeenCalledTimes(3)
    } finally {
      cleanup()
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('inline 内容在 cache=false 时仍可解析（覆盖 inline 分支的 useCache=false）', async () => {
    const pages = [
      createPage({
        sourcePage: 'guide/no-cache.md',
        routePath: '/guide/no-cache',
        content: `---
displayName: No Cache
---
# No Cache
`,
      }),
    ]

    const result = await resolveContentMeta(pages, createSiteConfig(), {
      dev: { cache: false },
    })

    expect(result.stats.inlineContentCount).toBe(1)
    expect(result.pages[0].displayText).toBe('No Cache')
  })

  it('处理文件读取、missing template、动态路由回退并对同路径仅告警一次', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'auto-nav-content-'))
    try {
      const srcDir = path.join(tempRoot, 'docs')
      await mkdir(path.join(srcDir, 'guide'), { recursive: true })
      await writeFile(
        path.join(srcDir, 'guide', 'real.md'),
        `---
navVisible: false
order: 5
---
# Real
`,
        'utf-8'
      )

      const siteConfig = createSiteConfig()
      siteConfig.srcDir = srcDir

      const pages: ResolvedPage[] = [
        {
          sourcePage: 'guide/real.md',
          resolvedPage: 'guide/real.md',
          rewrittenPage: 'guide/real.md',
          routePath: '/guide/real',
          localeKey: 'root',
        },
        {
          sourcePage: 'guide/missing.md',
          resolvedPage: 'guide/missing.md',
          rewrittenPage: 'guide/missing.md',
          routePath: '/guide/missing',
          localeKey: 'root',
          params: { slug: 'missing' },
        },
      ]

      const warn = vi.fn()
      const resultA = await resolveContentMeta(
        pages,
        siteConfig,
        {
          frontmatterKeyPrefix: 'nav',
          dev: { cache: false },
        },
        { warn }
      )
      const resultB = await resolveContentMeta(
        pages,
        siteConfig,
        {
          frontmatterKeyPrefix: 'nav',
        },
        { warn }
      )

      expect(resultA.stats.pagesCount).toBe(2)
      expect(resultA.stats.dynamicTemplateFallbackCount).toBe(1)
      expect(resultA.stats.missingTemplateCount).toBe(1)
      expect(resultA.pages[0].itemMeta.visible).toBe(false)
      expect(resultB.pages[1].frontmatter).toEqual({})
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })
})
