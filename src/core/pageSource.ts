import type { DefaultTheme, SiteConfig } from 'vitepress'
import type { AutoNavPluginOptions } from '../types/plugin'
import type {
  NormalizedRuntimeContext,
  ResolvedPage,
  RuntimeDynamicRoute,
} from '../types/model'

export interface PageSourceStats {
  rawPagesCount: number
  uniquePagesCount: number
  rawDynamicRoutesCount: number
  uniqueDynamicRoutesCount: number
  resolvedPagesCount: number
  uniqueResolvedPagesCount: number
}

export interface PageSourceResult {
  pages: ResolvedPage[]
  context: NormalizedRuntimeContext
  stats: PageSourceStats
}

function normalizePath(path: string | undefined): string {
  return (path ?? '').replace(/\\/g, '/').replace(/^\.?\//, '')
}

function toRoutePath(pagePath: string): string {
  const normalized = normalizePath(pagePath)
  const withoutExtension = normalized.replace(/\.md$/, '')
  const withLeadingSlash = `/${withoutExtension}`
  if (withoutExtension === 'index') return '/'
  return withLeadingSlash.replace(/\/index$/, '/')
}

function resolveLocaleKey(pagePath: string, localeKeys: string[]) {
  const normalized = normalizePath(pagePath)
  const firstSegment = normalized.split('/')[0]
  if (localeKeys.includes(firstSegment)) return firstSegment
  return 'root'
}

function getUniqueList(items: string[]) {
  return Array.from(new Set(items))
}

function normalizeRewriteMap(
  input: Record<string, string | undefined> | undefined
) {
  if (!input) return {}
  return Object.keys(input).reduce(
    (result, key) => {
      const value = input[key]
      if (typeof value === 'string' && value.length > 0) {
        result[normalizePath(key)] = normalizePath(value)
      }
      return result
    },
    {} as Record<string, string>
  )
}

function stableStringify(value: Record<string, string> | undefined) {
  if (!value) return '{}'
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce(
        (result, key) => {
          result[key] = value[key]
          return result
        },
        {} as Record<string, string>
      )
  )
}

function normalizeDynamicRoutes(
  routes: SiteConfig<DefaultTheme.Config>['dynamicRoutes']['routes']
): RuntimeDynamicRoute[] {
  return routes.map((route) => ({
    route: normalizePath(route.route),
    path: normalizePath(route.path),
    params: route.params,
    content: route.content,
  }))
}

function dedupeDynamicRoutes(dynamicRoutes: RuntimeDynamicRoute[]) {
  const map = new Map<string, RuntimeDynamicRoute>()
  for (const route of dynamicRoutes) {
    const key = `${route.route}|${route.path}|${stableStringify(route.params)}`
    if (!map.has(key)) {
      map.set(key, route)
    }
  }
  return Array.from(map.values())
}

function globToRegExp(glob: string) {
  const normalized = normalizePath(glob)
  let pattern = '^'

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const next = normalized[index + 1]

    if (char === '*' && next === '*') {
      const after = normalized[index + 2]
      if (after === '/') {
        pattern += '(?:.*/)?'
        index += 2
        continue
      }
      pattern += '.*'
      index += 1
      continue
    }

    if (char === '*') {
      pattern += '[^/]*'
      continue
    }

    if (char === '?') {
      pattern += '[^/]'
      continue
    }

    if ('\\.^$+{}[]()|'.includes(char)) {
      pattern += `\\${char}`
    } else {
      pattern += char
    }
  }

  pattern += '$'
  return new RegExp(pattern)
}

function normalizePatternList(input?: string | string[]) {
  if (input == null) return []
  const patterns = Array.isArray(input) ? input : [input]
  return patterns.map(normalizePath).filter((pattern) => pattern.length > 0)
}

function isIgnoredLegacySummaryPage(pagePath: string) {
  return (
    normalizePath(pagePath).endsWith('/SUMMARY.md') ||
    normalizePath(pagePath) === 'SUMMARY.md'
  )
}

function matchesAnyPattern(path: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(path))
}

function shouldKeepPage(
  page: ResolvedPage,
  includePatterns: RegExp[],
  excludePatterns: RegExp[]
) {
  const targets = [page.sourcePage, page.resolvedPage, page.rewrittenPage]

  if (targets.some((target) => isIgnoredLegacySummaryPage(target))) {
    return false
  }

  if (
    includePatterns.length > 0 &&
    !targets.some((target) => matchesAnyPattern(target, includePatterns))
  ) {
    return false
  }

  if (
    excludePatterns.length > 0 &&
    targets.some((target) => matchesAnyPattern(target, excludePatterns))
  ) {
    return false
  }

  return true
}

function isRootOrLocaleRootIndexPage(page: ResolvedPage, localeKeys: string[]) {
  const normalized = normalizePath(page.rewrittenPage)
  if (normalized === 'index.md') return true

  const parts = normalized.split('/')
  if (parts.length !== 2) return false

  const [firstSegment, fileName] = parts
  if (fileName !== 'index.md') return false
  return localeKeys.includes(firstSegment)
}

export function resolvePageSource(
  siteConfig: SiteConfig<DefaultTheme.Config>,
  options: AutoNavPluginOptions = {}
): PageSourceResult {
  const rewritesMap = normalizeRewriteMap(siteConfig.rewrites?.map)
  const rewritesInv = normalizeRewriteMap(siteConfig.rewrites?.inv)

  // runtime pages 是唯一可信输入，但这里仍需先过滤空值/异常值。
  // 否则 undefined 或空字符串会被归一化成空路径，继续流入后续链路后
  // 可能生成 routePath='/' 的幽灵条目，并触发对 srcDir 的误读取。
  const runtimePages = siteConfig.pages
    .map((page) => normalizePath(page))
    .filter((page) => page.length > 0)
  const rawDynamicRoutes = normalizeDynamicRoutes(
    siteConfig.dynamicRoutes.routes
  )
  const uniqueDynamicRoutes = dedupeDynamicRoutes(rawDynamicRoutes)

  const dynamicRoutesByPath = uniqueDynamicRoutes.reduce((result, route) => {
    const list = result.get(route.path) || []
    list.push(route)
    result.set(route.path, list)
    return result
  }, new Map<string, RuntimeDynamicRoute[]>())

  const dynamicRoutesByRoute = uniqueDynamicRoutes.reduce((result, route) => {
    const list = result.get(route.route) || []
    list.push(route)
    result.set(route.route, list)
    return result
  }, new Map<string, RuntimeDynamicRoute[]>())

  const rawPages = runtimePages.map((page) => {
    return normalizePath(rewritesInv[page] || page)
  })

  const uniquePages = getUniqueList(rawPages)

  const localeKeys = getUniqueList(
    Object.keys(siteConfig.site.locales || {})
      .map((key) => normalizePath(key).split('/')[0])
      .filter((key) => key && key !== 'root')
  )

  const includeInput = options.include
  const excludeInput = options.exclude
  const includePatterns = normalizePatternList(includeInput).map((glob) =>
    globToRegExp(glob)
  )
  const excludePatterns = normalizePatternList(excludeInput).map((glob) =>
    globToRegExp(glob)
  )

  const resolvedPages = uniquePages.map((rawPage) => {
    const dynamicMatch =
      dynamicRoutesByPath.get(rawPage)?.[0] ??
      dynamicRoutesByRoute.get(rawPage)?.[0]

    const sourcePage = dynamicMatch?.route || rawPage
    const resolvedPage = dynamicMatch?.path || rawPage
    const rewrittenPage = normalizePath(
      rewritesMap[resolvedPage] || rewritesMap[sourcePage] || resolvedPage
    )
    const localeKey = resolveLocaleKey(rewrittenPage, localeKeys)

    return {
      sourcePage,
      resolvedPage,
      rewrittenPage,
      localeKey,
      routePath: toRoutePath(rewrittenPage),
      params: dynamicMatch?.params,
      content: dynamicMatch?.content,
    } satisfies ResolvedPage
  })

  const filteredResolvedPages = resolvedPages.filter((page) => {
    if (isRootOrLocaleRootIndexPage(page, localeKeys)) return false
    return shouldKeepPage(page, includePatterns, excludePatterns)
  })

  const dedupePageMap = new Map<string, ResolvedPage>()
  for (const page of filteredResolvedPages) {
    const key = `${page.rewrittenPage}|${page.sourcePage}`
    if (!dedupePageMap.has(key)) {
      dedupePageMap.set(key, page)
    }
  }
  const uniqueResolvedPages = Array.from(dedupePageMap.values())

  const uniqueRewrittenPages = getUniqueList(
    uniqueResolvedPages.map((page) => page.rewrittenPage)
  )

  const pageToSourceMap = Object.keys(rewritesInv).reduce(
    (result, rewrittenPage) => {
      result[normalizePath(rewrittenPage)] = normalizePath(
        rewritesInv[rewrittenPage]
      )
      return result
    },
    {} as Record<string, string | undefined>
  )

  const context: NormalizedRuntimeContext = {
    uniquePages,
    uniqueRewrittenPages,
    uniqueDynamicRoutes,
    pageToSourceMap,
  }

  const stats: PageSourceStats = {
    rawPagesCount: rawPages.length,
    uniquePagesCount: uniquePages.length,
    rawDynamicRoutesCount: rawDynamicRoutes.length,
    uniqueDynamicRoutesCount: uniqueDynamicRoutes.length,
    resolvedPagesCount: resolvedPages.length,
    uniqueResolvedPagesCount: uniqueResolvedPages.length,
  }

  return {
    pages: uniqueResolvedPages,
    context,
    stats,
  }
}

export function formatPageSourceStats(stats: PageSourceStats) {
  return `pages ${stats.rawPagesCount}->${stats.uniquePagesCount}, dynamic ${stats.rawDynamicRoutesCount}->${stats.uniqueDynamicRoutesCount}, resolved ${stats.resolvedPagesCount}->${stats.uniqueResolvedPagesCount}`
}
