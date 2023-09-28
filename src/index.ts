import { sep, normalize, join } from "path";
import { utimesSync, statSync } from "fs";
import { spawn } from "child_process";
import glob from "fast-glob";

import type { ResolvedConfig, ViteDevServer, Plugin, UserConfig } from "vite";
import type { DefaultTheme, SiteConfig } from "vitepress";

/** 插件配置项 */
interface Options {
  /**
   * glob 匹配表达式
   * 会匹配 srcDir 目录下，除 srcExclude 配置外的，满足表达式的 md 文件
   * 默认：**.md
   */
  pattern?: string | string[];
  /**
   * 对特定文件或文件夹进行配置
   * 键名为文件、文件夹名或路径（会从外层文件夹往里进行查找，md 扩展名可以省略；名称存在重复时，可以用路径区分）
   */
  itemsSetting?: Record<string, ItemOption>;
  /**
   * 自定义排序方法，同级文件、文件夹会调用这个函数进行排序
   * 默认会先按照 sort 权重降序排列，再按照创建时间升序排列
   */
  compareFn?: (a: FileInfo, b: FileInfo) => number;
}

/** 单个文件、文件夹配置项 */
interface ItemOption {
  /** 是否展示 */
  hide?: boolean;
  /** 排序权重，权重越大越靠前 */
  sort?: number;
  /** 重定义展示名称 */
  title?: string;
  /** 同 sidebar 中的配置，默认 false（支持折叠，默认展开） */
  collapsed?: boolean;
}

interface FileInfo extends ItemOption {
  /** 文件、文件夹名 */
  name: string;
  /** 是否是文件夹 */
  isFolder: boolean;
  /** 文件首次提交时间或本地文件创建时间 */
  createTime: number;
  /** 文件最新提交时间或本地文件更新时间 */
  updateTime: number;
  children: FileInfo[];
}

export default function AutoNav(options: Options = {}): Plugin {
  return {
    name: "vite-plugin-vitepress-auto-nav",
    // md 文件增删时，通过触发配置文件修改操作，实现热更新功能
    configureServer({ config, watcher }: ViteDevServer) {
      const {
        vitepress: { configPath },
      } = config as ResolvedConfig & { vitepress: SiteConfig };

      // 从config中获取配置文件路径
      const $configPath =
        configPath?.match(/(\.vitepress.*)/)?.[1] || ".vitepress/config.ts";

      // VitePress 中已经添加了对所有 md 文件的监听，这里只需要处理事件
      watcher.on("all", (event, path) => {
        // 过滤掉 change 事件和非 md 文件操作
        if (event === "change" || !path.endsWith(".md")) return;
        // 修改配置文件系统时间戳，触发更新
        utimesSync($configPath, new Date(), new Date());
      });
    },
    async config(config) {
      const _config = config as UserConfig & { vitepress: SiteConfig };

      // 从vitepress配置中获取文档根路径与要排除的文档
      const {
        vitepress: {
          userConfig: { srcExclude = [], srcDir = "./" },
          site: {
            themeConfig: { nav },
          },
        },
      } = _config;

      // 支持手动传入匹配模式或匹配全部
      const pattern = options.pattern || "**.md";

      // 读取需要的md文件
      const paths = (
        await glob(pattern, {
          cwd: srcDir,
          ignore: [
            "**/node_modules/**",
            "**/dist/**",
            "index.md",
            ...srcExclude,
          ],
        })
      ).map((path) => normalize(path));

      // 处理文件路径数组为多级结构化数据
      const data = await serializationPaths(paths, options, srcDir);

      // 数据排序
      sortStructuredData(data, options.compareFn);

      // vitepress 中没有配置 nav 时自动生成
      // 因为 nav 数据项较少，可以用手动配置代替在插件中设置
      if (!nav) {
        _config.vitepress.site.themeConfig.nav = generateNav(data);
      }

      // 生成侧边栏目录
      const sidebar = generateSidebar(data);
      _config.vitepress.site.themeConfig.sidebar = sidebar;

      return _config;
    },
  };
}

/** 处理文件路径字符串数组 */
async function serializationPaths(
  paths: string[],
  { itemsSetting = {} }: Options = {},
  srcDir: string
) {
  // 统一路径格式，便于匹配
  for (const key in itemsSetting) {
    itemsSetting[join(srcDir, key)] = itemsSetting[key];
  }

  const pathKeys = Object.keys(itemsSetting);

  const root: FileInfo[] = [];

  // 遍历处理每一条文章路径
  for (const path of paths) {
    // 记录当前处理文件、文件夹的父级
    let currentNode = root;
    // 记录当前处理文件、文件夹的路径
    let currentPath = "";

    // 获取路径中的每一级名称
    const pathParts = join(srcDir, path).split(sep);

    for (const name of pathParts) {
      currentPath = join(currentPath, name);

      // 获取文章时间戳信息
      const [createTime, updateTime] = await getTimestamp(currentPath);

      // 通过是否有扩展名判断是文件还是文件夹
      const isFolder = !name.includes(".");

      // 查找是否有自定义配置
      // 先按路径匹配
      let customInfoKey = pathKeys.find((p) => currentPath === p);
      // 再按文件名匹配
      if (!customInfoKey) {
        customInfoKey = pathKeys.find(
          (p) => name === p || name.replace(".md", "") === p
        );
      }
      const customInfo = customInfoKey ? itemsSetting[customInfoKey] : {};

      // 跳过不展示的部分
      if (customInfo.hide) break;

      // 查找该层级中是否已经处理过这个文件或文件夹
      let childNode = currentNode.find((node) => node.name === name);

      // 若未处理过，整理数据并添加到数组
      if (!childNode) {
        childNode = {
          ...customInfo,
          name,
          isFolder,
          createTime,
          updateTime,
          children: [],
        };
        currentNode.push(childNode);
      }

      currentNode = childNode.children;
    }
  }
  return root;
}

/** 对结构化后的多级数组数据进行逐级排序 */
function sortStructuredData(
  data: FileInfo[],
  compareFn?: (a: FileInfo, b: FileInfo) => number
): FileInfo[] {
  return data.sort(compareFn || defaultCompareFn).map((item) => {
    if (item.children && item.children.length > 0) {
      item.children = sortStructuredData(item.children, compareFn);
    }
    return item;
  });
}

/** 默认排序方法，优先按 sort 权重降序，其次按创建时间升序 */
function defaultCompareFn(a: FileInfo, b: FileInfo) {
  if (a.sort !== undefined && b.sort !== undefined) {
    // 权重相同时按创建时间升序排列
    return b.sort - a.sort || a.createTime - b.createTime;
  } else if (a.sort !== undefined) {
    return -1;
  } else if (b.sort !== undefined) {
    return 1;
  } else {
    return a.createTime - b.createTime;
  }
}

/** 生成 nav 数据 */
function generateNav(structuredData: FileInfo[]) {
  return structuredData.map((item) => ({
    text: item.title || item.name,
    activeMatch: `/${item.name}/`,
    link: getFirstArticleFromFolder(item),
  }));
}

/** 获取首层目录中第一篇文章 */
function getFirstArticleFromFolder(data: FileInfo, path = "") {
  path += `/${data.name}`;
  if (data.children.length > 0) {
    return getFirstArticleFromFolder(data.children[0], path);
  } else {
    // 显示名称应除掉扩展名
    return path.replace(".md", "");
  }
}

/** 生成 sidebar */
function generateSidebar(structuredData: FileInfo[]): DefaultTheme.Sidebar {
  const sidebar: DefaultTheme.Sidebar = {};

  // 遍历首层目录（nav），递归生成对应的 sidebar
  for (const { name, children } of structuredData) {
    sidebar[`/${name}/`] = traverseSubFile(children, `/${name}`);
  }

  function traverseSubFile(
    subData: FileInfo[],
    parentPath: string
  ): DefaultTheme.SidebarItem[] {
    return subData.map((file) => {
      const filePath = `${parentPath}/${file.name}`;
      const fileName = file.title || file.name.replace(".md", "");
      if (file.isFolder) {
        return {
          text: fileName,
          collapsed: file.collapsed ?? false,
          items: traverseSubFile(file.children, filePath),
        };
      } else {
        return { text: fileName, link: filePath.replace(".md", "") };
      }
    });
  }

  return sidebar;
}

/**
 * 获取文件提交时间
 */
function getTimestamp(filePath: string) {
  return new Promise<[number, number]>((resolve) => {
    let output: number[] = [];

    // 开启子进程执行git log命令
    const child = spawn("git", [
      "--no-pager",
      "log",
      '--pretty="%ci"',
      filePath,
    ]);

    // 监听输出流
    child.stdout.on("data", (d) => {
      const data = String(d)
        .split("\n")
        .map((item) => +new Date(item))
        .filter((item) => item);
      output.push(...data);
    });

    // 输出接受后返回
    child.on("close", () => {
      if (output.length) {
        // 返回[发布时间，最近更新时间]
        resolve([+new Date(output[output.length - 1]), +new Date(output[0])]);
      } else {
        // 没有提交记录时获取文件时间
        const { birthtimeMs, ctimeMs } = statSync(filePath);
        resolve([birthtimeMs, ctimeMs]);
      }
    });

    child.on("error", () => {
      // 获取失败时使用文件时间
      const { birthtimeMs, ctimeMs } = statSync(filePath);
      resolve([birthtimeMs, ctimeMs]);
    });
  });
}
