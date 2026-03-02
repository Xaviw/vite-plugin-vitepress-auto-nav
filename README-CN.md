# vite-plugin-vitepress-auto-nav

自动生成 `VitePress` 的 `nav` 与 `sidebar` 配置

## ✨ 功能

- 将一级文件夹作为 `nav`，将次级文件夹和文件作为 `sidebar`
- 修改插件配置或 `frontmatter` 后自动刷新
- 支持自定义读取范围（基于 `srcDir` 与 `srcExclude` 配置）
- 支持自定义子文件夹下的 `index.md` 是单独展示还是点击文件夹名称展示
- 支持自定义显示名称，文章还支持一级标题作为名称
- 支持自定义排序方法
- 支持自定义隐藏文件或文件夹
- 支持插件选项与文章 `frontmatter` 配置两种方式自定义文章配置（配置属性名还支持添加前缀）
- 支持使用同 `Gitbook` 的 `SUMMARY.md` 文件作为 `sidebar` 配置

## 🕯️ 使用

1. 安装

```sh
# 使用 ts 时推荐安装 vite，否则会有类型错误
pnpm i vite-plugin-vitepress-auto-nav vite -D
```

2. 添加插件

```ts
// .vitepress/config.ts
import AutoNav from 'vite-plugin-vitepress-auto-nav'

export default defineConfig({
  vite: {
    plugins: [
      AutoNav({
        // 自定义配置
      }),
    ],
  },
})
```

3. 正常启动项目即可使用

## 配置

请参照 TypeScript 类型提示

## License

[MIT](./LICENSE) License © 2023 [Xaviw](https://github.com/Xaviw)
