import type { DefaultTheme } from 'vitepress'
import type { FileInfo, FolderInfo, Handler, ItemHandler } from './types'
import { minimatch } from 'minimatch'
import { getFolderLink } from './utils'

interface ItemHandlerOptions {
  /** 使用 md h1 作为显示名称 */
  useMarkdownTitle?: boolean
  /** 自定义显示名称，优先级最高 */
  title?: string
  /** 不在 sidebar 中显示 */
  hide?: boolean
}

/**
 * 部分兼容 v3 的 sidebarItem 生成方法
 * @remark
 * 文件支持在 frontmatter 中进行配置，优先级低于参数配置，设置 frontmatterPrefix 可以避免影响原有参数。
 * @param options
 * @param options.config 键为 glob 表达式字符串（通过 [minimatch](https://github.com/isaacs/minimatch) 进行判断，仅最后一条匹配的配置生效；键需要以页面实际访问路径为准，文件需要包含扩展名 '.md'），值为配置对象，例如 `{ '/a/b/*.md': { hide: true } }`
 * @param options.frontmatterPrefix frontmatter 中配置属性的前缀（不影响 options 配置中的属性名），例如设置为 `a_`，则会从 frontmatter 中获取 `a_title` 作为自定义显示名称
 */
export function sidebarItemHandler(
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
): ItemHandler<DefaultTheme.SidebarItem | DefaultTheme.SidebarMulti> {
  return ({ item, children, locales, rewrites }) => {
    const isFile = !!(item as FileInfo).link

    const frontmatter = (item as FileInfo).frontmatter || {}

    const [_, options = {}] = Object.entries(config).reverse().find(([pattern]) => {
      return minimatch(isFile ? `${(item as FileInfo).link}.md` : item.path, pattern)
    }) || []

    const hide = options.hide || frontmatter[`${frontmatterPrefix}hide`]
    if (item.name === 'index.md' || hide)
      return false

    const hasIndex = (item as FolderInfo).children?.find(i => i.name === 'index.md')

    let title = options.title || frontmatter[`${frontmatterPrefix}title`]
    if (!title && isFile && (options.useMarkdownTitle || frontmatter[`${frontmatterPrefix}useMarkdownTitle`])) {
      title = (item as FileInfo).h1
    }

    // 使用国际化时，首层为语言目录
    if (locales ? item.depth === 1 : item.depth === 0) {
      // 首层是文件时，无需显示 sidebar
      if (isFile)
        return false

      // 使用原始路径进行匹配，rewrites 在引用配置的 handler 中处理
      const result = {
        [`${item.path}/`]: children,
      }

      // 文件夹内动态路由与现首层路径不匹配时，对每一个动态路由做简单的映射
      for (const [origin, rewrite] of Object.entries(rewrites.map)) {
        if (origin.startsWith(item.path.slice(1)) && rewrite) {
          // 匹配路径需要去掉文件名部分
          result[`/${rewrite.replace(/[^/]+\.md$/, '')}`] = children
        }
      }

      return result
    }
    else {
      return {
        text: title || item.name.replace(/\.md$/, ''),
        link: isFile ? (item as FileInfo).link : (hasIndex as FileInfo)?.link,
        items: children,
        collapsed: options.collapsed,
      }
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
 * @param options.depth 最大显示层级（从 0 开始，存在国际化配置时会忽略首层），默认为 0
 */
export function navItemHandler(
  {
    config = {},
    frontmatterPrefix = '',
    depth = 0,
  }: {
    config?: Record<string, ItemHandlerOptions>
    frontmatterPrefix?: string
    depth?: number
  } = {},
): ItemHandler<DefaultTheme.NavItemWithLink | DefaultTheme.NavItemWithChildren> {
  return ({ item, children, locales, childrenRewrites }) => {
    const MAX_DEPTH = depth + (locales ? 1 : 0)
    const isFile = !!(item as FileInfo).link

    const frontmatter = (item as FileInfo).frontmatter || {}

    const [_, options = {}] = Object.entries(config).reverse().find(([pattern]) => {
      return minimatch(isFile ? `${(item as FileInfo).link}.md` : item.path, pattern)
    }) || []

    const hide = options.hide || frontmatter[`${frontmatterPrefix}hide`]
    if (item.name === 'index.md' || hide || item.depth > MAX_DEPTH)
      return false

    let title = options.title || frontmatter[`${frontmatterPrefix}title`]
    if (!title && isFile && (options.useMarkdownTitle || frontmatter[`${frontmatterPrefix}useMarkdownTitle`])) {
      title = (item as FileInfo).h1
    }

    let link: string | undefined = (item as FileInfo).link
    // 文件夹时获取文件夹可用链接
    if (!link && (item as FolderInfo).children?.length) {
      link = getFolderLink(item as FolderInfo)
    }

    // 国际化首层
    if (locales && item.depth === 0) {
      return {
        text: item.name,
        items: children,
      } as DefaultTheme.NavItemWithChildren
    }

    const subMatches = (childrenRewrites || [])
      .filter(i => !i.startsWith(`${item.path.slice(1)}/`))
      .map(i => `/${i}`.replace(/\.md$/, ''))
    const activeMatch = `^(${[item.path.replace(/\.md$/, ''), ...subMatches].join('|')})`.replace(/\//g, '\\/')

    // 文件或最后一层
    if (!children?.length || item.depth === MAX_DEPTH) {
      return {
        text: title || item.name.replace(/\.md$/, ''),
        link,
        activeMatch,
      } as DefaultTheme.NavItemWithLink
    }
    // 只可能是文件夹，无需去除扩展名
    return {
      text: title || item.name,
      items: children,
      activeMatch,
    } as DefaultTheme.NavItemWithChildren
  }
}

/** 应用生成的数据到配置中 */
export const handler: Handler = (config, { nav, sidebar, locales }) => {
  if (locales) {
    // 全部语言名称
    const langs = Object.keys(locales)
    langs.forEach((lang) => {
      // 确保语言配置下 themeConfig 存在
      if (!config.vitepress.site.locales[lang].themeConfig)
        config.vitepress.site.locales[lang].themeConfig = {}

      // 从 sidebar 数据中找到对应语言的 items 配置
      // root 对应所有以非 lang 标签开头的路径
      let sidebarData: DefaultTheme.SidebarMulti[] | undefined
      if (lang === 'root') {
        sidebarData = (sidebar as DefaultTheme.SidebarItem[]).reduce<DefaultTheme.SidebarMulti[]>((p, c) => {
          if (!langs.includes((c as DefaultTheme.SidebarItem).text!))
            return [...p, ...(c.items as DefaultTheme.SidebarMulti[])]
          return p
        }, [])
      }
      else {
        sidebarData = sidebar.find(item => item.text === lang)?.items as DefaultTheme.SidebarMulti[] | undefined
      }

      // 合并每一条 SidebarMulti 并应用
      if (sidebarData?.length) {
        config.vitepress.site.locales[lang].themeConfig.sidebar = sidebarData.reduce((p, c) => {
          // 存在某个语言下路径被映射到非该语言路径的情况，此时需要将配置写入目标语言配置或 root 配置
          for (const [prefix, items] of Object.entries(c)) {
            // 非该语言标签开头的路径映射到 root 下
            if (lang !== 'root' && !prefix.startsWith(`/${lang}/`)) {
              if (!config.vitepress.site.locales.root.themeConfig)
                config.vitepress.site.locales.root.themeConfig = {}
              config.vitepress.site.locales.root.themeConfig.sidebar[prefix] = items
            }
            else {
              p[prefix] = items
            }
          }
          return p
        }, {})
      }

      // 从 nav 数据中找到对应语言的 items 配置
      const navData = nav.find((item) => {
        if (lang === 'root') {
          return !langs.includes((item as DefaultTheme.NavItemWithChildren).text!)
        }
        return item.text === lang
      })?.items as DefaultTheme.NavItemWithChildren[] | undefined
      if (navData?.length) {
        config.vitepress.site.locales[lang].themeConfig.nav = navData
      }
    })
  }
  // 非国际化
  else {
    config.vitepress.site.themeConfig.sidebar = sidebar.reduce(
      (p, c) => {
        return { ...p, ...c }
      },
      {},
    )

    config.vitepress.site.themeConfig.nav = nav
  }
  return config
}
