/* eslint-disable unused-imports/no-unused-vars */
import type { Plugin, SiteConfig } from 'vitepress'
import type { FileInfo, FolderInfo, Options } from './types.js'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { minimatch } from 'minimatch'
import { deepSrot, defaultComparer, getArticleData, getTimestamp } from './utils.js'

/**
 * vitepress 自动生成 sidebar 与 nav 配置的插件
 *
 * vitepress config 中存在 nav 配置时，插件将视为用户需要自定义 nav 配置；
 * 如果需要插件自动生成 nav 配置，请先注释掉自定义 nav。
 */
export default function ({
  exclude = [],
  // navItemHandler = defaultNavItemHandler,
  // sidebarItemHandler = defaultSidebarItemHandler,
  comparer = defaultComparer,
  handler,
  summary,
}: Options = {}): Plugin {
  let infoCache: (FileInfo | FolderInfo)[] = []

  return {
    name: 'vitepress-auto',
    configureServer({ watcher, restart }) {
      // 新增文件时，如果自动保存，会在 add 事件后触发 change 事件
      // 删除文件夹时，每个子文件和子文件夹都会触发删除事件（顺序未知，似乎不固定）
      // 修改配置文件会触发 change 事件，并且刷新；刷新过程中增加的临时文件同样会触发 add 事件（但不会触发其他事件）
      // 非 srcDir 文件夹下，以及 .vitepress/cache 文件夹下的文件变化不会触发事件（被监听的文件引用的文件变化还是会触发事件）
      watcher.on('all', (eventName, path) => {
      })
    },
    // config 变更会自动刷新
    async config(config: any) {
      const {
        userConfig: {
          themeConfig: { nav } = {},
        } = {},
        srcDir, // 系统绝对路径
        pages, // 基于 srcDir 配置的路径数组，例如 a.md、b/c.md
        cacheDir,
      } = config.vitepress as SiteConfig

      // 首次尝试从本地读取缓存，后续刷新直接使用读取到的缓存
      if (!Object.keys(infoCache).length) {
        // 确保缓存目录存在，避免后续报错
        if (!existsSync(cacheDir))
          await mkdir(cacheDir)

        try {
          const cacheFile = join(cacheDir, 'auto-nav-cache.json')
          const cacheStr = await readFile(cacheFile, 'utf-8')
          infoCache = JSON.parse(cacheStr)
        }
        catch { }
      }

      const promises: Promise<any>[] = []

      // 遍历文章
      pages
        .filter((path) => {
          return !exclude.some(pattern => minimatch(path, pattern))
        })
        .forEach((path) => {
          let current = infoCache

          // 遍历文章路径每一层
          const parts = path.split('/')
          parts.forEach((part, index) => {
            const isFile = index === parts.length - 1
            const name = isFile ? part.replace(/\.md$/, '') : part
            const path = `/${parts.slice(0, index + 1).join('/')}`
            let item = current.find(data => data.path === path)

            // 没有缓存才获取数据
            if (!item) {
              item = {
                name,
                path: isFile ? path.replace(/\.md$/, '') : path,
                depth: index,
              } as FileInfo | FolderInfo
              current.push(item)

              const absolutePath = join(srcDir, path)
              const e = getTimestamp(absolutePath).then((times) => {
                item!.timesInfo = times
              })
              promises.push(e)

              if (isFile) {
                const e = getArticleData(absolutePath).then(({ h1, frontmatter }) => {
                  (item as FileInfo).h1 = h1;
                  (item as FileInfo).frontmatter = frontmatter
                })
                promises.push(e)
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
      // 数据排序
      deepSrot(infoCache, comparer)

      let sidebar: any[]
      // writeFile(join('./test.json'), JSON.stringify(infoCache, null, 2))
    },
  }
}
