import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { DefaultTheme, SiteConfig } from 'vitepress'

interface DynamicRouteProbeItem {
  route: string
  path: string
  hasContent: boolean
}

interface ThemeConfigProbe {
  nav: unknown
  sidebar: unknown
}

interface VitePressProbePayload {
  pageCount: number
  uniquePageCount: number
  rewrittenPageCount: number
  uniqueRewrittenPageCount: number
  rewrittenPages: string[]
  rewritesMap: Record<string, string>
  dynamicRoutes: DynamicRouteProbeItem[]
  site: {
    localeKeys: string[]
    themeConfig: ThemeConfigProbe
    localeThemeConfig: Record<string, ThemeConfigProbe>
  }
}

export interface AutoNavTestProbeSnapshot {
  caseName: string
  capturedAt: string
  vitepress: VitePressProbePayload
}

interface ResolvedConfigLike {
  vitepress?: SiteConfig<DefaultTheme.Config>
}

interface ProbePluginLike {
  name: string
  enforce?: 'pre' | 'post'
  configResolved?: (config: unknown) => void
  closeBundle?: () => void | Promise<void>
}

function normalizePath(input: string | undefined): string {
  return (input ?? '').replace(/\\/g, '/').replace(/^\.?\//, '')
}

function dedupeList(items: string[]) {
  return Array.from(new Set(items))
}

function pickThemeConfig(themeConfig: unknown): ThemeConfigProbe {
  if (!themeConfig || typeof themeConfig !== 'object') {
    return {
      nav: undefined,
      sidebar: undefined,
    }
  }

  const value = themeConfig as Record<string, unknown>
  return {
    nav: value.nav,
    sidebar: value.sidebar,
  }
}

function collectSnapshot(
  caseName: string,
  siteConfig: SiteConfig<DefaultTheme.Config>
): AutoNavTestProbeSnapshot {
  const pages = Array.isArray(siteConfig.pages)
    ? siteConfig.pages.map((page) => normalizePath(page))
    : []
  const rewritesMap = Object.entries(siteConfig.rewrites?.map ?? {}).reduce(
    (result, [source, target]) => {
      result[normalizePath(source)] = normalizePath(target)
      return result
    },
    {} as Record<string, string>
  )

  const rewrittenPages = pages.map((page) => rewritesMap[page] ?? page)
  const localeThemeConfig = Object.keys(siteConfig.site.locales ?? {}).reduce(
    (result, key) => {
      result[key] = pickThemeConfig(siteConfig.site.locales?.[key]?.themeConfig)
      return result
    },
    {} as Record<string, ThemeConfigProbe>
  )

  return {
    caseName,
    capturedAt: new Date().toISOString(),
    vitepress: {
      pageCount: pages.length,
      uniquePageCount: dedupeList(pages).length,
      rewrittenPageCount: rewrittenPages.length,
      uniqueRewrittenPageCount: dedupeList(rewrittenPages).length,
      rewrittenPages: dedupeList(rewrittenPages),
      rewritesMap,
      dynamicRoutes: (siteConfig.dynamicRoutes?.routes ?? []).map((item) => ({
        route: normalizePath(item.route),
        path: normalizePath(item.path),
        hasContent: typeof item.content === 'string',
      })),
      site: {
        localeKeys: Object.keys(siteConfig.site.locales ?? {}),
        themeConfig: pickThemeConfig(siteConfig.site.themeConfig),
        localeThemeConfig,
      },
    },
  }
}

export function autoNavTestProbePlugin(caseName: string): ProbePluginLike {
  let resolvedConfig: ResolvedConfigLike | undefined

  return {
    name: 'auto-nav-test-probe',
    enforce: 'post',
    configResolved(config) {
      resolvedConfig = config as ResolvedConfigLike
    },
    async closeBundle() {
      const outputFile = process.env.AUTO_NAV_TEST_PROBE_OUTPUT_FILE
      if (!outputFile) return
      if (!resolvedConfig) return

      const siteConfig = resolvedConfig.vitepress

      if (!siteConfig) {
        throw new Error(
          '[auto-nav-test-probe] vitepress runtime context is unavailable'
        )
      }

      const snapshot = collectSnapshot(caseName, siteConfig)
      await mkdir(path.dirname(outputFile), { recursive: true })
      await writeFile(outputFile, JSON.stringify(snapshot, null, 2), 'utf-8')
    },
  }
}
