import { sep, normalize, join } from 'node:path'
import glob from 'fast-glob'
import fs from 'fs-extra'
import type { ResolvedConfig, ViteDevServer, Plugin, UserConfig } from 'vite'
import type { DefaultTheme, SiteConfig } from 'vitepress'

interface FileInfo {
  name: string
  isFolder: boolean
  createTime: number
  updateTime: number
  hide?: boolean
  sort?: number
  title?: string
  collapsed?: boolean
  children: FileInfo[]
}

interface PluginSettings {
  [key: string]: Pick<FileInfo, 'hide' | 'sort' | 'title'> & { collapsed?: boolean }
}

interface Options {
  pattern?: string | string[]
  settings?: PluginSettings
  compareFn?: (a: FileInfo, b: FileInfo) => number
}

export type { FileInfo, PluginSettings, Plugin }

export default function (options: Options = {}): Plugin {
  return {
    name: 'vite-plugin-vitepress-auto-nav',
    // md 文件增删时，通过触发配置文件修改操作，实现热更新功能
    configureServer({ config, watcher }: ViteDevServer) {
      const {
        vitepress: { configPath },
      } = config as ResolvedConfig & { vitepress: SiteConfig }

      // 从config中获取配置文件路径
      const $configPath = configPath?.match(/(\.vitepress.*)/)?.[1] || '.vitepress/config.ts'

      watcher.on('all', (event, path) => {
        // 开发服务器默认监听了所有文件，过滤掉 change 事件和非 md 文件操作
        if (event === 'change' || !path.endsWith('.md')) return
        fs.utimesSync($configPath, new Date(), new Date())
      })
    },
    async config(config) {
      const _config = config as UserConfig & { vitepress: SiteConfig }

      // 从vitepress配置中获取文档根路径与要排除的文档
      const {
        vitepress: {
          userConfig: { srcExclude = [], srcDir = './' },
          site: {
            themeConfig: { nav },
          },
        },
      } = _config

      // 支持手动传入匹配模式或匹配全部
      const pattern = options.pattern || '**/*.md'

      // 读取需要的md文件
      const paths = (
        await glob(pattern, {
          cwd: srcDir,
          ignore: ['**/node_modules/**', '**/dist/**', 'index.md', ...srcExclude],
        })
      )
        .map((path) => normalize(path))
        .sort()

      // 处理文件路径数组为多级结构化数据
      const data = serializationPaths(paths, options, srcDir)

      // 数据排序
      sortStructuredData(data, options.compareFn)

      // vitepress 中没有配置 nav 时自动生成
      // 因为 nav 数据项较少，可以用手动配置代替在插件中设置
      if (!nav) {
        _config.vitepress.site.themeConfig.nav = generateNav(data)
      }

      // 生成侧边栏目录
      const sidebar = generateSidebar(data)
      _config.vitepress.site.themeConfig.sidebar = sidebar

      return _config
    },
  }
}

/**
 * 处理文件路径字符串数组
 */
function serializationPaths(paths: string[], { settings = {} }: Options = {}, srcDir: string) {
  // 统一路径格式，便于匹配
  for (const key in settings) {
    settings[join(srcDir, key)] = settings[key]
  }

  const pathKeys = Object.keys(settings)

  const root: FileInfo[] = []

  for (const path of paths) {
    // 获取路径中的每一级名称
    const pathParts = join(srcDir, path).split(sep)

    let currentNode = root
    let currentPath = ''

    for (const name of pathParts) {
      currentPath = join(currentPath, name)

      // 获取时间戳
      const { birthtimeMs: createTime, ctimeMs: updateTime } = fs.statSync(currentPath)

      // 简单判断是否是文件
      const isFolder = !name.includes('.')

      // 查找是否有自定义配置
      // 先按路径匹配
      let customInfoKey = pathKeys.find((p) => currentPath === p)
      // 再按文件名匹配（仅传入文件、文件夹名时）
      if (!customInfoKey) {
        customInfoKey = pathKeys.find((p) => name === p || name.replace('.md', '') === p)
      }
      const customInfo = customInfoKey ? settings[customInfoKey] : {}

      // 跳过不展示的部分
      if (customInfo.hide) break

      let childNode = currentNode.find((node) => node.name === name)

      if (!childNode) {
        childNode = { ...customInfo, name, isFolder, createTime, updateTime, children: [] }
        currentNode.push(childNode)
      }

      currentNode = childNode.children
    }
  }
  return root
}

/**
 * 对结构化后的多级数组数据进行逐级排序
 * 优先按 sort 排序，其次时间戳排序，navSort 始终优先于时间戳
 */
function sortStructuredData(data: FileInfo[], compareFn?: (a: FileInfo, b: FileInfo) => number): FileInfo[] {
  if (typeof compareFn !== 'function') {
    compareFn = (a, b) => {
      if (a.sort !== undefined && b.sort !== undefined) {
        return b.sort - a.sort
      } else if (a.sort !== undefined) {
        return -1
      } else if (b.sort !== undefined) {
        return 1
      } else {
        return a.createTime - b.createTime
      }
    }
  }
  return data.sort(compareFn).map((item) => {
    if (item.children && item.children.length > 0) {
      item.children = sortStructuredData(item.children, compareFn)
    }
    return item
  })
}

/**
 * 生成 nav 数据
 */
function generateNav(structuredData: FileInfo[]) {
  return structuredData.map((item) => ({
    text: item.title || item.name,
    activeMatch: `/${item.name}/`,
    link: getFirstArticleFromFolder(item),
  }))
}

/**
 * 获取首层目录中第一篇文章
 */
function getFirstArticleFromFolder(data: FileInfo, path = '') {
  path += `/${data.name}`
  if (data.children.length > 0) {
    return getFirstArticleFromFolder(data.children[0], path)
  } else {
    return path
  }
}

/**
 * 生成 sidebar
 */
function generateSidebar(structuredData: FileInfo[]): DefaultTheme.Sidebar {
  const sidebar: DefaultTheme.Sidebar = {}

  for (const { name, children } of structuredData) {
    sidebar[`/${name}/`] = traverseSubFile(children, `/${name}`)
  }

  function traverseSubFile(subData: FileInfo[], parentPath: string): DefaultTheme.SidebarItem[] {
    return subData.map((file) => {
      const filePath = `${parentPath}/${file.name}`
      const fileName = file.title || file.name.replace('.md', '')
      if (file.isFolder) {
        return {
          text: fileName,
          collapsed: file.collapsed ?? false,
          items: traverseSubFile(file.children, filePath),
        }
      } else {
        return { text: fileName, link: filePath.replace('.md', '') }
      }
    })
  }

  return sidebar
}
