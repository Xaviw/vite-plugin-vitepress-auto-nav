import { createHash } from 'crypto'
import type { DefaultTheme, SiteConfig } from 'vitepress'
import type { AutoNavPluginOptions } from '../types/plugin'

interface HashRouteRecord {
  route: string
  path: string
  params?: Record<string, string>
  contentHash?: string
}

interface HashRuntimePayload {
  pages: string[]
  rewrites: Record<string, string>
  dynamicRoutes: HashRouteRecord[]
  localeKeys: string[]
  options: Record<string, unknown>
}

function normalizePath(input: string) {
  return input.replace(/\\/g, '/').replace(/^\.?\//, '')
}

function stableSerialize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSerialize)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce(
        (result, key) => {
          result[key] = stableSerialize((value as Record<string, unknown>)[key])
          return result
        },
        {} as Record<string, unknown>
      )
  }

  if (typeof value === 'function') {
    return `[function:${value.name}:${value.length}]`
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  return value
}

function hashJson(value: unknown) {
  return createHash('sha1')
    .update(JSON.stringify(stableSerialize(value)))
    .digest('hex')
}

function toRouteRecord(
  route: SiteConfig<DefaultTheme.Config>['dynamicRoutes']['routes'][number]
): HashRouteRecord {
  return {
    route: normalizePath(route.route),
    path: normalizePath(route.path),
    params: route.params,
    contentHash:
      typeof route.content === 'string' && route.content.length > 0
        ? createHash('sha1').update(route.content).digest('hex')
        : undefined,
  }
}

function isIgnoredLegacySummaryPage(pagePath: string) {
  return (
    normalizePath(pagePath).endsWith('/SUMMARY.md') ||
    normalizePath(pagePath) === 'SUMMARY.md'
  )
}

function toHashOptions(options: AutoNavPluginOptions = {}) {
  return {
    include: options.include,
    exclude: options.exclude,
    standaloneIndex: options.standaloneIndex,
    overrides: options.overrides,
    frontmatterKeyPrefix: options.frontmatterKeyPrefix,
    sorter: options.sorter,
    preferArticleTitle: options.preferArticleTitle,
    dev: options.dev,
  } satisfies Record<string, unknown>
}

export function createRuntimeContextHash(
  siteConfig: SiteConfig<DefaultTheme.Config>,
  options: AutoNavPluginOptions = {}
) {
  const payload: HashRuntimePayload = {
    pages: siteConfig.pages
      .map((page) => normalizePath(page))
      .filter((page) => !isIgnoredLegacySummaryPage(page)),
    rewrites: Object.keys(siteConfig.rewrites?.map ?? {})
      .sort()
      .reduce(
        (result, key) => {
          const rewrite = siteConfig.rewrites?.map?.[key]
          if (rewrite) {
            result[normalizePath(key)] = normalizePath(rewrite)
          }
          return result
        },
        {} as Record<string, string>
      ),
    dynamicRoutes: siteConfig.dynamicRoutes.routes.map(toRouteRecord),
    localeKeys: Object.keys(siteConfig.site.locales ?? {}).sort(),
    options: toHashOptions(options),
  }

  return hashJson(payload)
}

export function createPayloadHash(payload: unknown) {
  return hashJson(payload)
}
