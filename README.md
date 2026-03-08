# vite-plugin-vitepress-auto-nav

[中文文档](./README-CN.md)

Auto-generate VitePress default-theme `nav` and `sidebar` from runtime pages.

## Features

- Use top-level directories to generate `nav` when the user has not defined one, and lower-level directories to generate `sidebar` that always replaces the user config.
- Support rewrites, dynamic routes, and i18n.
- Support custom display names for folders and pages, with optional H1-based titles for pages.
- Support visibility control and sorting for both folders and pages.
- Support folder `collapsed` state in `sidebar`, matching the default theme behavior.
- Support treating `index.md` as either a folder link or a standalone page.

## Quick start

1. Install

```sh
npm install -D vite-plugin-vitepress-auto-nav
```

2. Add the plugin in `.vitepress/config.ts`

```ts
import { defineConfig } from 'vitepress'
import AutoNav from 'vite-plugin-vitepress-auto-nav'

export default defineConfig({
  vite: {
    plugins: [AutoNav()],
  },
})
```

3. Configure the plugin if needed. Decide whether you also want to keep a custom `themeConfig.nav`.
   In most projects the top nav has only a few entries, so the plugin leaves room for manual nav customization.

4. Start VitePress as usual

## Configuration

| Current param          | Type                                      | Default         | Description                                                                                                                    |
| ---------------------- | ----------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `include`              | `string \| string[]`                      | -               | Plugin include rules, resolved as glob patterns relative to VitePress `srcDir`.                                                |
| `exclude`              | `string \| string[]`                      | -               | Plugin exclude rules, resolved as glob patterns relative to VitePress `srcDir`.                                                |
| `standaloneIndex`      | `boolean`                                 | `false`         | Controls how `index.md` is mounted inside a folder: `false` keeps it as the folder link, `true` keeps it as a standalone page. |
| `overrides`            | `Record<string, ItemMetaOptions>`         | `{}`            | Entry override config. Keys can be filenames, folder names, or relative paths. If names collide, prefer relative paths.        |
| `frontmatterKeyPrefix` | `string`                                  | `''`            | Adds a prefix to plugin frontmatter keys to avoid conflicts with existing site fields.                                         |
| `sorter`               | `(a, b, frontmatterKeyPrefix?) => number` | `defaultSorter` | Sort function for sibling nodes. The function input includes `overrides.order`.                                                |
| `preferArticleTitle`   | `boolean`                                 | `false`         | Whether page H1 should be preferred globally as the navigation label. Lower priority than `displayName`.                       |
| `dev`                  | `AutoNavDevOptions`                       | See below       | Development options for watch debounce, content cache, and log output.                                                         |
| ❌                     | -                                         | -               | `SUMMARY.md`-based generation is no longer supported.                                                                          |

### `overrides` (`ItemMetaOptions`)

The same option names can also be used in Markdown frontmatter. If your project already uses these field names, add a prefix with `frontmatterKeyPrefix`, for example `navDisplayName`, `navOrder`, or `navVisible`.

| Current param        | Type      | Default | Description                                                                                                          |
| -------------------- | --------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `displayName`        | `string`  | -       | Custom label for a file or folder entry. Higher priority than `preferArticleTitle` and the default file/folder name. |
| `visible`            | `boolean` | `true`  | Controls whether the entry appears in navigation.                                                                    |
| `order`              | `number`  | -       | Sort weight passed into `sorter`. Smaller values come first.                                                         |
| `preferArticleTitle` | `boolean` | `false` | Whether to read the page H1 as the display label for this entry.                                                     |
| `collapsed`          | `boolean` | -       | Default collapsed state for folder entries.                                                                          |

### `dev` (`AutoNavDevOptions`)

| Current param     | Type                            | Default  | Description                                                                                               |
| ----------------- | ------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `watchDebounceMs` | `number`                        | `1500`   | File watcher debounce time in milliseconds, used to avoid recalculating too often during rapid edits.     |
| `cache`           | `boolean`                       | `true`   | Whether to reuse parsed content metadata cache in development.                                            |
| `logLevel`        | `'silent' \| 'info' \| 'debug'` | `'info'` | Development log level. Switch to `debug` when checking path resolution, merged output, or watch behavior. |

## Migrating from v3

Paste the section below into an AI model to get a fast migration.

```text
Upgrade this project from vite-plugin-vitepress-auto-nav v3 to the latest version.

First, update the package:
- npm: `npm install -D vite-plugin-vitepress-auto-nav@latest`
- pnpm: `pnpm add -D vite-plugin-vitepress-auto-nav@latest`
- yarn: `yarn add -D vite-plugin-vitepress-auto-nav@latest`

Then migrate the config with these rules:

Rename these top-level options:
- `pattern` -> `include`
- `itemsSetting` -> `overrides`
- `frontmatterPrefix` -> `frontmatterKeyPrefix`
- `compareFn` -> `sorter`
- `useArticleTitle` -> `preferArticleTitle`

Rename these item/frontmatter fields:
- `title` -> `displayName`
- `sort` -> `order`
- `useArticleTitle` -> `preferArticleTitle`

Invert these booleans:
- `indexAsFolderLink` -> `standaloneIndex`, using `standaloneIndex = !indexAsFolderLink`
- `hide` -> `visible`, using `visible = !hide`

New options you may add if needed:
- `exclude`
- `dev.watchDebounceMs`
- `dev.cache`
- `dev.logLevel`

Important summary rule:
- If the existing config contains any `summary` option, `SUMMARY.md` workflow, or other summary-based generation logic, stop the migration at that point and explicitly report that summary-based generation is no longer supported in the latest version.

Migration rules:
1. Replace renamed keys directly.
2. Convert inverted booleans using the formulas above.
3. Keep unrelated VitePress config unchanged.

Output requirements:
- Return the migrated config code only.
- Preserve existing comments when possible.
- If summary-based config is detected, do not output migrated code. Output a short explanation that summary is no longer supported and ask for the page structure or content organization rules before continuing.
```

## Development scripts

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
