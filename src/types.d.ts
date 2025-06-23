import type { UserConfig } from 'vite'
import type { LocaleConfig, SiteConfig } from 'vitepress'

export type Recordable<T = any> = Record<string, T>

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

/** 文件、文件夹公共数据 */
interface BaseInfo {
  /**
   * 名称（文件含扩展名 '.md'，动态路由为生成后的 name）
   */
  name: string
  /**
   * 原始路径，相对于 srcDir（以 '/' 开头以及分隔，文件含扩展名 '.md'）
   */
  path: string
  /**
   * path 层级深度，从 0 开始（例如 '/a/b.md' 深入为 1）
   */
  depth: number
  /**
   * 文件、文件夹时间戳信息
   * @remark
   * 文件夹的 git 提交时间依赖于内部文件的提交时间
   */
  timesInfo: TimesInfo
}

/** 文件数据 */
export interface FileInfo extends BaseInfo {
  /**
   * 访问链接，动态路由以及 rewrites 为生成后的链接（以 '/' 开头以及分隔，不含扩展名）
   */
  link: string
  /**
   * 动态路由的原始文件名称（含扩展名 '.md'，非动态路由文件不含该属性）
   */
  originName?: string
  /** 文章内一级标题 */
  h1: string
  /** frontmatter 数据 */
  frontmatter: Recordable
  /** 动态路由 params */
  params: Recordable
}

/** 文件夹数据 */
export interface FolderInfo extends BaseInfo {
  /** 子文件、文件夹信息 */
  children: Item[]
}

/** 文件或文件夹数据 */
export type Item = FileInfo | FolderInfo

/** 文件或文件夹排序比较方法 */
export type Comparer = (a: Item, b: Item) => number

/** 文件夹下所有普通路径和 rewrite 路径 */
export interface ChildrenLinks {
  /** 普通页面路径 */
  notRewrites: string[]
  /** rewrite 页面路径 */
  rewrites: string[]
}

/** 自定义处理方法可用参数 */
export interface HandlerOptions {
  /** vitepress rewrites 配置 */
  rewrites: SiteConfig['rewrites']
  /** vitepress 国际化配置 */
  locales?: LocaleConfig
}

/** 文件或文件夹数据转换为 vitepress 配置的处理方法（返回 false 表示忽略该文件或文件夹） */
export type ItemHandler<T> = (
  options: HandlerOptions & {
    /** 文件或文件夹数据 */
    item: Item
    /** 文件夹子数据数组 */
    children?: T[]
    /** 文件夹下所有普通路径和 rewrite 路径 */
    childrenLinks?: ChildrenLinks
  }
) => T | false

/** ItemHandler 处理后的数据应用到 vitepress 配置的方法 */
export type Handler<T> = (
/** vitepress 原始配置 */
  config: VitepressUserConfig,
  /** ItemHandler 返回值组成的数组 */
  data: T[],
  /** 可用配置 */
  options: HandlerOptions
) => MaybePromise<void>

/** 插件配置项 */
export interface Options<S = any, N = any> {
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
   * 解析得到 sidebar 后合并到 vitepress 配置的方法
   */
  sidebarHandler?: Handler<S>

  /**
   * 每一项文件或文件夹生成为 navItem 的方法
   * @remark
   * 参数 children 属性为子文件、文件夹生成的 navItem 数组；
   * 返回 false 会忽略生成该项
   */
  navItemHandler?: ItemHandler<N>

  /**
   * 解析得到 nav 后合并到 vitepress 配置的方法
   */
  navHandler?: Handler<N>
}
