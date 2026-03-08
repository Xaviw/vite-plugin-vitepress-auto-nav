# AGENTS.md

本文件为在本仓库中协作的编码代理提供最小必要说明。

## 语言

- 除非用户明确要求，否则与用户的交流、文档更新、代码注释统一使用中文。
- 代码标识符、类型名、API 名保持原文。

## 项目定位

这是一个 VitePress 插件，用于基于 **VitePress runtime pages** 自动生成默认主题的 `nav` 与 `sidebar`。

当前主流程：

1. 归一化用户配置
2. 解析 VitePress 运行时上下文
3. 解析页面来源（pages / rewrites / dynamic routes / locales）
4. 读取内容元数据（frontmatter / H1）
5. 构建 locale 树
6. 生成 nav / sidebar
7. 合并回 themeConfig
8. 在开发态 watch 中按需重算

## 关键目录

- `src/index.ts`：插件对外入口
- `src/core/`：核心实现
  - `plugin.ts`：主编排与 watch 流程
  - `normalizeOptions.ts`：配置归一化
  - `pageSource.ts`：页面来源解析
  - `contentMeta.ts`：内容元数据解析
  - `treeBuilder.ts`：目录树构建
  - `navBuilder.ts`：nav 生成
  - `sidebarBuilder.ts`：sidebar 生成
  - `merger.ts`：themeConfig 合并
  - `watcher.ts`：watch 判定与防抖
  - `cache.ts`：hash 与跳过重算逻辑
- `src/types/`：公开配置与内部模型类型
- `tests/unit/`：单元测试
- `tests/integration/`：集成测试
- `example/projects/`：集成测试使用的示例场景
- `dist/`：构建产物，不要手动修改

## 当前公开配置

以 `src/types/plugin.ts` 为准。当前对外参数包括：

- `include`
- `exclude`
- `standaloneIndex`
- `overrides`
- `frontmatterKeyPrefix`
- `sorter`
- `preferArticleTitle`
- `dev`

## 关键行为约束

- `nav`：如果用户已手写配置，则保留用户配置。
- `sidebar`：由插件生成结果覆盖。
- 默认跳过站点根 `index.md` 与 locale 根 `index.md`。
- 当前仓库已移除旧的 `SUMMARY.md` 主生成链路，不要重新引入旧兼容逻辑，除非用户明确要求。
- 更新文档时，以真实代码与测试为准，不要依赖历史命名或旧参数。

## 常用命令

- 安装依赖：`pnpm install`
- 构建：`pnpm build`
- lint：`pnpm lint`
- 自动修复 lint：`pnpm lint:fix`
- 格式化：`pnpm format`
- 全量测试：`pnpm test`
- 单元测试：`pnpm test:unit`
- 集成测试：`pnpm test:integration`
- watch 测试：`pnpm test:watch`

## 验证建议

修改代码后，优先按影响范围执行：

1. `pnpm test:unit`
2. 必要时执行 `pnpm test:integration`
3. 最后执行 `pnpm build`

如果只改文档或说明文件，可不运行测试。

## 文档同步

当以下内容变化时，应检查文档是否同步：

- `src/types/plugin.ts`
- `README.md`
- `README-CN.md`
- `PLUGIN-FEATURES.md`

文档中若引用类型名，应优先使用当前仍存在的公开接口名称。
