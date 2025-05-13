import type { UserConfig } from 'vite'
import type { DefaultTheme, SiteConfig } from 'vitepress'

export type Recordable = Record<string, any>

export type MaybePromise<T> = T | Promise<T>

export interface VitepressUserConfig extends UserConfig {
  vitepress: SiteConfig
}

/** 文件、文件夹时间戳信息 */
export interface TimesInfo {
  /** 本地文件创建时间 */
  localBirthTime: number
  /** 本地文件修改时间 */
  localModifyTime: number
  /** git首次提交时间 */
  firstCommitTime: number
  /** git最后一次提交时间 */
  lastCommitTime: number
}

interface BaseInfo {
  /**
   * 文件、文件夹名
   * @example 'index' | 'folder'
   */
  name: string
  /**
   * 路径
   * @example '/a/b'
   */
  path: string
  /**
   * 文件、文件夹深度，从 0 开始（对应 srcDir）
   */
  depth: number
  /**
   * 文件、文件夹时间戳信息
   * @remark
   * 文件夹的 git 提交时间依赖于内部文件的提交时间
   */
  timesInfo: TimesInfo
}

export interface FileInfo extends BaseInfo {
  /** 文章内一级标题 */
  h1: string
  /** frontmatter 数据 */
  frontmatter: Recordable
}

export interface FolderInfo extends BaseInfo {
  /** 子文件、文件夹信息 */
  children: Item[]
}

export type Item = FileInfo | FolderInfo

export type Comparer = (a: Item, b: Item) => number

export type ItemHandler<T extends Recordable = Recordable> = (
  item: Item,
  children?: T[] | undefined
) => T | false

export type Handler<S extends Recordable = DefaultTheme.SidebarItem, N extends Recordable = (DefaultTheme.NavItemWithLink | DefaultTheme.NavItemWithChildren)> = (
  config: VitepressUserConfig,
  data: { sidebar: S[], nav: N[] }
) => MaybePromise<Omit<VitepressUserConfig, 'plugins'>>

/** 插件配置项 */
export interface Options<S extends Recordable = DefaultTheme.SidebarItem, N extends Recordable = (DefaultTheme.NavItemWithLink | DefaultTheme.NavItemWithChildren)> {
  /**
   * glob 表达式字符串数组，用于排除某些文件或文件夹
   * @remark
   * 排除的页面还是能够通过链接访问，如果希望彻底排除，请使用 vitepress 的 srcExclude 配置；
   * 空文件夹始终会被排除
   */
  exclude?: string[]

  /**
   * 自定义排序方法，同级文件、文件夹会调用这个函数进行排序
   * @default
   * ```js
   * () => {
   *    // 创建时间升序
   *    const timeA = a.timesInfo.firstCommitTime || a.timesInfo.localBirthTime
   *    const timeB = b.timesInfo.firstCommitTime || b.timesInfo.localBirthTime
   *    return timeA - timeB
   * }
   * ```
   */
  comparer?: Comparer

  /**
   * 每一项文件或文件夹生成为 sidebarItem 的方法
   * @remark
   * 第二个参数为子文件、文件夹生成的 sidebarItem 数组；
   * 返回 false 会忽略生成该项
   * @default
   * ```js
   * (item, children) => {
   *    if(item.name === 'index') return
   *    return {
   *      text: item.name,
   *      link: item.path,
   *      items: children,
   *    }
   * }
   * ```
   */
  sidebarItemHandler?: ItemHandler<S>

  /**
   * 每一项文件或文件夹生成为 navItem 的方法
   * @remark
   * 第二个参数为子文件、文件夹生成的 navItem 数组；
   * 返回 false 会忽略生成该项
   * @default
   * ```js
   * (item, children) => {
   *    if(item.name === 'index' || item.depth > 1) return
   *    return {
   *      text: item.name,
   *      items: children,
   *      link: item.path,
   *      activeMatch
   *    }
   * }
   * ```
   */
  navItemHandler?: ItemHandler<N>

  /**
   * 解析得到 sidebar、nav 后合并到 vitepress 配置的方法（在不兼容 DefaultTheme 的主题中使用）
   * @default
   * ```ts
   * (config, data) => {
   *    config.vitepress.site.themeConfig.sidebar = data.sidebar
   *    config.vitepress.site.themeConfig.nav = data.nav
   *    return config
   * }
   * ```
   */
  handler?: Handler<S, N>

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
}
