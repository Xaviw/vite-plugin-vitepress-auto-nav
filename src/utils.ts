import type { TimesInfo } from './types.js'
import { exec } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { promisify } from 'node:util'

// declare module 'front-matter' {
//   interface FrontMatter {
//     <T>(file: string, options?: FrontMatterOptions): FrontMatterResult<T>
//   }

//   export { FrontMatter }
// }

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
 * @returns 本地时间戳以及git提交时间戳信息
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
      times.firstCommitTime = Number(commits[0]) || 0
      times.lastCommitTime = Number(commits[commits.length - 1]) || 0
    }),
  ])

  return times
}

/**
 * @param path 文件路径
 * @returns 文章标题、frontmatter
 */
// export async function getArticleData(path: string): Promise<Pick<ItemInfo, 'articleTitle' | 'frontmatter'>> {
//   const fileStr = await readFile(path, 'utf-8')
//   const { attributes: frontmatter = {} } = frontMatter(fileStr)
// }
