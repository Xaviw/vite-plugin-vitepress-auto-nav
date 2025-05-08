import type { UserConfig } from 'vite'
import type { DefaultTheme, SiteConfig } from 'vitepress'

export type Recordable = Record<string, any>

export type MaybePromise<T> = T | Promise<T>

export interface VitepressUserConfig extends UserConfig {
  vitepress: SiteConfig
}

/** 插件配置项 */
export interface Options {
  /**
   * 对特定文件或文件夹进行配置
   *
   * 键为 glob 表达式，值为配置对象
   *
   * md 文件 frontmatter 中支持相同配置项，且优先级更高（支持通过 frontmatterPrefix 属性自定义配置前缀）
   */
  settings?: Record<string, ItemConfig>

  /**
   * frontmatter 中配置属性需要添加的前缀
   */
  frontmatterPrefix?: string

  /**
   * 自定义排序方法，同级文件、文件夹会调用这个函数进行排序
   *
   * > 创建时间为首次 git 提交时间，不存在 git 提交时间则为本地文件创建时间
   *
   * 默认排序方法 defaultComparer 规则为：优先按 sort 值升序排列，其次按创建时间升序排列
   */
  comparer?: (a: ItemInfo, b: ItemInfo, frontmatterPrefix: string = '') => number

  /** 用于支持从 Gitbook 的 SUMMARY 文件生成 sidebar 与 nav，添加后其他配置将不再生效 */
  summary?: {
    /** SUMMARY.md 文件路径 */
    target: string
    /**
     * 同 SidebarItem.collapsed
     *
     * 未指定时，不可折叠
     *
     * 为 true 时，可折叠且默认折叠
     *
     * 为 false 时，可折叠且默认展开
     */
    collapsed?: boolean
    /**
     * 去掉转义字符 "\"
     * @default true
     */
    removeEscape?: boolean
  }

  /**
   * 解析得到 sidebar、nav 后合并到 vitepress 配置的方法，在不兼容 DefaultTheme 的主题中使用
   *
   * 默认修改方式为：
   * ```ts
   * config.vitepress.site.themeConfig.sidebar = data.sidebar
   * config.vitepress.site.themeConfig.nav = data.nav
   * return config
   * ```
   */
  handler?: (config: VitepressUserConfig, data: { sidebar: DefaultTheme.Sidebar, nav: DefaultTheme.NavItemWithLink }) => MaybePromise<Omit<VitepressUserConfig, 'plugins'>>
}

/**
 * 对特定文件或文件夹进行配置
 */
export interface ItemConfig {
  /** 是否显示 */
  hide?: boolean
  /** 排序值 */
  sort?: number
  /** 重定义展示名称，优先级高于 useArticleTitle */
  title?: string
  /** 是否使用文章中的标题代替文件名作为显示名称（首个标题，不分级别，文章内不存在标题时该配置无效） */
  useArticleTitle?: boolean
  /**
   * 同 vitepress 默认主题 sidebar 配置的 collapsed 属性，只对文件夹生效
   */
  collapsed?: DefaultTheme.SidebarItem['collapsed']
}

/** 文件、文件夹时间戳信息 */
export interface TimesInfo {
  /** 本地文件创建时间 */
  localBirthTime?: number
  /** 本地文件修改时间 */
  localModifyTime?: number
  /** git首次提交时间 */
  firstCommitTime?: number
  /** git最后一次提交时间 */
  lastCommitTime?: number
}

/** 文件、文件夹关键信息 */
export interface ItemInfo {
  /** 文件、文件夹名 */
  name: string
  /** 文件、文件夹时间戳信息 */
  timesInfo: TimesInfo
  /** 文件、文件夹配置 */
  config: ItemConfig
  /** 是否是文件夹 */
  isFolder: boolean
  /** frontmatter 数据（仅文件存在） */
  frontmatter: Recordable
  /** 文章内标题（仅文件存在） */
  articleTitle: string
  /** 子文件、文件夹信息（仅文件夹存在） */
  children: ItemInfo[]
}
