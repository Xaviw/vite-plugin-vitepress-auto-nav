# vite-plugin-vitepress-auto-nav 功能清单

本文基于当前实现代码与现有 unit / integration 测试整理，目标是把本插件的**完整功能面**、**核心实现流程**和**已覆盖测试场景**放在一处，便于后续维护与回归验证。

---

## 1. 插件总体定位

本插件用于基于 **VitePress runtime pages** 自动生成默认主题的 `nav` 与 `sidebar`。

核心入口：

- `src/index.ts:6`
- `src/core/plugin.ts:157`

总体执行链路：

1. 用户调用 `AutoNav(options)`。
2. 插件先做参数归一化。
3. 在 VitePress 生命周期中读取 runtime `siteConfig`。
4. 从 `pages / rewrites / dynamicRoutes` 解析插件可消费的页面源。
5. 读取 frontmatter / H1 / overrides，得到每个页面的显示元数据。
6. 按 locale 构建目录树。
7. 从目录树生成 `navByLocale` 与 `sidebarByLocale`。
8. 合并回 `siteConfig.site.themeConfig` 与 `siteConfig.site.locales[*].themeConfig`。
9. 在 `configResolved` 阶段做最终去重与自动生成标记清理。
10. 在 dev/watch 场景下按变更重算并触发 `full-reload`。

---

## 2. 公开能力清单

公开配置定义：`src/types/plugin.ts:13`

### 2.1 `include`

- 作用：指定插件处理哪些 markdown 页面。
- 类型：`string | string[]`
- 归一化：会去空白、去重、统一为数组。
- 实现入口：`src/core/normalizeOptions.ts:9`
- 实际生效点：`src/core/pageSource.ts:201`

简单流程：

1. 读取用户传入的 glob。
2. 归一化为字符串数组。
3. 在页面源解析阶段，对 `sourcePage / resolvedPage / rewrittenPage` 同时做匹配。
4. 只有命中的页面才进入后续元数据解析与树构建。

测试覆盖：

- `tests/unit/normalizeOptions.test.ts`
- `tests/unit/pageSource.test.ts`

### 2.2 `exclude`

- 作用：从插件导航生成范围中排除页面。
- 类型：`string | string[]`
- 归一化：会去空白、去重、统一为数组。
- 实现入口：`src/core/normalizeOptions.ts:23`
- 实际生效点：`src/core/pageSource.ts:158`

简单流程：

1. 页面先通过 `include` 判断。
2. 再检查是否命中 `exclude`。
3. 命中的页面不会进入插件生成链路。
4. 这只影响插件输出，不改变 VitePress runtime pages 本身。

测试覆盖：

- `tests/unit/pageSource.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `exclude-only`、`hidden-pages-still-build`、`complex-combo-multi-level`

### 2.3 `standaloneIndex`

- 作用：控制目录下 `index.md` 是作为目录链接还是独立页面。
- 默认：`false`
- 实现入口：`src/core/treeBuilder.ts:207`

简单流程：

- `false`：
  1. 若页面是某目录下的 `index.md`。
  2. 将该页面信息挂到目录节点本身。
  3. 目录节点会拥有 `link`，sidebar 中该目录可点击。
- `true`：
  1. 目录仍然存在。
  2. `index.md` 作为目录下的一个独立 page node 保留。
  3. 目录本身若无 index，则 nav 会取首个可访问子链接。

测试覆盖：

- `tests/unit/treeNavSidebar.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `standalone-index-true`

### 2.4 `overrides`

- 作用：按文件名、目录名或相对路径覆盖条目行为。
- 类型：`Record<string, ItemMetaOptions>`
- 支持字段：`visible`、`order`、`displayName`、`preferArticleTitle`、`collapsed`
- 归一化入口：`src/core/normalizeOptions.ts:78`
- 页面匹配入口：`src/core/contentMeta.ts:149`

简单流程：

1. 先对 key 规范化：去 `./`、去 `.md`、统一斜杠、去尾部 `/`。
2. 在解析页面元数据时，按候选 key 顺序查找。
3. 候选包括：
   - source path
   - resolved path
   - rewritten path
   - 去扩展名路径
   - basename
   - 目录 index 的父目录名/父目录路径
4. 命中后将配置作为页面或目录条目的附加元信息参与后续生成。

测试覆盖：

- `tests/unit/normalizeOptions.test.ts`
- `tests/unit/contentMeta.test.ts`
- `tests/unit/pageSource.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `overrides-custom`、`override-key-collision`、`complex-combo-multi-level`

### 2.5 `frontmatterKeyPrefix`

- 作用：为插件 frontmatter 字段加前缀，避免与站点已有字段冲突。
- 实现入口：`src/core/contentMeta.ts:105`

支持的前缀化字段：

- `visible`
- `order`
- `displayName`
- `preferArticleTitle`
- `collapsed`

简单流程：

1. 若设置了前缀，例如 `nav`。
2. 先查 `navVisible` / `navOrder` / `navDisplayName` 等。
3. 若前缀字段存在且值合法，直接使用。
4. 若前缀字段存在但值非法，则回退普通字段。
5. 普通字段仍不存在时，再回退 overrides / 全局默认值。

测试覆盖：

- `tests/unit/contentMeta.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `frontmatter-custom`

### 2.6 `sorter`

- 作用：控制同级节点排序。
- 实现入口：`src/core/normalizeOptions.ts:143`
- 树排序入口：`src/core/treeBuilder.ts:109`

默认排序规则：`src/core/normalizeOptions.ts:114`

1. 先比 `order`。
2. 再比 `index`。
3. 再比 `name.localeCompare()`。
4. 若仍相等，返回 `0`，外层再用 `sourceOrder` 做稳定排序。

自定义排序规则：

1. 若用户提供 `sorter`，优先调用。
2. 若返回值不是有限数字，回退默认排序。
3. 若用户 sorter 抛异常，也回退默认排序。

测试覆盖：

- `tests/unit/normalizeOptions.test.ts`
- `tests/unit/treeNavSidebar.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `sorter-custom`

### 2.7 `preferArticleTitle`

- 作用：全局默认是否优先用文章 H1 作为展示名。
- 默认：`false`
- 实现入口：`src/core/contentMeta.ts:209`

简单流程：

1. 如果页面/目录已有 `displayName`，优先使用 `displayName`。
2. 否则若 `preferArticleTitle` 为 `true` 且页面存在 H1，则使用 H1。
3. 否则回退文件名或目录名。

测试覆盖：

- `tests/unit/contentMeta.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `dynamic-routes`、`overrides-custom`、`frontmatter-custom`、`complex-combo-multi-level`

### 2.8 `dev`

- 定义：`src/types/plugin.ts:3`
- 支持字段：
  - `watchDebounceMs`
  - `cache`
  - `logLevel`

简单流程：

1. `watchDebounceMs` 控制 watch 防抖。
2. `cache` 控制内容解析缓存是否开启。
3. `logLevel` 控制日志输出层级：
   - `silent`：不打 info/debug
   - `info`：打生命周期与 preserve 提示
   - `debug`：额外输出 hash / route source / build stats / watch reason

测试覆盖：

- `tests/unit/pluginFlow.test.ts`
- `tests/unit/contentMeta.test.ts`

---

## 3. 页面输入解析能力

核心实现：`src/core/pageSource.ts:201`

### 3.1 读取 runtime pages

- 输入来源：`siteConfig.pages`
- 这是插件当前唯一可信的页面主输入。
- 插件不是直接扫磁盘构建导航，而是消费 VitePress 已解析好的 runtime pages。

简单流程：

1. 读取 `siteConfig.pages`。
2. 做路径规范化。
3. 和 rewrites / dynamicRoutes 合并理解。
4. 生成插件内部的 `ResolvedPage[]`。

测试覆盖：

- `tests/unit/pageSource.test.ts`
- 所有 integration example

### 3.2 支持 rewrites

- 支持 `siteConfig.rewrites.map` 与 `siteConfig.rewrites.inv`。
- 实现点：`src/core/pageSource.ts:205`

简单流程：

1. 先把 runtime page 通过 `rewrites.inv` 映回原始 source。
2. 再在生成 `rewrittenPage` 时优先用：
   - `rewritesMap[resolvedPage]`
   - 否则 `rewritesMap[sourcePage]`
   - 否则保留 `resolvedPage`
3. 导航最终使用 rewrite 后路径。

测试覆盖：

- `tests/unit/pageSource.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `routing-static-rewrites`、`routing-param-rewrites`、`dynamic-routes-rewrites`、`complex-combo-multi-level`

### 3.3 支持 dynamic routes

- 实现点：`src/core/pageSource.ts:209`

简单流程：

1. 读取 `siteConfig.dynamicRoutes.routes`。
2. 将 `{ route, path, params, content }` 规范化。
3. 先按 `path` 匹配 runtime page；找不到再按 `route` 回退。
4. 将 `sourcePage` 记录为动态模板路径，如 `blog/[slug].md`。
5. 将 `resolvedPage` 记录为当前具体实例路径，如 `blog/hello-world.md`。
6. 后续显示名、nav、sidebar 都按具体实例路径生成。

测试覆盖：

- `tests/unit/pageSource.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `dynamic-routes`、`dynamic-routes-i18n`、`dynamic-routes-rewrites`、`dynamic-routes-multi-segment`

### 3.4 locale 自动识别

- 实现点：`src/core/pageSource.ts:36`

简单流程：

1. 从 `siteConfig.site.locales` 中提取 locale key。
2. 读取 rewritten path 的首段。
3. 若首段命中 locale key，则该页面归属对应 locale。
4. 否则归属 `root`。

测试覆盖：

- `tests/unit/pageSource.test.ts`
- 多语言 integration examples

### 3.5 默认跳过 root / locale 根 index

- 实现点：`src/core/pageSource.ts:186`

简单流程：

1. 若页面为 `index.md`。
2. 或者形如 `fr/index.md`、`ja/index.md` 的 locale 根首页。
3. 插件默认不把它们放进自动导航生成链路。

测试覆盖：

- `tests/unit/pageSource.test.ts`

### 3.6 `include` / `exclude` 同时作用于三类路径

- `sourcePage`
- `resolvedPage`
- `rewrittenPage`

实现点：`src/core/pageSource.ts:158`

这意味着：

- 你可以按原始路径筛选。
- 也可以按动态路由展开后的路径筛选。
- 也可以按 rewrite 后路径筛选。

测试覆盖：

- `tests/unit/pageSource.test.ts`

### 3.7 忽略 `SUMMARY.md`

- 当前插件**不再支持**基于 `SUMMARY.md` 的旧生成链路。
- `SUMMARY.md` 现在会从插件主流程中被统一忽略。
- 实现点：`src/core/pageSource.ts`、`src/core/cache.ts`、`src/core/watcher.ts`

简单流程：

1. 若页面路径是 `SUMMARY.md`，则不进入插件页面解析。
2. 若 runtime pages 中存在 `SUMMARY.md`，不会参与 hash、导航、侧边栏。
3. watch 到 `SUMMARY.md` 也不会触发插件重算。

测试覆盖：

- `tests/unit/pageSource.test.ts`
- `tests/unit/cache.test.ts`
- `tests/unit/watcher.test.ts`
- `tests/unit/pluginFlow.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `summary-ignore`

---

## 4. 内容元数据解析能力

核心实现：`src/core/contentMeta.ts:349`

### 4.1 读取 frontmatter 与 H1

- 使用 `gray-matter` 解析 markdown。
- H1 读取实现：`src/core/contentMeta.ts:89`

简单流程：

1. 读取文件内容或 dynamic route 的 inline content。
2. 提取 frontmatter。
3. 从正文首个 H1 提取文章标题。
4. H1 中若出现 `{{$frontmatter.xxx}}`，会做简单变量替换。

测试覆盖：

- `tests/unit/contentMeta.test.ts`

### 4.2 展示字段优先级

实现点：`src/core/contentMeta.ts:209`

优先级链路：

1. prefixed frontmatter（若设置前缀且值合法）
2. 普通 frontmatter
3. overrides
4. 全局默认值

涉及字段：

- `visible`
- `order`
- `displayName`
- `preferArticleTitle`
- `collapsed`

测试覆盖：

- `tests/unit/contentMeta.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `frontmatter-custom`、`frontmatter-default-fields`

### 4.3 frontmatter 字段边界

仅支持当前正式字段：

- `visible`
- `order`
- `displayName`
- `preferArticleTitle`
- `collapsed`

旧字段 `hide`、`sort`、`title`、`useArticleTitle` 已移除，不再参与解析或排序。

测试覆盖：

- `tests/unit/contentMeta.test.ts`

### 4.4 目录 index 的显示名与 collapsed

简单流程：

1. 如果页面是目录 `index.md`，默认显示父目录名。
2. 如果存在目录级 overrides，可覆盖其显示名。
3. `collapsed` 对目录节点生效，对普通页面只作为元数据保留，最终 sidebar page item 不输出 `collapsed`。

测试覆盖：

- `tests/unit/contentMeta.test.ts`
- `tests/unit/treeNavSidebar.test.ts`

### 4.5 dynamic route 内容回退

简单流程：

1. 若 dynamic route 带 inline `content`，直接解析该内容。
2. 若无 inline `content`，则回退去读模板 markdown。
3. 若模板文件不存在，则返回空 frontmatter / 空 H1，并只告警一次。

测试覆盖：

- `tests/unit/contentMeta.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `dynamic-routes`

### 4.6 内容缓存

- 实现点：`src/core/contentMeta.ts:257`

简单流程：

1. 若 `dev.cache !== false`，按文件路径 + mtime + size 或 inline content hash 建缓存 key。
2. 命中缓存时复用已解析 frontmatter/H1。
3. 文件变化后缓存自然失效。
4. 当前轮未使用的缓存会被 prune。

测试覆盖：

- `tests/unit/contentMeta.test.ts`

---

## 5. 目录树构建能力

核心实现：`src/core/treeBuilder.ts:207`

### 5.1 只让可见页面进入树

- `visible=false` 的页面不会进入树构建。
- 这意味着它们不会出现在 nav/sidebar。
- 但它们仍可能存在于 VitePress runtime pages 中。

测试覆盖：

- `tests/unit/contentMeta.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `overrides-custom`、`hidden-pages-still-build`

### 5.2 locale 隔离

简单流程：

1. 先按 `page.localeKey` 分组。
2. 每个 locale 独立构树。
3. root 与各 locale 的节点不会串值。

测试覆盖：

- `tests/unit/treeNavSidebar.test.ts`
- 多语言 integration examples

### 5.3 自动创建目录节点

简单流程：

1. 按 `rewrittenPage` 拆分目录层级。
2. 若父目录节点不存在，则创建 folder node。
3. 若已存在则复用，并更新更合理的 `sourceOrder`。

测试覆盖：

- `tests/unit/treeNavSidebar.test.ts`

### 5.4 目录显示名解析

- 实现点：`src/core/treeBuilder.ts:47`

候选优先级：

1. locale 路径级 key，例如 `fr/guide`
2. 普通相对路径 key，例如 `guide`
3. 目录名短 key，例如 `basic`
4. 默认回退目录名本身

测试覆盖：

- `tests/unit/treeNavSidebar.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `override-key-collision`、`complex-combo-multi-level`

### 5.5 排序

- 实现点：`src/core/treeBuilder.ts:109`

简单流程：

1. 先尝试用户 sorter。
2. 用户 sorter 无效时回退默认 sorter。
3. 若比较结果仍为 `0`，再按 `sourceOrder` 稳定排序。
4. 排序会递归作用于所有子节点。

测试覆盖：

- `tests/unit/treeNavSidebar.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `sorter-custom`、`complex-combo-multi-level`

---

## 6. nav 生成能力

核心实现：`src/core/navBuilder.ts:49`

### 6.1 生成 top-level nav

简单流程：

1. 遍历某个 locale 的根节点。
2. 对每个根节点求一个可访问 `link`。
3. 生成 `{ text, link, activeMatch }`。
4. 最后按 `link` 去重。

### 6.2 目录 link 解析规则

- 实现点：`src/core/navBuilder.ts:14`

规则：

1. 如果节点本身是 page，直接返回 `routePath`。
2. 如果节点是 folder 且挂了 `index.md`，返回目录自己的 `routePath`。
3. 如果节点是 folder 但没有 index，则递归取第一个可访问子链接。
4. 若整棵子树都不可访问，则该根节点不生成 nav。

### 6.3 `activeMatch` 规则

- 目录：保持目录 route，如 `/guide/`
- 普通页面：直接使用页面 route，如 `/overview`

测试覆盖：

- `tests/unit/treeNavSidebar.test.ts`
- 几乎所有 integration examples

---

## 7. sidebar 生成能力

核心实现：`src/core/sidebarBuilder.ts:65`

### 7.1 section key 规则

- 普通页面 route 会补成 `/xxx/`
- 目录 route 若已是 `/guide/` 则直接用
- 实现点：`src/core/sidebarBuilder.ts:15`

### 7.2 sidebar item 规则

简单流程：

1. top-level root node 对应一个 section。
2. 若 root 是 folder，则把其 children 转成 sidebar items。
3. 若 root 是 page，则该 section 为空数组。
4. folder item 默认有：
   - `text`
   - `items`
   - 若目录有 index，则额外有 `link`
   - 若设置了 `collapsed`，则写入 `collapsed`
5. page item 只有：
   - `text`
   - `link`

测试覆盖：

- `tests/unit/treeNavSidebar.test.ts`
- `tests/integration/exampleProjects.test.ts`

---

## 8. themeConfig 合并策略

核心实现：

- `src/core/merger.ts:180`
- `src/core/merger.ts:215`

这是当前插件最重要的输出语义之一。

### 8.1 `nav` 永远 preserve

简单流程：

1. 若目标 `themeConfig.nav` 已存在。
2. 插件跳过写入。
3. 记录 `skip` 统计并输出 info 日志（非 silent）。
4. 若目标 `nav` 不存在，才写入自动生成结果。

### 8.2 `sidebar` 永远 replace

简单流程：

1. 无论用户原先是否写了 `sidebar`。
2. 插件都会用自动生成的 `sidebar` 覆盖目标值。
3. 记录 `replace` 与 `write` 统计。

### 8.3 locale 目标自动初始化

简单流程：

1. 若 payload 命中某个 locale。
2. 若该 locale 存在但 `themeConfig` 缺失，会自动补 `{}`。
3. 若该 locale 根本不存在，则跳过并告警。

测试覆盖：

- `tests/unit/merger.test.ts`
- `tests/unit/pluginFlow.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 root/manual/locale 场景

---

## 9. 最终结果清理与去重

核心实现：`src/core/plugin.ts:122`

### 9.1 自动生成标记清理

插件在 merge 时会打内部标记：

- `__autoNavGeneratedNav`
- `__autoNavGeneratedSidebar`

在 `configResolved` 阶段会统一清理掉，不把内部状态留给最终用户配置。

### 9.2 nav 去重

- 按 `link` 去重。

### 9.3 sidebar 去重

- page item：按 `link` 去重。
- 无 link 的 group item：按 `text + collapsed + 子项结构` 生成 key 去重。

测试覆盖：

- `tests/unit/pluginFlow.test.ts`
- `tests/integration/exampleProjects.test.ts` 中 `complex-combo-multi-level`、`routing-no-rewrites`、`dynamic-routes-multi-segment`、`standalone-index-true`

---

## 10. dev / watch 行为

核心实现：`src/core/plugin.ts:157`、`src/core/watcher.ts:35`

### 10.1 runtimeHash 缓存

- 实现点：`src/core/cache.ts:89`

简单流程：

1. 用 `pages / rewrites / dynamicRoutes / localeKeys / options` 计算 runtimeHash。
2. 若本轮 hash 与上轮相同，则跳过页面源到 payload 的重算。

### 10.2 payloadHash 缓存

简单流程：

1. 计算当前 `navByLocale + sidebarByLocale` 的 payloadHash。
2. watch 场景下，若 payloadHash 未变，则跳过 merge/apply。
3. 避免无意义 full-reload。

### 10.3 watch 触发源

- markdown 文件
- dynamic route 的 `*.paths.ts/js/...`
- VitePress config / configDeps

### 10.4 watch 噪声过滤

- 会忽略 vitepress timestamp noise
- 会忽略无关文件
- 会忽略 `SUMMARY.md`

### 10.5 full-reload 策略

简单流程：

1. 监听到有效变更。
2. 经过防抖后重跑插件主流程。
3. 若 merge 后产生有效写入，则发 `server.ws.send({ type: 'full-reload' })`。

测试覆盖：

- `tests/unit/watcher.test.ts`
- `tests/unit/pluginFlow.test.ts`

---

## 11. 日志行为

核心实现：`src/core/plugin.ts:160`

### 11.1 `silent`

- 不输出生命周期与 debug 日志。
- 但 `warn` 仍可能输出。

### 11.2 `info`

- 输出：
  - `🎈 auto-nav 生成中...`
  - `🎈 auto-nav 生成完成`
  - merge preserve 提示等 info 级日志
- 不输出 debug 级细节。

### 11.3 `debug`

- 除 info 外，还输出：
  - skip recompute due to hash
  - skip watch apply due to stable payload hash
  - route source stats
  - content meta stats
  - tree/nav/sidebar/merge stats
  - watch 触发原因

测试覆盖：

- `tests/unit/pluginFlow.test.ts`

---

## 12. 旧行为与兼容边界

### 12.1 已删除的旧 summary 主链路

- 旧 `summary` 方案已移除，不再从 `SUMMARY.md` 推导导航。
- `README.md` / `README-CN.md` 已把它定义为废弃能力。

### 12.2 旧 frontmatter 字段兼容已移除

以下旧字段不再支持：

- `hide`
- `sort`
- `title`
- `useArticleTitle`

### 12.3 “隐藏”只影响插件输出，不阻止 VitePress 构建输入

- `visible=false` 与 `exclude` 影响的是插件生成的 nav/sidebar。
- 它们不等于删除 runtime pages。

测试覆盖：

- `tests/integration/exampleProjects.test.ts` 中 `hidden-pages-still-build`、`overrides-custom`、`complex-combo-multi-level`

---

## 13. 测试覆盖矩阵

### 13.1 unit 覆盖模块

当前 unit 测试覆盖：

- `normalizeOptions`
- `context`
- `pageSource`
- `contentMeta`
- `treeBuilder`
- `navBuilder`
- `sidebarBuilder`
- `merger`
- `watcher`
- `pluginFlow`
- `cache`

主要文件：

- `tests/unit/normalizeOptions.test.ts`
- `tests/unit/context.test.ts`
- `tests/unit/pageSource.test.ts`
- `tests/unit/contentMeta.test.ts`
- `tests/unit/treeNavSidebar.test.ts`
- `tests/unit/merger.test.ts`
- `tests/unit/watcher.test.ts`
- `tests/unit/pluginFlow.test.ts`
- `tests/unit/cache.test.ts`

### 13.2 integration 覆盖场景

主入口：`tests/integration/exampleProjects.test.ts`

已覆盖 example 类型包括：

- 输出策略：`output-preserve`
- rewrites：`routing-static-rewrites`、`routing-param-rewrites`、`routing-no-rewrites`
- dynamic routes：`dynamic-routes`、`dynamic-routes-i18n`、`dynamic-routes-rewrites`、`dynamic-routes-multi-segment`
- i18n：`i18n-full-subdir`、`root-and-locale-auto-nav`、`root-manual-locale-auto`、`root-auto-locale-manual`
- 过滤：`exclude-only`、`hidden-pages-still-build`
- overrides/frontmatter：`overrides-custom`、`frontmatter-custom`、`frontmatter-default-fields`
- 结构/排序：`top-level-multi-sections`、`sorter-custom`、`standalone-index-true`
- key collision / replace / 复杂组合：
  - `override-key-collision`
  - `sidebar-replace-conflict`
  - `complex-combo-multi-level`
- legacy summary guard：`summary-ignore`

---

## 14. 当前结论

基于当前代码与测试，插件的稳定语义可以概括为：

1. **输入层**：以 VitePress runtime pages 为准，兼容 rewrites / dynamic routes / locale。
2. **元数据层**：支持 frontmatter、前缀字段、overrides、H1、旧字段兼容与缓存。
3. **结构层**：按 locale 独立构树，支持 `standaloneIndex`、多层目录、排序、目录折叠。
4. **输出层**：自动生成 `nav` 与 `sidebar`，其中：
   - `nav`：保留用户已有配置
   - `sidebar`：始终覆盖用户已有配置
5. **运行层**：支持 watch、防抖、hash 跳过、日志分级与最终去重。
6. **边界层**：旧 `SUMMARY.md` 生成链路已移除，`SUMMARY.md` 不再影响主流程。

如果后续要继续维护，最建议优先看的文件顺序是：

1. `src/index.ts:6`
2. `src/core/plugin.ts:157`
3. `src/core/pageSource.ts:201`
4. `src/core/contentMeta.ts:349`
5. `src/core/treeBuilder.ts:207`
6. `src/core/navBuilder.ts:49`
7. `src/core/sidebarBuilder.ts:65`
8. `src/core/merger.ts:215`
9. `tests/integration/exampleProjects.test.ts:8`
