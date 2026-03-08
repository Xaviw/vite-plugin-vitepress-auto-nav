import type { DefaultTheme, SiteConfig } from 'vitepress'

interface MergeLoggers {
  info?: (message: string) => void
  warn?: (message: string) => void
}

export const AUTO_NAV_GENERATED_NAV_MARK = '__autoNavGeneratedNav'
export const AUTO_NAV_GENERATED_SIDEBAR_MARK = '__autoNavGeneratedSidebar'

export interface MergeStats {
  writes: number
  skips: number
  replaces: number
  removals: number
}

interface MergeResult {
  stats: MergeStats
  changed: boolean
}

export interface MergePayload {
  navByLocale?: Record<string, DefaultTheme.NavItemWithLink[]>
  sidebarByLocale?: Record<string, DefaultTheme.Sidebar>
}

type SidebarMultiValue = DefaultTheme.SidebarMulti[string]

function cloneNavItems(items: DefaultTheme.NavItemWithLink[]) {
  return items.map((item) => ({ ...item }))
}

function cloneSidebarItem(
  item: DefaultTheme.SidebarItem
): DefaultTheme.SidebarItem {
  return {
    text: item.text,
    link: item.link,
    collapsed: item.collapsed,
    items: item.items?.map(cloneSidebarItem),
  }
}

function cloneSidebarMultiValue(value: SidebarMultiValue): SidebarMultiValue {
  if (Array.isArray(value)) {
    return value.map(cloneSidebarItem)
  }

  return {
    base: value.base,
    items: value.items.map(cloneSidebarItem),
  }
}

function cloneSidebarMulti(
  sidebar: DefaultTheme.SidebarMulti
): DefaultTheme.SidebarMulti {
  return Object.keys(sidebar).reduce((result, key) => {
    result[key] = cloneSidebarMultiValue(sidebar[key])
    return result
  }, {} as DefaultTheme.SidebarMulti)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isSidebarItem(value: unknown): value is DefaultTheme.SidebarItem {
  if (!isObject(value)) return false
  if (value.text !== undefined && typeof value.text !== 'string') return false
  if (value.link !== undefined && typeof value.link !== 'string') return false
  if (value.collapsed !== undefined && typeof value.collapsed !== 'boolean') {
    return false
  }
  if (value.items !== undefined) {
    if (!Array.isArray(value.items)) return false
    if (!value.items.every(isSidebarItem)) return false
  }
  return true
}

function isSidebarMulti(value: unknown): value is DefaultTheme.SidebarMulti {
  if (!isObject(value)) return false

  for (const key of Object.keys(value)) {
    const multiValue = value[key]
    if (Array.isArray(multiValue)) {
      if (!multiValue.every(isSidebarItem)) return false
      continue
    }

    if (!isObject(multiValue)) return false
    if (!Array.isArray(multiValue.items)) return false
    if (!multiValue.items.every(isSidebarItem)) return false
    if (typeof multiValue.base !== 'string') return false
  }

  return true
}

function resolveThemeConfigTarget(
  siteConfig: SiteConfig<DefaultTheme.Config>,
  localeKey: string,
  warn?: (message: string) => void
) {
  if (localeKey === 'root') {
    return siteConfig.site.themeConfig as Record<string, unknown>
  }

  const localeConfig = siteConfig.site.locales?.[localeKey]
  if (!localeConfig) {
    warn?.(
      `[vite-plugin-vitepress-auto-nav] locale "${localeKey}" not found, skip merge`
    )
    return undefined
  }

  if (!localeConfig.themeConfig) {
    localeConfig.themeConfig = {}
  }

  return localeConfig.themeConfig as Record<string, unknown>
}

function collectMergeLocaleKeys(
  siteConfig: SiteConfig<DefaultTheme.Config>,
  payload: MergePayload
) {
  const localeKeys = new Set<string>([
    ...Object.keys(payload.navByLocale ?? {}),
    ...Object.keys(payload.sidebarByLocale ?? {}),
  ])

  const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
  if (
    rootTheme[AUTO_NAV_GENERATED_NAV_MARK] === true ||
    rootTheme[AUTO_NAV_GENERATED_SIDEBAR_MARK] === true
  ) {
    localeKeys.add('root')
  }

  for (const localeKey of Object.keys(siteConfig.site.locales ?? {})) {
    const localeTheme = siteConfig.site.locales?.[localeKey]?.themeConfig as
      | Record<string, unknown>
      | undefined
    if (!localeTheme) continue

    if (
      localeTheme[AUTO_NAV_GENERATED_NAV_MARK] === true ||
      localeTheme[AUTO_NAV_GENERATED_SIDEBAR_MARK] === true
    ) {
      localeKeys.add(localeKey)
    }
  }

  return Array.from(localeKeys)
}

function cleanupGeneratedField(
  targetThemeConfig: Record<string, unknown>,
  fieldName: 'nav' | 'sidebar',
  stats: MergeStats
) {
  const generatedMark =
    fieldName === 'nav'
      ? AUTO_NAV_GENERATED_NAV_MARK
      : AUTO_NAV_GENERATED_SIDEBAR_MARK

  if (targetThemeConfig[generatedMark] !== true) {
    return
  }

  delete targetThemeConfig[fieldName]
  delete targetThemeConfig[generatedMark]
  stats.removals += 1
}

function applyFixedMerge(
  targetThemeConfig: Record<string, unknown>,
  fieldName: 'nav' | 'sidebar',
  generatedValue: DefaultTheme.NavItemWithLink[] | DefaultTheme.Sidebar,
  localeKey: string,
  loggers: MergeLoggers,
  stats: MergeStats
) {
  const targetLabel =
    localeKey === 'root'
      ? `themeConfig.${fieldName}`
      : `locales.${localeKey}.themeConfig.${fieldName}`

  // 输出策略固定：nav 永远 preserve，避免覆盖用户手写导航；
  // sidebar 视为插件完整托管结果，因此始终 replace。
  if (fieldName === 'nav') {
    if (targetThemeConfig.nav !== undefined) {
      stats.skips += 1
      loggers.info?.(
        `[vite-plugin-vitepress-auto-nav] skip write due to preserve: ${targetLabel}`
      )
      return
    }
    targetThemeConfig.nav = generatedValue
    targetThemeConfig[AUTO_NAV_GENERATED_NAV_MARK] = true
    stats.writes += 1
    return
  }

  targetThemeConfig.sidebar = generatedValue
  targetThemeConfig[AUTO_NAV_GENERATED_SIDEBAR_MARK] = true
  stats.replaces += 1
  stats.writes += 1
}

export function mergeThemeConfig(
  siteConfig: SiteConfig<DefaultTheme.Config>,
  payload: MergePayload,
  loggers: MergeLoggers = {}
): MergeResult {
  const localeKeys = collectMergeLocaleKeys(siteConfig, payload)

  const stats: MergeStats = {
    writes: 0,
    skips: 0,
    replaces: 0,
    removals: 0,
  }

  // merge 不仅要处理“本轮有生成结果”的 locale，
  // 还要处理“上一轮曾自动生成、但本轮已经为空”的 locale。
  // 否则删除最后一个页面后，旧 sidebar/nav 会残留在 themeConfig 中。
  for (const localeKey of localeKeys) {
    const target = resolveThemeConfigTarget(siteConfig, localeKey, loggers.warn)
    if (!target) continue

    const localeNav = payload.navByLocale?.[localeKey]
    if (localeNav) {
      applyFixedMerge(
        target,
        'nav',
        cloneNavItems(localeNav),
        localeKey,
        loggers,
        stats
      )
    } else {
      cleanupGeneratedField(target, 'nav', stats)
    }

    const localeSidebar = payload.sidebarByLocale?.[localeKey]
    if (localeSidebar) {
      const safeSidebar = isSidebarMulti(localeSidebar)
        ? cloneSidebarMulti(localeSidebar)
        : localeSidebar
      // sidebar 是插件的完整托管输出：有值时覆盖，无值时清理旧自动生成结果。
      applyFixedMerge(target, 'sidebar', safeSidebar, localeKey, loggers, stats)
    } else {
      cleanupGeneratedField(target, 'sidebar', stats)
    }
  }

  return {
    stats,
    changed: stats.writes > 0 || stats.removals > 0,
  }
}

export function formatMergeStats(stats: MergeStats) {
  return `merge writes=${stats.writes}, skips=${stats.skips}, replaced=${stats.replaces}, removed=${stats.removals}`
}
