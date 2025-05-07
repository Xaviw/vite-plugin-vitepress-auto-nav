import type { Plugin, SiteConfig } from 'vitepress'

export default function (options: any): Plugin {
  console.log('options:', options)
  return {
    name: 'vitepress-auto',
    configureServer({ watcher }) {
      // 新增文件时，如果自动保存，会触发 change 事件
      // 删除目录时，同时会触发 unlink 事件
      // 修改配置文件会触发 change 事件，并且刷新；刷新过程中增加的临时文件会触发 add 事件
      // 非 srcDir 目录下，以及 .vitepress/cache 目录下的文件变化不会触发事件（被监听的文件引用的文件变化还是会触发事件）

      watcher.on('change', (path) => {
        console.log('文件变化:', path)
      })

      watcher.on('add', (path) => {
        console.log('新增文件:', path)
      })

      watcher.on('unlink', (path) => {
        console.log('删除文件:', path)
      })

      watcher.on('addDir', (path) => {
        console.log('新增目录:', path)
      })

      watcher.on('unlinkDir', (path) => {
        console.log('删除目录:', path)
      })
    },
    // config 变更会自动刷新
    config(config: any) {
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
      console.log(srcExclude, nav, srcDir, configPath, pages, cacheDir)
    },
  }
}
