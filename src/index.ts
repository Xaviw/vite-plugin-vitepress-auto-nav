import type { Plugin, SiteConfig } from 'vitepress'
import type { FileInfo, FolderInfo, Item, Options } from './types.js'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { minimatch } from 'minimatch'
import { debounce, deepHandle, deepSrot, defaultComparer, defaultHandler, defaultNavItemHandler, defaultSidebarItemHandler, getArticleData, getTimestamp } from './utils.js'

/**
 * vitepress 自动生成 sidebar 与 nav 配置
 */
export default function ({
  exclude = [],
  navItemHandler = defaultNavItemHandler,
  sidebarItemHandler = defaultSidebarItemHandler,
  comparer = defaultComparer,
  handler = defaultHandler,
  // summary,
}: Options = {}): Plugin {
  let cache: Item[] = []
  let baseDir: string
  let configDir: string

  return {
    name: 'vite-plugin-vitepress-auto-nav',
    configureServer({ watcher, restart }) {
      // 新增文件时，如果自动保存，会在 add 事件后触发 change 事件
      // 删除文件夹时，每个子文件和子文件夹都会触发删除事件（顺序未知，似乎不固定）
      // 修改配置文件会触发 change 事件，并且刷新；刷新过程中增加的临时文件同样会触发 add 事件（但不会触发其他事件）
      // 非 srcDir 文件夹下，以及 .vitepress/cache 文件夹下的文件变化不会触发事件（被监听的文件引用的文件变化还是会触发事件）
      const debouncedRestart = debounce(restart, 1500)
      watcher.on('all', async (eventName, path) => {
        if (
          !baseDir
          || !configDir
          || eventName === 'addDir' // 忽略新增目录，在新增文件时再处理
          || minimatch(path, `${configDir}/**/*`) // 忽略配置目录下的文件监听
          || !minimatch(path, `${baseDir}/**/*`) // 忽略非 srcDir 目录下的文件监听
        ) {
          return
        }

        // 修改和删除操作需要同步操作缓存
        if (['change', 'unlink', 'unlinkDir'].includes(eventName)) {
          let current = cache
          const parts = path
            .replace(/\\/g, '/')
            .replace(`${baseDir}/`, '')
            .replace(/\.md$/, '')
            .split('/')

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            const targetIndex = current.findIndex(data => data.name === part)
            if (targetIndex < 0)
              return

            if (i === parts.length - 1) {
              // 删除
              if (['unlink', 'unlinkDir'].includes(eventName)) {
                current.splice(targetIndex, 1)
              }
              // 修改事件检查 frontmatter 是否变更
              else {
                const { frontmatter, h1 } = current[targetIndex] as FileInfo
                const newData = await getArticleData(path)
                // frontmatter 未变更时，忽略
                if (JSON.stringify({ frontmatter, h1 }) === JSON.stringify(newData))
                  return
                // 否则更新缓存数据
                (current[targetIndex] as FileInfo).frontmatter = newData.frontmatter;
                (current[targetIndex] as FileInfo).h1 = newData.h1
              }
            }
            else {
              current = (current[targetIndex] as FolderInfo).children
            }
          }
        }

        // 使用防抖，避免多次刷新
        debouncedRestart()
      })
    },
    // config 变更会自动刷新
    async config(config: any) {
      const {
        srcDir, // 系统绝对路径
        pages, // 基于 srcDir 配置的路径数组，例如 a.md、b/c.md
        cacheDir,
        root,
      } = config.vitepress as SiteConfig
      baseDir = srcDir.replace(/\\/g, '/')
      configDir = `${root.replace(/\\/g, '/')}/.vitepress`

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

      const promises: Promise<any>[] = []

      // 遍历文章
      pages
        .filter((path) => {
          return !exclude.some(pattern => minimatch(path, pattern))
        })
        .forEach((path) => {
          let current = cache

          // 遍历文章路径每一层
          const parts = path.split('/')
          parts.forEach((part, index) => {
            const isFile = index === parts.length - 1
            const name = isFile ? part.replace(/\.md$/, '') : part
            const itemPath = `/${parts.slice(0, index + 1).join('/')}`
            let item = current.find(data => data.path === itemPath.replace(/\.md$/, ''))

            // 没有缓存才获取数据
            if (!item) {
              item = {
                name,
                path: isFile ? itemPath.replace(/\.md$/, '') : itemPath,
                depth: index,
              } as Item
              current.push(item)

              const absolutePath = join(srcDir, itemPath)
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
      // 数据缓存
      writeFile(join(cacheDir, 'auto-nav-cache.json'), JSON.stringify(cache, null, 2))
      // 数据排序
      deepSrot(cache, comparer)
      // 数据处理
      const sidebars = deepHandle(cache, sidebarItemHandler)
      const navies = deepHandle(cache, navItemHandler)
      // 修改配置
      handler(config, { sidebar: sidebars, nav: navies })
    },
  }
}
