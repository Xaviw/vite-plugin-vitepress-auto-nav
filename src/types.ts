import type { UserConfig } from 'vite'
import type { SiteConfig } from 'vitepress'

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
   * 原始路径，相对于 vitepress srcDir 配置（以 '/' 开头以及分隔，文件含扩展名 '.md'）
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

/** ItemHandler 处理后的数据应用到 vitepress 配置的方法 */
export type Handler = (
/** vitepress 原始配置 */
  config: VitepressUserConfig,
  /** 处理后的文章数据 */
  data: Item[]
) => MaybePromise<void>

/** 插件配置项 */
export interface Options {
  /**
   * 自定义排序方法，同级文件、文件夹会调用这个函数进行排序
   */
  comparer?: Comparer

  /**
   * 将插件整理的数据转换为 vitepress 配置的方法
   */
  handler?: Handler
}
