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

### 🛠️ 配置项

```ts
interface Options {
  /**
   * glob 匹配表达式
   * 会匹配 srcDir 目录下，除 srcExclude 配置外的，满足表达式的 md 文件
   * 默认：**/*.md
   */
  pattern?: string | string[]
  /**
   * 对特定文件或文件夹进行配置
   * 键名为文件(夹)名或路径（名称存在重复时，可以用路径区分）
   * hide：是否展示
   * sort：排序权重，权重越大越靠前
   * title：重新定义展示名称
   * collapsed: 同 sidebar 中的配置，默认为 false（支持折叠，默认展开）
   */
  settings?: PluginSettings
  /**
   * 自定义排序方法，同级文件(夹)会调用这个函数进行排序
   */
  compareFn?: (a: FileInfo, b: FileInfo) => number
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

interface PluginSettings {
  [key: string]: Pick<FileInfo, 'hide' | 'sort' | 'title'> & { collapsed?: boolean }
}
```

## License

[MIT](./LICENSE) License © 2023 [Xaviw](https://github.com/Xaviw)
