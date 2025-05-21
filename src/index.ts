import type { Plugin, SiteConfig } from 'vitepress'
import type { FileInfo, FolderInfo, Item, Options } from './types'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, normalize, sep } from 'node:path'
import { minimatch } from 'minimatch'
import { comparer as defaultComparer } from './comparer'
import { handler as defaultHandler, navItemHandler as defaultNavItemHandler, sidebarItemHandler as defaultSidebarItemHandler } from './handler'
import { compactCache, debounce, deepHandle, deepSort, getFolderLink, getMarkdownData, getTimestamp } from './utils'

export {
  defaultComparer,
  defaultHandler,
  defaultNavItemHandler,
  defaultSidebarItemHandler,
  getFolderLink,
  getMarkdownData,
}

export type * from './types'

export function AutoNav({
  exclude = [],
  navItemHandler = defaultNavItemHandler(),
  sidebarItemHandler = defaultSidebarItemHandler(),
  comparer = defaultComparer(),
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
  /** 标准化 srcDir 路径 */
  let baseDir: string
  /** 标准化 vitepress 配置文件夹路径 */
  let configDir: string
  /** 缓存文件名 */
  const CACHE_FILE = 'auto-nav-cache.json'

  return {
    name: 'vite-plugin-vitepress-auto-nav',
    configureServer({ watcher, restart }) {
      // 刷新添加防抖，避免批量操作时频繁触发刷新
      const debouncedRestart = debounce(restart, 1500)

      // 非 srcDir 文件夹下的内容不会被监听
      // .vitepress 文件夹在 srcDir 文件夹内时，会被监听，反之不会（.vitepress/cache 文件夹始终不会被监听）
      // 修改配置文件会触发整体刷新（插件函数会重新运行）；如果配置文件在 srcDir 文件夹内，还会触发 change 事件；刷新过程中 .vitepress 目录下还可能会有新增临时文件触发 add 事件（但没有删除、修改等事件）
      // 被监听的文件引用的外部文件也会被监听
      // 新增文件时，如果有自动保存，会在 add 事件后触发 change 事件
      // 删除文件夹时，每个子文件和子文件夹都会触发删除事件（顺序不固定）
      watcher.on('all', async (eventName, path) => {
        path = normalize(path)

        const dynamicLoaderRe = /\.paths\.m?[jt]s$/

        if (
          !baseDir
          || !configDir
          || eventName === 'addDir' // 忽略新增目录，在新增文件时再处理
          || path.startsWith(configDir) // 忽略配置目录下的文件监听
          || !path.startsWith(baseDir) // 忽略非 srcDir 目录下的文件监听
          // 仅监听 md 文件与路径加载器文件
          // 路径加载器引用了外部文件的情况未考虑
          || !(path.endsWith('.md') || dynamicLoaderRe.test(path))
        ) {
          return
        }

        // md 文件修改同步操作缓存，减少计算量
        if (path.endsWith('.md') && eventName === 'change') {
          let current = cache
          const parts = path.replace(`${baseDir}${sep}`, '').split(sep)

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]

            // 同名文件、文件夹可以通过扩展名区分
            // 动态路由文件通过 originName 匹配数据
            const targetIndex = current.findIndex(data => (data as FileInfo).originName || data.name === part)
            if (targetIndex < 0)
              return

            // 最后一层为 md 文件
            if (i === parts.length - 1) {
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
                  // 循环更新动态路由生成的文件数据
                  const newIndex = current.slice(index + 1).findIndex(data => (data as FileInfo).originName || data.name === part)
                  if (newIndex >= 0)
                    circularUpdate(index + 1 + newIndex)
                }
              }
            }
            else {
              current = (current[targetIndex] as FolderInfo).children
            }
          }
        }

        // 动态路由加载器变更，或 md 文件其他操作，直接刷新
        debouncedRestart()
      })
    },
    // 刷新后会重新触发 config 钩子
    async config(config: any) {
      let {
        root, // D:/vite-plugin-vitepress-auto-nav/example
        srcDir, // D:/vite-plugin-vitepress-auto-nav/example
        cacheDir, // D:/vite-plugin-vitepress-auto-nav/example/.vitepress/cache
        pages, // ['a.md', 'b/c.md']，包括动态路由，未处理 rewrites
        rewrites, // { map: { 'x/origin.md': 'x/rewrite.md' }, inv: { 'x/rewrite.md': 'x/origin.md' } }
        dynamicRoutes: { routes }, // [{ path: 'a/b.md', fullPath: 'D:/a/b.md', route: 'a/[name].md', params: { name: 'b' } }]
        userConfig: { locales }, // { root: { label: '简体中文' }, en: { label: 'English' } }，同用户设置
      } = config.vitepress as SiteConfig

      // 记录关键配置并标准化路径
      baseDir = normalize(srcDir)
      configDir = join(root, '.vitepress')
      cacheDir = normalize(cacheDir)

      // 首次尝试从本地读取缓存，后续刷新直接使用读取到的缓存
      if (!cache.length) {
        // 确保缓存目录存在，避免后续报错
        if (!existsSync(cacheDir))
          await mkdir(cacheDir)

        // 尝试读取缓存 JSON 数据
        try {
          const cacheFile = join(cacheDir, CACHE_FILE)
          const cacheStr = await readFile(cacheFile, 'utf-8')
          const cacheData = JSON.parse(cacheStr)
          // rewrites 会影响 link 属性，如果变更需要重新获取数据
          if (JSON.stringify(cacheData.rewrites) === JSON.stringify(rewrites))
            cache = cacheData.cache
        }
        catch { }
      }

      // 清理失效缓存
      compactCache(cache, pages)

      // 暂存异步任务，后续 allSettled 等待，避免每单个任务都 await
      const promises: Promise<any>[] = []

      // 遍历文章
      pages
        // 处理 exclude
        .filter((path) => {
          if (!Array.isArray(exclude))
            return true

          // exclude 需要判断动态路由的源路径
          const dynamicOrigin = routes.find(data => data.path === path)?.route

          return !exclude.some((pattern) => {
            if (typeof pattern !== 'string')
              return false

            return minimatch(dynamicOrigin || path, pattern)
          })
        })
        // 收集数据
        .forEach((path) => {
          let current = cache

          // 路径可能存在 rewrite
          const rewrite = rewrites.map[path]

          // 动态路由和原路由的层级肯定是一致的
          const dynamicRoute = routes.find(data => data.path === path)
          const dynamicOrigin = dynamicRoute?.route
          const dynamicOriginParts = dynamicOrigin?.split('/')

          // 遍历文章路径每一层
          const parts = path.split('/')
          parts.forEach((part, index) => {
            // 最后一层为 md 文件
            const isFile = index === parts.length - 1
            // 当前层级原始路径
            const itemPath = `/${(dynamicOriginParts || parts).slice(0, index + 1).join('/')}`
            // 查找缓存
            let item = current.find(data => data.name === part)

            // 没有缓存才获取数据
            if (!item) {
              item = {
                name: part,
                path: itemPath,
                depth: index,
              } as Item
              current.push(item)

              // 拼接系统路径
              const absolutePath = join(srcDir, item.path)

              // 读取时间戳信息
              promises.push(
                getTimestamp(absolutePath).then((times) => {
                  item!.timesInfo = times
                }),
              )

              // 文件数据
              if (isFile) {
                // 处理 rewrite 以及 index.md
                (item as FileInfo).link = `/${(rewrite || path).replace(/(index)?\.md$/, '')}`;
                // 动态路由存在 params 数据
                (item as FileInfo).params = dynamicRoute?.params || {}
                // 动态路由存储原始文件名
                if (dynamicOrigin)
                  (item as FileInfo).originName = basename(dynamicOrigin)
                // 读取 md 数据
                promises.push(
                  getMarkdownData(absolutePath, dynamicRoute?.params).then(({ h1, frontmatter }) => {
                    (item as FileInfo).h1 = h1;
                    (item as FileInfo).frontmatter = frontmatter
                  }),
                )
              }
              // 文件夹数据
              else {
                (item as FolderInfo).children = []
              }
            }

            current = (item as FolderInfo).children
          })
        })

      // 等待数据组装完成
      await Promise.allSettled(promises)
      // 数据排序
      deepSort(cache, comparer)
      // 数据缓存
      writeFile(join(cacheDir, CACHE_FILE), JSON.stringify(cache, null, 2))
      // 数据处理
      const sidebar = deepHandle(cache, sidebarItemHandler, rewrites, locales)
      const nav = deepHandle(cache, navItemHandler, rewrites, locales)
      // 修改配置
      handler(config, { sidebar, nav, rewrites, locales })
    },
  }
}
