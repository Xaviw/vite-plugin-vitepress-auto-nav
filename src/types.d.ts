/** 插件配置项 */
export interface Options {
  /**
   * 对特定文件或文件夹进行配置
   *
   * 键为 glob 表达式，值为匹配文件的配置项
   *
   * md 文件 frontmatter 中支持相同配置项，且优先级更高（为避免冲突，支持通过 frontmatterPrefix 配置属性前缀）
   */
  settings?: Record<string, ItemOptions>

  /**
   * frontmatter 中匹配配置属性的前缀
   */
  frontmatterPrefix?: string

  /**
   * 自定义排序方法，同级文件、文件夹会调用这个函数进行排序
   *
   * > 创建时间为首次 git 提交时间，或者本地文件创建时间
   * > sort 值与排序值均从 0 开始
   *
   * 默认排序方法 defaultCompareFn 规则为：
   *
   * 1. 均存在 sort 值时，先按 sort 值升序排列再按创建时间升序排列
   * 2. 只存在一个 sort 值时，对比 sort 值与另一个文件在目录中的排序值，升序排列；sort 值等于排序值时，存在 sort 值的文件在前
   * 3. 均不存在 sort 值时，对比创建时间，升序排列
   */
  compareFn?: (a: Item, b: Item, frontmatterPrefix: string = '') => number

  /** 用于支持从 Gitbook 的 SUMMARY 文件生成目录，添加后其他配置将不再生效 */
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

/**
 * 对特定文件或目录进行配置
 */
export interface ItemOptions {
  /** 是否显示 */
  hide?: boolean
  /** 排序值（目标位置下标，从0开始） */
  sort?: number
  /** 重定义展示名称，优先级高于 useArticleTitle */
  title?: string
  /** 是否使用文章中的一级标题代替文件名作为文章名称 */
  useArticleTitle?: boolean
  /**
   * 同 sidebar 中 collapsed 配置，只对文件夹生效
   *
   * @default false
   */
  collapsed?: boolean
}

/** 文件、文件夹关键信息 */
export interface Item {
  /** 同级中的位置下标 */
  index: number
  /** 文件、文件夹名 */
  name: string
  /** 是否是文件夹 */
  isFolder: boolean
  /** 配置对象(不包括frontmatter)，以及时间戳数据(TimesInfo) */
  options: ItemCacheOptions
  /** frontmatter 数据以及文章一级标题（h1） */
  frontmatter: Frontmatter
  /** 子文件、文件夹 */
  children: Item[]
}

/** 缓存的 options 数据 */
export type ItemCacheOptions = ItemOptions & TimesInfo

/** 文件、文件夹时间戳信息 */
export interface TimesInfo {
  /** 本地文件创建时间 */
  birthTime?: number
  /** 本地文件修改时间 */
  modifyTime?: number
  /** git首次提交时间 */
  firstCommitTime?: number
  /** git最后一次提交时间 */
  lastCommitTime?: number
}

/** 缓存的 frontmatter 数据 */
export type Frontmatter = { h1?: string } & Recordable

export type Recordable = Record<string, any>
