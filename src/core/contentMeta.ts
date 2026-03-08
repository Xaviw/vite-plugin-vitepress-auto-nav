import type { DefaultTheme, SiteConfig } from 'vitepress'
import { createHash } from 'crypto'
import { readFile, stat } from 'fs/promises'
import { resolve, sep } from 'path'
import matter from 'gray-matter'
import type { AutoNavPluginOptions } from '../types/plugin'
import type { ItemMetaOptions } from '../types/public'
import type {
  EffectiveItemMeta,
  PageContentMeta,
  ResolvedPage,
} from '../types/model'

type DomainContentOptions = AutoNavPluginOptions
type DomainItemSetting = ItemMetaOptions

interface ParsedContentMeta {
  frontmatter: Record<string, unknown>
  h1?: string
}

interface ContentMetaStats {
  pagesCount: number
  hiddenPagesCount: number
  inlineContentCount: number
  dynamicTemplateFallbackCount: number
  missingTemplateCount: number
}

interface ContentMetaResult {
  pages: PageContentMeta[]
  stats: ContentMetaStats
}

interface ResolveContentMetaOptions {
  warn?: (message: string) => void
}

const parsedContentCache = new Map<string, ParsedContentMeta>()
const warnedIssues = new Set<string>()

function normalizePath(input: string) {
  return input.replace(/\\/g, '/').replace(/^\.?\//, '')
}

function removeMdExtension(input: string) {
  return input.endsWith('.md') ? input.slice(0, -3) : input
}

function getBasename(relativePath: string) {
  const normalized = normalizePath(relativePath)
  const parts = normalized.split('/')
  return parts[parts.length - 1]
}

function getParentDir(relativePath: string) {
  const normalized = normalizePath(relativePath)
  const parts = normalized.split('/')
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}

function isIndexMarkdownPath(relativePath: string) {
  return getBasename(relativePath) === 'index.md'
}

function parseBool(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function parseNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function warnOnce(
  key: string,
  message: string,
  warn?: (message: string) => void
) {
  if (!warn || warnedIssues.has(key)) return
  warnedIssues.add(key)
  warn(message)
}

function getArticleTitle(content: string, data: Record<string, unknown>) {
  let h1 = content.match(/^\s*#\s+(.*)[\n\r][\s\S]*/)?.[1]
  if (h1) {
    const regexp = /\{\{\s*\$frontmatter\.(\S+?)\s*\}\}/g
    let match
    while ((match = regexp.exec(h1)) !== null) {
      const replaceReg = new RegExp(
        '\\{\\{\\s*\\$frontmatter\\.' + match[1] + '\\s*\\}\\}',
        'g'
      )
      h1 = h1.replace(replaceReg, String(data[match[1]] ?? ''))
    }
  }
  return h1
}

function resolveFrontmatterField<T>(
  frontmatter: Record<string, unknown>,
  prefix: string,
  keys: string[],
  parse: (value: unknown) => T | undefined
) {
  if (prefix) {
    for (const key of keys) {
      const candidates = [
        `${prefix}${key}`,
        `${prefix}${key[0].toUpperCase()}${key.slice(1)}`,
      ]
      for (const candidate of candidates) {
        if (frontmatter[candidate] !== undefined) {
          const parsed = parse(frontmatter[candidate])
          if (parsed !== undefined) {
            return parsed
          }
          break
        }
      }
    }
  }

  for (const key of keys) {
    const parsed = parse(frontmatter[key])
    if (parsed !== undefined) {
      return parsed
    }
  }

  return undefined
}

function normalizeItemsSetting(options: DomainContentOptions) {
  const normalized: Record<string, DomainItemSetting> = {}
  const overrideSettings = options.overrides ?? {}

  return Object.keys(overrideSettings).reduce((result, key) => {
    result[normalizePath(key)] = overrideSettings[key]
    return result
  }, normalized)
}

function resolveItemSetting(
  page: ResolvedPage,
  normalizedSettings: Record<string, DomainItemSetting>
) {
  const sourcePage = normalizePath(page.sourcePage)
  const resolvedPage = normalizePath(page.resolvedPage)
  const rewrittenPage = normalizePath(page.rewrittenPage)
  const sourceNoExt = removeMdExtension(sourcePage)
  const resolvedNoExt = removeMdExtension(resolvedPage)
  const rewrittenNoExt = removeMdExtension(rewrittenPage)
  const sourceBase = getBasename(sourcePage)
  const sourceBaseNoExt = removeMdExtension(sourceBase)
  const isDirectoryIndexPage =
    isIndexMarkdownPath(sourcePage) ||
    isIndexMarkdownPath(resolvedPage) ||
    isIndexMarkdownPath(rewrittenPage)

  const candidates = [
    sourcePage,
    sourceNoExt,
    resolvedPage,
    resolvedNoExt,
    rewrittenPage,
    rewrittenNoExt,
    sourceBase,
    sourceBaseNoExt,
  ]

  if (isDirectoryIndexPage) {
    const sourceDir = getParentDir(sourcePage)
    const resolvedDir = getParentDir(resolvedPage)
    const rewrittenDir = getParentDir(rewrittenPage)
    const sourceDirBase = sourceDir ? getBasename(sourceDir) : ''
    const resolvedDirBase = resolvedDir ? getBasename(resolvedDir) : ''
    const rewrittenDirBase = rewrittenDir ? getBasename(rewrittenDir) : ''

    candidates.push(
      sourceDir,
      resolvedDir,
      rewrittenDir,
      sourceDirBase,
      resolvedDirBase,
      rewrittenDirBase
    )
  }

  for (const candidate of candidates) {
    if (normalizedSettings[candidate]) {
      return normalizedSettings[candidate]
    }
  }

  return undefined
}

// 统一解析单个条目的最终元数据：
// 1. frontmatter（含前缀字段）优先；
// 2. 其次读取 overrides；
// 3. 最后回退全局默认值。
// 这样可以保证页面自身声明始终比外部覆盖更高优先级。
function resolveItemMeta(
  frontmatter: Record<string, unknown>,
  itemSetting: DomainItemSetting | undefined,
  options: DomainContentOptions
): EffectiveItemMeta {
  const prefix = options.frontmatterKeyPrefix ?? ''
  const globalPreferArticleTitle = options.preferArticleTitle ?? false

  const visible =
    resolveFrontmatterField(frontmatter, prefix, ['visible'], parseBool) ??
    itemSetting?.visible ??
    true

  const order =
    resolveFrontmatterField(frontmatter, prefix, ['order'], parseNumber) ??
    itemSetting?.order

  const displayName =
    resolveFrontmatterField(
      frontmatter,
      prefix,
      ['displayName'],
      parseString
    ) ?? itemSetting?.displayName

  const preferArticleTitle =
    resolveFrontmatterField(
      frontmatter,
      prefix,
      ['preferArticleTitle'],
      parseBool
    ) ??
    itemSetting?.preferArticleTitle ??
    globalPreferArticleTitle

  const collapsed =
    resolveFrontmatterField(frontmatter, prefix, ['collapsed'], parseBool) ??
    itemSetting?.collapsed

  return {
    visible,
    order,
    displayName,
    preferArticleTitle,
    collapsed,
  }
}

function getContentSignature(content: string) {
  return createHash('sha1').update(content).digest('hex')
}

function pruneContentCache(activeCacheKeys: Set<string>) {
  for (const key of parsedContentCache.keys()) {
    if (!activeCacheKeys.has(key)) {
      parsedContentCache.delete(key)
    }
  }
}

async function readParsedContent(
  absolutePath: string,
  inlineContent: string | undefined,
  useCache: boolean,
  activeCacheKeys: Set<string>,
  warn?: (message: string) => void
): Promise<{ parsed: ParsedContentMeta; missingTemplate: boolean }> {
  if (inlineContent != null) {
    const signature = `inline:${absolutePath}:${getContentSignature(inlineContent)}`
    activeCacheKeys.add(signature)
    if (useCache) {
      const cached = parsedContentCache.get(signature)
      if (cached) {
        return { parsed: cached, missingTemplate: false }
      }
    }

    const { content, data } = matter(inlineContent)
    const parsed: ParsedContentMeta = {
      frontmatter: data as Record<string, unknown>,
      h1: getArticleTitle(content, data as Record<string, unknown>),
    }
    if (useCache) {
      parsedContentCache.set(signature, parsed)
    }
    return { parsed, missingTemplate: false }
  }

  try {
    const { mtimeMs, size } = await stat(absolutePath)
    const signature = `file:${absolutePath}:${mtimeMs}`
    const cacheKey = `${signature}:${size}`
    activeCacheKeys.add(cacheKey)
    if (useCache) {
      const cached = parsedContentCache.get(cacheKey)
      if (cached) {
        return { parsed: cached, missingTemplate: false }
      }
    }

    const raw = await readFile(absolutePath, 'utf-8')
    const { content, data } = matter(raw)
    const parsed: ParsedContentMeta = {
      frontmatter: data as Record<string, unknown>,
      h1: getArticleTitle(content, data as Record<string, unknown>),
    }
    if (useCache) {
      parsedContentCache.set(cacheKey, parsed)
    }
    return { parsed, missingTemplate: false }
  } catch {
    warnOnce(
      `missing-template:${absolutePath}`,
      `[vite-plugin-vitepress-auto-nav] missing template markdown: ${absolutePath}`,
      warn
    )
    return {
      parsed: {
        frontmatter: {},
        h1: undefined,
      },
      missingTemplate: true,
    }
  }
}

function resolveDisplayText(
  page: ResolvedPage,
  parsed: ParsedContentMeta,
  meta: EffectiveItemMeta
) {
  if (meta.displayName) return meta.displayName
  if (meta.preferArticleTitle && parsed.h1) return parsed.h1

  const basename = getBasename(page.rewrittenPage)
  if (basename !== 'index.md') {
    return removeMdExtension(basename)
  }

  const parentDir = getParentDir(page.rewrittenPage)
  if (!parentDir) return 'index'
  return getBasename(parentDir)
}

export async function resolveContentMeta(
  pages: ResolvedPage[],
  siteConfig: SiteConfig<DefaultTheme.Config>,
  options: AutoNavPluginOptions = {},
  resolveOptions: ResolveContentMetaOptions = {}
): Promise<ContentMetaResult> {
  const srcDir = siteConfig.srcDir.split(sep).join('/')
  const useCache = options.dev?.cache !== false
  const activeCacheKeys = new Set<string>()
  const normalizedItemsSetting = normalizeItemsSetting(options)

  if (!useCache) {
    parsedContentCache.clear()
  }

  let inlineContentCount = 0
  let dynamicTemplateFallbackCount = 0
  let missingTemplateCount = 0

  const mapped = await Promise.all(
    pages.map(async (page, sourceOrder) => {
      const absolutePath = resolve(srcDir, page.sourcePage)
      const { parsed, missingTemplate } = await readParsedContent(
        absolutePath,
        page.content,
        useCache,
        activeCacheKeys,
        resolveOptions.warn
      )

      if (page.content != null) {
        inlineContentCount += 1
      } else if (page.params) {
        dynamicTemplateFallbackCount += 1
      }
      if (missingTemplate) {
        missingTemplateCount += 1
      }

      const itemSetting = resolveItemSetting(page, normalizedItemsSetting)
      const itemMeta = resolveItemMeta(parsed.frontmatter, itemSetting, options)
      const displayText = resolveDisplayText(page, parsed, itemMeta)

      const result: PageContentMeta = {
        ...page,
        sourceOrder,
        absolutePath,
        frontmatter: parsed.frontmatter,
        h1: parsed.h1,
        itemMeta,
        displayText,
      }

      return result
    })
  )

  const hiddenPagesCount = mapped.filter(
    (page) => !page.itemMeta.visible
  ).length
  if (useCache) {
    pruneContentCache(activeCacheKeys)
  }

  return {
    pages: mapped,
    stats: {
      pagesCount: mapped.length,
      hiddenPagesCount,
      inlineContentCount,
      dynamicTemplateFallbackCount,
      missingTemplateCount,
    },
  }
}

export function formatContentMetaStats(stats: ContentMetaStats) {
  return `meta pages=${stats.pagesCount}, hidden=${stats.hiddenPagesCount}, inline=${stats.inlineContentCount}, fallback=${stats.dynamicTemplateFallbackCount}, missingTemplate=${stats.missingTemplateCount}`
}
