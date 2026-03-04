# 仓库指南

## 项目结构与模块组织

- 插件核心代码位于 `src/`：
  - `index.ts`：插件入口与 Vite/VitePress 生命周期钩子。
  - `parseArticle.ts` / `parseSummary.ts`：生成 `nav` 和 `sidebar` 的核心逻辑。
  - `utils.ts`：通用工具函数（刷新、节流、时间戳处理）。
- 类型声明文件位于 `types/index.d.ts`。
- 构建产物输出到 `dist/`（`index.mjs`、`.d.ts`），请勿手动修改。
- 文档位于 `README.md` 与 `README-CN.md`。

## 构建、校验与开发命令

- `pnpm build`：使用 Rollup 打包插件到 `dist/index.mjs`。
- `pnpm lint`：运行 ESLint 检查仓库代码。
- `pnpm lint:fix`：自动修复可处理的 lint 问题。
- `pnpm format`：使用 Prettier 统一格式。
- `pnpm prepare`：通过 `simple-git-hooks` 安装 Git hooks（通常安装依赖后自动执行）。

## 代码风格与命名规范

- 语言：TypeScript（ESM，`tsconfig.json` 开启严格模式）。
- 格式：Prettier（见 `.prettierrc`）：2 空格缩进、单引号、无分号、`es5` 尾随逗号、行宽 80。
- 规范检查：ESLint + `typescript-eslint` + Prettier 集成。
- 命名建议：
  - 文件/模块使用 `camelCase`（如 `parseSummary.ts`）；
  - 导出函数与类型按语义使用 `camelCase` / `PascalCase`。
- 有意未使用的变量或参数请加 `_` 前缀，以满足 lint 规则。

## 测试指南

- 当前仓库暂无独立自动化测试套件（未定义 `npm test`）。
- 提交 PR 前的最低校验要求：
  - 执行 `pnpm lint`；
  - 执行 `pnpm build`；
  - 在 VitePress 项目中验证插件行为（`nav`/`sidebar` 生成与刷新逻辑）。

## 提交与 Pull Request 规范

- 提交信息遵循历史约定前缀：`feat:`、`fix:`、`chore:`、`docs:`、`build:`。
- 单次提交应聚焦单一变更，避免将纯格式化修改与功能/修复混在一起。
- PR 建议包含：
  - 清晰的行为变更说明；
  - 关联 issue（如适用）；
  - 可复现的配置或示例（尤其是插件参数与 frontmatter 场景）。
- 若涉及用户可见行为变更，请附 `nav`/`sidebar` 生成结果的前后对比片段。
