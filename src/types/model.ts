import type { Frontmatter } from './public'

/** 解析后的页面来源信息 */
export interface ResolvedPage {
  /** 原始 markdown 源路径，dynamic route 场景下可能是模板路径 */
  sourcePage: string
  /** 运行时实际解析到的页面路径 */
  resolvedPage: string
  /** 应用 rewrites 后用于生成导航的页面路径 */
  rewrittenPage: string
  /** 当前页面归属的 locale key，未命中时为 `root` */
  localeKey: string
  /** 当前页面对应的最终路由路径 */
  routePath: string
  /** dynamic route 的参数对象 */
  params?: Record<string, string>
  /** dynamic route 内联传入的 markdown 内容 */
  content?: string
}

/** 运行时 dynamic route 记录 */
export interface RuntimeDynamicRoute {
  /** dynamic route 模板路径 */
  route: string
  /** 当前实例对应的具体页面路径 */
  path: string
  /** 当前实例的参数对象 */
  params?: Record<string, string>
  /** 当前实例的内联 markdown 内容 */
  content?: string
}

/** 页面最终生效的展示元数据 */
export interface EffectiveItemMeta {
  /** 当前条目是否可见 */
  visible: boolean
  /** 当前条目的排序权重 */
  order?: number
  /** 当前条目的展示名称 */
  displayName?: string
  /** 是否优先使用文章一级标题（H1）作为展示名称 */
  preferArticleTitle: boolean
  /** 目录节点是否默认折叠 */
  collapsed?: boolean
}

/** 追加内容元数据后的页面信息 */
export interface PageContentMeta extends ResolvedPage {
  /** 当前页面在原始输入中的稳定顺序 */
  sourceOrder: number
  /** 当前页面的绝对文件路径 */
  absolutePath: string
  /** 当前页面解析出的 frontmatter */
  frontmatter: Frontmatter
  /** 当前页面解析出的一级标题 */
  h1?: string
  /** 当前页面最终生效的条目元数据 */
  itemMeta: EffectiveItemMeta
  /** 当前页面最终用于展示的文本 */
  displayText: string
}

/** 归一化后的运行时上下文 */
export interface NormalizedRuntimeContext {
  /** 去重后的原始页面列表 */
  uniquePages: string[]
  /** 去重后的 rewrite 页面列表 */
  uniqueRewrittenPages: string[]
  /** 去重后的 dynamic routes 列表 */
  uniqueDynamicRoutes: RuntimeDynamicRoute[]
  /** rewrite 页面到源页面的映射表 */
  pageToSourceMap: Record<string, string | undefined>
}

/** 树构建阶段使用的节点结构 */
export interface TreeNode {
  /** 节点原始名称 */
  name: string
  /** 节点展示文本 */
  text: string
  /** 当前节点是否为目录 */
  isFolder: boolean
  /** 当前节点是否由 `index.md` 页面构成 */
  isIndexPage?: boolean
  /** 当前节点归属的 locale key */
  localeKey: string
  /** 当前节点对应的路由路径 */
  routePath: string
  /** 当前节点的稳定顺序 */
  sourceOrder?: number
  /** 当前节点的排序权重 */
  order?: number
  /** 目录节点是否默认折叠 */
  collapsed?: boolean
  /** 当前节点关联的 frontmatter */
  frontmatter?: Frontmatter
  /** 当前节点对应的源页面路径 */
  sourcePagePath?: string
  /** 当前节点对应的原始页面路径 */
  sourcePage?: string
  /** 当前节点对应的 rewrite 页面路径 */
  rewrittenPage?: string
  /** dynamic route 参数 */
  params?: Record<string, string>
  /** dynamic route 内联内容 */
  content?: string
  /** 子节点列表 */
  children: TreeNode[]
}

/** 按 locale 分组的目录树结构 */
export type LocaleTree = Record<string, TreeNode[]>
