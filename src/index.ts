/* eslint-disable unused-imports/no-unused-vars */
import type { Plugin, SiteConfig } from 'vitepress'
import type { ItemInfo, Options } from './types.js'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export default function (options: Options): Plugin {
  let cache: Record<string, ItemInfo> = {}

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
        configPath, // 系统绝对路径
        pages, // 基于 srcDir 配置的路径数组，例如 a.md、b/c.md
        cacheDir,
      } = config.vitepress as SiteConfig

      // 首次尝试从本地读取缓存，后续刷新直接使用读取到的缓存
      if (!Object.keys(cache).length) {
        // 确保缓存目录存在，避免报错
        if (!existsSync(cacheDir))
          await mkdir(cacheDir)

        try {
          const cacheFile = join(cacheDir, 'auto-nav-cache.json')
          const cacheStr = await readFile(cacheFile, 'utf-8')
          cache = JSON.parse(cacheStr)
        }
        catch { }
      }

      // 遍历获取文章及目录元数据
      pages.forEach((path) => {
        // 拼接为绝对路径
        path = join(srcDir, path)
      })
    },
  }
}
