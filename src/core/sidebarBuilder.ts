import type { DefaultTheme } from 'vitepress'
import type { LocaleTree, TreeNode } from '../types/model'

interface SidebarBuildStats {
  localeCount: number
  sidebarSectionCount: number
  sidebarItemCount: number
}

interface SidebarBuildResult {
  sidebarByLocale: Record<string, Record<string, DefaultTheme.SidebarItem[]>>
  stats: SidebarBuildStats
}

function toSidebarSectionKey(routePath: string) {
  if (routePath.endsWith('/')) return routePath
  return `${routePath}/`
}

function buildSidebarItems(nodes: TreeNode[]): DefaultTheme.SidebarItem[] {
  const result: DefaultTheme.SidebarItem[] = []

  for (const node of nodes) {
    if (node.isFolder) {
      const childItems = buildSidebarItems(node.children)
      const folderItem: DefaultTheme.SidebarItem = {
        text: node.text,
        items: childItems,
      }

      if (node.collapsed !== undefined) {
        folderItem.collapsed = node.collapsed
      }

      if (node.sourcePagePath) {
        folderItem.link = node.routePath
      }

      result.push(folderItem)
      continue
    }

    result.push({
      text: node.text,
      link: node.routePath,
    })
  }

  return result
}

function countSidebarItems(items: DefaultTheme.SidebarItem[]): number {
  let count = 0

  for (const item of items) {
    count += 1
    if (item.items?.length) {
      count += countSidebarItems(item.items)
    }
  }

  return count
}

export function buildSidebarByLocale(
  localeTree: LocaleTree
): SidebarBuildResult {
  const sidebarByLocale: Record<
    string,
    Record<string, DefaultTheme.SidebarItem[]>
  > = {}
  let sidebarSectionCount = 0
  let sidebarItemCount = 0

  for (const localeKey of Object.keys(localeTree)) {
    const roots = localeTree[localeKey]
    const sidebarMulti: Record<string, DefaultTheme.SidebarItem[]> = {}

    for (const root of roots) {
      const sectionKey = toSidebarSectionKey(root.routePath)
      const items = root.isFolder ? buildSidebarItems(root.children) : []

      if (sidebarMulti[sectionKey]) {
        const existingItems = sidebarMulti[sectionKey]
        sidebarMulti[sectionKey] = [...existingItems, ...items]
      } else {
        sidebarMulti[sectionKey] = items
      }
    }

    sidebarByLocale[localeKey] = sidebarMulti
    sidebarSectionCount += Object.keys(sidebarMulti).length
    sidebarItemCount += Object.values(sidebarMulti).reduce(
      (total, items) => total + countSidebarItems(items),
      0
    )
  }

  return {
    sidebarByLocale,
    stats: {
      localeCount: Object.keys(sidebarByLocale).length,
      sidebarSectionCount,
      sidebarItemCount,
    },
  }
}

export function formatSidebarBuildStats(stats: SidebarBuildStats) {
  return `sidebar locales=${stats.localeCount}, sections=${stats.sidebarSectionCount}, items=${stats.sidebarItemCount}`
}
