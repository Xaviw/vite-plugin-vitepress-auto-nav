/** 单个条目可配置的元数据字段 */
export interface ItemMetaOptions {
  /** 是否显示该条目 */
  visible?: boolean
  /** 排序权重，数值越小越靠前 */
  order?: number
  /** 自定义展示名称 */
  displayName?: string
  /** 是否优先使用文章一级标题（H1）作为展示名称 */
  preferArticleTitle?: boolean
  /** 目录节点是否默认折叠 */
  collapsed?: boolean
}

/** 条目时间相关信息 */
export interface TimesInfo {
  /** 文件或目录的创建时间 */
  birthTime?: number
  /** 文件或目录的最近修改时间 */
  modifyTime?: number
  /** 首次提交时间 */
  firstCommitTime?: number
  /** 最近一次提交时间 */
  lastCommitTime?: number
}

/** 带缓存时间信息的条目选项 */
export interface ItemCacheOptions extends ItemMetaOptions, TimesInfo {}

/** 页面 frontmatter 数据 */
export type Frontmatter = {
  /** 从正文首个一级标题中提取出的标题 */
  h1?: string
} & Record<string, unknown>

/** sorter 使用的统一条目结构 */
export interface Item {
  /** 当前条目在同级中的原始索引 */
  index: number
  /** 当前条目的名称 */
  name: string
  /** 当前条目是否为目录 */
  isFolder: boolean
  /** 当前条目的选项与缓存时间信息 */
  options: ItemCacheOptions
  /** 当前条目的 frontmatter 数据 */
  frontmatter: Frontmatter
  /** 当前条目的子节点列表 */
  children: Item[]
}
