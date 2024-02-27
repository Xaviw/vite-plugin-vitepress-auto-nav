# vite-plugin-vitepress-auto-nav

自动生成 VitePress 的 nav 与 sidebar 配置

## ✨ 功能

- 自动读取目录生成 sidebar 和 nav 配置
- 支持设置目录读取范围
- 支持使用文件/文件夹名称、文章一级标题或自定义名称作为 sidebar 和 nav 中的显示名称
- 支持隐藏文件夹或文章
- 支持自定义同级文件夹和文章的排序方法
- 支持手动配置 nav 代替自动生成

## 🕯️ 使用

安装 vite-plugin-vitepress-auto-sidebar

```sh
# 推荐使用 pnpm
pnpm i vite-plugin-vitepress-auto-nav -D
```

添加插件到 `.vitepress/config.ts`，如果添加后报 TS 类型错误请安装 vite

```ts
import AutoNav from "vite-plugin-vitepress-auto-nav";

export default defineConfig({
  vite: {
    plugins: [
      AutoNav({
        // 可以自定义配置
      }),
    ],
  },
});
```

## 🛠️ 配置项

```ts
/** 插件配置项 */
interface Options {
  /**
   * glob 匹配表达式
   *
   * 会匹配 srcDir 目录下，除 srcExclude 配置外满足表达式的 md 文件
   *
   * 默认：**.md
   */
  pattern?: string | string[];
  /**
   * 对特定文件或文件夹进行配置
   *
   * 键名为文件名、文件夹名或路径（会从外层文件夹往里进行查找，md 扩展名可以省略；名称存在重复时，用路径区分）
   *
   * 文章的配置也可以写在 frontmatter 中，使用系统属性名或`nav-属性名`。优先级高于 itemsSetting 配置
   */
  itemsSetting?: Record<string, ItemOptions>;
  /**
   * 自定义排序方法，同级文件、文件夹会调用这个函数进行排序
   *
   * 默认排序方法 defaultCompareFn 规则为：
   *
   * 1. 都有sort值时，先按sort值升序排列再按创建时间升序排列
   * 2. 只有一个有sort值，且sort值等于另一个的下标值时，有sort值的在前
   * 3. 只有一个有sort值，且sort值不等于另一个的下标值时，对比sort值与下标值，升序排列
   * 4. 都没有sort值时，对比创建时间顺序排列
   */
  compareFn?: (a: FileInfo, b: FileInfo) => number;
  /** 是否使用文章中的一级标题代替文件名作为文章名称（处理文件名可能是简写的情况），也可以在 itemsSetting 中单独配置 */
  useArticleTitle?: boolean;
}

/**
 * 单个文件、文件夹配置项
 *
 * 也支持在文章的 frontmatter 中配置同名属性或 `nav-属性名`，优先级高于 itemsSetting 中的配置
 */
interface ItemOptions {
  /** 是否显示 */
  hide?: boolean;
  /** 排序值（目标位置下标，从0开始） */
  sort?: number;
  /** 重定义展示名称 */
  title?: string;
  /** 是否使用文章中的一级标题代替文件名作为文章名称，优于全局 useArticleTitle 配置 */
  useArticleTitle?: boolean;
  /**
   * 同 sidebar 中的配置，只对文件夹生效
   *
   * 默认：false（支持折叠，默认展开）
   */
  collapsed?: boolean;
}

interface FileInfo {
  /** 同级中的位置下标 */
  index: number;
  /** 文件、文件夹名 */
  name: string;
  /** 是否是文件夹 */
  isFolder: boolean;
  /** 文件首次提交时间或本地文件创建时间 */
  createTime: number;
  /** 文件最新提交时间或本地文件更新时间 */
  updateTime: number;
  /** 配置对象：`{ ...itemSetting, ...frontmatter }` */
  options: ItemOptions & Record<string, any>;
  /** 子文件、文件夹 */
  children: FileInfo[];
}
```

> 生成的 nav 配置，会使用目录下第一篇文章作为 link 属性，如果需要自定义配置可以直接在 `config.ts` 中添加，此时插件将不会修改已存在的配置

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
        return b.updateTime - a.updateTime
      },
      useArticleTitle: true // 开启使用文章一级标题作为文章名称
    }),
  ],
}
```

## License

[MIT](./LICENSE) License © 2023 [Xaviw](https://github.com/Xaviw)
