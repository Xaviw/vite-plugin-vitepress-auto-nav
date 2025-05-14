/* eslint-disable jsdoc/check-param-names */
import type { FileInfo, Item } from './types'

/** 默认排序方法 */
export function defaultComparer(a: Item, b: Item): number {
  const timeA = a.timesInfo.firstCommitTime || a.timesInfo.localBirthTime
  const timeB = b.timesInfo.firstCommitTime || b.timesInfo.localBirthTime
  return timeA - timeB
}

/**
 * 兼容 v3 的排序方法
 * @remark
 * 优先按自定义值排序，其次按首次 git 提交时间（或创建时间）排序
 * @param options.key md 文件使用的排序字段（从 frontmatter 中获取），默认 'sort'
 * @param options.config 自定义路径排序权重，键为路径，值为权重，例如 `{ '/a/b': 1 }`
 * @param options.order 排序顺序，默认 'asc' 升序
 */
export function legacyComparer(
  {
    key = 'sort',
    config = {},
    order = 'asc',
  }: {
    key?: string
    config?: Record<string, number>
    order?: 'asc' | 'desc'
  } = {},
) {
  return (a: Item, b: Item): number => {
    const sortA = Number(config[a.path] ?? (a as FileInfo).frontmatter?.[key])
    const timeA = a.timesInfo.firstCommitTime || a.timesInfo.localBirthTime

    const sortB = Number(config[b.path] ?? (b as FileInfo).frontmatter?.[key])
    const timeB = b.timesInfo.firstCommitTime || b.timesInfo.localBirthTime

    const base = order === 'asc' ? 1 : -1

    if (!Number.isNaN(sortA) || !Number.isNaN(sortB)) {
      // 当两者都有排序值时，按排序值比较；相等时按时间比较
      // 当只有一个有排序值时，有排序值的排在前面
      return ((Number.isNaN(sortA) ? Infinity : sortA) - (Number.isNaN(sortB) ? Infinity : sortB) || timeA - timeB) * base
    }

    // 都没有排序值时，按时间比较
    return (timeA - timeB) * base
  }
}
