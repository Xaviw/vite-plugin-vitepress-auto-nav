import type { DefaultTheme } from 'vitepress'
import type { FileInfo, FolderInfo, Handler, ItemHandler } from './types'
import { minimatch } from 'minimatch'
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

interface ClassicSidebarItemHandlerOptions {
  /** 使用 md h1 作为显示名称，文件夹配置该项将作用于内部全部文件 */
  useMarkdownTitle?: boolean
  /** 自定义显示名称，优先级最高 */
  title?: string
  /** 是否不在 sidebar 中显示 */
  hide?: boolean
  /** 同 DefaultTheme.SidebarItem.collapsed，仅文件夹生效 */
  collapsed?: boolean
}

/**
 * 兼容 v3 的 sidebarItem 生成方法
 * @remark
 * 文件支持在 frontmatter 中进行配置，优先级低于参数配置
 * @param options 键为 glob 表达式字符串，值为配置对象，例如 `{ '/a/b/*.md': { hide: true } }`
 * @param frontmatterPrefix frontmatter 中配置属性的前缀，例如 `a_`，则会获取 `a_title` 作为自定义显示名称
 */
export function classicSidebarItemHandler(
  options: Record<string, ClassicSidebarItemHandlerOptions> = {},
  frontmatterPrefix: string = '',
): ItemHandler<DefaultTheme.SidebarItem> {
  return (item, children) => {
    const frontmatter = (item as FileInfo).frontmatter || {}
    const [_, config = {}] = Object.entries(options).reverse().find(([pattern]) => {
      return minimatch(item.path, pattern)
    }) || []

    const hide = config.hide || frontmatter[`${frontmatterPrefix}hide`]
    if (item.name === 'index' || hide)
      return false

    const isFolder = (item as FolderInfo).children?.length
    const hasIndex = (item as FolderInfo).children?.find(i => i.name === 'index')

    let text = config.title
    if (!text && !isFolder && (config.useMarkdownTitle || frontmatter[`${frontmatterPrefix}useMarkdownTitle`])) {
      text = (item as FileInfo).h1
    }

    return {
      text: text || item.name,
      link: !isFolder || hasIndex ? item.path : undefined,
      items: children,
      collapsed: isFolder ? config.collapsed || false : undefined,
    }
  }
}

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
