import { describe, expect, it, vi } from 'vitest'
import type { DefaultTheme, SiteConfig } from 'vitepress'
import { resolveVitePressContext } from '../../src/core/context'

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

describe('resolveVitePressContext', () => {
  it('handles invalid input and missing vitepress context with warnOnce', () => {
    const warn = vi.fn()

    const invalidA = resolveVitePressContext(null, { warn })
    const invalidB = resolveVitePressContext(null, { warn })
    const missingA = resolveVitePressContext({}, { warn })
    const missingB = resolveVitePressContext({}, { warn })

    expect(invalidA.available).toBe(false)
    expect(invalidB.available).toBe(false)
    expect(missingA.available).toBe(false)
    expect(missingB.available).toBe(false)
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('returns runtime context when vitepress config exists', () => {
    const siteConfig = createSiteConfig()
    const result = resolveVitePressContext({
      vitepress: siteConfig,
    })

    expect(result.available).toBe(true)
    expect(result.siteConfig).toBe(siteConfig)
  })
})
