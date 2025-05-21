import type { UserConfig } from 'vite'
import type { DefaultTheme, LocaleConfig, SiteConfig } from 'vitepress'

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
   * 文件、文件夹名（文件含扩展名 '.md'，动态路由为生成后的 name）
   */
  name: string
  /**
   * 原始路径，相对于 srcDir（以 '/' 开头以及分隔，文件含扩展名 '.md'）
   */
  path: string
  /**
   * 原始路径深度，从 0 开始（对应 path 层级）
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
  /**
   * 访问链接，支持动态路由以及 rewrites（以 '/' 开头以及分隔，不含扩展名）
   */
  link: string
  /**
   * 动态路由的原始文件名称（含扩展名 '.md'）
   */
  originName?: string
  /** 文章内一级标题 */
  h1: string
  /** frontmatter 数据 */
  frontmatter: Recordable
  /** 动态路由 params */
  params: Recordable
}

export interface FolderInfo extends BaseInfo {
  /** 子文件、文件夹信息 */
  children: Item[]
}

export type Item = FileInfo | FolderInfo

export type Comparer = (a: Item, b: Item) => number

export type ItemHandler<T extends Recordable = Recordable> = (
  options: { item: Item, children: T[] | undefined, locales?: LocaleConfig, rewrites: SiteConfig['rewrites'] }
) => T | false

export type Handler<
  S extends Recordable = DefaultTheme.SidebarItem | DefaultTheme.SidebarMulti,
  N extends Recordable = DefaultTheme.NavItemWithLink | DefaultTheme.NavItemWithChildren,
> = (
  config: VitepressUserConfig,
  data: { sidebar: S[], nav: N[], rewrites: SiteConfig['rewrites'], locales?: LocaleConfig }
) => MaybePromise<Omit<VitepressUserConfig, 'plugins'>>

/** 插件配置项 */
export interface Options<
  S extends Recordable = DefaultTheme.SidebarItem | DefaultTheme.SidebarMulti,
  N extends Recordable = DefaultTheme.NavItemWithLink | DefaultTheme.NavItemWithChildren,
> {
  /**
   * glob 表达式字符串数组，用于排除某些文件或文件夹
   * @remark
   * 通过 [minimatch](https://github.com/isaacs/minimatch) 进行判断；
   * 排除的页面还是能够通过链接访问，如果希望彻底排除，请使用 vitepress 的 srcExclude 配置；
   * 空文件夹始终会被排除
   */
  exclude?: string[]

  /**
   * 自定义排序方法，同级文件、文件夹会调用这个函数进行排序
   */
  comparer?: Comparer

  /**
   * 每一项文件或文件夹生成为 sidebarItem 的方法
   * @remark
   * 参数 children 属性为子文件、文件夹生成的 sidebarItem 数组；
   * 返回 false 会忽略生成该项
   */
  sidebarItemHandler?: ItemHandler<S>

  /**
   * 每一项文件或文件夹生成为 navItem 的方法
   * @remark
   * 参数 children 属性为子文件、文件夹生成的 navItem 数组；
   * 返回 false 会忽略生成该项
   */
  navItemHandler?: ItemHandler<N>

  /**
   * 解析得到 sidebar、nav 后合并到 vitepress 配置的方法
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
