import type { Plugin, SiteConfig } from 'vitepress'
import type { FileInfo, FolderInfo, Item, Options } from './types'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, normalize, sep } from 'node:path'
import { minimatch } from 'minimatch'
import { classicComparer, defaultComparer } from './comparer'
import { classicSidebarItemHandler, defaultHandler, defaultNavItemHandler, defaultSidebarItemHandler } from './handler'
import { debounce, deepHandle, deepSort, getDynamicMapping, getFolderLink, getMarkdownData, getTimestamp } from './utils'

export {
  classicComparer,
  classicSidebarItemHandler,
  defaultComparer,
  defaultHandler,
  defaultNavItemHandler,
  defaultSidebarItemHandler,
  getFolderLink,
  getMarkdownData,
}

export type * from './types'

/**
 * vitepress 自动生成 sidebar 与 nav 配置
 */
export function AutoNav({
  exclude = [],
  navItemHandler = defaultNavItemHandler,
  sidebarItemHandler = defaultSidebarItemHandler,
  comparer = defaultComparer,
  handler = defaultHandler,
  // summary,
}: Options = {}): Plugin {
  // 参数校验
  Object.entries({
    navItemHandler,
    sidebarItemHandler,
    comparer,
    handler,
  }).forEach(([key, value]) => {
    if (typeof value !== 'function')
      throw new TypeError(`${key} 必须是一个函数`)
  })

  /** 缓存数据 */
  let cache: Item[] = []
  /** 同 srcDir，系统绝对路径 */
  let baseDir: string
  /** vitepress 配置文件夹，系统绝对路径 */
  let configDir: string

  return {
    name: 'vite-plugin-vitepress-auto-nav',
    // 新增文件时，如果自动保存，会在 add 事件后触发 change 事件
    // 删除文件夹时，每个子文件和子文件夹都会触发删除事件（顺序不固定）
    // 修改配置文件会触发 change 事件，并且整体刷新（插件函数会重新运行）；刷新过程中可能会有临时文件触发 add 事件（但不会触发其他事件）
    // 非 srcDir 文件夹下，以及 .vitepress/cache 文件夹下的文件变化不会触发事件（被监听的文件引用的文件变化还是会触发事件）
    configureServer({ watcher, restart }) {
      // 刷新防抖
      const debouncedRestart = debounce(restart, 1500)

      watcher.on('all', async (eventName, path) => {
        path = normalize(path)

        if (
          !baseDir
          || !configDir
          || eventName === 'addDir' // 忽略新增目录，在新增文件时再处理
          || path.startsWith(configDir) // 忽略配置目录下的文件监听
          || !(path.startsWith(baseDir) && path.endsWith('.md')) // 忽略非 srcDir 目录下 md 文件监听
        ) {
          return
        }

        // 修改和删除操作需要同步操作缓存
        if (['change', 'unlink', 'unlinkDir'].includes(eventName)) {
          let current = cache
          const parts = path.replace(`${baseDir}${sep}`, '').split(sep)

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            // 存在动态路由时，同级数据可能存在多个相同的 name
            // 文件与文件夹可能同名，name 中通过 `.md` 进行区分
            const targetIndex = current.findIndex(data => data.name === part)
            if (targetIndex < 0)
              return

            if (i === parts.length - 1) {
              // 删除，存在动态路由时需要将对应的动态页面数据全部删除
              if (['unlink', 'unlinkDir'].includes(eventName)) {
                circularRemove(targetIndex)

                function circularRemove(index: number): void {
                  current.splice(index, 1)
                  const newIndex = current.findIndex(data => data.name === part)
                  if (newIndex >= 0)
                    circularRemove(newIndex)
                }
              }
              // change 事件只有可能是 md 文件触发，检查 frontmatter 是否变更
              else {
                const { frontmatter, h1 } = current[targetIndex] as FileInfo
                const newData = await getMarkdownData(path)
                // frontmatter 未变更时，忽略
                if (JSON.stringify({ frontmatter, h1 }) === JSON.stringify(newData)) {
                  return
                }
                // 否则更新缓存数据，存在动态路由时需要将对应的动态页面数据全部更新
                else {
                  circularUpdate(targetIndex)

                  function circularUpdate(index: number): void {
                    (current[index] as FileInfo).frontmatter = newData.frontmatter;
                    (current[index] as FileInfo).h1 = newData.h1
                    const newIndex = current.slice(index + 1).findIndex(data => data.name === part)
                    if (newIndex >= 0)
                      circularUpdate(index + 1 + newIndex)
                  }
                }
              }
            }
            else {
              current = (current[targetIndex] as FolderInfo).children
            }
          }
        }

        debouncedRestart()
      })
    },
    // config 变更会自动刷新
    async config(config: any) {
      let {
        srcDir, // 系统绝对路径
        pages, // 全部页面路径数组，例如 a.md、b/c.md，包括动态路由
        cacheDir, // 系统绝对路径
        root, // 系统绝对路径
        userConfig,
        rewrites: { map }, // { map: { 'x/origin.md': 'x/rewrite.md' }, inv: { 'x/rewrite.md': 'x/origin.md' } }
      } = config.vitepress as SiteConfig

      baseDir = normalize(srcDir)
      configDir = join(root, '.vitepress')
      cacheDir = normalize(cacheDir)

      // 首次尝试从本地读取缓存，后续刷新直接使用读取到的缓存
      if (!cache.length) {
        // 确保缓存目录存在，避免后续报错
        if (!existsSync(cacheDir))
          await mkdir(cacheDir)

        try {
          const cacheFile = join(cacheDir, 'auto-nav-cache.json')
          const cacheStr = await readFile(cacheFile, 'utf-8')
          cache = JSON.parse(cacheStr)
        }
        catch { }
      }

      // 全部动态路由
      const dynamicMapping = await getDynamicMapping({ srcDir, srcExclude: userConfig?.srcExclude })

      const promises: Promise<any>[] = []

      // 遍历文章
      pages
        .filter((path) => {
          if (!Array.isArray(exclude))
            return true

          const dynamicOrigin = dynamicMapping[path]

          return !exclude.some((pattern) => {
            if (typeof pattern !== 'string')
              return false

            return minimatch(dynamicOrigin || path, pattern)
          })
        })
        .forEach((path) => {
          let current = cache

          const rewrite = map[path]

          // 动态路由和原路由的层级肯定是一致的
          const dynamicOrigin: string | undefined = dynamicMapping[path]
          const dynamicOriginParts = dynamicOrigin?.split('/')

          // 遍历文章路径每一层
          const parts = path.split('/')
          parts.forEach((part, index) => {
            const isFile = index === parts.length - 1
            const dynamicPath = dynamicOriginParts && `/${dynamicOriginParts.slice(0, index + 1).join('/')}`
            const itemPath = `/${parts.slice(0, index + 1).join('/')}`
            let item = current.find(data => data.name === part)

            // 没有缓存才获取数据
            if (!item) {
              item = {
                name: part,
                path: dynamicPath || itemPath,
                depth: index,
              } as Item
              current.push(item)

              const absolutePath = join(srcDir, item.path)
              promises.push(
                getTimestamp(absolutePath).then((times) => {
                  item!.timesInfo = times
                }),
              )

              if (isFile) {
                (item as FileInfo).link = `/${(rewrite || path).replace(/(index)?\.md$/, '')}`

                if (dynamicOrigin) {
                  const originName = basename(dynamicOrigin);
                  (item as FileInfo).originName = originName
                }
                promises.push(
                  getMarkdownData(absolutePath).then(({ h1, frontmatter }) => {
                    (item as FileInfo).h1 = h1;
                    (item as FileInfo).frontmatter = frontmatter
                  }),
                )
              }
              else {
                (item as FolderInfo).children = []
              }
            }

            current = (item as FolderInfo).children
          })
        })

      // 等待数据组装完成
      await Promise.allSettled(promises)
      // 数据缓存
      writeFile(join(cacheDir, 'auto-nav-cache.json'), JSON.stringify(cache))
      // 数据排序
      deepSort(cache, comparer)
      // 数据处理
      const sidebar = deepHandle(cache, sidebarItemHandler)
      const nav = deepHandle(cache, navItemHandler)
      // 修改配置
      handler(config, { sidebar, nav })
    },
  }
}
