# vite-plugin-vitepress-auto-nav

[English](./README.md)

基于 VitePress runtime pages 自动生成默认主题 `nav` 和 `sidebar` 的插件。

## 特点

- 使用一级目录生成 `nav`（仅用户配置不存在时），次级目录生成 `sidebar`（始终覆盖用户配置）。
- 兼容路由重写、动态路由和国际化。
- 支持自定义目录或文章的显示名称，文章还支持使用一级标题作为显示名称。
- 支持自定义目录或文章的显隐状态、排序规则。
- 支持自定义 `sidebar` 中目录折叠状态（等同官方配置）。
- 支持自定义 `index.md` 作为目录链接或单独文章。

## 快速开始

1. 安装

```sh
npm install -D vite-plugin-vitepress-auto-nav
```

2. 在 `.vitepress/config.ts` 中接入插件

```ts
import { defineConfig } from 'vitepress'
import AutoNav from 'vite-plugin-vitepress-auto-nav'

export default defineConfig({
  vite: {
    plugins: [AutoNav()],
  },
})
```

3. 按需对插件进行配置；按需决定是否自定义 `themeConfig.nav` 配置（nav 中菜单项通常较少，插件尊重用户个性化的 nav 配置）

4. 正常启动 vitepress

## 配置

| 当前参数               | 类型                                      | 默认值          | 说明                                                                                    |
| ---------------------- | ----------------------------------------- | --------------- | --------------------------------------------------------------------------------------- |
| `include`              | `string \| string[]`                      | -               | 插件处理范围，基于 VitePress `srcDir` 解析 glob。                                       |
| `exclude`              | `string \| string[]`                      | -               | 插件处理范围排除规则，基于 VitePress `srcDir` 解析 glob。                               |
| `standaloneIndex`      | `boolean`                                 | `false`         | 控制目录下 `index.md` 的挂载方式：`false` 时把它当作目录链接，`true` 时保留为独立页面。 |
| `overrides`            | `Record<string, ItemMetaOptions>`         | `{}`            | 条目覆盖配置。key 支持文件名、目录名或相对路径；如果存在重名，优先用相对路径。          |
| `frontmatterKeyPrefix` | `string`                                  | `''`            | 给插件 frontmatter 字段加前缀，避免和站点现有字段冲突。                                 |
| `sorter`               | `(a, b, frontmatterKeyPrefix?) => number` | `defaultSorter` | 同级节点排序函数。函数参数中包含 `overrides.order`。                                    |
| `preferArticleTitle`   | `boolean`                                 | `false`         | 全局默认是否优先使用文章 H1 作为导航展示名。优先级低于 `displayName`。                  |
| `dev`                  | `AutoNavDevOptions`                       | 见下文          | 开发态配置，用来控制监听防抖、内容缓存和日志输出。                                      |
| ❌                     | -                                         | -               | `SUMMARY.md` 生成链路已不再支持。                                                       |

### `overrides`（`ItemMetaOptions`）

`overrides` 同名配置还支持在 md 文件 frontmatter 中配置，如果项目里已经有同名字段，建议通过 `frontmatterKeyPrefix` 增加前缀，比如 `navDisplayName`、`navOrder`、`navVisible`。

| 当前参数             | 类型      | 默认值  | 说明                                                                                  |
| -------------------- | --------- | ------- | ------------------------------------------------------------------------------------- |
| `displayName`        | `string`  | -       | 自定义文件或目录节点的展示文案，优先级高于 `preferArticleTitle` 和默认文件名/目录名。 |
| `visible`            | `boolean` | `true`  | 控制节点是否出现在导航。                                                              |
| `order`              | `number`  | -       | 提供给 `sorter` 的排序权重，值越小越靠前。                                            |
| `preferArticleTitle` | `boolean` | `false` | 是否读取文章 H1 作为展示名。                                                          |
| `collapsed`          | `boolean` | -       | 目录节点默认是否折叠。                                                                |

### `dev`（`AutoNavDevOptions`）

| 当前参数          | 类型                            | 默认值   | 说明                                                                      |
| ----------------- | ------------------------------- | -------- | ------------------------------------------------------------------------- |
| `watchDebounceMs` | `number`                        | `1500`   | 文件监听防抖时间，单位毫秒，用来控制频繁变更时的重算节奏。                |
| `cache`           | `boolean`                       | `true`   | 开发态是否复用内容解析缓存。                                              |
| `logLevel`        | `'silent' \| 'info' \| 'debug'` | `'info'` | 开发日志级别；排查路径解析、结果合并和 watch 行为时，可以切换到 `debug`。 |

## 从 V3 迁移

将此段内容交给 AI 大模型，让 AI 帮你完成快速迁移。

```text
请把这个项目从 vite-plugin-vitepress-auto-nav v3 迁移到最新版本。

先升级依赖：
- npm：`npm install -D vite-plugin-vitepress-auto-nav@latest`
- pnpm：`pnpm add -D vite-plugin-vitepress-auto-nav@latest`
- yarn：`yarn add -D vite-plugin-vitepress-auto-nav@latest`

然后按以下规则迁移配置：

顶层配置重命名如下：
- `pattern` -> `include`
- `itemsSetting` -> `overrides`
- `frontmatterPrefix` -> `frontmatterKeyPrefix`
- `compareFn` -> `sorter`
- `useArticleTitle` -> `preferArticleTitle`

条目配置 / frontmatter 字段重命名如下：
- `title` -> `displayName`
- `sort` -> `order`
- `useArticleTitle` -> `preferArticleTitle`

以下布尔值需要反转语义：
- `indexAsFolderLink` -> `standaloneIndex`，转换公式为 `standaloneIndex = !indexAsFolderLink`
- `hide` -> `visible`，转换公式为 `visible = !hide`

如有需要，可以补充这些新配置：
- `exclude`
- `dev.watchDebounceMs`
- `dev.cache`
- `dev.logLevel`

关于 summary 的重要规则：
- 如果现有配置中包含 `summary` 参数、`SUMMARY.md` 工作流，或任何基于 summary 的生成逻辑，请立即中断迁移，并明确告知：最新版本已经停止支持 summary 生成链路。

迁移规则：
1. 直接替换已重命名的字段。
2. 按上述公式处理语义反转的布尔值。
3. 与插件无关的 VitePress 配置保持不变。

输出要求：
- 只返回迁移后的配置代码。
- 尽量保留原有注释。
- 如果检测到 summary 相关配置，不要输出迁移后的代码，而是简短说明 summary 已停止支持，并要求用户补充页面结构或内容组织规则后再继续。
```

## 开发命令

- `pnpm build`
- `pnpm lint`
- `pnpm lint:fix`
- `pnpm format`
- `pnpm test`
- `pnpm test:unit`
- `pnpm test:unit:coverage`
- `pnpm test:integration`
- `pnpm test:watch`

## License

[MIT](./LICENSE) License © 2023 [Xaviw](https://github.com/Xaviw)
