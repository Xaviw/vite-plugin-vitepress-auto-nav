import type {
  AutoNavPluginOptions,
  NormalizedAutoNavOptions,
} from '../types/plugin'
import type { Item, ItemMetaOptions } from '../types/public'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeInclude(include: AutoNavPluginOptions['include']) {
  if (typeof include === 'string') {
    const normalized = include.trim()
    return normalized ? [normalized] : undefined
  }
  if (!Array.isArray(include)) return undefined
  const values = include
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  if (values.length === 0) return undefined
  return [...new Set(values)]
}

function normalizeExclude(exclude: AutoNavPluginOptions['exclude']) {
  if (typeof exclude === 'string') {
    const normalized = exclude.trim()
    return normalized ? [normalized] : undefined
  }
  if (!Array.isArray(exclude)) return undefined
  const values = exclude
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  if (values.length === 0) return undefined
  return [...new Set(values)]
}

function normalizeOverrideKey(key: string) {
  let normalized = key.trim().replace(/\\/g, '/')
  normalized = normalized.replace(/^\.?\//, '')
  normalized = normalized.replace(/\/+$/, '')
  normalized = normalized.replace(/\.md$/i, '')
  return normalized.trim()
}

function normalizeOrder(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value
}

function isItemMetaOptions(value: unknown): value is ItemMetaOptions {
  return isRecord(value)
}

function normalizeOverrideValue(
  value: ItemMetaOptions | undefined
): NormalizedAutoNavOptions['overrides'][string] {
  const source = isItemMetaOptions(value) ? value : {}
  const normalized: NormalizedAutoNavOptions['overrides'][string] = {
    visible: typeof source.visible === 'boolean' ? source.visible : true,
    preferArticleTitle:
      typeof source.preferArticleTitle === 'boolean'
        ? source.preferArticleTitle
        : false,
  }
  const order = normalizeOrder(source.order)
  if (order !== undefined) {
    normalized.order = order
  }
  if (typeof source.displayName === 'string' && source.displayName.trim()) {
    normalized.displayName = source.displayName.trim()
  }
  if (typeof source.collapsed === 'boolean') {
    normalized.collapsed = source.collapsed
  }
  return normalized
}

function normalizeOverrides(overrides: AutoNavPluginOptions['overrides']) {
  if (!isRecord(overrides)) return {}
  const normalized: NormalizedAutoNavOptions['overrides'] = {}
  for (const [key, value] of Object.entries(overrides)) {
    const normalizedKey = normalizeOverrideKey(key)
    if (!normalizedKey) continue
    normalized[normalizedKey] = normalizeOverrideValue(value)
  }
  return normalized
}

// sorter 读取顺序统一收敛到 order：
// 先读运行时注入的 item.options.order，再回退 frontmatter 的 order / prefixOrder。
function extractOrder(item: Item, frontmatterKeyPrefix = '') {
  const fromOptions = isRecord(item.options)
    ? normalizeOrder(item.options.order)
    : undefined
  if (fromOptions !== undefined) return fromOptions

  if (!isRecord(item.frontmatter)) return undefined
  const prefixedOrder = frontmatterKeyPrefix
    ? (normalizeOrder(item.frontmatter[`${frontmatterKeyPrefix}order`]) ??
      normalizeOrder(item.frontmatter[`${frontmatterKeyPrefix}Order`]))
    : undefined
  return prefixedOrder ?? normalizeOrder(item.frontmatter.order)
}

function resolveItemName(item: Item) {
  if (typeof item.name !== 'string') return ''
  return item.name
}

function resolveItemIndex(item: Item) {
  return normalizeOrder(item.index)
}

export function defaultSorter(
  a: Item,
  b: Item,
  frontmatterKeyPrefix = ''
): number {
  const orderA = extractOrder(a, frontmatterKeyPrefix)
  const orderB = extractOrder(b, frontmatterKeyPrefix)

  if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
    return orderA - orderB
  }
  if (orderA !== undefined && orderB === undefined) return -1
  if (orderA === undefined && orderB !== undefined) return 1

  const indexA = resolveItemIndex(a)
  const indexB = resolveItemIndex(b)
  if (indexA !== undefined && indexB !== undefined && indexA !== indexB) {
    return indexA - indexB
  }

  const nameA = resolveItemName(a)
  const nameB = resolveItemName(b)
  if (nameA && nameB && nameA !== nameB) {
    return nameA.localeCompare(nameB, 'zh-CN')
  }

  return 0
}

function createSafeSorter(
  sorter?: (a: Item, b: Item, frontmatterKeyPrefix?: string) => number
) {
  if (typeof sorter !== 'function') return defaultSorter
  return (a: Item, b: Item, frontmatterKeyPrefix = '') => {
    try {
      const result = sorter(a, b, frontmatterKeyPrefix)
      if (typeof result === 'number' && Number.isFinite(result)) {
        return result
      }
      return defaultSorter(a, b, frontmatterKeyPrefix)
    } catch {
      return defaultSorter(a, b, frontmatterKeyPrefix)
    }
  }
}

export function normalizeOptions(
  options: AutoNavPluginOptions = {}
): NormalizedAutoNavOptions {
  const source = isRecord(options) ? options : {}

  return {
    include: normalizeInclude(
      source.include as AutoNavPluginOptions['include']
    ),
    exclude: normalizeExclude(
      source.exclude as AutoNavPluginOptions['exclude']
    ),
    standaloneIndex: source.standaloneIndex === true,
    overrides: normalizeOverrides(
      source.overrides as AutoNavPluginOptions['overrides']
    ),
    frontmatterKeyPrefix:
      typeof source.frontmatterKeyPrefix === 'string'
        ? source.frontmatterKeyPrefix
        : '',
    sorter: createSafeSorter(source.sorter as AutoNavPluginOptions['sorter']),
    preferArticleTitle:
      typeof source.preferArticleTitle === 'boolean'
        ? source.preferArticleTitle
        : false,
    dev: source.dev as AutoNavPluginOptions['dev'],
  }
}
