import type { FileInfo, Item } from './types'
import { minimatch } from 'minimatch'

/**
 * 兼容 v3 的排序方法
 * @remark
 * 优先按自定义权重排序，其次按首次 git 提交时间（或本地文件创建时间）排序
 * @param options 配置对象
 * @param options.key frontmatter 排序权重字段名称，为空时忽略从 frontmatter 中获取，默认 'sort'
 * @param options.config 自定义排序权重配置对象，键为 glob 表达式字符串（通过 [minimatch](https://github.com/isaacs/minimatch) 进行判断，仅最后一条匹配的配置生效；键需要以页面实际访问路径为准，文件需要包含扩展名 '.md'），值为权重，例如 `{ '/a/b.md': 1, '/c': 2 }`
 * @param options.order 排序方式，默认 'asc' 升序
 */
export function defaultComparer(
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
    // 优先从自定义权重中获取
    // 其次存在 key 时从 frontmatter 中获取
    let sortA = Number(key && (a as FileInfo).frontmatter?.[key])
    let sortB = Number(key && (b as FileInfo).frontmatter?.[key])
    Object.entries(config).forEach(([pattern, sort]) => {
      if (minimatch((a as FileInfo).link ? `${(a as FileInfo).link}.md` : a.path, pattern))
        sortA = +sort
      if (minimatch((b as FileInfo).link ? `${(b as FileInfo).link}.md` : b.path, pattern))
        sortB = +sort
    })

    const timeA = a.timesInfo.firstCommitTime || a.timesInfo.localBirthTime
    const timeB = b.timesInfo.firstCommitTime || b.timesInfo.localBirthTime

    const base = order === 'asc' ? 1 : -1

    if (!Number.isNaN(sortA) || !Number.isNaN(sortB)) {
      // 当两者都有排序值时，优先按排序值比较，其次按时间比较
      // 当只有一个有排序值时，有排序值的排在前面
      return ((Number.isNaN(sortA) ? Infinity : sortA) - (Number.isNaN(sortB) ? Infinity : sortB) || timeA - timeB) * base
    }

    // 都没有排序值时，按时间比较
    return (timeA - timeB) * base
  }
}
