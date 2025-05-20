import type { DefaultTheme } from 'vitepress'
import type { FileInfo, FolderInfo, Handler, ItemHandler } from './types'
import { minimatch } from 'minimatch'
import { getFolderLink } from './utils'

/** 默认 sidebarItem 生成方法 */
export const defaultSidebarItemHandler: ItemHandler<DefaultTheme.SidebarItem> = (item, children) => {
  if (item.name === 'index.md')
    return false

  const isFile = !!(item as FileInfo).link
  const hasIndex = (item as FolderInfo).children?.find(i => i.name === 'index.md')

  return {
    text: item.name.replace(/\.md$/, ''),
    link: isFile ? (item as FileInfo).link : (hasIndex as FileInfo)?.link,
    items: children,
    collapsed: false,
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
 * 部分兼容 v3 的 sidebarItem 生成方法
 * @remark
 * 文件支持在 frontmatter 中进行配置，优先级低于参数配置
 * @param options 键为 glob 表达式字符串，值为配置对象，例如 `{ '/a/b/*.md': { hide: true } }`,仅最后一条匹配的配置生效
 * @param frontmatterPrefix frontmatter 中配置属性的前缀，例如设置为 `a_`，则会获取 `a_title` 作为自定义显示名称
 */
export function classicSidebarItemHandler(
  options: Record<string, ClassicSidebarItemHandlerOptions> = {},
  frontmatterPrefix: string = '',
): ItemHandler<DefaultTheme.SidebarItem | DefaultTheme.SidebarMulti> {
  return (item, children, locales) => {
    const frontmatter = (item as FileInfo).frontmatter || {}
    const [_, config = {}] = Object.entries(options).reverse().find(([pattern]) => {
      return minimatch(item.path, pattern)
    }) || []

    const hide = config.hide || frontmatter[`${frontmatterPrefix}hide`]
    if (item.name === 'index.md' || hide)
      return false

    const isFile = !!(item as FileInfo).link
    const hasIndex = (item as FolderInfo).children?.find(i => i.name === 'index.md')

    let text = config.title
    if (!text && isFile && (config.useMarkdownTitle || frontmatter[`${frontmatterPrefix}useMarkdownTitle`])) {
      text = (item as FileInfo).h1
    }
    if (locales ? item.depth === 1 : item.depth === 0) {
      return {
        [`${item.path.replace(/\.md$/, '')}/`]: children,
      }
    }
    else {
      return {
        text: text || item.name.replace(/\.md$/, ''),
        link: isFile ? (item as FileInfo).link : (hasIndex as FileInfo)?.link,
        items: children,
        collapsed: config.collapsed,
      }
    }
  }
}

/**
 * 默认 navItem 生成方法
 * @remark
 * 生成的 activeMatch 属性未处理存在 rewrites 的情况
 */
export const defaultNavItemHandler: ItemHandler<DefaultTheme.NavItemWithLink | DefaultTheme.NavItemWithChildren> = (item, children, locales) => {
  const MAX_DEPTH = locales ? 1 : 0
  if (item.name === 'index.md' || item.depth > MAX_DEPTH)
    return false

  let link: string | undefined = (item as FileInfo).link
  // 文件夹时获取文件夹可用链接
  if (!link && (item as FolderInfo).children?.length) {
    link = getFolderLink(item as FolderInfo)
  }

  return !children?.length || item.depth === MAX_DEPTH
    ? {
        text: item.name.replace(/\.md$/, ''),
        link,
        activeMatch: `^${item.path}`,
      } as DefaultTheme.NavItemWithLink
    : {
        text: item.name,
        items: children,
        activeMatch: `^${item.path}`,
      } as DefaultTheme.NavItemWithChildren
}

/** 应用生成的数据到配置中 */
export const defaultHandler: Handler = (config, { nav, sidebar, rewrites: { map }, locales }) => {
  if (locales) {
    const langs = Object.keys(locales)
    langs.forEach((lang) => {
      if (!config.vitepress.site.locales[lang].themeConfig)
        config.vitepress.site.locales[lang].themeConfig = {}

      const sidebarData = sidebar.find((item) => {
        if (lang === 'root') {
          return !langs.includes((item as DefaultTheme.SidebarItem).text!)
        }
        return item.text === lang
      })?.items
      config.vitepress.site.locales[lang].themeConfig.sidebar = (sidebarData as DefaultTheme.SidebarMulti[]).reduce((p, c) => {
        const [base, items] = Object.entries(c)[0]
        p[base] = items
        return p
      }, {})

      const navData = nav.find((item) => {
        if (lang === 'root') {
          return !langs.includes((item as DefaultTheme.NavItemWithChildren).text!)
        }
        return item.text === lang
      })?.items
      config.vitepress.site.locales[lang].themeConfig.nav = navData
    })
  }
  else {
    config.vitepress.site.themeConfig.sidebar = sidebar.reduce<DefaultTheme.SidebarMulti>(
      (p, c) => {
        const [base, items] = Object.entries(c)[0]
        for (const [origin, rewrite] of Object.entries(map)) {
          if (origin.startsWith(base.slice(1)) && rewrite) {
            p[rewrite.replace(/\.md$/, '')] = items
          }
        }
        return { ...p, ...c as DefaultTheme.SidebarMulti }
      },
      {},
    )

    config.vitepress.site.themeConfig.nav = nav
  }
  return config
}
