import { sep, normalize, join, resolve, extname } from "path";
import { utimesSync, existsSync } from "fs";
import { readFile, writeFile, stat, mkdir } from "fs/promises";
import { spawn } from "child_process";
import glob from "fast-glob";
import matter from "gray-matter";

import type { Plugin } from "vite";
import type { DefaultTheme, SiteConfig } from "vitepress";

interface UserConfig {
  vitepress: SiteConfig<DefaultTheme.Config>;
}

/** 插件配置项 */
interface Options {
  /**
   * glob 匹配表达式
   *
   * 会匹配 vitepress 配置中的 [srcDir] 目录下，除 [srcExclude] 外满足表达式的 md 文件
   *
   * 默认：**.md
   */
  pattern?: string | string[];
  /**
   * 对特定文件或文件夹进行配置
   *
   * 键名为文件名、文件夹名或路径（以 [srcDir] 为根目录，从外层文件夹往里进行查找，md 扩展名可以省略；名称重复时，用路径区分）
   *
   * md 文件的配置也可以写在 frontmatter 中，使用相同 `属性名`]` 或 `nav-属性名`。优先级高于 itemsSetting 配置
   */
  itemsSetting?: Record<string, ItemOptions>;
  /**
   * 自定义排序方法，同级文件、文件夹会调用这个函数进行排序
   *
   * 默认排序方法 defaultCompareFn 规则为：
   *
   * 1. 都有 sort 值时，先按 sort 值升序排列再按创建时间升序排列
   * 2. 只有一个有 sort 值，且 sort 值等于另一个的下标值时，有 sort 值的在前
   * 3. 只有一个有 sort 值，且 sort 值不等于另一个的下标值时，对比 sort 值与下标值，升序排列
   * 4. 都没有 sort 值时，对比创建时间（`firstCommitTime` || `birthTime`）顺序排列
   */
  compareFn?: (a: Item, b: Item) => number;
  /** 是否使用文章中的一级标题代替文件名作为文章名称（处理文件名可能是简写的情况），也可以在 itemsSetting 中单独配置 */
  useArticleTitle?: boolean;
}

/**
 * 单个文件、文件夹配置项
 *
 * 也支持在文章的 frontmatter 中配置 `同名属性` 或 `nav-属性名`，优先级高于 itemsSetting 中的配置
 */
interface ItemOptions {
  /** 是否显示 */
  hide?: boolean;
  /** 排序值（目标位置下标，从0开始） */
  sort?: number;
  /** 重定义展示名称，优先级高于 useArticleTitle */
  title?: string;
  /** 是否使用文章中的一级标题代替文件名作为文章名称，优于全局 useArticleTitle 配置 */
  useArticleTitle?: boolean;
  /**
   * 同 sidebar 中 collapsed 配置，只对文件夹生效
   *
   * 默认：false（支持折叠，默认展开）
   */
  collapsed?: boolean;
}

/** 文件、文件夹关键信息 */
interface Item {
  /** 同级中的位置下标 */
  index: number;
  /** 文件、文件夹名 */
  name: string;
  /** 是否是文件夹 */
  isFolder: boolean;
  /** 配置对象(不包括frontmatter)，以及时间戳数据(TimesInfo) */
  options: ItemCacheOptions;
  /** frontmatter 数据以及文章一级标题（h1） */
  frontmatter: Frontmatter;
  /** 子文件、文件夹 */
  children: Item[];
}

/** 缓存的 options 数据 */
type ItemCacheOptions = ItemOptions & TimesInfo;

/** 文件、文件夹时间戳信息 */
interface TimesInfo {
  /** 本地文件创建时间 */
  birthTime?: number;
  /** 本地文件修改时间 */
  modifyTime?: number;
  /** git首次提交时间 */
  firstCommitTime?: number;
  /** git最后一次提交时间 */
  lastCommitTime?: number;
}

/** 缓存的 frontmatter 数据 */
type Frontmatter = { h1?: string } & Recordable;

type Recordable = Record<string, any>;

// 缓存数据，减少读取 git 时间戳和读取文件内容的次数
let cache: Record<
  string,
  { options: ItemCacheOptions; frontmatter: Frontmatter }
> = {};
// 记录访问过的缓存，用于删除不再需要的缓存
const visitedCache = new Set<string>();

export default function AutoNav(options: Options = {}): Plugin {
  return {
    name: "vite-plugin-vitepress-auto-nav",
    // md 文件增删或配置修改时，通过触发配置文件修改操作，实现刷新
    async configureServer({ config, watcher }) {
      const {
        vitepress: { configPath },
      } = config as unknown as UserConfig;

      // 从config中获取配置文件路径
      const $configPath =
        configPath?.match(/(\.vitepress.*)/)?.[1] || ".vitepress/config.ts";

      // VitePress 中已经添加了对所有 md 文件的监听，这里只需要处理事件
      // 添加 1500ms 的节流，避免同时保存多个文件时重复触发刷新
      watcher.on("all", throttle(mdWatcher.bind(null, $configPath), 1500));
    },
    async config(config) {
      console.log("🎈 auto-nav 生成中...");

      const {
        vitepress: {
          userConfig: { srcExclude = [], srcDir = "./" },
          site: {
            themeConfig: { nav },
          },
          cacheDir,
        },
      } = config as unknown as UserConfig;

      // 清空访问过的缓存
      visitedCache.clear();
      // 缓存目录若不存在，先创建
      if (!existsSync(cacheDir)) {
        await mkdir(cacheDir);
      }
      // 获取缓存
      try {
        const cacheStr = await readFile(`${cacheDir}/auto-nav-cache.json`, {
          encoding: "utf-8",
        });
        cache = JSON.parse(cacheStr) || {};
      } catch (error) {}

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
      let data = await serializationPaths(paths, options, srcDir);

      // 处理文件夹 git 时间戳
      updateCommitTimes(data);

      // 数据排序
      data = sortStructuredData(data, options.compareFn);

      // vitepress 中没有配置 nav 时自动生成。因为 nav 数据项较少，可以用手动配置代替在插件中处理
      if (!nav) {
        (config as unknown as UserConfig).vitepress.site.themeConfig.nav =
          generateNav(data);
      }

      // 生成侧边栏目录
      const sidebar = generateSidebar(data);
      (config as unknown as UserConfig).vitepress.site.themeConfig.sidebar =
        sidebar;

      // 删除不再需要的缓存后，写入缓存到本地 vitepress cache 目录
      for (let key in cache) {
        if (!visitedCache.has(key)) {
          delete cache[key];
        }
      }
      writeFile(`${cacheDir}/auto-nav-cache.json`, JSON.stringify(cache));

      console.log("🎈 auto-nav 生成完成");
      return config;
    },
  };
}

/** 文件变动事件 */
async function mdWatcher(
  configPath: string,
  event: "add" | "addDir" | "change" | "unlink" | "unlinkDir",
  path: string
) {
  // 过滤非 md 文件操作
  if (!path.endsWith(".md")) return;

  // 检查关键 frontmatter 信息是否修改
  if (event === "change" && cache[path]) {
    // 有缓存时对比数据
    const file = await readFile(path, {
      encoding: "utf-8",
    });
    const { content, data } = matter(file);
    data.h1 = getArticleTitle(content, data);
    // 数据项数量不一致，需要刷新
    if (
      Object.keys(data).length !== Object.keys(cache[path].frontmatter).length
    ) {
      forceReload(configPath);
      return;
    }
    // 数据线数量一致，需要对比数据是否变动
    for (let key in data) {
      if (cache[path].frontmatter[key] !== data[key]) {
        forceReload(configPath);
        return;
      }
    }
  } else {
    forceReload(configPath);
  }
}

/** 处理文件路径字符串数组 */
async function serializationPaths(
  paths: string[],
  { itemsSetting = {}, useArticleTitle }: Options,
  srcDir: string
) {
  // 统一自定义配置中的路径格式，便于匹配
  const transformedSettings: Record<string, ItemOptions> = {};
  for (const key in itemsSetting) {
    transformedSettings[normalize(key)] = itemsSetting[key];
  }

  const pathKeys = Object.keys(transformedSettings);

  const root: Item[] = [];

  // 遍历处理每一条文章路径
  for (const path of paths) {
    // 记录当前处理文件、文件夹的父级
    let currentNode = root;
    // 记录当前处理文件、文件夹的路径
    let currentPath = "";

    // 获取路径中的每一级名称
    const pathParts = path.split(sep);

    for (const name of pathParts) {
      currentPath = join(currentPath, name);
      // 拼接 srcDir 得到实际文件路径
      const realPath = resolve(srcDir, currentPath);

      // 通过是否有扩展名判断是文件还是文件夹
      const isFolder = !extname(name);

      // 自定义配置
      let options: ItemCacheOptions = { useArticleTitle };

      // 查找itemsSetting是否有自定义配置
      // 先按路径匹配
      let customInfoKey = pathKeys.find((p) => currentPath === p);
      // 再按文件名匹配
      if (customInfoKey == null) {
        customInfoKey = pathKeys.find(
          (p) => name === p || name.replace(".md", "") === p
        );
      }
      if (customInfoKey != null) {
        const {
          collapsed,
          hide,
          sort,
          title,
          useArticleTitle: itemUseArticleTitle,
        } = transformedSettings[customInfoKey];
        options = {
          collapsed,
          hide,
          sort,
          title,
          useArticleTitle: itemUseArticleTitle ?? options.useArticleTitle,
        };
      }

      // 获取时间戳信息
      const timestampData = await getTimestamp(realPath, isFolder);
      options = { ...options, ...timestampData };

      // 获取文章frontmatter
      let frontmatter: Frontmatter = {};
      if (!isFolder) {
        frontmatter = await getArticleData(realPath);
      }

      // 修改缓存并标记访问过
      cache[realPath] = { options, frontmatter };
      visitedCache.add(realPath);

      // 跳过不展示的部分
      if (getTargetOptionValue(frontmatter, options, "hide")) break;

      // 查找该层级中是否已经处理过这个文件或文件夹
      let childNode = currentNode.find((node) => node.name === name);

      // 若未处理过，整理数据并添加到数组
      if (!childNode) {
        childNode = {
          index: 0, // 占位，后续再实际赋值
          name,
          isFolder,
          options,
          frontmatter,
          children: [],
        };
        currentNode.push(childNode);
      }

      currentNode = childNode.children;
    }
  }
  return root;
}

/** 处理文件夹的 git 时间戳 */
function updateCommitTimes(data: Item[]): void {
  for (const item of data) {
    if (item.isFolder) {
      updateCommitTimes(item.children);
      const folderTimes = getFolderCommitTimes(item.children);
      item.options.firstCommitTime = folderTimes.minFirstCommitTime;
      item.options.lastCommitTime = folderTimes.maxLastCommitTime;
    }
  }
}

/** 获取文件夹内子文件、文件夹最小和最大的 git 时间戳 */
function getFolderCommitTimes(children: Item[]): {
  minFirstCommitTime?: number;
  maxLastCommitTime?: number;
} {
  let minFirstCommitTime: number | undefined;
  let maxLastCommitTime: number | undefined;

  for (const item of children) {
    if (item.isFolder) {
      const folderTimes = getFolderCommitTimes(item.children);
      minFirstCommitTime = Math.min(
        minFirstCommitTime ?? Infinity,
        folderTimes.minFirstCommitTime ?? Infinity
      );
      maxLastCommitTime = Math.max(
        maxLastCommitTime ?? 0,
        folderTimes.maxLastCommitTime ?? 0
      );
    } else {
      minFirstCommitTime = Math.min(
        minFirstCommitTime ?? Infinity,
        item.options.firstCommitTime ?? Infinity
      );
      maxLastCommitTime = Math.max(
        maxLastCommitTime ?? 0,
        item.options.lastCommitTime ?? 0
      );
    }
  }

  return {
    minFirstCommitTime:
      minFirstCommitTime === Infinity ? undefined : minFirstCommitTime,
    maxLastCommitTime: maxLastCommitTime === 0 ? undefined : maxLastCommitTime,
  };
}

/** 对结构化后的多级数组数据进行逐级排序 */
function sortStructuredData(
  data: Item[],
  compareFn: (a: Item, b: Item) => number = defaultCompareFn
): Item[] {
  return data
    .map((item, index) => {
      item.index = index;
      if (item.children && item.children.length > 0) {
        item.children = sortStructuredData(item.children, compareFn);
      }
      return item;
    })
    .sort(compareFn);
}

/** 默认排序方法 */
function defaultCompareFn(a: Item, b: Item) {
  const sortA = getTargetOptionValue(a.frontmatter, a.options, "sort");
  const sortB = getTargetOptionValue(b.frontmatter, b.options, "sort");

  const timeA = a.options.firstCommitTime || a.options.birthTime!;
  const timeB = b.options.firstCommitTime || b.options.birthTime!;

  if (sortA !== undefined && sortB !== undefined) {
    // 均存在sort，先sort升序排列，再createTime升序排列
    return sortA - sortB || timeA - timeB;
  } else if (sortA !== undefined && sortB === undefined) {
    // 只有a有sort
    // a.sort === b.index时a在前
    // 否则对比 a.sort 和 b.index，升序排列
    return sortA === b.index ? -1 : sortA - b.index;
  } else if (sortA === undefined && sortB !== undefined) {
    // 只有b有sort
    // b.sort === a.index时 b 在前
    // 否则对比 b.sort 和 a.index，升序排列
    return sortB === a.index ? 1 : a.index - sortB;
  } else {
    // 均不存在sort，创建时间升序排列
    return timeA - timeB;
  }
}

/** 生成 nav 数据 */
function generateNav(structuredData: Item[]) {
  return structuredData.map((item) => ({
    text: item.options.title || item.name,
    activeMatch: `/${item.name}/`,
    link: getFirstArticleFromFolder(item),
  }));
}

/** 获取首层目录中第一篇文章 */
function getFirstArticleFromFolder(data: Item, path = "") {
  path += `/${data.name}`;
  if (data.children.length > 0) {
    return getFirstArticleFromFolder(data.children[0], path);
  } else {
    // 显示名称应除掉扩展名
    return path.replace(".md", "");
  }
}

/** 生成 sidebar */
function generateSidebar(structuredData: Item[]): DefaultTheme.Sidebar {
  const sidebar: DefaultTheme.Sidebar = {};

  // 遍历首层目录（nav），递归生成对应的 sidebar
  for (const { name, children } of structuredData) {
    sidebar[`/${name}/`] = traverseSubFile(children, `/${name}`);
  }

  function traverseSubFile(
    subData: Item[],
    parentPath: string
  ): DefaultTheme.SidebarItem[] {
    return subData.map((file) => {
      const filePath = `${parentPath}/${file.name}`;
      const fileName =
        getTargetOptionValue(file.frontmatter, file.options, "title") ||
        (getTargetOptionValue(
          file.frontmatter,
          file.options,
          "useArticleTitle"
        ) &&
          file.frontmatter.h1) ||
        file.name.replace(".md", "");
      if (file.isFolder) {
        return {
          text: fileName,
          collapsed: file.options.collapsed ?? false,
          items: traverseSubFile(file.children, filePath),
        };
      } else {
        return { text: fileName, link: filePath.replace(".md", "") };
      }
    });
  }

  return sidebar;
}

/** 辅助方法：从 frontmatter 以及 options 中获取实际使用的配置 */
function getTargetOptionValue(
  fronmatter: Frontmatter,
  options: ItemCacheOptions,
  key: string
) {
  return fronmatter[`nav-${key}`] ?? fronmatter[key] ?? (options as any)[key];
}

/**
 * 读取文章frontmatter以及h1
 * @param absolutePath - 需要是绝对路径，与cache中对应
 */
async function getArticleData(absolutePath: string): Promise<Frontmatter> {
  const cacheData = cache[absolutePath];
  if (cacheData) {
    // 根据文件、文件夹更新时间判断是否需要重新获取信息
    const currentMTime = (await stat(absolutePath)).mtimeMs;
    if (currentMTime === cacheData.options.modifyTime) {
      return cacheData.frontmatter;
    }
  }
  // 读取文件
  const file = await readFile(absolutePath, { encoding: "utf-8" });
  // 解析文件内容和frontmatter
  const { content, data } = matter(file);
  // 提取页面一级标题
  data.h1 = getArticleTitle(content, data);
  return data;
}

/** 处理文章h1存在变量的情况 */
function getArticleTitle(content: string, data: Recordable) {
  let h1 = content.match(/^\s*#\s+(.*)[\n\r][\s\S]*/)?.[1];
  if (h1) {
    // 标题可能使用了frontmatter变量
    const regexp = /\{\{\s*\$frontmatter\.(\S+?)\s*\}\}/g;
    let match;
    while ((match = regexp.exec(h1)) !== null) {
      const replaceReg = new RegExp(
        "\\{\\{\\s*\\$frontmatter\\." + match[1] + "\\s*\\}\\}",
        "g"
      );
      h1 = h1.replace(replaceReg, data[match[1]]);
    }
  }
  return h1;
}

/**
 * 获取git时间戳
 * @param absolutePath - 需要是绝对路径，与cache中对应
 */
async function getTimestamp(absolutePath: string, isFolder: boolean) {
  const cacheData = cache[absolutePath];
  if (cacheData) {
    // 根据文件、文件夹更新时间判断是否需要重新获取信息
    const currentMTime = (await stat(absolutePath)).mtimeMs;
    if (currentMTime === cacheData.options.modifyTime) {
      const { birthTime, modifyTime, firstCommitTime, lastCommitTime } =
        cacheData.options;
      return { birthTime, modifyTime, firstCommitTime, lastCommitTime };
    }
  }
  const { birthtimeMs: birthTime, mtimeMs: modifyTime } = await stat(
    absolutePath
  );
  return new Promise<{
    birthTime?: number;
    modifyTime?: number;
    firstCommitTime?: number;
    lastCommitTime?: number;
  }>(async (resolve) => {
    if (isFolder) {
      resolve({ birthTime, modifyTime });
      return;
    }

    let output: number[] = [];

    // 开启子进程执行git log命令
    const child = spawn("git", [
      "--no-pager",
      "log",
      '--pretty="%ci"',
      absolutePath,
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
    child.on("close", async () => {
      if (output.length) {
        // 返回[发布时间，最近更新时间]

        resolve({
          lastCommitTime: +new Date(output[output.length - 1]),
          firstCommitTime: +new Date(output[0]),
          birthTime,
          modifyTime,
        });
      } else {
        // 没有提交记录时获取文件时间

        resolve({ birthTime, modifyTime });
      }
    });

    child.on("error", async () => {
      // 获取失败时使用文件时间

      resolve({ birthTime, modifyTime });
    });
  });
}

/** 强制重启开发服务器，实现刷新 */
function forceReload(path: string) {
  // 修改配置文件系统时间戳，触发更新
  utimesSync(path, new Date(), new Date());
}

/** 节流 */
function throttle<T extends (...args: any[]) => void>(func: T, delay: number) {
  let lastExecTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const currentTime = Date.now();
    const timeSinceLastExec = currentTime - lastExecTime;

    if (timeSinceLastExec >= delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - timeSinceLastExec);
    }
  };
}
