import type { Plugin, SiteConfig } from 'vitepress'
import type { FileInfo, Item, Options } from './types'
import { existsSync } from 'node:fs'
import { mkdir, readFile, utimes, writeFile } from 'node:fs/promises'
import { basename, join, normalize, sep } from 'node:path'
import { defaultComparer } from './comparer'
import { defaultNavHandler, defaultNavItemHandler, defaultSidebarHandler, defaultSidebarItemHandler } from './handler'
import { assertFile, assertFolder, compactCache, debounce, deepHandle, deepSort, getFolderLink, getMarkdownData, getTimestamp, hasLocalSearch } from './utils'

// 导出工具方法
export {
  assertFile,
  assertFolder,
  defaultComparer,
  defaultNavHandler,
  defaultNavItemHandler,
  defaultSidebarHandler,
  defaultSidebarItemHandler,
  getFolderLink,
}

// 导出类型
export type * from './types'

/**
 * vitepress 自动生成导航栏和侧边栏的插件
 */
export function autoNav({
  navItemHandler = defaultNavItemHandler(),
  sidebarItemHandler = defaultSidebarItemHandler(),
  comparer = defaultComparer(),
  sidebarHandler = defaultSidebarHandler(),
  navHandler = defaultNavHandler(),
}: Options = {}): Plugin {
  // 参数校验
  Object.entries({
    navItemHandler,
    sidebarItemHandler,
    defaultComparer,
    sidebarHandler,
    navHandler,
  }).forEach(([key, value]) => {
    if (typeof value !== 'function')
      throw new TypeError(`${key} 必须是一个函数`)
  })

  /** 缓存数据 */
  let cache: Item[] = []
  /** srcDir 路径 */
  let baseDir: string
  /** vitepress 配置文件夹路径 */
  let configDir: string
  /** vitepress 配置文件路径 */
  let configPath: string
  /** 缓存文件名 */
  const CACHE_FILE = 'auto-nav-cache.json'
  /**
   * 是否使用了本地搜索插件
   * 目前使用了本地搜索插件会导致 restart 报错（https://github.com/vuejs/vitepress/issues/4688）
   */
  let hasLocalSearchPlugin = false

  return {
    name: 'vite-plugin-vitepress-auto-nav',
    configureServer({ watcher, restart }) {
      // 刷新添加防抖，避免批量操作时频繁触发刷新
      const debouncedRestart = debounce(() => {
        if (!hasLocalSearchPlugin)
          restart()
        else
          // 通过修改配置文件触发强制刷新
          utimes(configPath, new Date(), new Date())
      }, 1500)

      // 非 srcDir 文件夹下的内容不会被监听（但是被监听文件引用的外部文件会被监听）
      // .vitepress 文件夹在 srcDir 文件夹内时，会被监听，反之不会（.vitepress/cache 文件夹始终不会被监听）
      // 修改配置文件会触发整体刷新（插件函数会重新运行）；如果配置文件在 srcDir 文件夹内，还会触发 change 事件；刷新过程中 .vitepress 目录下还可能会有新增临时文件触发 add 事件（但没有删除、修改等事件）
      // 新增文件时，如果有自动保存，会在 add 事件后触发 change 事件
      // 删除文件夹时，每个子文件和子文件夹都会触发删除事件（顺序不固定）
      watcher.on('all', async (eventName, path) => {
        path = normalize(path)

        const dynamicLoaderRe = /\.paths\.m?[jt]s$/

        if (
          !baseDir
          || !configDir
          // 忽略新增目录，在新增文件时再处理
          || eventName === 'addDir'
          // 忽略配置目录下的文件监听
          || path.startsWith(configDir)
          // 忽略非 srcDir 目录下的文件监听
          || !path.startsWith(baseDir)
          // 仅监听 md 文件与路径加载器文件
          // 路径加载器引用了外部文件的情况未考虑
          || !(path.endsWith('.md') || dynamicLoaderRe.test(path))
        ) {
          return
        }

        // md 文件修改同步操作缓存，减少计算量
        if (path.endsWith('.md') && eventName === 'change') {
          // 存储当前级别对象，可以直接操作
          let current = cache

          // 按路径级别操作每一级缓存数据
          const parts = path.replace(`${baseDir}${sep}`, '').split(sep)
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]

            // 查找是否有缓存
            // 同名文件、文件夹可以通过扩展名区分；动态路由文件可能有多个，通过 originName 匹配数据
            const searchedIndexes = current.reduce<number[]>((p, c, i) => {
              if ((c as FileInfo).originName || c.name === part)
                p.push(i)
              return p
            }, [])
            if (!searchedIndexes.length)
              return

            searchedIndexes.forEach(async (searchedIndex) => {
              // 更新缓存中的 localModifyTime
              current[searchedIndex].timesInfo.localModifyTime = Date.now()

              // 路径最后一层为 md 文件
              if (partsAssertFile(i, parts, current[searchedIndex])) {
                const { frontmatter, h1 } = current[searchedIndex]
                const newData = await getMarkdownData(path)

                // frontmatter 未变更时，忽略
                if (JSON.stringify({ frontmatter, h1 }) !== JSON.stringify(newData)) {
                  current[searchedIndex].frontmatter = newData.frontmatter
                  current[searchedIndex].h1 = newData.h1
                }
              }
              // 其他层均为文件夹
              else {
                current = current[searchedIndex].children
              }
            })
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
        configPath: cp, // D:/vite-plugin-vitepress-auto-nav/example/.vitepress/config.ts
        pages, // ['a.md', 'b/c.md']，包括动态路由，未处理 rewrites
        rewrites, // { map: { 'x/origin.md': 'x/rewrite.md' }, inv: { 'x/rewrite.md': 'x/origin.md' } }
        dynamicRoutes: { routes }, // [{ path: 'a/b.md', fullPath: 'D:/a/b.md', route: 'a/[name].md', params: { name: 'b' } }]
        userConfig,
      } = config.vitepress as SiteConfig

      const { locales } = userConfig // { root: { label: '简体中文' }, en: { label: 'English' } }，同用户设置

      // 记录关键配置并标准化路径
      baseDir = normalize(srcDir)
      configDir = join(root, '.vitepress')
      cacheDir = normalize(cacheDir)
      configPath = normalize(cp!) // 使用了本插件则肯定存在配置文件
      hasLocalSearchPlugin = hasLocalSearch(userConfig)

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
              if (partsAssertFile(index, parts, item)) {
                // 处理 rewrite 以及 index.md
                item.link = `/${(rewrite || path).replace(/\.md$/, '')}`
                // 动态路由存在 params 数据
                item.params = dynamicRoute?.params || {}
                // 动态路由存储原始文件名
                if (dynamicOrigin)
                  item.originName = basename(dynamicOrigin)
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
                item.children = []
              }
            }

            if (assertFolder(item))
              current = item.children
          })
        })

      // 等待数据组装完成
      await Promise.allSettled(promises)
      // 数据排序
      deepSort(cache, comparer)
      // 数据缓存
      writeFile(join(cacheDir, CACHE_FILE), JSON.stringify({ cache, rewrites }))
      // 数据处理
      const sidebar = deepHandle(cache, sidebarItemHandler, rewrites, locales)
      const nav = deepHandle(cache, navItemHandler, rewrites, locales)
      // 修改配置
      sidebarHandler(config, sidebar, { locales, rewrites })
      navHandler(config, nav, { locales, rewrites })
    },
  }
}

// 只有路径最后一层才是文件
function partsAssertFile(index: number, parts: string[], item: Item): item is FileInfo {
  return index === parts.length - 1
}
