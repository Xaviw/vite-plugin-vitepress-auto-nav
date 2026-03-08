/** 兼容的 Vite 配置对象抽象 */
export type CompatibleViteConfig = object

/** 兼容的 Vite 环境对象抽象 */
export type CompatibleViteEnv = object

/** 兼容的 Vite 插件 apply 配置 */
export type CompatibleViteApply =
  | 'serve'
  | 'build'
  | ((config: CompatibleViteConfig, env: CompatibleViteEnv) => boolean)

/** 兼容的文件监听事件名称 */
export type CompatibleWatchEventName =
  | 'add'
  | 'addDir'
  | 'change'
  | 'unlink'
  | 'unlinkDir'

/** 兼容的 Vite 开发服务器最小结构 */
export interface CompatibleViteDevServer {
  config: CompatibleViteConfig
  watcher: {
    on: (
      event: 'all',
      listener: (eventName: CompatibleWatchEventName, path: string) => void
    ) => void
  }
  ws: {
    send: (payload: { type: string }) => void
  }
}

/** 兼容的 Vite 插件最小结构 */
export interface CompatibleVitePlugin {
  name: string
  enforce?: 'pre' | 'post'
  apply?: CompatibleViteApply
  config?: (
    config: CompatibleViteConfig,
    env: CompatibleViteEnv
  ) =>
    | CompatibleViteConfig
    | null
    | void
    | Promise<CompatibleViteConfig | null | void>
  configResolved?: (config: CompatibleViteConfig) => void | Promise<void>
  configureServer?: (
    server: CompatibleViteDevServer
  ) => void | (() => void) | Promise<void | (() => void)>
}
