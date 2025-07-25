import type { DefaultTheme, SiteConfig } from 'vitepress'
import type { Handler } from './types'
import { minimatch } from 'minimatch'
import { assertFile, getFolderLink } from './utils'

interface HandlerOptions {
  /**
   * 是否将首层目录作为 SidebarMulti
   * @default true
   */
  sidebarMulti?: boolean
  /**
   * 使用文章首个一级标题作为显示名称
   * @default true
   */
  useMarkdownTitle?: boolean
  /**
   * 读取 frontmatter 时的属性前缀
   */
  frontmatterPrefix?: string
  /**
   * 对部分文件、文件夹进行配置
   * @remark
   * 键为 glob 表达式字符串，值为配置对象；
   * 通过 [minimatch](https://github.com/isaacs/minimatch) 进行判断，仅最后一条匹配的配置生效；
   * 如果存在动态路由或 rewrites，键需要以页面实际访问路径为准，`index` 不能省略，文件需要包含扩展名 `.md`
   * @example
   * { '/a/b/*.md': { hide: true } }
   */
  config?: Record<
    string,
    {
      /** 使用文章首个一级标题作为显示名称  */
      useMarkdownTitle?: boolean
      /** 自定义显示名称，优先级最高 */
      title?: string
      /** 不显示 */
      hide?: boolean
      /** 同 DefaultTheme.SidebarItem.collapsed，仅文件夹生效 */
      sidebarCollapsed?: boolean
    }
  >
}

export function defaultHandler(
  {
    config = {},
    frontmatterPrefix = '',
    sidebarMulti = true,
    useMarkdownTitle = true,
  }: HandlerOptions = {},
): Handler {
  return (vitepressConfig, data) => {
    const {
      userConfig: {
        /** { root: { label: '简体中文' }, en: { label: 'English' } }，同用户设置 */
        locales,
        rewrites,
        themeConfig,
      },
    } = vitepressConfig.vitepress as SiteConfig<DefaultTheme.Config>

    // 存在国际化
    if (locales?.root) {
      // themeConfig.nav 优先级高于 locales.root.themeConfig.nav
      if (themeConfig.nav)
        themeConfig.nav = undefined
    }
    else {
      themeConfig.nav = data.reduce<DefaultTheme.NavItemWithLink[]>(
        (p, c) => {
          const isFile = assertFile(c)

          // 查找匹配的配置
          const [_, options = {}] = Object.entries(config)
            .findLast(([pattern]) => {
              return minimatch(isFile ? `${c.link}.md` : c.path, pattern)
            }) || []

          const frontmatter = isFile ? c.frontmatter : {}

          const hide = options.hide || frontmatter[`${frontmatterPrefix}hide`]
          const link = isFile ? c.link : getFolderLink(c)
          // index.md 链接作用于文件夹，不再单独展示
          if (hide || !link || (isFile && c.link.endsWith('/index')))
            return p

          let text = options.title || frontmatter[`${frontmatterPrefix}title`]
          // 文件未设置 title 时，还需要判断是否 useMarkdownTitle
          if (
            !text
            && isFile
            && (
              options.useMarkdownTitle
              || frontmatter[`${frontmatterPrefix}useMarkdownTitle`]
            )) {
            text = c.h1
          }

          p.push({ text, link, activeMatch: `^${c.path}`.replace(/\//g, '\\/') })

          return p
        },
        [],
      )
    }
  }
}
