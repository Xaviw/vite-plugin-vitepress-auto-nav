import type { DefaultTheme } from 'vitepress'
import type { BaseInfo, FileInfo, FolderInfo, TimesInfo } from './types.js'
import { exec } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import fm from 'front-matter'

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
    }, delay)
  }
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
      times.firstCommitTime = (Number(commits[0]) || 0) * 1000
      times.lastCommitTime = (Number(commits[commits.length - 1]) || 0) * 1000
    }),
  ])

  return times
}

/**
 * @param path 文件路径
 * @returns 文章标题、frontmatter
 */
export async function getArticleData(path: string): Promise<Pick<FileInfo, 'h1' | 'frontmatter'>> {
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

/** 默认排序方法 */
export function defaultComparer(a: BaseInfo, b: BaseInfo): number {
  const timeA = a.timesInfo.firstCommitTime || a.timesInfo.localBirthTime
  const timeB = b.timesInfo.firstCommitTime || b.timesInfo.localBirthTime
  return timeA - timeB
}

/** 深度排序 */
export function deepSrot(
  list: (FileInfo | FolderInfo)[],
  comparer: (a: FileInfo | FolderInfo, b: FileInfo | FolderInfo) => number,
): void {
  list.sort(comparer)
  for (const item of list) {
    if ((item as FolderInfo).children) {
      deepSrot((item as FolderInfo).children, comparer)
    }
  }
}

/** 默认 sidebarItem 生成方法 */
export function defaultSidebarItemHandler(
  item: FileInfo | FolderInfo,
  children: DefaultTheme.SidebarItem[] | undefined,
): DefaultTheme.SidebarItem | false {
  if (item.name === 'index')
    return false

  return {
    text: item.name,
    link: item.path,
    items: children,
    collapsed: false,
  }
}

/** 默认 navItem 生成方法 */
export function defaultNavItemHandler(
  item: FileInfo | FolderInfo,
  children: (DefaultTheme.NavItemComponent | DefaultTheme.NavItemChildren | DefaultTheme.NavItemWithLink)[] | undefined,
): DefaultTheme.NavItemWithLink | DefaultTheme.NavItemWithChildren | false {
  const MAX_DEPTH = 1
  if (item.name === 'index' || item.depth > MAX_DEPTH)
    return false

  let link = item.path
  if (children?.length && item.depth < MAX_DEPTH) {
    // 文件夹判断是否有子 index 页面，没有则取第一个子页面
    const index = (item as FolderInfo).children.findIndex(i => i.name === 'index')
    if (!index)
      link = (item as FolderInfo).children[0].path
  }

  return !children?.length || item.depth === MAX_DEPTH
    ? {
        text: item.name,
        link,
      }
    : {
        text: item.name,
        items: children,
        activeMatch: `^${item.path}$`,
      }
}
