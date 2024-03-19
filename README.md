# vite-plugin-vitepress-auto-nav

自动生成 `VitePress` 的 `nav` 与 `sidebar` 配置

## ✨ 功能

- 支持自定义读取范围（基于 `srcDir` 与 `srcExclude` 配置）
- 将一级文件夹作为 `nav`，将次级文件夹和文件作为 `sidebar`
- 支持插件配置与文章 `frontmatter` 配置两种自定义方式
- 支持自定义显示名称，文章还支持一级标题作为名称
- 支持自定义排序方法
- 支持自定义隐藏文件或文件夹
- 修改插件配置或 `frontmatter` 后自动刷新

## 🕯️ 使用

1. 安装

```sh
# 推荐使用 pnpm
pnpm i vite-plugin-vitepress-auto-nav -D
# 使用 ts 时推荐安装 vite，否则会有类型错误
pnpm i vite -D
```

2. 添加插件

```ts
// .vitepress/config.ts
import AutoNav from "vite-plugin-vitepress-auto-nav";

export default defineConfig({
  vite: {
    plugins: [
      AutoNav({
        // 自定义配置
      }),
    ],
  },
});
```

3. 正常启动项目即可使用

## 🛠️ 配置

**在文章 `frontmatter` 中也可以配置 `ItemOptions` 中的属性。同时支持配置为 `nav-属性名` 的格式，可以避免与逻辑中的变量重名。对于 `frontmatter` 中其他的变量，也会加入到排序函数参数的 `frontmatter` 属性中**

```ts
interface Options {
  /**
   * glob 匹配表达式
   *
   * 会匹配 vitepress 配置中的 [srcDir] 目录下，除 [srcExclude] 外满足表达式的 md 文件
   *
   * 默认：**.md
   */
  pattern?: string | string[];
  /**
   * 对特定文件或文件夹进行配置
   *
   * 键名为文件名、文件夹名或路径（以 [srcDir] 为根目录，从外层文件夹往里进行查找，md 扩展名可以省略；名称重复时，用路径区分）
   *
   * md 文件的配置也可以写在 frontmatter 中，使用相同 `属性名`]` 或 `nav-属性名`。优先级高于 itemsSetting 配置
   */
  itemsSetting?: Record<string, ItemOptions>;
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
  compareFn?: (a: Item, b: Item) => number;
  /** 是否使用文章中的一级标题代替文件名作为文章名称（处理文件名可能是简写的情况），也可以在 itemsSetting 中单独配置 */
  useArticleTitle?: boolean;
}

/**
 * 单个文件、文件夹配置项
 *
 * 也支持在文章的 frontmatter 中配置 `同名属性` 或 `nav-属性名`，优先级高于 itemsSetting 中的配置
 */
interface ItemOptions {
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
interface Item {
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
type ItemCacheOptions = ItemOptions & TimesInfo;

/** 文件、文件夹时间戳信息 */
interface TimesInfo {
  /** 本地文件创建时间 */
  birthTime?: number;
  /** 本地文件修改时间 */
  modifyTime?: number;
  /** git首次提交时间（仅文件） */
  firstCommitTime?: number;
  /** git最后一次提交时间（仅文件） */
  lastCommitTime?: number;
}

/** 缓存的 frontmatter 数据 */
type Frontmatter = { h1?: string } & Recordable;

type Recordable = Record<string, any>;
```

> 生成的 `nav` 配置，会使用目录下第一篇文章作为 `link` 属性。如果需要自定义 `nav` 可以直接手动定义，此时插件将不会修改已存在的 `nav` 配置（因为 `nav` 配置通常较少，手动配置相较于插件中进行复杂的配置性价比更高）

## 🎊 配置示例

```ts
vite: {
  plugins: [
    AutoNav({
      pattern: ["**/!(README|TODO).md"], // 也可以在这里排除不展示的文件，例如不匹配 README 和 TODO 文件
      settings: {
        a: { hide: true }, // 不显示名称为 a 的文件夹或 md 文件
        b: { title: 'bb' }, // 名称为 b 的文件夹或文件在菜单中显示为 bb
        c/b: { sort : 3 }, // 通过路径精确匹配 c 文件夹下的 b 进行配置，排序时位于下标3的位置或最后
        c/b2: { useArticleTitle: false }, // 关闭使用文章一级标题作为文章名称
        d: { collapsed: true }, // 文件夹折叠配置
      },
      compareFn: (a, b) => {
        // 按最新提交时间(没有提交记录时为本地文件修改时间)升序排列
        return (b.options.lastCommitTime || b.options.modifyTime) - (a.options.lastCommitTime || a.options.modifyTime)
      },
      useArticleTitle: true // 全局开启使用文章一级标题作为文章名称
    }),
  ],
}
```

## License

[MIT](./LICENSE) License © 2023 [Xaviw](https://github.com/Xaviw)
