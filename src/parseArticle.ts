import { readFile, stat } from "fs/promises";
import matter from "gray-matter";
import { cache, visitedCache } from "./index";
import { getTargetOptionValue, getTimestamp } from "./utils";
import { join, normalize, resolve, sep } from "path";
import type {
  Frontmatter,
  Item,
  ItemCacheOptions,
  ItemOptions,
  Options,
  Recordable,
} from "../types";
import type { DefaultTheme } from "vitepress";

/** 处理文件路径字符串数组 */
export async function serializationPaths(
  paths: string[],
  { itemsSetting = {}, useArticleTitle, frontmatterPrefix }: Options,
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

      // 判断是文件还是文件夹
      const isFolder = (await stat(realPath)).isDirectory();

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
      if (getTargetOptionValue(frontmatter, options, "hide", frontmatterPrefix))
        break;

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

/** 对结构化后的多级数组数据进行逐级排序 */
export function sortStructuredData(
  data: Item[],
  compareFn: (
    a: Item,
    b: Item,
    frontmatterPrefix?: string
  ) => number = defaultCompareFn,
  frontmatterPrefix: string = ""
): Item[] {
  return data
    .map((item, index) => {
      item.index = index;
      if (item.children && item.children.length > 0) {
        item.children = sortStructuredData(
          item.children,
          compareFn,
          frontmatterPrefix
        );
      }
      return item;
    })
    .sort((a, b) => compareFn(a, b, frontmatterPrefix));
}

/** 默认排序方法 */
export function defaultCompareFn(
  a: Item,
  b: Item,
  frontmatterPrefix: string = ""
) {
  const sortA = getTargetOptionValue(
    a.frontmatter,
    a.options,
    "sort",
    frontmatterPrefix
  );
  const sortB = getTargetOptionValue(
    b.frontmatter,
    b.options,
    "sort",
    frontmatterPrefix
  );

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
export function generateNav(structuredData: Item[]) {
  return structuredData.map((item) => ({
    text: item.options.title || item.name,
    activeMatch: `/${item.name}/`,
    link: getFirstArticleFromFolder(item),
  }));
}

/** 获取首层目录中第一篇文章 */
export function getFirstArticleFromFolder(data: Item, path = "") {
  path += `/${data.name}`;
  if (data.children.length > 0) {
    return getFirstArticleFromFolder(data.children[0], path);
  } else {
    // 显示名称应除掉扩展名
    return path.replace(".md", "");
  }
}

/** 生成 sidebar */
export function generateSidebar(
  structuredData: Item[],
  options: Options
): DefaultTheme.Sidebar {
  const { indexAsFolderLink = true, frontmatterPrefix = "" } = options;
  const sidebar: DefaultTheme.Sidebar = {};

  // 遍历首层目录（nav），递归生成对应的 sidebar
  for (const { name, children } of structuredData) {
    sidebar[`/${name}/`] = traverseSubFile(children, `/${name}`).sidebarMulti;
  }

  function traverseSubFile(
    subData: Item[],
    parentPath: string
  ): { link?: string; sidebarMulti: DefaultTheme.SidebarItem[] } {
    // 如果下级有 index，临时记录
    let link: string | undefined = undefined;

    const sidebarMulti = subData.reduce((p, file) => {
      const isIndex = file.name.replace(".md", "") === "index";

      const filePath = isIndex
        ? `${parentPath}/`
        : `${parentPath}/${file.name}`;

      if (indexAsFolderLink && isIndex) {
        link = filePath;
        return p;
      }

      const fileName =
        getTargetOptionValue(
          file.frontmatter,
          file.options,
          "title",
          frontmatterPrefix
        ) ||
        (getTargetOptionValue(
          file.frontmatter,
          file.options,
          "useArticleTitle",
          frontmatterPrefix
        ) &&
          file.frontmatter.h1) ||
        file.name.replace(".md", "");
      if (file.isFolder) {
        const result = traverseSubFile(file.children, filePath);
        p.push({
          text: fileName,
          collapsed: file.options.collapsed ?? false,
          items: result.sidebarMulti,
          link: result.link,
        });
      } else {
        p.push({ text: fileName, link: filePath.replace(".md", "") });
      }
      return p;
    }, [] as DefaultTheme.SidebarItem[]);

    return { sidebarMulti, link };
  }

  return sidebar;
}

/**
 * 读取文章frontmatter以及h1
 * @param absolutePath - 需要是绝对路径，与cache中对应
 */
export async function getArticleData(
  absolutePath: string
): Promise<Frontmatter> {
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
export function getArticleTitle(content: string, data: Recordable) {
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
