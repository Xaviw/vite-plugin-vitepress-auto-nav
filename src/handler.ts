import type { DefaultTheme } from 'vitepress'
import type { FileInfo, Handler, Item, ItemHandler } from './types'
import { minimatch } from 'minimatch'
import { assertFile, assertFolder, getFolderLink } from './utils'

interface ItemHandlerOptions {
  /** 使用 md h1 作为显示名称 */
  useMarkdownTitle?: boolean
  /** 自定义显示名称，优先级最高 */
  title?: string
  /** 不在 sidebar 中显示 */
  hide?: boolean
}

type SidebarItem = Omit<Item, 'children' | 'link'> & {
  originLink?: string
  link?: string
  children?: SidebarItem[]
  text?: string
  collapsed?: boolean
}

/**
 * 页面数据生成 sidebarItem 的方法，兼容部分 v3 配置
 * @remark
 * md 文件支持在 frontmatter 中进行配置，优先级低于参数配置；设置 frontmatterPrefix 可以避免影响原有参数。
 * @param options
 * @param options.config 键为 glob 表达式字符串（通过 [minimatch](https://github.com/isaacs/minimatch) 进行判断，仅最后一条匹配的配置生效；如果存在动态路由或 rewrites，键需要以页面实际访问路径为准，文件需要包含扩展名 `.md`），值为配置对象，例如 `{ '/a/b/*.md': { hide: true } }`
 * @param options.frontmatterPrefix frontmatter 中配置属性的前缀（不影响 options 配置中的属性名），例如设置为 `a_`，则会从 frontmatter 中获取 `a_title` 作为自定义显示名称
 */
export function defaultSidebarItemHandler(
  {
    config = {},
    frontmatterPrefix = '',
  }: {
    config?: Record<string, ItemHandlerOptions & {
      /** 同 DefaultTheme.SidebarItem.collapsed，仅文件夹生效 */
      collapsed?: boolean
    }>
    frontmatterPrefix?: string
  } = {},
): ItemHandler<SidebarItem> {
  return ({ item, children }) => {
    const isFile = assertFile(item)

    // 查找匹配的配置
    const [_, options = {}]
      = Object.entries(config)
        .findLast(([pattern]) => {
          return minimatch(isFile ? `${item.link}.md` : item.path, pattern)
        }) || []

    const frontmatter = isFile ? item.frontmatter : {}

    const hide = options.hide || frontmatter[`${frontmatterPrefix}hide`]
    // index.md 链接作用于文件夹，不再单独展示
    if (hide || (isFile && item.link.endsWith('/index')))
      return false

    let title = options.title || frontmatter[`${frontmatterPrefix}title`]
    // 文件未设置 title 时，还需要判断是否 useMarkdownTitle
    if (!title && isFile && (options.useMarkdownTitle || frontmatter[`${frontmatterPrefix}useMarkdownTitle`])) {
      title = item.h1
    }

    return {
      ...item,
      originLink: (item as FileInfo).link,
      children,
      text: title || item.name.replace(/\.md$/, ''),
      link: isFile
        ? item.link
        : getFolderLink(item, true),
      collapsed: options.collapsed,
    }
  }
}

/**
 * 将 sidebarItemHandler 生成的 sidebar 数据应用到 vitepress 配置中
 * @remark
 * 第一层文件夹单独作为 SidebarMulti，第一层文件作为根 SidebarMulti（包括第一层文件夹下的 index 路由）
 */
export function defaultSidebarHandler(
  {
    useMulti,
  }: {
    /**
     * 是否将首层文件夹单独设置为 SidebarMulti
     */
    useMulti?: boolean
  } = {},
): Handler<SidebarItem> {
  function generater(data: SidebarItem[]): DefaultTheme.SidebarMulti | DefaultTheme.SidebarItem[] {
    if (useMulti) {
      return data.reduce<DefaultTheme.SidebarMulti>((p, c) => {
        // 忽略被 rewrite 的起始路径不一致的情况
        if (c.children)
          p[`${c.path}/`] = c.children
        return p
      }, {})
    }
    else {
      return data
    }
  }

  return (config, data, { locales }) => {
    const site = config.vitepress.site
    if (!site.themeConfig)
      site.themeConfig = {}

    // 未使用国际化
    if (!locales?.root) {
      site.themeConfig.sidebar = generater(data)
    }
    // 使用了国际化
    else {
      const localesObject = site.locales
      const localeKeys = Object.keys(locales)
      localeKeys.forEach((locale) => {
        // root 语言映射到根配置
        if (locale === 'root')
          localesObject[locale].themeConfig = site.themeConfig
        // 其他直接在语言下配置
        else if (!localesObject[locale].themeConfig)
          localesObject[locale].themeConfig = {}
      })

      data.forEach((item) => {
        // 忽略与配置语言不匹配的页面
        if (!localeKeys.includes(item.name) || !item.children?.length)
          return

        localesObject[item.name].themeConfig.sidebar = generater(item.children)
      })
    }
  }
}

/**
 * 部分兼容 v3 的 navItem 生成方法
 * @remark
 * 文件支持在 frontmatter 中进行配置，优先级低于参数配置，设置 frontmatterPrefix 可以避免影响原有参数。
 * @param options
 * @param options.config 键为 glob 表达式字符串（通过 [minimatch](https://github.com/isaacs/minimatch) 进行判断，仅最后一条匹配的配置生效；键需要以页面实际访问路径为准，文件需要包含扩展名 '.md'），值为配置对象，例如 `{ '/a/b/*.md': { hide: true } }`
 * @param options.frontmatterPrefix frontmatter 中配置属性的前缀（不影响 options 配置中的属性名），例如设置为 `a_`，则会从 frontmatter 中获取 `a_title` 作为自定义显示名称
 */
export function defaultNavItemHandler(
  {
    config = {},
    frontmatterPrefix = '',
  }: {
    config?: Record<string, ItemHandlerOptions>
    frontmatterPrefix?: string
  } = {},
): ItemHandler<DefaultTheme.NavItemWithLink | DefaultTheme.NavItemWithChildren> {
  return ({ item, children, locales }) => {
    const isFile = assertFile(item)
    const hasLocale = !!locales?.root

    // 查找匹配的配置
    const [_, options = {}] = Object
      .entries(config)
      .findLast(([pattern]) => {
        return minimatch(isFile ? `${item.link}.md` : item.path, pattern)
      }) || []

    const frontmatter = isFile ? item.frontmatter : {}
    const hide = options.hide || frontmatter[`${frontmatterPrefix}hide`]

    if ((hasLocale ? item.depth > 1 : item.depth > 0) || item.name === 'index.md' || hide)
      return false

    let title = options.title || frontmatter[`${frontmatterPrefix}title`]
    if (!title && isFile && (options.useMarkdownTitle || frontmatter[`${frontmatterPrefix}useMarkdownTitle`])) {
      title = item.h1
    }

    let link = isFile ? item.link : undefined
    // 文件夹时获取文件夹可用链接
    if (assertFolder(item)) {
      link = getFolderLink(item)
    }

    // 国际化首层
    if (locales?.root && item.depth === 0) {
      return {
        text: item.name,
        items: children,
      } as DefaultTheme.NavItemWithChildren
    }

    const activeMatch = `^${item.path}`.replace(/\//g, '\\/')

    return {
      text: title || item.name.replace(/\.md$/, ''),
      link,
      activeMatch,
    } as DefaultTheme.NavItemWithLink
  }
}

/** 应用生成的数据到配置中 */
export function defaultNavHandler(): Handler<DefaultTheme.NavItemWithLink | DefaultTheme.NavItemWithChildren> {
  return (config, data) => {
    config.vitepress.site.themeConfig.nav = data
  }
}
