import type { DefaultTheme, SiteConfig } from 'vitepress'
import { createPayloadHash, createRuntimeContextHash } from './cache'
import { resolveVitePressContext } from './context'
import { formatPageSourceStats, resolvePageSource } from './pageSource'
import { formatContentMetaStats, resolveContentMeta } from './contentMeta'
import { buildLocaleTree, formatTreeBuildStats } from './treeBuilder'
import { buildNavByLocale, formatNavBuildStats } from './navBuilder'
import { buildSidebarByLocale, formatSidebarBuildStats } from './sidebarBuilder'
import {
  AUTO_NAV_GENERATED_NAV_MARK,
  AUTO_NAV_GENERATED_SIDEBAR_MARK,
  formatMergeStats,
  mergeThemeConfig,
  type MergePayload,
} from './merger'
import {
  createDebouncedWatchRunner,
  createWatchFileSet,
  resolveWatchDecision,
} from './watcher'
import type { AutoNavPluginOptions } from '../types/plugin'
import type { CompatibleVitePlugin } from '../types/viteCompatible'

interface RouteComputationCache {
  runtimeHash: string
  payloadHash: string
  payload: MergePayload
  pageSourceStats: string
  contentMetaStats: string
  treeStats: string
  navStats: string
  sidebarStats: string
}

type RunTrigger = 'config' | `watch:${string}`

function isWatchTrigger(trigger: RunTrigger) {
  return trigger.startsWith('watch:')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function dedupeNavItemsByLink(
  nav: DefaultTheme.NavItemWithLink[]
): DefaultTheme.NavItemWithLink[] {
  const seenLinks = new Set<string>()
  const deduped: DefaultTheme.NavItemWithLink[] = []

  for (const item of nav) {
    if (seenLinks.has(item.link)) continue
    seenLinks.add(item.link)
    deduped.push(item)
  }

  return deduped
}

function createSidebarItemDedupKey(item: DefaultTheme.SidebarItem): string {
  if (typeof item.link === 'string') {
    return `link:${item.link}`
  }

  return `group:${JSON.stringify({
    text: item.text,
    collapsed: item.collapsed,
    items: item.items?.map(createSidebarItemDedupKey) ?? [],
  })}`
}

function dedupeSidebarItems(
  items: DefaultTheme.SidebarItem[]
): DefaultTheme.SidebarItem[] {
  const seenItems = new Set<string>()
  const deduped: DefaultTheme.SidebarItem[] = []

  for (const item of items) {
    const normalizedItem: DefaultTheme.SidebarItem = {
      text: item.text,
      link: item.link,
      collapsed: item.collapsed,
      items: item.items ? dedupeSidebarItems(item.items) : undefined,
    }

    const dedupeKey = createSidebarItemDedupKey(normalizedItem)
    if (seenItems.has(dedupeKey)) continue
    seenItems.add(dedupeKey)
    deduped.push(normalizedItem)
  }

  return deduped
}

function dedupeGeneratedSidebar(
  sidebar: DefaultTheme.Sidebar
): DefaultTheme.Sidebar {
  const sidebarMulti = sidebar as DefaultTheme.SidebarMulti
  const deduped = Object.keys(sidebarMulti).reduce((result, key) => {
    const value = sidebarMulti[key]
    if (Array.isArray(value)) {
      result[key] = dedupeSidebarItems(value)
      return result
    }

    result[key] = {
      base: value.base,
      items: dedupeSidebarItems(value.items),
    }
    return result
  }, {} as DefaultTheme.SidebarMulti)

  return deduped
}

function finalizeGeneratedThemeConfig(
  siteConfig: SiteConfig<DefaultTheme.Config>
) {
  const applyForTarget = (target: Record<string, unknown> | undefined) => {
    if (!target) return

    if (target[AUTO_NAV_GENERATED_NAV_MARK] === true) {
      if (Array.isArray(target.nav)) {
        target.nav = dedupeNavItemsByLink(
          target.nav as DefaultTheme.NavItemWithLink[]
        )
      }
      delete target[AUTO_NAV_GENERATED_NAV_MARK]
    }

    if (target[AUTO_NAV_GENERATED_SIDEBAR_MARK] === true) {
      if (isObject(target.sidebar)) {
        target.sidebar = dedupeGeneratedSidebar(
          target.sidebar as DefaultTheme.Sidebar
        )
      }
      delete target[AUTO_NAV_GENERATED_SIDEBAR_MARK]
    }
  }

  applyForTarget(siteConfig.site.themeConfig as Record<string, unknown>)

  for (const localeKey of Object.keys(siteConfig.site.locales ?? {})) {
    const localeThemeConfig = siteConfig.site.locales?.[localeKey]
      ?.themeConfig as Record<string, unknown> | undefined
    applyForTarget(localeThemeConfig)
  }
}

export default function createPlugin(
  options: AutoNavPluginOptions
): CompatibleVitePlugin {
  const watchDebounceMs = options.dev?.watchDebounceMs ?? 1500
  const logLevel = options.dev?.logLevel ?? 'info'
  const shouldLogInfo = logLevel !== 'silent'
  const shouldLogDebug = logLevel === 'debug'

  let routeCache: RouteComputationCache | undefined
  let lastRoutePayloadHash: string | undefined

  const info = (message: string) => {
    if (!shouldLogInfo) return
    console.log(message)
  }

  const debug = (message: string) => {
    if (!shouldLogDebug) return
    console.log(message)
  }

  const warn = (message: string) => {
    console.warn(message)
  }

  const resolveRoutePayload = async (
    siteConfig: SiteConfig<DefaultTheme.Config>
  ): Promise<{ cache: RouteComputationCache; fromCache: boolean }> => {
    const runtimeHash = createRuntimeContextHash(siteConfig, options)
    if (routeCache?.runtimeHash === runtimeHash) {
      return {
        cache: routeCache,
        fromCache: true,
      }
    }

    const pageSource = resolvePageSource(siteConfig, options)
    const contentMeta = await resolveContentMeta(
      pageSource.pages,
      siteConfig,
      options,
      { warn }
    )
    const localeTree = buildLocaleTree(contentMeta.pages, options)
    const navResult = buildNavByLocale(localeTree.tree)
    const sidebarResult = buildSidebarByLocale(localeTree.tree)
    const payload: MergePayload = {
      navByLocale: navResult.navByLocale,
      sidebarByLocale: sidebarResult.sidebarByLocale,
    }

    // runtimeHash 负责跳过“输入未变化”的整条计算链；
    // payloadHash 负责在 watch 场景跳过“结果未变化”的重复 merge / reload。
    routeCache = {
      runtimeHash,
      payloadHash: createPayloadHash(payload),
      payload,
      pageSourceStats: formatPageSourceStats(pageSource.stats),
      contentMetaStats: formatContentMetaStats(contentMeta.stats),
      treeStats: formatTreeBuildStats(localeTree.stats),
      navStats: formatNavBuildStats(navResult.stats),
      sidebarStats: formatSidebarBuildStats(sidebarResult.stats),
    }

    return {
      cache: routeCache,
      fromCache: false,
    }
  }

  const runPipeline = async (
    siteConfig: SiteConfig<DefaultTheme.Config>,
    trigger: RunTrigger
  ) => {
    const lifecycleLog = !isWatchTrigger(trigger)
    if (lifecycleLog) {
      info('🎈 auto-nav 生成中...')
    }

    const routeResult = await resolveRoutePayload(siteConfig)
    if (routeResult.fromCache) {
      debug(
        `[vite-plugin-vitepress-auto-nav] skip recompute due to hash: ${routeResult.cache.runtimeHash}`
      )
    }

    if (
      isWatchTrigger(trigger) &&
      routeResult.cache.payloadHash === lastRoutePayloadHash
    ) {
      debug(
        `[vite-plugin-vitepress-auto-nav] skip watch apply due to stable payload hash: ${routeResult.cache.payloadHash}`
      )
      return false
    }

    const mergeResult = mergeThemeConfig(
      siteConfig,
      routeResult.cache.payload,
      {
        info: shouldLogInfo ? info : undefined,
        warn,
      }
    )

    if (shouldLogDebug) {
      debug(`🎈 route source: ${routeResult.cache.pageSourceStats}`)
      debug(`🎈 content meta: ${routeResult.cache.contentMetaStats}`)
      debug(`🎈 locale tree: ${routeResult.cache.treeStats}`)
      debug(`🎈 nav build: ${routeResult.cache.navStats}`)
      debug(`🎈 sidebar build: ${routeResult.cache.sidebarStats}`)
      debug(`🎈 ${formatMergeStats(mergeResult.stats)}`)
    }
    lastRoutePayloadHash = routeResult.cache.payloadHash

    if (lifecycleLog) {
      info('🎈 auto-nav 生成完成')
    }

    return mergeResult.changed
  }

  return {
    name: 'vite-plugin-vitepress-auto-nav',
    async configureServer(server) {
      const runtime = resolveVitePressContext(server.config, {
        scope: 'configureServer',
        warn,
      })
      if (!runtime.siteConfig) return

      const watchFileSet = createWatchFileSet(runtime.siteConfig)
      const scheduleWatchTask = createDebouncedWatchRunner(
        async ({ eventName, path, reason }) => {
          const runtimeContext = resolveVitePressContext(server.config, {
            scope: 'configureServer:watch',
            warn,
          })
          if (!runtimeContext.siteConfig) return

          debug(
            `[vite-plugin-vitepress-auto-nav] watch ${eventName} -> ${reason}: ${path}`
          )
          routeCache = undefined
          const changed = await runPipeline(
            runtimeContext.siteConfig,
            `watch:${reason}`
          )

          if (changed) {
            server.ws.send({
              type: 'full-reload',
            })
          }
        },
        watchDebounceMs
      )

      server.watcher.on('all', (eventName, path) => {
        const decision = resolveWatchDecision(eventName, path, watchFileSet)
        if (!decision.shouldHandle || !decision.reason) return
        scheduleWatchTask(
          eventName as 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir',
          decision.normalizedPath,
          decision.reason
        )
      })
    },
    async config(config) {
      const runtime = resolveVitePressContext(config, {
        scope: 'config',
        warn,
      })
      if (!runtime.siteConfig) return config

      await runPipeline(runtime.siteConfig, 'config')
      return config
    },
    configResolved(config) {
      const runtime = resolveVitePressContext(config, {
        scope: 'configResolved',
        warn,
      })
      if (!runtime.siteConfig) return

      finalizeGeneratedThemeConfig(runtime.siteConfig)
    },
  }
}
