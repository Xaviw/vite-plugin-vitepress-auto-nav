import { describe, expect, it, vi } from 'vitest'
import type { DefaultTheme, SiteConfig } from 'vitepress'
import { formatMergeStats, mergeThemeConfig } from '../../src/core/merger'

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
      customData: {},
      themeConfig: {
        nav: [{ text: 'Manual Root', link: '/manual-root/' }],
        sidebar: {
          '/manual-root/': [{ text: 'Manual Root', link: '/manual-root/' }],
        },
      },
      locales: {
        fr: {
          label: 'Français',
          lang: 'fr-FR',
          themeConfig: {
            nav: [{ text: 'Manual FR', link: '/fr/manual/' }],
            sidebar: {
              '/fr/manual/': [{ text: 'Manual FR', link: '/fr/manual/' }],
            },
          },
        },
      },
    } as unknown as SiteConfig<DefaultTheme.Config>['site'],
  } as SiteConfig<DefaultTheme.Config>
}

describe('mergeThemeConfig', () => {
  it('支持清理本轮已无生成结果的旧自动生成字段', () => {
    const siteConfig = createSiteConfig()
    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    const frTheme = siteConfig.site.locales?.fr?.themeConfig as Record<
      string,
      unknown
    >

    rootTheme.sidebar = {
      '/guide/': [{ text: 'Generated Guide', link: '/guide/' }],
    }
    rootTheme.nav = [{ text: 'Generated Guide', link: '/guide/' }]
    rootTheme.__autoNavGeneratedNav = true
    rootTheme.__autoNavGeneratedSidebar = true

    frTheme.sidebar = {
      '/fr/guide/': [{ text: 'Generated FR Guide', link: '/fr/guide/' }],
    }
    frTheme.__autoNavGeneratedSidebar = true

    const result = mergeThemeConfig(siteConfig, {
      navByLocale: {},
      sidebarByLocale: {},
    })

    expect(rootTheme.nav).toBeUndefined()
    expect(rootTheme.sidebar).toBeUndefined()
    expect(rootTheme.__autoNavGeneratedNav).toBeUndefined()
    expect(rootTheme.__autoNavGeneratedSidebar).toBeUndefined()
    expect(frTheme.sidebar).toBeUndefined()
    expect(frTheme.__autoNavGeneratedSidebar).toBeUndefined()
    expect(result.changed).toBe(true)
    expect(result.stats.removals).toBe(3)
  })

  it('site.locales 缺失时仍可安全合并 root 配置', () => {
    const siteConfig = createSiteConfig()
    delete (siteConfig.site as { locales?: unknown }).locales

    const result = mergeThemeConfig(siteConfig, {
      navByLocale: {
        root: [{ text: 'Generated Root', link: '/generated-root/' }],
      },
      sidebarByLocale: {
        root: {
          '/guide/': [{ text: 'Guide', link: '/guide/' }],
        },
      },
    })

    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    expect(rootTheme.nav).toEqual([
      { text: 'Manual Root', link: '/manual-root/' },
    ])
    expect(rootTheme.sidebar).toEqual({
      '/guide/': [{ text: 'Guide', link: '/guide/' }],
    })
    expect(result.changed).toBe(true)
    expect(result.stats).toEqual({
      writes: 1,
      skips: 1,
      replaces: 1,
      removals: 0,
    })
  })

  it('固定输出策略：nav 始终 preserve，sidebar 始终 replace', () => {
    const siteConfig = createSiteConfig()
    const info = vi.fn()
    const result = mergeThemeConfig(
      siteConfig,
      {
        navByLocale: {
          root: [{ text: 'Guide', link: '/guide/' }],
          fr: [{ text: 'FR Guide', link: '/fr/' }],
        },
        sidebarByLocale: {
          root: {
            '/guide/': [{ text: 'Guide', link: '/guide/' }],
          },
          fr: {
            '/fr/': [{ text: 'FR Guide', link: '/fr/' }],
          },
        },
      },
      { info }
    )

    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    const frTheme = siteConfig.site.locales?.fr?.themeConfig as Record<
      string,
      unknown
    >
    expect(rootTheme.nav).toEqual([
      { text: 'Manual Root', link: '/manual-root/' },
    ])
    expect(frTheme.nav).toEqual([{ text: 'Manual FR', link: '/fr/manual/' }])
    expect(rootTheme.sidebar).toEqual({
      '/guide/': [{ text: 'Guide', link: '/guide/' }],
    })
    expect(frTheme.sidebar).toEqual({
      '/fr/': [{ text: 'FR Guide', link: '/fr/' }],
    })
    expect(result.stats.writes).toBe(2)
    expect(result.stats.skips).toBe(2)
    expect(result.stats.replaces).toBe(2)
    expect(info).toHaveBeenCalledTimes(2)
    expect(info.mock.calls).toEqual([
      [
        '[vite-plugin-vitepress-auto-nav] skip write due to preserve: themeConfig.nav',
      ],
      [
        '[vite-plugin-vitepress-auto-nav] skip write due to preserve: locales.fr.themeConfig.nav',
      ],
    ])
  })

  it('locale 目标缺失时跳过写入并告警', () => {
    const siteConfig = createSiteConfig()
    const warn = vi.fn()
    const info = vi.fn()
    const result = mergeThemeConfig(
      siteConfig,
      {
        navByLocale: {
          root: [{ text: 'Guide', link: '/guide/' }],
          ja: [{ text: 'JA Guide', link: '/ja/' }],
        },
        sidebarByLocale: {
          root: {
            '/guide/': [{ text: 'Guide', link: '/guide/' }],
          },
          ja: {
            '/ja/': [{ text: 'JA Guide', link: '/ja/' }],
          },
        },
      },
      {
        info,
        warn,
      }
    )

    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    expect(rootTheme.nav).toEqual([
      { text: 'Manual Root', link: '/manual-root/' },
    ])
    expect(rootTheme.sidebar).toEqual({
      '/guide/': [{ text: 'Guide', link: '/guide/' }],
    })
    expect(result.stats.writes).toBe(1)
    expect(result.stats.skips).toBe(1)
    expect(result.stats.replaces).toBe(1)
    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith(
      '[vite-plugin-vitepress-auto-nav] skip write due to preserve: themeConfig.nav'
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      '[vite-plugin-vitepress-auto-nav] locale "ja" not found, skip merge'
    )
  })

  it('支持 locale themeConfig 缺省初始化、sidebar 对象结构克隆与 merge stats 输出', () => {
    const siteConfig = createSiteConfig()
    ;(
      siteConfig.site.locales as Record<string, { label: string; lang: string }>
    ).ja = {
      label: '日本語',
      lang: 'ja-JP',
    }
    const info = vi.fn()

    const payloadSidebar = {
      '/ja/': {
        base: '/ja/',
        items: [
          {
            text: 'JA Intro',
            link: '/ja/',
            items: [{ text: 'Nested', link: '/ja/nested' }],
          },
        ],
      },
    } as unknown as DefaultTheme.Sidebar

    const result = mergeThemeConfig(
      siteConfig,
      {
        navByLocale: {
          root: [{ text: 'Should Skip', link: '/skip/' }],
          ja: [{ text: 'JA', link: '/ja/' }],
        },
        sidebarByLocale: {
          ja: payloadSidebar,
          root: {
            '/manual-root/': [{ text: 'Ignored', link: '/ignored' }],
          },
        },
      },
      { info }
    )

    const jaTheme = (
      siteConfig.site.locales as Record<
        string,
        { themeConfig?: Record<string, unknown> }
      >
    ).ja.themeConfig
    expect(jaTheme?.nav).toEqual([{ text: 'JA', link: '/ja/' }])
    expect(jaTheme?.sidebar).toEqual(payloadSidebar)
    expect(result.stats.writes).toBeGreaterThan(0)
    expect(formatMergeStats(result.stats)).toContain('merge writes=')
    expect(info).toHaveBeenCalled()
  })

  it('invalid sidebar multi value 会回退到直接替换分支，并保留 nav preserve 语义', () => {
    const siteConfig = createSiteConfig()
    const info = vi.fn()
    const warn = vi.fn()

    const invalidSidebar = {
      '/broken/': {
        base: 1,
        items: [{ text: 'broken', link: '/broken' }],
      },
    } as unknown as DefaultTheme.Sidebar

    const result = mergeThemeConfig(
      siteConfig,
      {
        navByLocale: {
          root: [{ text: 'Generated Root', link: '/generated-root/' }],
        },
        sidebarByLocale: {
          root: invalidSidebar,
        },
      },
      {
        info,
        warn,
      }
    )

    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    expect(rootTheme.nav).toEqual([
      { text: 'Manual Root', link: '/manual-root/' },
    ])
    expect(rootTheme.sidebar).toEqual(invalidSidebar)
    expect(result.stats).toEqual({
      writes: 1,
      skips: 1,
      replaces: 1,
      removals: 0,
    })
    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith(
      '[vite-plugin-vitepress-auto-nav] skip write due to preserve: themeConfig.nav'
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('sidebar item collapsed 类型非法时会走校验失败分支', () => {
    const siteConfig = createSiteConfig()
    const invalidCollapsedSidebar = {
      '/x/': [
        {
          text: 'X',
          link: '/x/',
          collapsed: 'yes',
        },
      ],
    } as unknown as DefaultTheme.Sidebar

    mergeThemeConfig(siteConfig, {
      sidebarByLocale: {
        root: invalidCollapsedSidebar,
      },
    })

    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    expect(rootTheme.sidebar).toEqual(invalidCollapsedSidebar)
  })

  it('sidebar multi 多种非法结构均可被识别并回退', () => {
    const siteConfig = createSiteConfig()

    const invalidCases: DefaultTheme.Sidebar[] = [
      [] as unknown as DefaultTheme.Sidebar,
      {
        '/bad1/': 1 as unknown as DefaultTheme.SidebarMulti['/bad1/'],
      },
      {
        '/bad2/': {
          base: '/bad2/',
          items: {} as unknown as DefaultTheme.SidebarItem[],
        },
      },
      {
        '/bad3/': {
          base: '/bad3/',
          items: [{ text: 1 as unknown as string }],
        },
      },
    ]

    for (const sidebar of invalidCases) {
      mergeThemeConfig(siteConfig, {
        sidebarByLocale: {
          root: sidebar,
        },
      })
    }

    const navOnlyResult = mergeThemeConfig(siteConfig, {
      navByLocale: {
        root: [{ text: 'Root', link: '/root/' }],
      },
    })
    expect(navOnlyResult.stats.skips).toBeGreaterThanOrEqual(1)
  })

  it('isSidebarItem 非法分支可覆盖：非对象、link 非字符串、items 结构非法', () => {
    const siteConfig = createSiteConfig()

    const invalidCases: DefaultTheme.Sidebar[] = [
      {
        '/non-object/': [1 as unknown as DefaultTheme.SidebarItem],
      },
      {
        '/bad-link/': [
          {
            text: 'Bad Link',
            link: 1 as unknown as string,
          },
        ],
      },
      {
        '/bad-items-array/': [
          {
            text: 'Bad Items Array',
            items: {} as unknown as DefaultTheme.SidebarItem[],
          },
        ],
      },
      {
        '/bad-items-entry/': [
          {
            text: 'Bad Items Entry',
            items: [1 as unknown as DefaultTheme.SidebarItem],
          },
        ],
      },
    ]

    for (const sidebar of invalidCases) {
      mergeThemeConfig(siteConfig, {
        sidebarByLocale: {
          root: sidebar,
        },
      })
    }

    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    expect(rootTheme.sidebar).toBeDefined()
  })
})
