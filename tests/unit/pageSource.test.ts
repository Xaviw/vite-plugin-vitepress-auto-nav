import { describe, expect, it } from 'vitest'
import type { DefaultTheme, SiteConfig } from 'vitepress'
import { resolvePageSource } from '../../src/core/pageSource'

function createSiteConfig(
  partial: Partial<SiteConfig<DefaultTheme.Config>>
): SiteConfig<DefaultTheme.Config> {
  return {
    root: '/repo/example',
    srcDir: '/repo/example',
    cacheDir: '/repo/example/.vitepress/cache',
    outDir: '/repo/example/.vitepress/dist',
    pages: [],
    rewrites: {
      map: {},
      inv: {},
    },
    dynamicRoutes: {
      routes: [],
    },
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
    ...partial,
  } as SiteConfig<DefaultTheme.Config>
}

describe('resolvePageSource', () => {
  it('在无 routing/i18n 参数时自动处理 rewrites、dynamic routes 与 locale', () => {
    const siteConfig = createSiteConfig({
      pages: [
        'guide/index.md',
        'fr/guide/index.md',
        'guide/getting-started.md',
        'packages/pkg-a/src/pkg-a-docs.md',
        'packages/pkg-a/src/pkg-a-docs.md',
        'blog/hello-world.md',
        'blog/release-note.md',
      ],
      rewrites: {
        map: {
          'packages/pkg-a/src/pkg-a-docs.md': 'packages-docs/pkg-a/index.md',
        },
        inv: {},
      } as SiteConfig<DefaultTheme.Config>['rewrites'],
      dynamicRoutes: {
        routes: [
          {
            route: 'blog/[slug].md',
            path: 'blog/hello-world.md',
            params: { slug: 'hello-world' },
            content: 'hello',
          },
          {
            route: 'blog/[slug].md',
            path: 'blog/release-note.md',
            params: { slug: 'release-note' },
          },
          {
            route: 'blog/[slug].md',
            path: 'blog/release-note.md',
            params: { slug: 'release-note' },
          },
        ],
      } as SiteConfig<DefaultTheme.Config>['dynamicRoutes'],
      site: {
        ...createSiteConfig({}).site,
        locales: {
          root: {
            label: 'root',
          },
          fr: {
            label: 'Français',
          },
        },
      } as SiteConfig<DefaultTheme.Config>['site'],
    })

    const result = resolvePageSource(siteConfig)

    expect(result.stats.rawDynamicRoutesCount).toBe(3)
    expect(result.stats.uniqueDynamicRoutesCount).toBe(2)
    expect(result.context.uniqueRewrittenPages).toContain(
      'packages-docs/pkg-a/index.md'
    )
    expect(result.pages.some((item) => item.localeKey === 'fr')).toBe(true)

    const releaseNote = result.pages.find(
      (item) => item.resolvedPage === 'blog/release-note.md'
    )
    expect(releaseNote?.sourcePage).toBe('blog/[slug].md')
    expect(releaseNote?.routePath).toBe('/blog/release-note')
  })

  it('supports include and exclude patterns with auto locale detection', () => {
    const siteConfig = createSiteConfig({
      pages: [
        'docs/guide/index.md',
        'zh/guide/index.md',
        'zh/private/secret.md',
      ],
      dynamicRoutes: {
        routes: [],
      } as SiteConfig<DefaultTheme.Config>['dynamicRoutes'],
      site: {
        ...createSiteConfig({}).site,
        locales: {
          root: { label: 'root' },
          zh: { label: '简体中文' },
        },
      } as SiteConfig<DefaultTheme.Config>['site'],
    })

    const result = resolvePageSource(siteConfig, {
      include: ['zh/**/*.md'],
      exclude: ['**/private/**'],
    })

    expect(result.pages).toHaveLength(1)
    expect(result.pages[0].rewrittenPage).toBe('zh/guide/index.md')
    expect(result.pages[0].localeKey).toBe('zh')
  })

  it('supports runtime pages from rewrites inverse mapping automatically', () => {
    const siteConfig = createSiteConfig({
      pages: ['friendly/guide.md'],
      rewrites: {
        map: {
          'docs/guide.md': 'friendly/guide.md',
        },
        inv: {
          'friendly/guide.md': 'docs/guide.md',
        },
      } as SiteConfig<DefaultTheme.Config>['rewrites'],
    })

    const result = resolvePageSource(siteConfig)

    expect(result.pages[0].sourcePage).toBe('docs/guide.md')
    expect(result.pages[0].resolvedPage).toBe('docs/guide.md')
    expect(result.pages[0].rewrittenPage).toBe('friendly/guide.md')
  })

  it('supports ? glob pattern and locale fallback to root', () => {
    const siteConfig = createSiteConfig({
      pages: ['docs/a1.md', 'docs/a12.md'],
      site: {
        ...createSiteConfig({}).site,
        locales: {},
      } as SiteConfig<DefaultTheme.Config>['site'],
    })

    const result = resolvePageSource(siteConfig, {
      include: ['docs/a?.md'],
    })

    expect(result.pages).toHaveLength(1)
    expect(result.pages[0].rewrittenPage).toBe('docs/a1.md')
    expect(result.pages[0].localeKey).toBe('root')
  })

  it('默认跳过根 index，并处理缺失 rewrites 与 route-key dynamic fallback', () => {
    const siteConfig = createSiteConfig({
      pages: ['index.md', 'blog/[slug].md'],
      rewrites:
        undefined as unknown as SiteConfig<DefaultTheme.Config>['rewrites'],
      dynamicRoutes: {
        routes: [
          {
            route: 'blog/[slug].md',
            path: 'blog/post.md',
          },
        ],
      } as SiteConfig<DefaultTheme.Config>['dynamicRoutes'],
      site: {
        ...createSiteConfig({}).site,
        locales: undefined,
      } as unknown as SiteConfig<DefaultTheme.Config>['site'],
    })

    const result = resolvePageSource(siteConfig)
    const root = result.pages.find((item) => item.rewrittenPage === 'index.md')
    expect(root).toBeUndefined()

    const dynamic = result.pages.find(
      (item) => item.sourcePage === 'blog/[slug].md'
    )
    expect(dynamic?.resolvedPage).toBe('blog/post.md')
    expect(result.pages).toHaveLength(1)
    expect(result.stats.uniqueResolvedPagesCount).toBe(1)
  })

  it('即使 include 命中 index 规则，也会默认跳过 root 与 locale 根 index', () => {
    const siteConfig = createSiteConfig({
      pages: ['index.md', 'guide/index.md', 'fr/index.md'],
      site: {
        ...createSiteConfig({}).site,
        locales: {
          root: { label: 'root' },
          fr: { label: 'Français' },
        },
      } as SiteConfig<DefaultTheme.Config>['site'],
    })

    const result = resolvePageSource(siteConfig, {
      include: '**/index.md',
    })

    expect(result.pages.map((item) => item.rewrittenPage)).not.toContain(
      'index.md'
    )
    expect(result.pages.map((item) => item.rewrittenPage)).not.toContain(
      'fr/index.md'
    )
    expect(result.pages.map((item) => item.rewrittenPage)).toContain(
      'guide/index.md'
    )
  })

  it('normalizes undefined page entries and supports string include/exclude patterns', () => {
    const siteConfig = createSiteConfig({
      pages: [undefined as unknown as string, 'guide/a.md', 'guide/b.md'],
      rewrites: {
        map: {},
        inv: {},
      } as SiteConfig<DefaultTheme.Config>['rewrites'],
    })

    const result = resolvePageSource(siteConfig, {
      include: 'guide/*.md',
      exclude: 'guide/b.md',
    })

    expect(result.pages.map((item) => item.rewrittenPage)).toContain(
      'guide/a.md'
    )
    expect(result.pages.map((item) => item.rewrittenPage)).not.toContain(
      'guide/b.md'
    )
  })

  it('未配置 include 时也会过滤空 page，避免生成幽灵首页条目', () => {
    const siteConfig = createSiteConfig({
      pages: [undefined as unknown as string, '', 'guide/a.md'],
      rewrites: {
        map: {},
        inv: {},
      } as SiteConfig<DefaultTheme.Config>['rewrites'],
    })

    const result = resolvePageSource(siteConfig)

    expect(result.pages).toHaveLength(1)
    expect(result.pages[0].rewrittenPage).toBe('guide/a.md')
    expect(result.pages[0].routePath).toBe('/guide/a')
  })

  it('覆盖 rewrites 空值忽略与 resolved page 去重分支', () => {
    const siteConfig = createSiteConfig({
      pages: ['blog/post.md', 'blog/[slug].md'],
      rewrites: {
        map: {
          'blog/post.md': '',
        },
        inv: {},
      } as SiteConfig<DefaultTheme.Config>['rewrites'],
      dynamicRoutes: {
        routes: [
          {
            route: 'blog/[slug].md',
            path: 'blog/post.md',
            params: { slug: 'post' },
          },
        ],
      } as SiteConfig<DefaultTheme.Config>['dynamicRoutes'],
    })

    const result = resolvePageSource(siteConfig)
    expect(result.pages).toHaveLength(1)
    expect(result.pages[0].sourcePage).toBe('blog/[slug].md')
    expect(result.pages[0].rewrittenPage).toBe('blog/post.md')
  })

  it('include/exclude 会同时作用于 sourcePage、resolvedPage 与 rewrittenPage', () => {
    const siteConfig = createSiteConfig({
      pages: ['docs/guide.md', 'blog/[slug].md', 'internal/secret.md'],
      rewrites: {
        map: {
          'docs/guide.md': 'friendly/guide.md',
        },
        inv: {
          'friendly/guide.md': 'docs/guide.md',
        },
      } as SiteConfig<DefaultTheme.Config>['rewrites'],
      dynamicRoutes: {
        routes: [
          {
            route: 'blog/[slug].md',
            path: 'blog/hello.md',
            params: { slug: 'hello' },
          },
        ],
      } as SiteConfig<DefaultTheme.Config>['dynamicRoutes'],
    })

    const includeBySource = resolvePageSource(siteConfig, {
      include: ['docs/*.md'],
    })
    expect(includeBySource.pages.map((item) => item.rewrittenPage)).toEqual([
      'friendly/guide.md',
    ])

    const includeByResolved = resolvePageSource(siteConfig, {
      include: ['blog/hello.md'],
    })
    expect(includeByResolved.pages.map((item) => item.sourcePage)).toEqual([
      'blog/[slug].md',
    ])

    const includeByRewritten = resolvePageSource(siteConfig, {
      include: ['friendly/*.md'],
    })
    expect(includeByRewritten.pages.map((item) => item.rewrittenPage)).toEqual([
      'friendly/guide.md',
    ])

    const excludeByRewritten = resolvePageSource(siteConfig, {
      exclude: ['friendly/*.md'],
    })
    expect(
      excludeByRewritten.pages.map((item) => item.rewrittenPage)
    ).not.toContain('friendly/guide.md')

    const excludeByResolved = resolvePageSource(siteConfig, {
      exclude: ['blog/hello.md'],
    })
    expect(
      excludeByResolved.pages.map((item) => item.sourcePage)
    ).not.toContain('blog/[slug].md')
  })

  it('rewritesMap[resolvedPage] 优先于 rewritesMap[sourcePage]，且 localeKey 基于 rewritten 路径判定', () => {
    const siteConfig = createSiteConfig({
      pages: ['docs/[slug].md'],
      rewrites: {
        map: {
          'docs/[slug].md': 'fallback/[slug].md',
          'docs/bonjour.md': 'fr/guides/bonjour.md',
        },
        inv: {},
      } as SiteConfig<DefaultTheme.Config>['rewrites'],
      dynamicRoutes: {
        routes: [
          {
            route: 'docs/[slug].md',
            path: 'docs/bonjour.md',
            params: { slug: 'bonjour' },
          },
        ],
      } as SiteConfig<DefaultTheme.Config>['dynamicRoutes'],
      site: {
        ...createSiteConfig({}).site,
        locales: {
          root: { label: 'root' },
          fr: { label: 'Français' },
        },
      } as SiteConfig<DefaultTheme.Config>['site'],
    })

    const result = resolvePageSource(siteConfig)

    expect(result.pages).toHaveLength(1)
    expect(result.pages[0]).toMatchObject({
      sourcePage: 'docs/[slug].md',
      resolvedPage: 'docs/bonjour.md',
      rewrittenPage: 'fr/guides/bonjour.md',
      routePath: '/fr/guides/bonjour',
      localeKey: 'fr',
    })
  })

  it('同名文件在不同路径下使用精确 glob 时不会误命中', () => {
    const siteConfig = createSiteConfig({
      pages: ['guide/intro.md', 'guide/nested/intro.md', 'api/intro.md'],
    })

    const result = resolvePageSource(siteConfig, {
      include: ['guide/intro.md'],
    })

    expect(result.pages.map((item) => item.rewrittenPage)).toEqual([
      'guide/intro.md',
    ])
  })

  it('存在 SUMMARY.md 时会被主流程完全忽略', () => {
    const siteConfig = createSiteConfig({
      pages: [
        'SUMMARY.md',
        'guide/index.md',
        'guide/intro.md',
        'fr/SUMMARY.md',
        'fr/guide/index.md',
      ],
      site: {
        ...createSiteConfig({}).site,
        locales: {
          root: { label: 'root' },
          fr: { label: 'Français' },
        },
      } as SiteConfig<DefaultTheme.Config>['site'],
    })

    const result = resolvePageSource(siteConfig, {
      include: '**/*.md',
    })

    expect(result.pages.map((item) => item.rewrittenPage)).toEqual([
      'guide/index.md',
      'guide/intro.md',
      'fr/guide/index.md',
    ])
    expect(result.pages.map((item) => item.sourcePage)).not.toContain(
      'SUMMARY.md'
    )
    expect(result.pages.map((item) => item.sourcePage)).not.toContain(
      'fr/SUMMARY.md'
    )
  })
})
