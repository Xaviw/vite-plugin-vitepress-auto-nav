import type { AutoNavPluginOptions } from './types/plugin'
import type { CompatibleVitePlugin } from './types/viteCompatible'
import { normalizeOptions } from './core/normalizeOptions'
import createPlugin from './core/plugin'

export default function AutoNav(
  options: AutoNavPluginOptions = {}
): CompatibleVitePlugin {
  const normalized = normalizeOptions(options)
  return createPlugin({
    ...options,
    include: normalized.include,
    exclude: normalized.exclude,
    standaloneIndex: normalized.standaloneIndex,
    overrides: normalized.overrides,
    frontmatterKeyPrefix: normalized.frontmatterKeyPrefix,
    sorter: normalized.sorter,
    preferArticleTitle: normalized.preferArticleTitle,
  })
}
