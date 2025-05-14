import type { DefaultTheme } from 'vitepress'
import type { FolderInfo, Handler, ItemHandler } from './types'
import { getFolderLink } from './utils'

/** 默认 sidebarItem 生成方法 */
export const defaultSidebarItemHandler: ItemHandler<DefaultTheme.SidebarItem> = (item, children) => {
  if (item.name === 'index')
    return false

  const isFolder = (item as FolderInfo).children?.length
  const hasIndex = (item as FolderInfo).children?.find(i => i.name === 'index')

  return {
    text: item.name,
    link: !isFolder || hasIndex ? item.path : undefined,
    items: children,
    collapsed: isFolder ? false : undefined,
  }
}

// export function legacySidebarItemHandler(
//   {

//   }: {
//     useMarkdownTitle?: boolean
//     collapsed?: boolean
//     hide?: boolean
//   },
// ): ItemHandler<DefaultTheme.SidebarItem> {
//   return (item, children) => {
//     if (item.name === 'index')
//       return false

//     const isFolder = (item as FolderInfo).children?.length
//     const hasIndex = (item as FolderInfo).children?.find(i => i.name === 'index')

//     return {
//       text: item.name,
//       link: !isFolder || hasIndex ? item.path : undefined,
//       items: children,
//       collapsed: isFolder ? false : undefined,
//     }
//   }
// }

/** 默认 navItem 生成方法 */
export const defaultNavItemHandler: ItemHandler<(DefaultTheme.NavItemWithLink | DefaultTheme.NavItemWithChildren)> = (item, children) => {
  const MAX_DEPTH = 0
  if (item.name === 'index' || item.depth > MAX_DEPTH)
    return false

  let link = item.path
  // 文件夹时获取文件夹可用链接
  if ((item as FolderInfo).children?.length) {
    link = getFolderLink(item as FolderInfo)
  }

  return !children?.length || item.depth === MAX_DEPTH
    ? {
        text: item.name,
        link,
      } as DefaultTheme.NavItemWithLink
    : {
        text: item.name,
        items: children,
        activeMatch: `^${item.path}`,
      } as DefaultTheme.NavItemWithChildren
}

/** 应用生成的数据到配置中 */
export const defaultHandler: Handler = (config, { nav, sidebar }) => {
  config.vitepress.site.themeConfig.sidebar = sidebar.reduce<DefaultTheme.SidebarMulti>(
    (p, c) => {
      if (c.items?.length && c.text)
        p[`/${c.text}/`] = c.items
      return p
    },
    {},
  )
  config.vitepress.site.themeConfig.nav = nav
  return config
}
