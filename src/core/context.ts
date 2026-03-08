import type { DefaultTheme, SiteConfig } from 'vitepress'

export interface VitePressRuntimeContext {
  available: boolean
  siteConfig?: SiteConfig<DefaultTheme.Config>
  reason?: string
}

export interface ResolveContextOptions {
  scope?: string
  warn?: (message: string) => void
}

const warnedKeys = new Set<string>()

function warnOnce(
  key: string,
  message: string,
  warn?: (message: string) => void
) {
  if (!warn || warnedKeys.has(key)) return
  warnedKeys.add(key)
  warn(message)
}

export function resolveVitePressContext(
  input: unknown,
  options: ResolveContextOptions = {}
): VitePressRuntimeContext {
  const { warn } = options

  if (!input || typeof input !== 'object') {
    warnOnce(
      'invalid-vite-config',
      '[vite-plugin-vitepress-auto-nav] skip: vite config is not an object',
      warn
    )
    return {
      available: false,
      reason: 'vite config is not an object',
    }
  }

  const maybeVitepress = (
    input as {
      vitepress?: SiteConfig<DefaultTheme.Config>
    }
  ).vitepress

  if (!maybeVitepress) {
    warnOnce(
      'missing-vitepress-context',
      '[vite-plugin-vitepress-auto-nav] skip: vitepress runtime context is missing',
      warn
    )
    return {
      available: false,
      reason: 'vitepress runtime context is missing',
    }
  }

  return {
    available: true,
    siteConfig: maybeVitepress,
  }
}
