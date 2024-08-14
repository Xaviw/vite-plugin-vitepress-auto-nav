import type { DefaultTheme, SiteConfig } from "vitepress";

export interface UserConfig {
  vitepress: SiteConfig<DefaultTheme.Config>;
}

/** 插件配置项 */
export interface Options {
  /**
   * glob 匹配表达式
   *
   * 会匹配 vitepress 配置中的 [srcDir] 目录下，除 [srcExclude] 外满足表达式的 md 文件（默认排除 node_modules、dist、根 index.md）
   *
   * 默认：**.md
   */
  pattern?: string | string[];
  /**
   * 将 index.md 作为其父级文件夹路径对应的页面，index 会作为父级文件夹对应的页面，设置为 false 后 index 会作为独立的页面显示（a/index.md 对应路径 /a，此时 index.md 对应的 ItemOptions 中的配置不会生效）
   *
   * 默认：true
   */
  indexAsFolderLink?: boolean;
  /**
   * 对特定文件或文件夹进行配置
   *
   * 键名为文件名、文件夹名或路径（以 [srcDir] 为根目录，从外层文件夹往里进行查找，md 扩展名可以省略；文件名重复时，增加前导路径区分）
   *
   * md 文件的配置也可以写在 frontmatter 中，使用相同属性名（支持通过 frontmatterPrefix 配置属性前缀）。优先级高于 itemsSetting 配置
   */
  itemsSetting?: Record<string, ItemOptions>;
  /**
   * 在 frontmatter 中进行配置时的属性前缀
   *
   * 可以避免与项目原有的变量逻辑冲突
   */
  frontmatterPrefix?: string;
  /**
   * 自定义排序方法，同级文件、文件夹会调用这个函数进行排序
   *
   * 默认排序方法 defaultCompareFn 规则为：
   *
   * 1. 都有 sort 值时，先按 sort 值升序排列再按创建时间升序排列
   * 2. 只有一个有 sort 值，且 sort 值等于另一个的下标值时，有 sort 值的在前
   * 3. 只有一个有 sort 值，且 sort 值不等于另一个的下标值时，对比 sort 值与下标值，升序排列
   * 4. 都没有 sort 值时，对比创建时间（`firstCommitTime` || `birthTime`）顺序排列
   */
  compareFn?: (a: Item, b: Item, frontmatterPrefix: string = "") => number;
  /** 是否使用文章中的一级标题代替文件名作为文章名称（处理文件名可能是简写的情况），也可以在 itemsSetting 中单独配置，优先级低于 title 配置 */
  useArticleTitle?: boolean;
  /** 用于支持从 Gitbook 的 SUMMARY 文件生成目录，添加后其他配置将不再生效 */
  summary?: {
    /** SUMMARY.md 文件路径 */
    target: string;
    /**
     * 同 SidebarItem.collapsed
     *
     * 未指定时，不可折叠
     *
     * 为 true 时，可折叠且默认折叠
     *
     * 为 false 时，可折叠且默认展开
     */
    collapsed?: boolean;
    /**
     * 去掉转义字符 "\"
     * @default true
     */
    removeEscape?: boolean;
  };
}

/**
 * 单个文件、文件夹配置项
 *
 * 也支持在文章的 frontmatter 中配置 `同名属性` 或 `frontmatterPrefix-属性名`，优先级高于 itemsSetting 中的配置
 */
export interface ItemOptions {
  /** 是否显示 */
  hide?: boolean;
  /** 排序值（目标位置下标，从0开始） */
  sort?: number;
  /** 重定义展示名称，优先级高于 useArticleTitle */
  title?: string;
  /** 是否使用文章中的一级标题代替文件名作为文章名称，优于全局 useArticleTitle 配置 */
  useArticleTitle?: boolean;
  /**
   * 同 sidebar 中 collapsed 配置，只对文件夹生效
   *
   * 默认：false（支持折叠，默认展开）
   */
  collapsed?: boolean;
}

/** 文件、文件夹关键信息 */
export interface Item {
  /** 同级中的位置下标 */
  index: number;
  /** 文件、文件夹名 */
  name: string;
  /** 是否是文件夹 */
  isFolder: boolean;
  /** 配置对象(不包括frontmatter)，以及时间戳数据(TimesInfo) */
  options: ItemCacheOptions;
  /** frontmatter 数据以及文章一级标题（h1） */
  frontmatter: Frontmatter;
  /** 子文件、文件夹 */
  children: Item[];
}

/** 缓存的 options 数据 */
export type ItemCacheOptions = ItemOptions & TimesInfo;

/** 文件、文件夹时间戳信息 */
export interface TimesInfo {
  /** 本地文件创建时间 */
  birthTime?: number;
  /** 本地文件修改时间 */
  modifyTime?: number;
  /** git首次提交时间 */
  firstCommitTime?: number;
  /** git最后一次提交时间 */
  lastCommitTime?: number;
}

/** 缓存的 frontmatter 数据 */
export type Frontmatter = { h1?: string } & Recordable;

export type Recordable = Record<string, any>;
