/* eslint-disable unused-imports/no-unused-vars */
import type { Plugin, SiteConfig } from 'vitepress'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export default function (options: any): Plugin {
//   export let cache: Record<
//   string,
//   { options: ItemCacheOptions; frontmatter: Frontmatter }
// > = {};

  return {
    name: 'vitepress-auto',
    configureServer({ watcher, restart }) {
      // 新增文件时，如果自动保存，会在 add 事件后触发 change 事件
      // 删除目录时，每个子文件和子目录都会触发删除事件（顺序未知，似乎不固定）
      // 修改配置文件会触发 change 事件，并且刷新；刷新过程中增加的临时文件同样会触发 add 事件（但不会触发其他事件）
      // 非 srcDir 目录下，以及 .vitepress/cache 目录下的文件变化不会触发事件（被监听的文件引用的文件变化还是会触发事件）
      watcher.on('all', (eventName, path) => {
      })
    },
    // config 变更会自动刷新
    async config(config: any) {
      const {
        userConfig: {
          srcExclude,
          themeConfig: { nav } = {},
        } = {},
        srcDir,
        configPath,
        pages,
        cacheDir,
      } = config.vitepress as SiteConfig
      console.log('🚀 ~ config ~ pages:', pages)

      if (!existsSync(cacheDir))
        await mkdir(cacheDir)

      try {
        const cacheFile = join(cacheDir, 'auto-nav-cache.json')
        const cacheStr = await readFile(cacheFile, 'utf-8',

        )
      }
      catch { }
    },
  }
}
