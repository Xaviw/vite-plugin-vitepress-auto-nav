import type { AutoNavPluginOptions } from '../types/plugin'
import type { LocaleTree, PageContentMeta, TreeNode } from '../types/model'
import type { Item } from '../types/public'
import { normalizeOptions } from './normalizeOptions'

type DomainTreeOptions = AutoNavPluginOptions

interface TreeBuildStats {
  localeCount: number
  pageNodeCount: number
  folderNodeCount: number
}

interface LocaleTreeBuildResult {
  tree: LocaleTree
  stats: TreeBuildStats
}

function normalizePath(input: string) {
  return input.replace(/\\/g, '/').replace(/^\.?\//, '')
}

function normalizeOverrideKey(key: string) {
  let normalized = normalizePath(key).replace(/\/+$/, '')
  normalized = normalized.replace(/\.md$/i, '')
  return normalized
}

function buildFolderDisplayNameMap(options: DomainTreeOptions) {
  const overrides = options.overrides ?? {}
  const map: Record<string, string> = {}

  for (const key of Object.keys(overrides)) {
    const normalizedKey = normalizeOverrideKey(key)
    if (!normalizedKey) continue

    const displayName = overrides[key]?.displayName
    if (typeof displayName !== 'string') continue
    const trimmed = displayName.trim()
    if (!trimmed) continue
    map[normalizedKey] = trimmed
  }

  return map
}

function resolveFolderDisplayName(
  localeKey: string,
  localeRelativeFolderPath: string,
  folderName: string,
  folderDisplayNameMap: Record<string, string>
) {
  const normalizedFolderPath = normalizeOverrideKey(localeRelativeFolderPath)
  const normalizedLocalePath =
    localeKey === 'root'
      ? normalizedFolderPath
      : normalizeOverrideKey(`${localeKey}/${normalizedFolderPath}`)

  const candidates = [
    normalizedLocalePath,
    normalizedFolderPath,
    normalizeOverrideKey(folderName),
  ]

  for (const candidate of candidates) {
    if (folderDisplayNameMap[candidate]) {
      return folderDisplayNameMap[candidate]
    }
  }

  return folderName
}

function toLocaleRelativePath(rewrittenPage: string, localeKey: string) {
  const normalized = normalizePath(rewrittenPage)
  if (localeKey === 'root') return normalized

  const localePrefix = `${localeKey}/`
  if (!normalized.startsWith(localePrefix)) return normalized
  return normalized.slice(localePrefix.length)
}

function toFolderRoutePath(parentRoutePath: string, folderName: string) {
  if (parentRoutePath === '/') return `/${folderName}/`
  return `${parentRoutePath}${folderName}/`
}

// 将树节点映射成 sorter 需要的 Item 形状。
// 这里只暴露当前规范字段，避免排序阶段重新引入历史兼容字段。
function createComparableItem(node: TreeNode, index: number): Item {
  const order = node.sourceOrder ?? index
  return {
    index,
    name: node.name,
    isFolder: node.isFolder,
    options: {
      order: node.order,
      collapsed: node.collapsed,
      birthTime: order,
      modifyTime: order,
      firstCommitTime: order,
      lastCommitTime: order,
    },
    frontmatter: (node.frontmatter ?? {}) as Item['frontmatter'],
    children: [],
  }
}

function sortNodes(nodes: TreeNode[], options: DomainTreeOptions) {
  const domainOptions = options
  const compareFn = normalizeOptions(domainOptions).sorter
  const frontmatterPrefix = domainOptions.frontmatterKeyPrefix ?? ''

  nodes.sort((a, b) => {
    const left = createComparableItem(a, a.sourceOrder ?? 0)
    const right = createComparableItem(b, b.sourceOrder ?? 0)

    // sorter 在 normalizeOptions 中已经被包装为安全函数，
    // 这里直接调用即可；若比较结果仍为 0，再退回 sourceOrder 保持稳定排序。
    const result = compareFn(left, right, frontmatterPrefix)
    if (result !== 0) return result
    return (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0)
  })
  for (const node of nodes) {
    if (node.children.length) sortNodes(node.children, options)
  }
}

function createFolderNode(
  name: string,
  text: string,
  localeKey: string,
  routePath: string,
  sourceOrder?: number
): TreeNode {
  return {
    name,
    text,
    isFolder: true,
    localeKey,
    routePath,
    sourceOrder,
    children: [],
  }
}

function createPageNode(page: PageContentMeta): TreeNode {
  const fileName =
    normalizePath(page.rewrittenPage).split('/').pop() || page.rewrittenPage
  return {
    name: fileName,
    text: page.displayText,
    isFolder: false,
    isIndexPage: fileName === 'index.md',
    localeKey: page.localeKey,
    routePath: page.routePath,
    sourceOrder: page.sourceOrder,
    order: page.itemMeta.order,
    collapsed: page.itemMeta.collapsed,
    frontmatter: page.frontmatter,
    sourcePagePath: page.sourcePage,
    sourcePage: page.sourcePage,
    rewrittenPage: page.rewrittenPage,
    params: page.params,
    content: page.content,
    children: [],
  }
}

function ensureFolderNode(
  children: TreeNode[],
  name: string,
  text: string,
  localeKey: string,
  routePath: string,
  sourceOrder?: number
) {
  let node = children.find((item) => item.isFolder && item.name === name)
  if (!node) {
    node = createFolderNode(name, text, localeKey, routePath, sourceOrder)
    children.push(node)
    return { node, created: true }
  }
  node.text = text
  if (sourceOrder != null) {
    node.sourceOrder =
      node.sourceOrder == null
        ? sourceOrder
        : Math.min(node.sourceOrder, sourceOrder)
  }
  return { node, created: false }
}

function applyIndexToFolder(folderNode: TreeNode, page: PageContentMeta) {
  folderNode.sourceOrder = page.sourceOrder
  folderNode.order = page.itemMeta.order
  folderNode.collapsed = page.itemMeta.collapsed
  folderNode.frontmatter = page.frontmatter
  folderNode.sourcePagePath = page.sourcePage
  folderNode.sourcePage = page.sourcePage
  folderNode.rewrittenPage = page.rewrittenPage
  folderNode.params = page.params
  folderNode.content = page.content
  folderNode.routePath = page.routePath
}

export function buildLocaleTree(
  pages: PageContentMeta[],
  options: AutoNavPluginOptions = {}
): LocaleTreeBuildResult {
  const domainOptions = options
  const standaloneIndex = domainOptions.standaloneIndex === true
  // standaloneIndex=false 时，目录 index.md 提升为目录自身链接；
  // standaloneIndex=true 时，index.md 作为目录下的独立 page node 保留。
  const indexAsFolderLink = !standaloneIndex
  const folderDisplayNameMap = buildFolderDisplayNameMap(domainOptions)

  const tree: LocaleTree = {}
  let pageNodeCount = 0
  let folderNodeCount = 0

  const byLocale = pages.reduce((result, page) => {
    if (!page.itemMeta.visible) return result
    const localeKey = page.localeKey || 'root'
    const list = result.get(localeKey) || []
    list.push({ ...page, localeKey })
    result.set(localeKey, list)
    return result
  }, new Map<string, PageContentMeta[]>())

  for (const [localeKey, localePages] of byLocale.entries()) {
    const roots: TreeNode[] = []

    for (const page of localePages) {
      const localeRelativePath = toLocaleRelativePath(
        page.rewrittenPage,
        localeKey
      )
      const parts = localeRelativePath.split('/')
      const fileName = parts[parts.length - 1]
      const parentParts = parts.slice(0, -1)
      const isIndex = fileName === 'index.md'

      let children = roots
      let parentRoutePath = localeKey === 'root' ? '/' : `/${localeKey}/`
      let parentFolder: TreeNode | undefined
      let parentFolderPath = ''

      for (const folderName of parentParts) {
        parentFolderPath = parentFolderPath
          ? `${parentFolderPath}/${folderName}`
          : folderName
        const folderRoutePath = toFolderRoutePath(parentRoutePath, folderName)
        const folderDisplayName = resolveFolderDisplayName(
          localeKey,
          parentFolderPath,
          folderName,
          folderDisplayNameMap
        )
        const ensured = ensureFolderNode(
          children,
          folderName,
          folderDisplayName,
          localeKey,
          folderRoutePath,
          page.sourceOrder
        )
        const folder = ensured.node
        if (ensured.created) {
          folderNodeCount += 1
        }
        children = folder.children
        parentRoutePath = folderRoutePath
        parentFolder = folder
      }

      if (isIndex && indexAsFolderLink && parentFolder) {
        applyIndexToFolder(parentFolder, page)
        continue
      }

      const node = createPageNode(page)
      children.push(node)
      pageNodeCount += 1
    }

    sortNodes(roots, options)
    tree[localeKey] = roots
  }

  return {
    tree,
    stats: {
      localeCount: Object.keys(tree).length,
      pageNodeCount,
      folderNodeCount,
    },
  }
}

export function formatTreeBuildStats(stats: TreeBuildStats) {
  return `tree locales=${stats.localeCount}, folders=${stats.folderNodeCount}, pages=${stats.pageNodeCount}`
}
