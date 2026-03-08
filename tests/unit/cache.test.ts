import { describe, expect, it } from 'vitest'
import type { DefaultTheme, SiteConfig } from 'vitepress'
import {
  createPayloadHash,
  createRuntimeContextHash,
} from '../../src/core/cache'

function createSiteConfig(
  partial: Partial<SiteConfig<DefaultTheme.Config>> = {}
): SiteConfig<DefaultTheme.Config> {
  return {
    root: '/repo/example',
    srcDir: '/repo/example',
    cacheDir: '/repo/example/.vitepress/cache',
    outDir: '/repo/example/.vitepress/dist',
    pages: ['guide/index.md'],
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
    ...partial,
  } as SiteConfig<DefaultTheme.Config>
}

describe('cache hash helpers', () => {
  it('createPayloadHash supports bigint/function/object/array payloads deterministically', () => {
    const fn = function namedSorter() {
      return 1
    }
    const payload = {
      bigint: 1n,
      fn,
      nested: [{ b: 2, a: 1 }],
    }

    const hashA = createPayloadHash(payload)
    const hashB = createPayloadHash({
      fn,
      nested: [{ a: 1, b: 2 }],
      bigint: 1n,
    })
    expect(hashA).toBe(hashB)
  })

  it('createRuntimeContextHash reacts to rewrite and dynamic route changes', () => {
    const base = createSiteConfig({
      rewrites: {
        map: {
          'docs/a.md': 'docs/a/index.md',
        },
        inv: {},
      } as SiteConfig<DefaultTheme.Config>['rewrites'],
      dynamicRoutes: {
        routes: [
          {
            route: 'blog/[slug].md',
            path: 'blog/hello.md',
            params: { slug: 'hello' },
            content: '# hello',
          },
          {
            route: 'blog/[slug].md',
            path: 'blog/world.md',
            params: { slug: 'world' },
          },
        ],
      } as SiteConfig<DefaultTheme.Config>['dynamicRoutes'],
    })

    const hashA = createRuntimeContextHash(base, {
      include: ['**/*.md'],
      sorter: (a, b) => a.name.localeCompare(b.name),
    })
    const hashB = createRuntimeContextHash(
      createSiteConfig({
        ...base,
        rewrites: {
          map: {
            'docs/a.md': 'docs/a/index.md',
            'docs/b.md': 'docs/b/index.md',
          },
          inv: {},
        } as SiteConfig<DefaultTheme.Config>['rewrites'],
      }),
      {
        include: ['**/*.md'],
        sorter: (a, b) => a.name.localeCompare(b.name),
      }
    )

    expect(hashA).not.toBe(hashB)
  })

  it('handles missing rewrites/locales and anonymous sorter', () => {
    const siteConfig = createSiteConfig({
      rewrites:
        undefined as unknown as SiteConfig<DefaultTheme.Config>['rewrites'],
      site: {
        ...createSiteConfig().site,
        locales: undefined,
      } as unknown as SiteConfig<DefaultTheme.Config>['site'],
      dynamicRoutes: {
        routes: [
          {
            route: 'x/[id].md',
            path: 'x/1.md',
          },
        ],
      } as SiteConfig<DefaultTheme.Config>['dynamicRoutes'],
    })

    const hash = createRuntimeContextHash(siteConfig, {
      sorter: (a, b) => a.index - b.index,
    })
    expect(hash).toBeTypeOf('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('rewrite 为空字符串时会被忽略（覆盖 normalizeRewriteMap 分支）', () => {
    const siteConfig = createSiteConfig({
      rewrites: {
        map: {
          'docs/a.md': '',
          'docs/b.md': 'docs/b/index.md',
        },
        inv: {},
      } as SiteConfig<DefaultTheme.Config>['rewrites'],
    })

    const hashA = createRuntimeContextHash(siteConfig)
    const hashB = createRuntimeContextHash(
      createSiteConfig({
        rewrites: {
          map: {
            'docs/b.md': 'docs/b/index.md',
          },
          inv: {},
        } as SiteConfig<DefaultTheme.Config>['rewrites'],
      })
    )

    expect(hashA).toBe(hashB)
  })

  it('SUMMARY.md 不参与 runtime hash', () => {
    const hashA = createRuntimeContextHash(
      createSiteConfig({
        pages: ['SUMMARY.md', 'guide/index.md', 'guide/intro.md'],
      })
    )
    const hashB = createRuntimeContextHash(
      createSiteConfig({
        pages: ['guide/index.md', 'guide/intro.md'],
      })
    )

    expect(hashA).toBe(hashB)
  })
})
