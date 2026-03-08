import { describe, expect, it, vi } from 'vitest'
import type { DefaultTheme, SiteConfig } from 'vitepress'
import {
  createDebouncedWatchRunner,
  createWatchFileSet,
  resolveWatchDecision,
} from '../../src/core/watcher'

function createSiteConfig(): SiteConfig<DefaultTheme.Config> {
  return {
    root: '/repo/example',
    srcDir: '/repo/example',
    cacheDir: '/repo/example/.vitepress/cache',
    outDir: '/repo/example/.vitepress/dist',
    pages: [],
    rewrites: { map: {}, inv: {} },
    dynamicRoutes: { routes: [] },
    configPath: '/repo/example/.vitepress/config.ts',
    configDeps: ['/repo/example/.vitepress/config.theme.ts'],
    site: {
      base: '/',
      lang: 'zh-CN',
      title: 'test',
      description: '',
      head: [],
      customData: {},
      themeConfig: {},
      locales: {},
    } as unknown as SiteConfig<DefaultTheme.Config>['site'],
  } as SiteConfig<DefaultTheme.Config>
}

describe('watcher', () => {
  it('忽略不支持的事件类型', () => {
    const watchFileSet = createWatchFileSet(createSiteConfig())
    const decision = resolveWatchDecision(
      'ready',
      '/repo/example/guide/index.md',
      watchFileSet
    )

    expect(decision.shouldHandle).toBe(false)
  })

  it('ignores vitepress timestamp noise updates', () => {
    const watchFileSet = createWatchFileSet(createSiteConfig())
    const decision = resolveWatchDecision(
      'change',
      '/repo/example/.vitepress/config.ts.timestamp-1700000000000.mjs',
      watchFileSet
    )

    expect(decision.shouldHandle).toBe(false)
  })

  it('handles markdown and dynamic paths events', () => {
    const watchFileSet = createWatchFileSet(createSiteConfig())

    const addDecision = resolveWatchDecision(
      'add',
      '/repo/example/guide/advanced.md',
      watchFileSet
    )
    expect(addDecision.shouldHandle).toBe(true)
    expect(addDecision.reason).toBe('markdown')

    const changeDecision = resolveWatchDecision(
      'change',
      '/repo/example/guide/index.md',
      watchFileSet
    )
    expect(changeDecision.shouldHandle).toBe(true)
    expect(changeDecision.reason).toBe('markdown')

    const unlinkDecision = resolveWatchDecision(
      'unlink',
      '/repo/example/guide/advanced.md',
      watchFileSet
    )
    expect(unlinkDecision.shouldHandle).toBe(true)
    expect(unlinkDecision.reason).toBe('markdown')

    const summaryDecision = resolveWatchDecision(
      'change',
      '/repo/example/SUMMARY.md',
      watchFileSet
    )
    expect(summaryDecision.shouldHandle).toBe(false)

    const dynamicDecision = resolveWatchDecision(
      'change',
      '/repo/example/blog/[slug].paths.ts',
      watchFileSet
    )
    expect(dynamicDecision.shouldHandle).toBe(true)
    expect(dynamicDecision.reason).toBe('dynamic-routes-paths')
  })

  it('addDir 和 unlinkDir 对普通目录事件不触发', () => {
    const watchFileSet = createWatchFileSet(createSiteConfig())

    const addDirDecision = resolveWatchDecision(
      'addDir',
      '/repo/example/guide/nested',
      watchFileSet
    )
    expect(addDirDecision.shouldHandle).toBe(false)

    const unlinkDirDecision = resolveWatchDecision(
      'unlinkDir',
      '/repo/example/guide/nested',
      watchFileSet
    )
    expect(unlinkDirDecision.shouldHandle).toBe(false)
  })

  it('handles config dependencies', () => {
    const siteConfig = createSiteConfig()
    const watchFileSet = createWatchFileSet(siteConfig)

    const configDepDecision = resolveWatchDecision(
      'change',
      '/repo/example/.vitepress/config.theme.ts',
      watchFileSet
    )
    expect(configDepDecision.shouldHandle).toBe(true)
    expect(configDepDecision.reason).toBe('vitepress-config')
  })

  it('configDeps 缺失时仅监听 configPath', () => {
    const siteConfig = createSiteConfig()
    siteConfig.configDeps = undefined
    const watchFileSet = createWatchFileSet(siteConfig)

    const configDecision = resolveWatchDecision(
      'change',
      '/repo/example/.vitepress/config.ts',
      watchFileSet
    )
    expect(configDecision.shouldHandle).toBe(true)
    expect(configDecision.reason).toBe('vitepress-config')
  })

  it('configPath 缺失时不会将 config 文件识别为监听目标', () => {
    const siteConfig = createSiteConfig()
    siteConfig.configPath = undefined
    siteConfig.configDeps = undefined
    const watchFileSet = createWatchFileSet(siteConfig)

    const configDecision = resolveWatchDecision(
      'change',
      '/repo/example/.vitepress/config.ts',
      watchFileSet
    )
    expect(configDecision.shouldHandle).toBe(false)
  })

  it('无关文件变更不会触发', () => {
    const watchFileSet = createWatchFileSet(createSiteConfig())
    const decision = resolveWatchDecision(
      'change',
      '/repo/example/assets/logo.png',
      watchFileSet
    )

    expect(decision.shouldHandle).toBe(false)
  })

  it('debounced runner 合并短时间任务，仅执行最后一次', async () => {
    vi.useFakeTimers()
    const handleTask = vi.fn(async () => {})
    const run = createDebouncedWatchRunner(handleTask, 20)

    run('change', '/repo/example/guide/a.md', 'markdown')
    run('change', '/repo/example/guide/b.md', 'markdown')

    await vi.advanceTimersByTimeAsync(20)
    expect(handleTask).toHaveBeenCalledTimes(1)
    expect(handleTask).toHaveBeenCalledWith({
      eventName: 'change',
      path: '/repo/example/guide/b.md',
      reason: 'markdown',
    })
    vi.useRealTimers()
  })

  it('runner 在执行中收到新任务时会在当前任务后补跑', async () => {
    vi.useFakeTimers()

    let resumeFirst: (() => void) | undefined
    const handleTask = vi.fn(async (task: { reason: string }) => {
      if (task.reason === 'first') {
        await new Promise<void>((resolve) => {
          resumeFirst = resolve
        })
      }
    })

    const run = createDebouncedWatchRunner(handleTask, 10)
    run('change', '/repo/example/guide/a.md', 'first')
    await vi.advanceTimersByTimeAsync(10)
    expect(handleTask).toHaveBeenCalledTimes(1)

    run('change', '/repo/example/guide/b.md', 'second')
    await vi.advanceTimersByTimeAsync(10)
    expect(handleTask).toHaveBeenCalledTimes(1)

    resumeFirst?.()
    await vi.runAllTimersAsync()
    expect(handleTask).toHaveBeenCalledTimes(2)
    expect(handleTask.mock.calls[1][0]).toEqual({
      eventName: 'change',
      path: '/repo/example/guide/b.md',
      reason: 'second',
    })
    vi.useRealTimers()
  })
})
