import type { Item, ItemMetaOptions } from './public'

/** 开发态行为配置 */
export interface AutoNavDevOptions {
  /** 文件监听防抖时长（毫秒） */
  watchDebounceMs?: number
  /** 是否启用内容元数据缓存 */
  cache?: boolean
  /** 日志级别 */
  logLevel?: 'silent' | 'info' | 'debug'
}

/** 插件顶层配置 */
export interface AutoNavPluginOptions {
  /** 页面纳入规则（glob） */
  include?: string | string[]
  /** 页面排除规则（glob） */
  exclude?: string | string[]
  /** 是否将目录下 `index.md` 作为独立页面 */
  standaloneIndex?: boolean
  /** 条目覆盖配置（按文件名、目录名或相对路径匹配） */
  overrides?: Record<string, ItemMetaOptions>
  /** frontmatter 字段前缀 */
  frontmatterKeyPrefix?: string
  /** 同级节点排序函数 */
  sorter?: (a: Item, b: Item, frontmatterKeyPrefix?: string) => number
  /** 是否优先使用文章一级标题（H1）作为展示名称 */
  preferArticleTitle?: boolean
  /** 开发态行为配置 */
  dev?: AutoNavDevOptions
}

/** 归一化后的插件配置 */
export interface NormalizedAutoNavOptions {
  /** 归一化后的纳入规则列表 */
  include?: string[]
  /** 归一化后的排除规则列表 */
  exclude?: string[]
  /** 是否将目录下 `index.md` 作为独立页面 */
  standaloneIndex: boolean
  /** 归一化后的覆盖配置 */
  overrides: Record<
    string,
    Required<Pick<ItemMetaOptions, 'visible' | 'preferArticleTitle'>> &
      Pick<ItemMetaOptions, 'order' | 'displayName' | 'collapsed'>
  >
  /** 归一化后的 frontmatter 字段前缀 */
  frontmatterKeyPrefix: string
  /** 安全包装后的排序函数 */
  sorter: (a: Item, b: Item, frontmatterKeyPrefix?: string) => number
  /** 是否优先使用文章一级标题（H1）作为展示名称 */
  preferArticleTitle: boolean
  /** 开发态行为配置 */
  dev?: AutoNavDevOptions
}
