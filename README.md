# vite-plugin-vitepress-auto-nav

自动生成 VitePress 的 nav 与 sidebar 配置

## 🕯️ 使用

安装 vite-plugin-vitepress-auto-sidebar

```sh
# 推荐使用 pnpm
pnpm i vite-plugin-vitepress-auto-nav -D
```

添加插件到 `.vitepress/config.ts`

```ts
import AutoNav from 'vite-plugin-vitepress-auto-nav'

export default defineConfig({
  vite: {
    plugins: [
      AutoNav({
        // 可以自定义配置
      }),
    ],
  },
})
```

## 🛠️ 配置项

```ts
/** 插件配置项 */
interface Options {
  /**
   * glob 匹配表达式
   * 会匹配 srcDir 目录下，除 srcExclude 配置外的，满足表达式的 md 文件
   * 默认：**/*.md
   */
  pattern?: string | string[]
  /**
   * 对特定文件或文件夹进行配置
   * 键名为文件、文件夹名或路径（名称存在重复时，可以用路径区分，md 扩展名可以省略）
   */
  settings?: PluginSettings
  /**
   * 自定义排序方法，同级文件、文件夹会调用这个函数进行排序
   * 默认会先按照 sort 权重降序排列，再按照创建时间升序排列
   */
  compareFn?: (a: FileInfo, b: FileInfo) => number
}

/** 单个文件、文件夹配置项 */
interface PluginSettings {
  /*
  * hide：是否展示
  * sort：排序权重，权重越大越靠前
  * title：重新定义展示名称
  * collapsed: 同 sidebar 中的配置，默认为 false（支持折叠，默认展开）
  */
  [key: string]: Pick<FileInfo, 'hide' | 'sort' | 'title'> & { collapsed?: boolean }
}

interface FileInfo {
  name: string
  isFolder: boolean
  createTime: number
  updateTime: number
  hide?: boolean
  sort?: number
  title?: string
  collapsed?: boolean
  children: FileInfo[]
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
        a: { hide: true }, // a.md 不显示在目录中
        b: { title: 'bb' }, // 可以重新定义目录中的展示名
        c/c1: { sort : 9 }, // 名称相同时可以用路径精确匹配
        c2: { sort : 8 }, // 自定义排序权重，c2 会显示在 c1 后面，显示在未定义 sort 的文件前面
        d: { collapsed: 'cc' }, // 定义文件夹折叠配置
      },
      compareFn: (a, b) => {
        // 按修改时间升序排列
        return b.updateTime - a.updateTime
      }
    }),
  ],
}
```

## License

[MIT](./LICENSE) License © 2023 [Xaviw](https://github.com/Xaviw)
