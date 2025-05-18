import type { FileInfo, FolderInfo, Item, ItemHandler, Recordable, TimesInfo } from './types'
import { exec } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { normalize, resolve } from 'node:path'
import { promisify } from 'node:util'
import fm from 'front-matter'
import { glob } from 'tinyglobby'
import { loadConfigFromFile } from 'vite'

/**
 * 获取 md 文件的 frontmatter 及 h1
 * @param path md 文件路径
 */
export async function getMarkdownData(path: string): Promise<Pick<FileInfo, 'h1' | 'frontmatter'>> {
  const fileStr = await readFile(path, 'utf-8')
  const { attributes: frontmatter = {}, body } = fm<Record<string, string>>(fileStr)

  // 提取第一个标题
  let heading = body.match(/^\s*#\s(.+)$/m)?.[1]?.trim()

  // 处理标题中包含 frontmatter 变量的情况
  if (heading) {
    heading = heading.replaceAll(
      /\{\{\s*\$frontmatter\.(\S+?)\s*\}\}/g,
      (_, key) => frontmatter[key] || '',
    )
  }

  return {
    frontmatter,
    h1: heading || '',
  }
}

/**
 * 获取文件夹下首个可访问路径
 * @param item 文件夹数据
 * @remark
 * 文件夹中存在 index.md 时，返回文件夹自身路径；否则返回第一篇子 md 路径（若有），或第一个子文件夹下的第一篇 md 路径
 * @example
 * ```ts
 * getFolderLink(folderData) // 可能返回 `/folder/` 或 `/folder/sub/anyMd`
 * ```
 */
export function getFolderLink(item: FolderInfo): string | undefined {
  if (!item.children?.length)
    return

  const index = item.children.find(i => i.name === 'index.md')
  if (index)
    return (index as FileInfo).link

  const md = item.children.find(i => (i as FileInfo).link)
  if (md)
    return (md as FileInfo).link

  return getFolderLink(item.children[0] as FolderInfo)
}

/**
 * @param path 文件或文件夹路径
 * @returns 本地时间戳以及git提交时间戳信息（单位毫秒）
 */
export async function getTimestamp(path: string): Promise<TimesInfo> {
  const times = {
    localBirthTime: 0,
    localModifyTime: 0,
    firstCommitTime: 0,
    lastCommitTime: 0,
  }

  await Promise.allSettled([
    stat(path).then(({ birthtimeMs, mtimeMs }) => {
      times.localBirthTime = birthtimeMs
      times.localModifyTime = mtimeMs
    }),

    promisify(exec)(`git --no-pager log --format=%at -- ${path}`).then(({ stdout }) => {
      const commits = stdout
        .toString()
        .split('\n')
        .filter(Boolean)
      times.lastCommitTime = (Number(commits[0]) || 0) * 1000
      times.firstCommitTime = (Number(commits[commits.length - 1]) || 0) * 1000
    }),
  ])

  return times
}

/** 调用 comparer 进行深度排序 */
export function deepSort(
  list: Item[],
  comparer: (a: Item, b: Item) => number,
): void {
  list.sort(comparer)
  for (const item of list) {
    if ((item as FolderInfo).children) {
      deepSort((item as FolderInfo).children, comparer)
    }
  }
}

/** 调用 handler 生成 sidebar 或 nav */
export function deepHandle<T extends Recordable>(list: Item[], handler: ItemHandler<T>): T[] {
  const result: T[] = []
  for (const item of list) {
    let children
    if ((item as FolderInfo).children) {
      children = deepHandle((item as FolderInfo).children, handler)
    }
    const res = handler(item, children)
    if (res)
      result.push(res)
  }
  return result
}

/**  */
export async function getDynamicMapping({
  srcDir,
  srcExclude,
}: { srcDir: string, srcExclude?: string[] }): Promise<Record<string, string>> {
  const mapping: Record<string, string> = {}
  const dynamicRouteRE = /\[(\w+)\]/g

  // 获取所有动态路由
  const dynamicRoutes = (await glob(['**/*.md'], {
    cwd: srcDir,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      ...(srcExclude || []),
    ],
    expandDirectories: false,
  })).filter(path => dynamicRouteRE.test(path))

  for (const route of dynamicRoutes) {
    const fullPath = normalize(resolve(srcDir, route))

    // 查找对应的路径加载器文件
    const paths = ['js', 'ts', 'mjs', 'mts'].map(ext =>
      fullPath.replace(/\.md$/, `.paths.${ext}`),
    )
    const pathsFile = paths.find(p => existsSync(p))
    if (!pathsFile)
      continue

    // 获取路径加载器
    const mod = await loadConfigFromFile(
      {} as any,
      pathsFile,
      undefined,
      'silent',
    )
    if (!mod)
      continue

    // 执行路径加载器
    const { paths: loader } = mod.config as any
    if (typeof loader !== 'function')
      continue
    const pathsData: { params: Recordable }[] = await loader()

    // 生成路径
    pathsData.forEach((userConfig) => {
      const resolvedPath = route.replace(
        dynamicRouteRE,
        (_, key) => userConfig.params[key],
      )
      mapping[resolvedPath] = route
    })
  }

  return mapping
}

/**
 * 防抖函数
 * @param fn 需要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖处理后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  return function (...args: Parameters<T>): void {
    if (timer) {
      clearTimeout(timer)
    }

    timer = setTimeout(() => {
      fn(...args)
      timer = null
    }, delay)
  }
}
