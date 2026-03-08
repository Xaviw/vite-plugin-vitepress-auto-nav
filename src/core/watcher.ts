import { normalize } from 'path'
import type { DefaultTheme, SiteConfig } from 'vitepress'

export type WatchEventName =
  | 'add'
  | 'addDir'
  | 'change'
  | 'unlink'
  | 'unlinkDir'

interface WatchFileSet {
  configFiles: Set<string>
}

interface WatchDecision {
  shouldHandle: boolean
  normalizedPath: string
  reason?: string
}

interface DebouncedWatchTask {
  eventName: WatchEventName
  path: string
  reason: string
}

const dynamicPathsFileRegExp = /(^|\/)[^/]+\.paths\.(?:ts|mts|js|mjs|cts|cjs)$/i
const configTimestampNoiseRegExp =
  /\/\.vitepress\/config\.(?:ts|mts|cts|js|mjs|cjs)\.timestamp-.*\.mjs$/i

function toWatchPath(path: string) {
  return normalize(path).replace(/\\/g, '/').toLowerCase()
}

function isIgnoredLegacySummaryPath(path: string) {
  return path.endsWith('/summary.md') || path === 'summary.md'
}

export function createWatchFileSet(
  siteConfig: SiteConfig<DefaultTheme.Config>
): WatchFileSet {
  const configFiles = new Set<string>()

  if (siteConfig.configPath) {
    configFiles.add(toWatchPath(siteConfig.configPath))
  }

  for (const dep of siteConfig.configDeps ?? []) {
    configFiles.add(toWatchPath(dep))
  }

  return { configFiles }
}

export function resolveWatchDecision(
  eventName: string,
  path: string,
  watchFileSet: WatchFileSet
): WatchDecision {
  const normalizedPath = toWatchPath(path)
  if (configTimestampNoiseRegExp.test(normalizedPath)) {
    return {
      shouldHandle: false,
      normalizedPath,
    }
  }

  if (
    eventName !== 'add' &&
    eventName !== 'addDir' &&
    eventName !== 'change' &&
    eventName !== 'unlink' &&
    eventName !== 'unlinkDir'
  ) {
    return {
      shouldHandle: false,
      normalizedPath,
    }
  }

  if (normalizedPath.endsWith('.md')) {
    if (isIgnoredLegacySummaryPath(normalizedPath)) {
      return {
        shouldHandle: false,
        normalizedPath,
      }
    }

    return {
      shouldHandle: true,
      normalizedPath,
      reason: 'markdown',
    }
  }

  if (dynamicPathsFileRegExp.test(normalizedPath)) {
    return {
      shouldHandle: true,
      normalizedPath,
      reason: 'dynamic-routes-paths',
    }
  }

  if (watchFileSet.configFiles.has(normalizedPath)) {
    return {
      shouldHandle: true,
      normalizedPath,
      reason: 'vitepress-config',
    }
  }

  return {
    shouldHandle: false,
    normalizedPath,
  }
}

export function createDebouncedWatchRunner(
  handleTask: (task: DebouncedWatchTask) => Promise<void>,
  debounceMs: number
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let pendingTask: DebouncedWatchTask | undefined
  let running = false

  const schedule = (delayMs = debounceMs) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      void run()
    }, delayMs)
  }

  const run = async () => {
    if (running) {
      schedule(0)
      return
    }

    const task = pendingTask as DebouncedWatchTask
    pendingTask = undefined
    running = true
    try {
      await handleTask(task)
    } finally {
      running = false
      if (pendingTask) {
        schedule(0)
      }
    }
  }

  return (eventName: WatchEventName, path: string, reason: string) => {
    pendingTask = {
      eventName,
      path,
      reason,
    }
    schedule()
  }
}
