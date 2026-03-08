import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DefaultTheme, SiteConfig } from 'vitepress'
import {
  AUTO_NAV_GENERATED_NAV_MARK,
  AUTO_NAV_GENERATED_SIDEBAR_MARK,
} from '../../src/core/merger'
import AutoNav from '../../src/index'

type WatchHandler = (eventName: string, path: string) => void

interface MockServer {
  config: {
    vitepress: SiteConfig<DefaultTheme.Config>
  }
  watcher: {
    on: (eventName: string, handler: WatchHandler) => void
  }
  ws: {
    send: ReturnType<typeof vi.fn>
  }
}

async function writeMarkdown(
  root: string,
  relativePath: string,
  content: string
) {
  const absolutePath = path.join(root, relativePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content, 'utf-8')
}

function createSiteConfig(root: string): SiteConfig<DefaultTheme.Config> {
  return {
    root,
    srcDir: root,
    cacheDir: path.join(root, '.vitepress/cache'),
    outDir: path.join(root, '.vitepress/dist'),
    pages: ['guide/index.md'],
    rewrites: { map: {}, inv: {} },
    dynamicRoutes: { routes: [] },
    configPath: path.join(root, '.vitepress/config.ts'),
    configDeps: [path.join(root, '.vitepress/config.theme.ts')],
    site: {
      base: '/',
      lang: 'zh-CN',
      title: 'test',
      description: '',
      head: [],
      customData: {},
      themeConfig: {
        nav: [{ text: 'Manual Root', link: '/manual-root/' }],
        sidebar: {
          '/manual-root/': [{ text: 'Manual Root', link: '/manual-root/' }],
        },
      },
      locales: {},
    } as unknown as SiteConfig<DefaultTheme.Config>['site'],
  } as SiteConfig<DefaultTheme.Config>
}

describe('plugin main flow', () => {
  const createdRoots: string[] = []

  afterEach(async () => {
    await Promise.all(
      createdRoots.map((root) => rm(root, { recursive: true, force: true }))
    )
    createdRoots.length = 0
  })

  it('configResolved 会清理自动生成标记并对 root / locale 结果去重', () => {
    const siteConfig = createSiteConfig('/repo/example')
    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>

    rootTheme.nav = [
      { text: 'Guide', link: '/guide/' },
      { text: 'Guide Duplicate', link: '/guide/' },
      { text: 'Manual Root', link: '/manual-root/' },
    ]
    rootTheme[AUTO_NAV_GENERATED_NAV_MARK] = true
    rootTheme.sidebar = {
      '/guide/': [
        { text: 'Guide', link: '/guide/' },
        { text: 'Guide Duplicate', link: '/guide/' },
        {
          text: 'Folder',
          items: [
            { text: 'Child', link: '/guide/child' },
            { text: 'Child Duplicate', link: '/guide/child' },
          ],
        },
        {
          text: 'Folder',
          items: [
            { text: 'Child', link: '/guide/child' },
            { text: 'Child Duplicate', link: '/guide/child' },
          ],
        },
      ],
    }
    rootTheme[AUTO_NAV_GENERATED_SIDEBAR_MARK] = true

    siteConfig.site.locales = {
      fr: {
        lang: 'fr-FR',
        label: 'Français',
        link: '/fr/',
        themeConfig: {
          nav: [
            { text: 'Guide FR', link: '/fr/guide/' },
            { text: 'Guide FR Duplicate', link: '/fr/guide/' },
          ],
          [AUTO_NAV_GENERATED_NAV_MARK]: true,
          sidebar: {
            '/fr/guide/': {
              base: '/fr/guide/',
              items: [
                { text: 'Guide FR', link: '/fr/guide/' },
                { text: 'Guide FR Duplicate', link: '/fr/guide/' },
                {
                  text: 'Folder FR',
                  items: [
                    { text: 'Deep', link: '/fr/guide/deep' },
                    { text: 'Deep Duplicate', link: '/fr/guide/deep' },
                  ],
                },
                {
                  text: 'Folder FR',
                  items: [
                    { text: 'Deep', link: '/fr/guide/deep' },
                    { text: 'Deep Duplicate', link: '/fr/guide/deep' },
                  ],
                },
              ],
            },
          },
          [AUTO_NAV_GENERATED_SIDEBAR_MARK]: true,
        },
      },
    } as unknown as SiteConfig<DefaultTheme.Config>['site']['locales']

    const plugin = AutoNav({
      dev: { logLevel: 'silent' },
    })

    plugin.configResolved?.({ vitepress: siteConfig } as never)

    expect(rootTheme).not.toHaveProperty(AUTO_NAV_GENERATED_NAV_MARK)
    expect(rootTheme).not.toHaveProperty(AUTO_NAV_GENERATED_SIDEBAR_MARK)
    expect(rootTheme.nav).toEqual([
      { text: 'Guide', link: '/guide/' },
      { text: 'Manual Root', link: '/manual-root/' },
    ])
    expect(rootTheme.sidebar).toEqual({
      '/guide/': [
        { text: 'Guide', link: '/guide/' },
        {
          text: 'Folder',
          link: undefined,
          collapsed: undefined,
          items: [{ text: 'Child', link: '/guide/child' }],
        },
      ],
    })

    const localeTheme = siteConfig.site.locales?.fr?.themeConfig as Record<
      string,
      unknown
    >
    expect(localeTheme).not.toHaveProperty(AUTO_NAV_GENERATED_NAV_MARK)
    expect(localeTheme).not.toHaveProperty(AUTO_NAV_GENERATED_SIDEBAR_MARK)
    expect(localeTheme.nav).toEqual([{ text: 'Guide FR', link: '/fr/guide/' }])
    expect(localeTheme.sidebar).toEqual({
      '/fr/guide/': {
        base: '/fr/guide/',
        items: [
          { text: 'Guide FR', link: '/fr/guide/' },
          {
            text: 'Folder FR',
            link: undefined,
            collapsed: undefined,
            items: [{ text: 'Deep', link: '/fr/guide/deep' }],
          },
        ],
      },
    })
  })

  it('AutoNav 会将归一化后的公开参数传给内部插件工厂', async () => {
    vi.resetModules()
    const createPluginMock = vi.fn(() => ({ name: 'mock-auto-nav' }))
    vi.doMock('../../src/core/plugin', () => ({
      default: createPluginMock,
    }))

    try {
      const { default: AutoNavWithMock } = await import('../../src/index')
      const userSorter = vi.fn(() => -99)
      const options = {
        include: ' guide/**/*.md ',
        exclude: ['drafts/**/*.md', ' drafts/**/*.md '],
        standaloneIndex: true,
        overrides: {
          './guide/index.md': {
            visible: false,
            displayName: ' Guide Index ',
            order: 2,
            collapsed: true,
          },
        },
        frontmatterKeyPrefix: 'nav',
        sorter: userSorter,
        preferArticleTitle: true,
        dev: {
          watchDebounceMs: 32,
          logLevel: 'debug' as const,
        },
      }

      const plugin = AutoNavWithMock(options)
      expect(plugin).toEqual({ name: 'mock-auto-nav' })
      expect(createPluginMock).toHaveBeenCalledTimes(1)

      const normalizedOptions = createPluginMock.mock.calls[0]?.[0] as {
        include?: string[]
        exclude?: string[]
        standaloneIndex: boolean
        overrides: Record<string, unknown>
        frontmatterKeyPrefix: string
        preferArticleTitle: boolean
        dev?: Record<string, unknown>
        sorter: (
          a: unknown,
          b: unknown,
          frontmatterKeyPrefix?: string
        ) => number
      }

      expect(normalizedOptions.include).toEqual(['guide/**/*.md'])
      expect(normalizedOptions.exclude).toEqual(['drafts/**/*.md'])
      expect(normalizedOptions.standaloneIndex).toBe(true)
      expect(normalizedOptions.overrides).toEqual({
        'guide/index': {
          visible: false,
          displayName: 'Guide Index',
          order: 2,
          preferArticleTitle: false,
          collapsed: true,
        },
      })
      expect(normalizedOptions.frontmatterKeyPrefix).toBe('nav')
      expect(normalizedOptions.preferArticleTitle).toBe(true)
      expect(normalizedOptions.dev).toEqual(options.dev)
      expect(normalizedOptions.sorter).not.toBe(userSorter)

      const itemA = { name: 'a', index: 1 }
      const itemB = { name: 'b', index: 2 }
      expect(normalizedOptions.sorter(itemA, itemB, 'nav')).toBe(-99)
      expect(userSorter).toHaveBeenCalledWith(itemA, itemB, 'nav')
    } finally {
      vi.doUnmock('../../src/core/plugin')
      vi.resetModules()
    }
  })

  it('configResolved 在缺失 vitepress 上下文时直接返回，并支持 root-only 标记清理', () => {
    const plugin = AutoNav({
      dev: { logLevel: 'silent' },
    })

    expect(() => plugin.configResolved?.({} as never)).not.toThrow()

    const siteConfig = createSiteConfig('/repo/example')
    siteConfig.site.locales =
      undefined as unknown as SiteConfig<DefaultTheme.Config>['site']['locales']
    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    rootTheme.nav = [
      { text: 'Guide', link: '/guide/' },
      { text: 'Guide Duplicate', link: '/guide/' },
    ]
    rootTheme.sidebar = {
      '/guide/': [
        { text: 'Guide', link: '/guide/' },
        { text: 'Guide Duplicate', link: '/guide/' },
      ],
    }
    rootTheme[AUTO_NAV_GENERATED_NAV_MARK] = true
    rootTheme[AUTO_NAV_GENERATED_SIDEBAR_MARK] = true

    plugin.configResolved?.({ vitepress: siteConfig } as never)

    expect(rootTheme.nav).toEqual([{ text: 'Guide', link: '/guide/' }])
    expect(rootTheme.sidebar).toEqual({
      '/guide/': [{ text: 'Guide', link: '/guide/' }],
    })
    expect(rootTheme).not.toHaveProperty(AUTO_NAV_GENERATED_NAV_MARK)
    expect(rootTheme).not.toHaveProperty(AUTO_NAV_GENERATED_SIDEBAR_MARK)
  })

  it('watch noop 分支不会调度任务', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-nav-watch-noop-'))
    createdRoots.push(root)

    await writeMarkdown(root, 'guide/index.md', '# Guide')
    const siteConfig = createSiteConfig(root)
    const plugin = AutoNav({
      include: ['guide/**/*.md'],
      dev: {
        watchDebounceMs: 0,
        logLevel: 'silent',
      },
    })

    await plugin.config?.({ vitepress: siteConfig })

    let allHandler: WatchHandler | undefined
    const wsSend = vi.fn()
    const server: MockServer = {
      config: { vitepress: siteConfig },
      watcher: {
        on(eventName, handler) {
          if (eventName === 'all') {
            allHandler = handler
          }
        },
      },
      ws: {
        send: wsSend,
      },
    }

    await plugin.configureServer?.(server as never)
    allHandler?.('change', path.join(root, 'assets/logo.png'))

    await vi.waitFor(
      () => {
        expect(wsSend).not.toHaveBeenCalled()
      },
      { timeout: 50 }
    )
  })

  it('configResolved 覆盖无标记 target、缺失 target 与非标准 generated 值分支', () => {
    const siteConfig = createSiteConfig('/repo/example')
    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>

    rootTheme.nav = { invalid: true }
    rootTheme.sidebar = 'invalid-sidebar'
    rootTheme[AUTO_NAV_GENERATED_NAV_MARK] = true
    rootTheme[AUTO_NAV_GENERATED_SIDEBAR_MARK] = true

    siteConfig.site.locales = {
      fr: {
        lang: 'fr-FR',
        label: 'Français',
        themeConfig: {},
      },
      ja: {
        lang: 'ja-JP',
        label: '日本語',
      },
      de: {
        lang: 'de-DE',
        label: 'Deutsch',
        themeConfig: {
          sidebar: {
            '/de/guide/': [{ text: 'Loose Group' }, { text: 'Loose Group' }],
          },
          [AUTO_NAV_GENERATED_SIDEBAR_MARK]: true,
        },
      },
    } as unknown as SiteConfig<DefaultTheme.Config>['site']['locales']

    const plugin = AutoNav({
      dev: { logLevel: 'silent' },
    })

    plugin.configResolved?.({ vitepress: siteConfig } as never)

    expect(rootTheme.nav).toEqual({ invalid: true })
    expect(rootTheme.sidebar).toBe('invalid-sidebar')
    expect(rootTheme).not.toHaveProperty(AUTO_NAV_GENERATED_NAV_MARK)
    expect(rootTheme).not.toHaveProperty(AUTO_NAV_GENERATED_SIDEBAR_MARK)

    const frTheme = siteConfig.site.locales?.fr?.themeConfig as Record<
      string,
      unknown
    >
    expect(frTheme).toEqual({})

    const deTheme = siteConfig.site.locales?.de?.themeConfig as Record<
      string,
      unknown
    >
    expect(deTheme).not.toHaveProperty(AUTO_NAV_GENERATED_SIDEBAR_MARK)
    expect(deTheme.sidebar).toEqual({
      '/de/guide/': [
        {
          text: 'Loose Group',
          link: undefined,
          collapsed: undefined,
          items: undefined,
        },
      ],
    })
  })

  it('watch 回调在运行时 vitepress 上下文丢失时直接返回', async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), 'auto-nav-watch-missing-runtime-')
    )
    createdRoots.push(root)

    await writeMarkdown(root, 'guide/index.md', '# Guide')
    const siteConfig = createSiteConfig(root)
    const plugin = AutoNav({
      include: ['guide/**/*.md'],
      dev: {
        watchDebounceMs: 0,
        logLevel: 'silent',
      },
    })

    await plugin.config?.({ vitepress: siteConfig })

    let allHandler: WatchHandler | undefined
    const wsSend = vi.fn()
    const server: MockServer = {
      config: { vitepress: siteConfig },
      watcher: {
        on(eventName, handler) {
          if (eventName === 'all') {
            allHandler = handler
          }
        },
      },
      ws: {
        send: wsSend,
      },
    }

    await plugin.configureServer?.(server as never)
    ;(server as unknown as { config: unknown }).config = {}
    allHandler?.('change', path.join(root, 'guide/index.md'))

    await vi.waitFor(
      () => {
        expect(wsSend).not.toHaveBeenCalled()
      },
      { timeout: 50 }
    )
  })

  it('覆盖 config + configureServer + watch add / unlink 链路', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-nav-main-flow-'))
    createdRoots.push(root)

    await writeMarkdown(root, 'guide/index.md', '# Guide')
    const siteConfig = createSiteConfig(root)
    const plugin = AutoNav({
      include: ['guide/**/*.md'],
      dev: {
        watchDebounceMs: 0,
        logLevel: 'silent',
      },
    })

    const viteConfig = { vitepress: siteConfig }
    await plugin.config?.(viteConfig)

    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    expect(rootTheme.nav).toEqual([
      { text: 'Manual Root', link: '/manual-root/' },
    ])
    expect(rootTheme.sidebar).toEqual({
      '/guide/': [],
    })

    let allHandler: WatchHandler | undefined
    const wsSend = vi.fn()
    const server: MockServer = {
      config: { vitepress: siteConfig },
      watcher: {
        on(eventName, handler) {
          if (eventName === 'all') {
            allHandler = handler
          }
        },
      },
      ws: {
        send: wsSend,
      },
    }

    await plugin.configureServer?.(server as never)
    expect(allHandler).toBeTypeOf('function')

    await writeMarkdown(root, 'guide/advanced.md', '# Advanced')
    siteConfig.pages.push('guide/advanced.md')
    allHandler?.('add', path.join(root, 'guide/advanced.md'))

    await vi.waitFor(() => {
      expect(wsSend).toHaveBeenCalledTimes(1)
      expect(wsSend).toHaveBeenCalledWith({ type: 'full-reload' })
    })

    expect(rootTheme.sidebar).toEqual({
      '/guide/': [{ text: 'advanced', link: '/guide/advanced' }],
    })

    await rm(path.join(root, 'guide/advanced.md'))
    siteConfig.pages = siteConfig.pages.filter(
      (page) => page !== 'guide/advanced.md'
    )
    allHandler?.('unlink', path.join(root, 'guide/advanced.md'))

    await vi.waitFor(() => {
      expect(wsSend).toHaveBeenCalledTimes(2)
    })

    expect(rootTheme.nav).toEqual([
      { text: 'Manual Root', link: '/manual-root/' },
    ])
    expect(rootTheme.sidebar).toEqual({
      '/guide/': [],
    })
  })

  it('删除最后一个自动生成 section 时会清理旧 sidebar 并触发 full-reload', async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), 'auto-nav-watch-cleanup-')
    )
    createdRoots.push(root)

    await writeMarkdown(root, 'guide/index.md', '# Guide')
    await writeMarkdown(root, 'guide/advanced.md', '# Advanced')

    const siteConfig = createSiteConfig(root)
    siteConfig.pages = ['guide/index.md', 'guide/advanced.md']
    const plugin = AutoNav({
      include: ['guide/**/*.md'],
      dev: {
        watchDebounceMs: 0,
        logLevel: 'silent',
      },
    })

    await plugin.config?.({ vitepress: siteConfig })

    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    expect(rootTheme.sidebar).toEqual({
      '/guide/': [{ text: 'advanced', link: '/guide/advanced' }],
    })

    let allHandler: WatchHandler | undefined
    const wsSend = vi.fn()
    const server: MockServer = {
      config: { vitepress: siteConfig },
      watcher: {
        on(eventName, handler) {
          if (eventName === 'all') {
            allHandler = handler
          }
        },
      },
      ws: {
        send: wsSend,
      },
    }

    await plugin.configureServer?.(server as never)

    await rm(path.join(root, 'guide/advanced.md'))
    siteConfig.pages = ['guide/index.md']
    allHandler?.('unlink', path.join(root, 'guide/advanced.md'))

    await vi.waitFor(() => {
      expect(wsSend).toHaveBeenCalledWith({ type: 'full-reload' })
    })

    expect(rootTheme.sidebar).toEqual({
      '/guide/': [],
    })
  })

  it('config 在缺失 vitepress 上下文时直接跳过', async () => {
    const plugin = AutoNav({
      dev: {
        logLevel: 'silent',
      },
    })
    const input = {}
    const result = await plugin.config?.(input)
    expect(result).toBe(input)
  })

  it('runtimeHash 稳定时跳过重算，变化时重新计算', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-nav-runtime-hash-'))
    createdRoots.push(root)

    await writeMarkdown(root, 'guide/index.md', '# Guide')
    const siteConfig = createSiteConfig(root)
    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    const plugin = AutoNav({
      include: ['guide/**/*.md'],
      dev: {
        logLevel: 'debug',
      },
    })

    const viteConfig = { vitepress: siteConfig }
    await plugin.config?.(viteConfig)

    log.mockClear()
    await plugin.config?.(viteConfig)
    expect(
      log.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('skip recompute due to hash')
      )
    ).toBe(true)

    log.mockClear()
    await writeMarkdown(root, 'guide/advanced.md', '# Advanced')
    siteConfig.pages.push('guide/advanced.md')
    await plugin.config?.(viteConfig)

    expect(
      log.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('skip recompute due to hash')
      )
    ).toBe(false)
    expect(rootTheme.sidebar).toEqual({
      '/guide/': [{ text: 'advanced', link: '/guide/advanced' }],
    })

    log.mockRestore()
  })

  it('watch 在 payloadHash 稳定时跳过 apply，变化时触发 full-reload', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-nav-watch-hash-'))
    createdRoots.push(root)

    await writeMarkdown(root, 'guide/index.md', '# Guide')
    const siteConfig = createSiteConfig(root)
    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    const plugin = AutoNav({
      include: ['guide/**/*.md'],
      dev: {
        watchDebounceMs: 0,
        logLevel: 'debug',
      },
    })

    await plugin.config?.({ vitepress: siteConfig })

    let allHandler: WatchHandler | undefined
    const wsSend = vi.fn()
    const server: MockServer = {
      config: { vitepress: siteConfig },
      watcher: {
        on(eventName, handler) {
          if (eventName === 'all') {
            allHandler = handler
          }
        },
      },
      ws: {
        send: wsSend,
      },
    }

    await plugin.configureServer?.(server as never)

    log.mockClear()
    allHandler?.('change', path.join(root, 'guide/index.md'))
    await vi.waitFor(() => {
      expect(
        log.mock.calls.some(
          ([message]) =>
            typeof message === 'string' &&
            message.includes('skip watch apply due to stable payload hash')
        )
      ).toBe(true)
    })
    expect(wsSend).not.toHaveBeenCalled()
    expect(rootTheme.sidebar).toEqual({
      '/guide/': [],
    })

    await writeMarkdown(root, 'guide/advanced.md', '# Advanced')
    siteConfig.pages.push('guide/advanced.md')
    allHandler?.('add', path.join(root, 'guide/advanced.md'))
    await vi.waitFor(() => {
      expect(wsSend).toHaveBeenCalledWith({ type: 'full-reload' })
    })

    expect(rootTheme.sidebar).toEqual({
      '/guide/': [{ text: 'advanced', link: '/guide/advanced' }],
    })

    log.mockRestore()
  })

  it("logLevel='info' 会输出 info 生命周期日志并抑制 debug 日志，watch 场景保持同级别行为", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), 'auto-nav-log-level-info-')
    )
    createdRoots.push(root)

    await writeMarkdown(root, 'guide/index.md', '# Guide')
    const siteConfig = createSiteConfig(root)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    const plugin = AutoNav({
      include: ['guide/**/*.md'],
      dev: {
        watchDebounceMs: 0,
        logLevel: 'info',
      },
    })

    await plugin.config?.({ vitepress: siteConfig })
    expect(
      log.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('🎈 auto-nav 生成中...')
      )
    ).toBe(true)
    expect(
      log.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('🎈 auto-nav 生成完成')
      )
    ).toBe(true)
    expect(
      log.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('skip write due to preserve: themeConfig.nav')
      )
    ).toBe(true)
    expect(
      log.mock.calls.some(
        ([message]) =>
          typeof message === 'string' && message.includes('route source:')
      )
    ).toBe(false)
    expect(
      log.mock.calls.some(
        ([message]) =>
          typeof message === 'string' && message.includes('watch add ->')
      )
    ).toBe(false)

    let allHandler: WatchHandler | undefined
    const wsSend = vi.fn()
    const server: MockServer = {
      config: { vitepress: siteConfig },
      watcher: {
        on(eventName, handler) {
          if (eventName === 'all') {
            allHandler = handler
          }
        },
      },
      ws: {
        send: wsSend,
      },
    }

    await plugin.configureServer?.(server as never)
    log.mockClear()

    await writeMarkdown(root, 'guide/advanced.md', '# Advanced')
    siteConfig.pages.push('guide/advanced.md')
    allHandler?.('add', path.join(root, 'guide/advanced.md'))

    await vi.waitFor(() => {
      expect(wsSend).toHaveBeenCalledWith({ type: 'full-reload' })
    })

    expect(
      log.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('skip write due to preserve: themeConfig.nav')
      )
    ).toBe(true)
    expect(
      log.mock.calls.some(
        ([message]) =>
          typeof message === 'string' && message.includes('route source:')
      )
    ).toBe(false)
    expect(
      log.mock.calls.some(
        ([message]) =>
          typeof message === 'string' && message.includes('watch add ->')
      )
    ).toBe(false)

    log.mockRestore()
  })

  it('存在 SUMMARY.md 时主流程仍只消费当前 page-driven 输入', async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), 'auto-nav-summary-ignore-')
    )
    createdRoots.push(root)

    await writeMarkdown(root, 'guide/index.md', '# Guide')
    await writeMarkdown(root, 'guide/intro.md', '# Intro')
    await writeMarkdown(
      root,
      'SUMMARY.md',
      '# Summary\n\n- [Fake Root](./fake-root.md)\n- [Ghost Guide](./ghost.md)\n'
    )

    const siteConfig = createSiteConfig(root)
    siteConfig.pages = ['guide/index.md', 'guide/intro.md', 'SUMMARY.md']
    const plugin = AutoNav({
      include: '**/*.md',
      dev: {
        logLevel: 'silent',
      },
    })

    await plugin.config?.({ vitepress: siteConfig })

    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    expect(rootTheme.nav).toEqual([
      { text: 'Manual Root', link: '/manual-root/' },
    ])
    expect(rootTheme.sidebar).toEqual({
      '/guide/': [{ text: 'intro', link: '/guide/intro' }],
    })
    expect(
      Object.keys(rootTheme.sidebar as Record<string, unknown>)
    ).not.toContain('/summary/')
  })
  it('未传 dev 时使用默认日志级别并可完成 config 链路', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-nav-default-dev-'))
    createdRoots.push(root)
    await writeMarkdown(root, 'guide/index.md', '# Guide')
    const siteConfig = createSiteConfig(root)
    const plugin = AutoNav()
    const config = { vitepress: siteConfig }
    await plugin.config?.(config)
    const rootTheme = siteConfig.site.themeConfig as Record<string, unknown>
    expect(rootTheme.sidebar).toEqual({
      '/guide/': [],
    })
  })

  it('configureServer 在缺失 vitepress 上下文时直接返回', async () => {
    const plugin = AutoNav({
      dev: { logLevel: 'silent' },
    })
    const server = {
      config: {},
      watcher: {
        on: vi.fn(),
      },
      ws: {
        send: vi.fn(),
      },
    }

    await plugin.configureServer?.(server as never)
    expect(server.watcher.on).not.toHaveBeenCalled()
  })
})
