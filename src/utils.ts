import type { LocaleConfig, SiteConfig } from 'vitepress'
import type { FileInfo, FolderInfo, Item, ItemHandler, Recordable, TimesInfo } from './types'
import { exec } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import fm from 'front-matter'

/**
 * 获取 md 文件的 frontmatter 及 h1
 * @param path md 文件路径
 */
export async function getMarkdownData(path: string, params: Recordable = {}): Promise<Pick<FileInfo, 'h1' | 'frontmatter'>> {
  const fileStr = await readFile(path, 'utf-8')
  const { attributes: frontmatter = {}, body } = fm<Record<string, string>>(fileStr)

  // 提取第一个标题
  let heading = body.match(/^\s*#\s(.+)$/m)?.[1]?.trim()

  // 处理标题中包含 frontmatter 变量的情况
  if (heading) {
    heading = heading
      .replaceAll(
        /\{\{\s*\$frontmatter\.(\S+?)\s*\}\}/g,
        (_, key) => frontmatter[key] || '',
      )
      .replaceAll(
        /\{\{\s*\$params\.(\S+?)\s*\}\}/g,
        (_, key) => params[key] || '',
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
export function deepHandle<T extends Recordable>(list: Item[], handler: ItemHandler<T>, rewrites: SiteConfig['rewrites'], locales?: LocaleConfig): T[] {
  const result: T[] = []
  for (const item of list) {
    let children
    let childrenRewrites
    if ((item as FolderInfo).children) {
      children = deepHandle((item as FolderInfo).children, handler, rewrites, locales)
      childrenRewrites = getChildrenRewrites((item as FolderInfo).children, rewrites.inv)
    }
    const res = handler({ item, children, locales, rewrites, childrenRewrites })
    if (res)
      result.push(res)
  }
  return result
}

/** 整理缓存，删除无用数据 */
export function compactCache(cache: Item[], pages: string[]): void {
  // 从全部页面路径中整理各个页面层级包含的名称
  const parts = pages.reduce<string[][]>((p, c) => {
    const names = c.split('/')
    names.forEach((name, index) => {
      if (!p[index])
        p[index] = []

      if (!p[index].includes(name))
        p[index].push(name)
    })
    return p
  }, [])

  compact(cache)

  function compact(current: Item[]): void {
    for (let i = 0; i < current.length; i++) {
      // 未从整理的页面路径中找到当前名称，删除该缓存
      if (!parts[current[i].depth]?.includes(current[i].name)) {
        current.splice(i, 1)
        // 删除后重新对齐索引
        i--
      }
      else if ((current[i] as FolderInfo).children?.length) {
        // 递归处理
        compact((current[i] as FolderInfo).children)
      }
    }
  }
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

/**
 * 获取文件夹下不匹配文件链接的重写规则
 */
export function getChildrenRewrites(items: Item[], inv: SiteConfig['rewrites']['inv']): string[] {
  const result: string[] = []
  for (const item of items) {
    if ((item as FolderInfo).children?.length) {
      result.push(...getChildrenRewrites((item as FolderInfo).children, inv))
    }
    else if ((item as FileInfo)) {
      const rewrite = `${(item as FileInfo).link.slice(1)}.md`
      inv[rewrite] && result.push(rewrite)
    }
  }
  return result
}
