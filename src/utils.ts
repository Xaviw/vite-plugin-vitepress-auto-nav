import type { DefaultTheme } from 'vitepress'
import type { BaseInfo, FileInfo, FolderInfo, Handler, Item, ItemHandler, Recordable, TimesInfo } from './types.js'
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
  list: Item[],
  comparer: (a: Item, b: Item) => number,
): void {
  list.sort(comparer)
  for (const item of list) {
    if ((item as FolderInfo).children) {
      deepSrot((item as FolderInfo).children, comparer)
    }
  }
}

/** 默认 sidebarItem 生成方法 */
export const defaultSidebarItemHandler: ItemHandler<DefaultTheme.SidebarItem> = (item, children) => {
  if (item.name === 'index')
    return false

  const isFolder = (item as FolderInfo).children?.length
  const hasIndex = (item as FolderInfo).children?.find(i => i.name === 'index')

  return {
    text: item.name,
    link: !isFolder || hasIndex ? item.path : undefined,
    items: children,
    collapsed: isFolder ? false : undefined,
  }
}

/** 默认 navItem 生成方法 */
export const defaultNavItemHandler: ItemHandler<(DefaultTheme.NavItemWithLink | DefaultTheme.NavItemWithChildren)> = (item, children) => {
  const MAX_DEPTH = 0
  if (item.name === 'index' || item.depth > MAX_DEPTH)
    return false

  let link = item.path
  // 文件夹时获取文件夹可用链接
  if ((item as FolderInfo).children?.length) {
    link = getFolderLink(item as FolderInfo)
  }

  return !children?.length || item.depth === MAX_DEPTH
    ? {
        text: item.name,
        link,
      } as DefaultTheme.NavItemWithLink
    : {
        text: item.name,
        items: children,
        activeMatch: `^${item.path}`,
      } as DefaultTheme.NavItemWithChildren
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

/** 应用生成的数据到配置中 */
export const defaultHandler: Handler = (config, { nav, sidebar }) => {
  config.vitepress.site.themeConfig.sidebar = sidebar.reduce<DefaultTheme.SidebarMulti>(
    (p, c) => {
      if (c.items?.length)
        p[`/${c.text!}/`] = c.items
      return p
    },
    {},
  )
  config.vitepress.site.themeConfig.nav = nav
  return config
}

/**
 * 获取文件夹对应的链接；
 * 文件夹中存在 index.md 时，返回文件夹自身路径；否则深度查找第一篇 md 路径作为链接
 */
export function getFolderLink(item: FolderInfo): string {
  const index = item.children.find(i => i.name === 'index')
  if (index)
    return `${item.path}/`

  const md = item.children.find(i => (i as FileInfo).frontmatter)
  if (md)
    return md.path

  return getFolderLink(item.children[0] as FolderInfo)
}
