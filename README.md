# vite-plugin-vitepress-auto-nav

[中文文档](./README-CN.md)

Automatically generate `nav` and `sidebar` configurations for `VitePress`.

## ✨ Features

- Supports custom scope (based on `srcDir` and `srcExclude` configurations)
- Uses top-level folders as `nav` and subfolders/files as `sidebar`
- Supports both plugin configuration and article `frontmatter` configuration
- Allows custom display names, with articles supporting top-level headings as names
- Supports custom sorting methods
- Supports hiding files or folders
- Auto-refreshes after modifying plugin configuration or `frontmatter`
- Supports using the same `SUMMARY.md` file as the `Gitbook` as the `sidebar` configuration.

## 🕯️ Usage

1. Install

```sh
# Recommended to use pnpm
pnpm i vite-plugin-vitepress-auto-nav -D
# When using TypeScript, it's recommended to install Vite to avoid type errors
pnpm i vite -D
```

2. Add the plugin

```ts
// .vitepress/config.ts
import AutoNav from "vite-plugin-vitepress-auto-nav";

export default defineConfig({
  vite: {
    plugins: [
      AutoNav({
        // Custom configuration
      }),
    ],
  },
});
```

3. enjoy it

## 🛠️ Configuration

**You can also configure properties from `ItemOptions` in the article `frontmatter`. Configuration in the format of `nav-propertyName` can be used to avoid conflicts with variables in the logic. Other variables in the `frontmatter` will also be included in the `frontmatter` property of the sorting function parameters.**

```ts
interface Options {
  /**
   * Glob matching expression
   *
   * Matches the md files located in the [srcDir] directory, excluding those specified in [srcExclude]
   *
   * Default: **.md
   */
  pattern?: string | string[];

  /**
   * Configurations for specific files or folders
   *
   * The key can be the file name, folder name, or path (relative to [srcDir]). When there are duplicate names, the path is used for differentiation.
   *
   * Configuration for md files can also be set in the frontmatter, using the same `propertyName` or `nav-propertyName`. This takes precedence over the itemsSetting configuration.
   */
  itemsSetting?: Record<string, ItemOptions>;

  /**
   * Custom sorting method for files and folders at the same level
   *
   * The default sorting method `defaultCompareFn` follows these rules:
   *
   * 1. When both have a `sort` value, they are sorted in ascending order based on the `sort` value, and then by creation time in ascending order.
   * 2. When only one has a `sort` value, and the `sort` value is equal to the index value of the other, the one with the `sort` value comes first.
   * 3. When only one has a `sort` value, and the `sort` value is not equal to the index value of the other, they are compared based on the `sort` value and the index value, and sorted in ascending order.
   * 4. When neither has a `sort` value, they are sorted based on the creation time (`firstCommitTime` or `birthTime`).
   */
  compareFn?: (a: Item, b: Item) => number;

  /** Whether to use the top-level heading of an article as its name (to handle cases where the file name may be an abbreviation). Can also be individually configured in the itemsSetting. */
  useArticleTitle?: boolean;
  /** This is used to support generating directories from Gitbook's SUMMARY file, and the other configurations will no longer take effect once it is added. */
  summary?: {
    /** path to SUMMARY.md */
    target: string;
    /**
     * Same as SidebarItem.collapsed
     *
     * If not specified, group is not collapsible.
     *
     * If `true`, group is collapsible and collapsed by default
     *
     * If `false`, group is collapsible but expanded by default
     */
    collapsed?: boolean;
    /**
     * Remove escaped characters "\"
     * @default true
     */
    removeEscape?: boolean;
  };
}

/**
 * Configuration options for a single file or folder
 *
 * Configuration can also be set in the article's frontmatter using the same `propertyName` or `nav-propertyName`. This takes precedence over the itemsSetting configuration.
 */
interface ItemOptions {
  /** Whether to display the item */
  hide?: boolean;

  /** Sorting value (target position index, starting from 0) */
  sort?: number;

  /** Redefines the display name, takes precedence over useArticleTitle */
  title?: string;

  /** Whether to use the top-level heading of an article as its name, takes precedence over the global useArticleTitle configuration */
  useArticleTitle?: boolean;

  /**
   * Same as the collapsed configuration in the sidebar, only applicable to folders
   *
   * Default: false (supports collapsing, default expanded)
   */
  collapsed?: boolean;
}

/** File or folder key information */
interface Item {
  /** Index position within the same level */
  index: number;

  /** File or folder name */
  name: string;

  /** Whether it is a folder */
  isFolder: boolean;

  /** Configuration object (excluding frontmatter) and timestamp data (TimesInfo) */
  options: ItemCacheOptions;

  /** Frontmatter data and top-level heading (h1) of the article */
  frontmatter: Frontmatter;

  /** Child files and folders */
  children: Item[];
}

/** Cached options data for files and folders */
type ItemCacheOptions = ItemOptions & TimesInfo;

/** File and directory timestamp information */
interface TimesInfo {
  /* Local file creation time */
  birthTime?: number;
  /* Local file modification time */
  modifyTime?: number;
  /* First commit time in Git */
  firstCommitTime?: number;
  /* Last commit time in Git */
  lastCommitTime?: number;
}

/** Cached frontmatter data */
type Frontmatter = { h1?: string } & Recordable;

type Recordable = Record<string, any>;
```

> The generated `nav` configuration will use the first article in the directory as the `link` attribute. If you need to customize the `nav`, you can manually define it, and the plugin will not modify the existing `nav` configuration (because `nav` configurations are usually minimal, manually configuring them is more cost-effective than complex configuration in the plugin).

## 🎊 Configuration Example

```ts
vite: {
  plugins: [
    AutoNav({
      pattern: ["**/!(README|TODO).md"], // You can also exclude files that you don't want to display, for example, exclude README and TODO files
      settings: {
        a: { hide: true }, // Do not display the folder or md file with the name "a"
        b: { title: 'bb' }, // Display the folder or file with the name "b" as "bb" in the menu
        c/b: { sort : 3 }, // Configure the folder "c" and file "b" under the specified path, it will be sorted at index 3 or at the end
        c/b2: { useArticleTitle: false }, // Disable using the article's first-level title as the article name
        d: { collapsed: true }, // Folder collapse configuration
      },
      compareFn: (a, b) => {
        // Sort in ascending order based on the latest commit time (or local file modification time if there is no commit record)
        return (b.options.lastCommitTime || b.options.modifyTime) - (a.options.lastCommitTime || a.options.modifyTime)
      },
      useArticleTitle: true // Globally enable using the article's first-level title as the article name
    }),
  ],
}
```

## License

[MIT](./LICENSE) License © 2023 [Xaviw](https://github.com/Xaviw)
