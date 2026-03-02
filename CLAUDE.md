# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

这是一个 Vite 插件，用于自动生成 VitePress 的导航栏（`nav`）和侧边栏（`sidebar`）配置。它扫描 VitePress 源目录中的 markdown 文件，并根据文件夹结构创建层级化的导航结构。

## 构建和开发命令

```bash
# 构建插件（输出到 dist/）
pnpm build

# 安装依赖
pnpm install
```

注意：此项目未配置测试套件、代码检查工具或格式化工具。类型检查通过构建时的 TypeScript 编译完成。

## 架构

### 核心插件流程

插件实现了一个 Vite 插件，包含两个主要钩子：

1. **`configureServer`** (src/index.ts:42-62)：设置文件监听器以实现热重载
   - 监听所有 markdown 文件和 SUMMARY.md（如果配置了）
   - 使用 1500ms 节流避免保存多个文件时重复重载
   - 通过 `forceReload()` 触发配置文件重载以刷新导航

2. **`config`** (src/index.ts:63-148)：在构建/开发启动时生成 nav/sidebar
   - 两种模式：SUMMARY 模式（Gitbook 风格）或自动生成模式
   - 自动模式：扫描文件 → 序列化为树 → 排序 → 生成 nav/sidebar
   - 使用缓存文件（`auto-nav-cache.json`）存储文件元数据和时间戳

### 模块职责

- **src/index.ts**：主插件入口，编排生成流程
- **src/parseArticle.ts**：处理自动生成模式
  - `serializationPaths()`：将扁平文件路径转换为层级树结构
  - `generateNav()`：从一级文件夹创建顶层导航
  - `generateSidebar()`：从树结构创建侧边栏配置
  - `getArticleData()`：从 markdown 文件提取 frontmatter 和元数据
  - `sortStructuredData()`：应用自定义或默认排序逻辑
- **src/parseSummary.ts**：将 Gitbook SUMMARY.md 文件解析为 VitePress 格式
- **src/utils.ts**：共享工具函数
  - Git 时间戳提取（`getFolderCommitTimes`、`getTimestamp`）
  - 缓存管理和节流
  - 支持 frontmatter 前缀的配置值解析

### 数据流

```
Markdown 文件 → glob 扫描 → serializationPaths() → Item 树
                                                      ↓
                                                  sortStructuredData()
                                                      ↓
                                    ┌─────────────────┴─────────────────┐
                                    ↓                                   ↓
                              generateNav()                      generateSidebar()
                                    ↓                                   ↓
                            VitePress nav 配置                VitePress sidebar 配置
```

### 关键数据结构

- **`Item`** (types/index.d.ts:95-108)：表示树中的文件或文件夹
  - 包含元数据（name、index、isFolder）
  - 持有 `options`（ItemOptions + 时间戳）和 `frontmatter` 数据
  - 递归的 `children` 数组用于嵌套结构

- **`Options`** (types/index.d.ts:8-70)：插件配置
  - `pattern`：文件匹配的 glob 模式
  - `indexAsFolderLink`：index.md 是否代表其父文件夹
  - `itemsSetting`：单个文件/文件夹的配置覆盖
  - `frontmatterPrefix`：frontmatter 配置属性的前缀
  - `compareFn`：自定义排序函数
  - `summary`：Gitbook SUMMARY.md 模式配置

### 缓存策略

插件维护一个缓存（src/index.ts 中的 `cache` 对象），存储：

- 文件/文件夹时间戳（birthTime、modifyTime、firstCommitTime、lastCommitTime）
- 每个路径的 ItemOptions 配置
- Frontmatter 数据

缓存持久化到 `.vitepress/.cache/auto-nav-cache.json`，每次运行时清理过期条目（通过 `visitedCache` Set 跟踪）。

### 配置优先级

对于任何文件/文件夹，配置按以下顺序解析（从高到低）：

1. Markdown 文件中的 frontmatter（带或不带 `frontmatterPrefix`）
2. 插件选项中的 `itemsSetting`
3. 全局插件选项（如 `useArticleTitle`）
4. 默认值

这由 src/utils.ts 中的 `getTargetOptionValue()` 处理。

## TypeScript 配置

- 启用严格模式，包含 `noUnusedLocals` 和 `noUnusedParameters`
- ESNext 目标，使用 ESM 模块
- 类型声明生成到 `dist/index.d.ts`
