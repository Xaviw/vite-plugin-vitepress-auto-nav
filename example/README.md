# VitePress 多项目测试集

该目录用于 Vitest 集成测试。每个 `projects/<case>` 都是一个完整独立项目，
仅包含该用例需要的配置与内容，并在首页说明测试范围。

## 用例列表

- `projects/output-preserve`：固定输出策略回归（含手写 nav/sidebar）
- `projects/routing-static-rewrites`：静态 rewrites
- `projects/routing-param-rewrites`：参数 rewrites
- `projects/routing-no-rewrites`：禁用 rewrites（`respectRewrites=false`）
- `projects/dynamic-routes`：动态路由（含 content / 无 content）
- `projects/dynamic-routes-multi-segment`：多段参数动态路由
- `projects/i18n-full-subdir`：全语言子目录 i18n（root/fr/ja）
- `projects/root-and-locale-auto-nav`：root / locale 同时自动生成 nav/sidebar
- `projects/root-manual-locale-auto`：root 手写 nav、locale 自动生成 nav/sidebar
- `projects/root-auto-locale-manual`：root 自动生成 nav/sidebar、locale 手写 nav
- `projects/exclude-only`：仅验证 exclude 对 root / locale nav/sidebar 的影响
- `projects/dynamic-routes-i18n`：动态路由与 i18n 组合
- `projects/dynamic-routes-rewrites`：动态路由与 rewrites 组合
- `projects/top-level-multi-sections`：多个顶层 section 与根级页面并存
- `projects/override-key-collision`：验证 overrides 短名 key 与相对路径 key 的优先级
- `projects/overrides-custom`：通过 `overrides` 覆盖可见性、命名、折叠与标题优先级
- `projects/frontmatter-custom`：通过 `frontmatterKeyPrefix` + frontmatter 控制排序、显隐与标题
- `projects/summary-ignore`：存在 `SUMMARY.md` 但主流程完全忽略
- `projects/hidden-pages-still-build`：隐藏页不进入导航，但仍保留在 runtime pages 中
- `projects/complex-combo-multi-level`：i18n + rewrites + overrides + frontmatter 组合（多层路径）
- `projects/standalone-index-true`：验证 `standaloneIndex: true` 时目录下 `index.md` 保持独立页面
- `projects/sorter-custom`：验证自定义 `sorter` 在 root / locale 下的最终排序
- `projects/frontmatter-default-fields`：验证不使用 `frontmatterKeyPrefix` 时默认 frontmatter 字段仍生效
- `projects/sidebar-replace-conflict`：验证插件生成 `sidebar` 时整体替换用户手写 `sidebar`

## 命令

```bash
# 启动某个用例
pnpm --dir example run dev:case -- projects/output-preserve

# 构建某个用例
pnpm --dir example run build:case -- projects/output-preserve
```

说明：

- `output-preserve` 场景中 `nav` 使用手写配置（`/manual-root/`、`/fr/manual/`），`sidebar` 由插件自动生成（`/guide/`、`/fr/guide/`）。
- 若本地已有其他 VitePress dev 进程占用端口，当前进程会切换到新端口；请以终端输出的实际 URL 为准访问，避免误判 404。
