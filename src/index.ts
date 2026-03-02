import { normalize } from 'path'
import { existsSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import glob from 'fast-glob'
import matter from 'gray-matter'
import parseSummary from './parseSummary'
import { throttle, forceReload, updateCommitTimes } from './utils'
import {
  generateNav,
  generateSidebar,
  getArticleTitle,
  serializationPaths,
  sortStructuredData,
} from './parseArticle'

import type { Plugin } from 'vite'
import type {
  Frontmatter,
  ItemCacheOptions,
  Options,
  UserConfig,
} from '../types'

// 缓存数据，减少读取 git 时间戳和读取文件内容的次数
export let cache: Record<
  string,
  { options: ItemCacheOptions; frontmatter: Frontmatter }
> = {}

// 记录访问过的缓存，用于删除不再需要的缓存
export const visitedCache = new Set<string>()

export default function AutoNav(options: Options = {}): Plugin {
  return {
    name: 'vite-plugin-vitepress-auto-nav',
    // md 文件增删或配置修改时，通过触发配置文件修改操作，实现刷新
    async configureServer({ config, watcher }) {
      const {
        vitepress: { configPath },
      } = config as unknown as UserConfig

      // 从config中获取配置文件路径
      const $configPath =
        configPath?.match(/(\.vitepress.*)/)?.[1] || '.vitepress/config.ts'

      // VitePress 中已经添加了对所有 md 文件的监听，这里只需要处理事件
      // 添加 1500ms 的节流，避免同时保存多个文件时重复触发刷新
      const throttleMdWatcher = throttle(
        mdWatcher.bind(null, $configPath),
        1500
      )
      watcher.on('all', (eventName, path) => {
        // 存在 summary 配置时，summaryFile 文件变动即刷新
        if (
          options.summary?.target &&
          normalize(path) === normalize(options.summary.target)
        ) {
          forceReload($configPath)
        } else {
          throttleMdWatcher(eventName, path)
        }
      })
    },
    async config(config) {
      const {
        vitepress: {
          userConfig: { srcExclude = [], srcDir = './' },
          site: {
            themeConfig: { nav },
          },
          cacheDir,
        },
      } = config as unknown as UserConfig

      if (options.summary) {
        console.log('🎈 SUMMARY 解析中...')
        const { sidebar, nav: _nav } = await parseSummary(options.summary)
        ;(config as unknown as UserConfig).vitepress.site.themeConfig.sidebar =
          sidebar
        if (!nav) {
          ;(config as unknown as UserConfig).vitepress.site.themeConfig.nav =
            _nav
        }
        console.log('🎈 SUMMARY 解析完成...')
        return config
      }

      console.log('🎈 auto-nav 生成中...')
      // 清空访问过的缓存
      visitedCache.clear()
      // 缓存目录若不存在，先创建
      if (!existsSync(cacheDir)) {
        await mkdir(cacheDir)
      }
      // 获取缓存
      try {
        const cacheStr = await readFile(`${cacheDir}/auto-nav-cache.json`, {
          encoding: 'utf-8',
        })
        cache = JSON.parse(cacheStr) || {}
      } catch {
        // 缓存文件不存在或解析失败
      }

      // 支持手动传入匹配模式或匹配全部
      const pattern = options.pattern || '**.md'

      // 读取需要的md文件
      const paths = (
        await glob(pattern, {
          cwd: srcDir,
          ignore: [
            '**/node_modules/**',
            '**/dist/**',
            'index.md',
            ...srcExclude,
          ],
        })
      ).map((path) => normalize(path))

      // 处理文件路径数组为多级结构化数据
      let data = await serializationPaths(paths, options, srcDir)

      // 处理文件夹 git 时间戳
      updateCommitTimes(data)

      // 数据排序
      data = sortStructuredData(data, options.compareFn)

      // vitepress 中没有配置 nav 时自动生成。因为 nav 数据项较少，可以用手动配置代替在插件中处理
      if (!nav) {
        ;(config as unknown as UserConfig).vitepress.site.themeConfig.nav =
          generateNav(data)
      }

      // 生成侧边栏目录
      const sidebar = generateSidebar(data, options)
      ;(config as unknown as UserConfig).vitepress.site.themeConfig.sidebar =
        sidebar

      // 删除不再需要的缓存后，写入缓存到本地 vitepress cache 目录
      for (const key in cache) {
        if (!visitedCache.has(key)) {
          delete cache[key]
        }
      }
      writeFile(`${cacheDir}/auto-nav-cache.json`, JSON.stringify(cache))

      console.log('🎈 auto-nav 生成完成')
      return config
    },
  }
}

/** 文件变动事件 */
async function mdWatcher(
  configPath: string,
  event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir',
  path: string
) {
  // 过滤非 md 文件操作
  if (!path.endsWith('.md')) return

  // 检查关键 frontmatter 信息是否修改
  if (event === 'change' && cache[path]) {
    // 有缓存时对比数据
    const file = await readFile(path, {
      encoding: 'utf-8',
    })
    const { content, data } = matter(file)
    data.h1 = getArticleTitle(content, data)
    // 数据项数量不一致，需要刷新
    if (
      Object.keys(data).length !== Object.keys(cache[path].frontmatter).length
    ) {
      forceReload(configPath)
      return
    }
    // 数据线数量一致，需要对比数据是否变动
    for (const key in data) {
      if (cache[path].frontmatter[key] !== data[key]) {
        forceReload(configPath)
        return
      }
    }
  } else {
    forceReload(configPath)
  }
}
