import type { DefaultTheme } from 'vitepress'
import type { LocaleTree, TreeNode } from '../types/model'

interface NavBuildStats {
  localeCount: number
  navItemCount: number
}

interface NavBuildResult {
  navByLocale: Record<string, DefaultTheme.NavItemWithLink[]>
  stats: NavBuildStats
}

function resolveNodeLink(node: TreeNode): string | undefined {
  if (!node.isFolder) {
    return node.routePath
  }

  if (node.sourcePagePath) {
    return node.routePath
  }

  for (const child of node.children) {
    const childLink = resolveNodeLink(child)
    if (childLink) return childLink
  }

  return undefined
}

function resolveActiveMatch(node: TreeNode) {
  if (node.routePath.endsWith('/')) return node.routePath
  return `${node.routePath}`
}

function dedupeNavItems(items: DefaultTheme.NavItemWithLink[]) {
  const seenLinks = new Set<string>()
  const deduped: DefaultTheme.NavItemWithLink[] = []

  for (const item of items) {
    if (seenLinks.has(item.link)) continue
    seenLinks.add(item.link)
    deduped.push(item)
  }

  return deduped
}

export function buildNavByLocale(localeTree: LocaleTree): NavBuildResult {
  const navByLocale: Record<string, DefaultTheme.NavItemWithLink[]> = {}
  let navItemCount = 0

  for (const localeKey of Object.keys(localeTree)) {
    const roots = localeTree[localeKey]
    const navItems: DefaultTheme.NavItemWithLink[] = []

    for (const node of roots) {
      const link = resolveNodeLink(node)
      if (!link) continue
      navItems.push({
        text: node.text,
        link,
        activeMatch: resolveActiveMatch(node),
      })
    }

    const deduped = dedupeNavItems(navItems)
    navByLocale[localeKey] = deduped
    navItemCount += deduped.length
  }

  return {
    navByLocale,
    stats: {
      localeCount: Object.keys(navByLocale).length,
      navItemCount,
    },
  }
}

export function formatNavBuildStats(stats: NavBuildStats) {
  return `nav locales=${stats.localeCount}, items=${stats.navItemCount}`
}
