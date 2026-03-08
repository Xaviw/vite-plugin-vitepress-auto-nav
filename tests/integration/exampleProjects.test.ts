import { spawnSync } from 'node:child_process'
import { mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import type { AutoNavTestProbeSnapshot } from '../support/plugins/autoNavTestProbe'

interface IntegrationCase {
  name: string
  assert: (snapshot: AutoNavTestProbeSnapshot) => void
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '../..')
const exampleDir = path.join(repoRoot, 'example')
const outputDir = path.join(repoRoot, '.temp', 'auto-nav-test-probe')

function uniqueLinks(nav: unknown): string[] {
  if (!Array.isArray(nav)) return []
  const links = nav
    .map((item) =>
      item && typeof item === 'object'
        ? (item as { link?: unknown }).link
        : undefined
    )
    .filter((link): link is string => typeof link === 'string')
  return Array.from(new Set(links))
}

function firstNavItem(
  nav: unknown
): { text?: unknown; link?: unknown; activeMatch?: unknown } | undefined {
  if (!Array.isArray(nav)) return undefined
  const first = nav[0]
  if (!first || typeof first !== 'object') return undefined
  return first as { text?: unknown; link?: unknown; activeMatch?: unknown }
}

function getSidebarLinksBySection(
  sidebar: unknown,
  sectionKey: string
): string[] {
  if (!sidebar || typeof sidebar !== 'object') return []

  const sectionValue = (sidebar as Record<string, unknown>)[sectionKey]
  if (!Array.isArray(sectionValue)) return []

  const links = sectionValue
    .map((item) =>
      item && typeof item === 'object'
        ? (item as { link?: unknown }).link
        : undefined
    )
    .filter((link): link is string => typeof link === 'string')

  return Array.from(new Set(links))
}

interface SidebarItemLike {
  text?: unknown
  link?: unknown
  collapsed?: unknown
  items?: unknown
}

function walkSidebarItems(
  items: unknown,
  visitor: (item: SidebarItemLike) => void
) {
  if (!Array.isArray(items)) return

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const current = item as SidebarItemLike
    visitor(current)
    walkSidebarItems(current.items, visitor)
  }
}

function getSidebarSectionItems(
  sidebar: unknown,
  sectionKey: string
): unknown[] {
  if (!sidebar || typeof sidebar !== 'object') return []
  const sectionValue = (sidebar as Record<string, unknown>)[sectionKey]
  if (!Array.isArray(sectionValue)) return []
  return sectionValue
}

function flattenSidebarLinksBySection(
  sidebar: unknown,
  sectionKey: string
): string[] {
  const links: string[] = []
  walkSidebarItems(getSidebarSectionItems(sidebar, sectionKey), (item) => {
    if (typeof item.link === 'string') {
      links.push(item.link)
    }
  })
  return links
}

function findSidebarItemByLink(
  sidebar: unknown,
  sectionKey: string,
  link: string
): SidebarItemLike | undefined {
  let found: SidebarItemLike | undefined
  walkSidebarItems(getSidebarSectionItems(sidebar, sectionKey), (item) => {
    if (found) return
    if (item.link === link) {
      found = item
    }
  })
  return found
}

function findSidebarItemByText(
  sidebar: unknown,
  sectionKey: string,
  text: string
): SidebarItemLike | undefined {
  let found: SidebarItemLike | undefined
  walkSidebarItems(getSidebarSectionItems(sidebar, sectionKey), (item) => {
    if (found) return
    if (item.text === text) {
      found = item
    }
  })
  return found
}

function expectNoRootLocaleThemeOverride(snapshot: AutoNavTestProbeSnapshot) {
  const rootLocaleThemeConfig = snapshot.vitepress.site.localeThemeConfig.root
  expect(Array.isArray(rootLocaleThemeConfig?.nav)).toBe(false)
  expect(rootLocaleThemeConfig?.sidebar).toBeUndefined()
}

function runBuild(caseName: string) {
  const outputFile = path.join(outputDir, `${caseName}.json`)
  const result = spawnSync(
    'pnpm',
    ['--dir', exampleDir, 'exec', 'vitepress', 'build', `projects/${caseName}`],
    {
      cwd: repoRoot,
      encoding: 'utf-8',
      env: {
        ...process.env,
        AUTO_NAV_TEST_PROBE_OUTPUT_FILE: outputFile,
      },
      shell: process.platform === 'win32',
    }
  )

  if (result.status !== 0 || result.error) {
    throw new Error(
      [
        `[integration:${caseName}] build failed`,
        result.error?.message ?? '',
        result.stdout ?? '',
        result.stderr ?? '',
      ].join('\n')
    )
  }

  return outputFile
}

async function readSnapshot(filePath: string) {
  const raw = await readFile(filePath, 'utf-8')
  return JSON.parse(raw) as AutoNavTestProbeSnapshot
}

function expectDynamicRoute(
  snapshot: AutoNavTestProbeSnapshot,
  pathValue: string,
  hasContent: boolean
) {
  const found = snapshot.vitepress.dynamicRoutes.some(
    (item) => item.path === pathValue && item.hasContent === hasContent
  )
  expect(found).toBe(true)
}

const cases: IntegrationCase[] = [
  {
    name: 'output-preserve',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)
      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const frNav = snapshot.vitepress.site.localeThemeConfig.fr?.nav
      const rootLinks = uniqueLinks(rootNav)
      const frLinks = uniqueLinks(frNav)
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const frSidebar = snapshot.vitepress.site.localeThemeConfig.fr?.sidebar
      expect(rootLinks).toEqual(['/manual-root/'])
      expect(frLinks).toEqual(['/fr/manual/'])
      expect(firstNavItem(rootNav)?.text).toBe('Manual Root')
      expect(firstNavItem(frNav)?.text).toBe('Manual FR')
      expect(
        Object.keys((rootSidebar ?? {}) as Record<string, unknown>)
      ).toEqual(['/guide/'])
      expect(Object.keys((frSidebar ?? {}) as Record<string, unknown>)).toEqual(
        ['/fr/guide/']
      )
      expect(flattenSidebarLinksBySection(rootSidebar, '/guide/')).toEqual([
        '/guide/getting-started',
      ])
      expect(flattenSidebarLinksBySection(frSidebar, '/fr/guide/')).toEqual([
        '/fr/guide/getting-started',
      ])
      expect(
        flattenSidebarLinksBySection(rootSidebar, '/manual-root/')
      ).toEqual([])
      expect(flattenSidebarLinksBySection(frSidebar, '/fr/manual/')).toEqual([])
    },
  },
  {
    name: 'routing-static-rewrites',
    assert(snapshot) {
      expect(
        snapshot.vitepress.rewritesMap['packages/pkg-a/src/pkg-a-docs.md']
      ).toBe('packages-docs/pkg-a/index.md')
      expect(
        snapshot.vitepress.rewritesMap['packages/pkg-b/src/pkg-b-docs.md']
      ).toBe('packages-docs/pkg-b/index.md')
      expect(snapshot.vitepress.rewrittenPages).toContain(
        'packages-docs/pkg-a/index.md'
      )
      expect(snapshot.vitepress.rewrittenPages).toContain(
        'packages-docs/pkg-b/index.md'
      )

      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      expect(firstNavItem(rootNav)?.text).toBe('packages-docs')
      expect(firstNavItem(rootNav)?.link).toBe('/packages-docs/pkg-a/')
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/packages-docs/')
      expect(
        Object.keys((rootSidebar ?? {}) as Record<string, unknown>)
      ).toEqual(['/packages-docs/'])
      expect(
        flattenSidebarLinksBySection(rootSidebar, '/packages-docs/')
      ).toEqual(['/packages-docs/pkg-a/', '/packages-docs/pkg-b/'])
      expect(
        findSidebarItemByLink(
          rootSidebar,
          '/packages-docs/',
          '/packages-docs/pkg-a/'
        )?.text
      ).toBe('pkg-a')
      expect(
        findSidebarItemByLink(
          rootSidebar,
          '/packages-docs/',
          '/packages-docs/pkg-b/'
        )?.text
      ).toBe('pkg-b')
      expect(
        flattenSidebarLinksBySection(rootSidebar, '/packages-docs/')
      ).not.toContain('/packages/pkg-a/src/pkg-a-docs')
    },
  },
  {
    name: 'routing-param-rewrites',
    assert(snapshot) {
      expect(
        snapshot.vitepress.rewritesMap['packages/pkg-c/src/index.md']
      ).toBe('packages-param/pkg-c/index.md')
      expect(
        snapshot.vitepress.rewritesMap['packages/pkg-d/src/index.md']
      ).toBe('packages-param/pkg-d/index.md')
      expect(snapshot.vitepress.rewrittenPages).toContain(
        'packages-param/pkg-c/index.md'
      )
      expect(snapshot.vitepress.rewrittenPages).toContain(
        'packages-param/pkg-d/index.md'
      )

      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      expect(firstNavItem(rootNav)?.text).toBe('packages-param')
      expect(firstNavItem(rootNav)?.link).toBe('/packages-param/pkg-c/')
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/packages-param/')
      expect(
        Object.keys((rootSidebar ?? {}) as Record<string, unknown>)
      ).toEqual(['/packages-param/'])
      expect(
        flattenSidebarLinksBySection(rootSidebar, '/packages-param/')
      ).toEqual(['/packages-param/pkg-c/', '/packages-param/pkg-d/'])
      expect(
        findSidebarItemByLink(
          rootSidebar,
          '/packages-param/',
          '/packages-param/pkg-c/'
        )?.text
      ).toBe('pkg-c')
      expect(
        findSidebarItemByLink(
          rootSidebar,
          '/packages-param/',
          '/packages-param/pkg-d/'
        )?.text
      ).toBe('pkg-d')
      expect(
        flattenSidebarLinksBySection(rootSidebar, '/packages-param/')
      ).not.toContain('/packages/pkg-c/src/')
    },
  },
  {
    name: 'routing-no-rewrites',
    assert(snapshot) {
      expect(Object.keys(snapshot.vitepress.rewritesMap)).toHaveLength(0)
      expect(snapshot.vitepress.rewrittenPages).toContain(
        'packages/pkg-a/src/pkg-a-docs.md'
      )
      expect(snapshot.vitepress.rewrittenPages).not.toContain(
        'packages-docs/pkg-a/index.md'
      )

      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      expect(firstNavItem(rootNav)?.text).toBe('packages')
      expect(firstNavItem(rootNav)?.link).toBe('/packages/pkg-a/src/pkg-a-docs')
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/packages/')
      expect(flattenSidebarLinksBySection(rootSidebar, '/packages/')).toEqual([
        '/packages/pkg-a/src/pkg-a-docs',
      ])
      expect(
        findSidebarItemByText(rootSidebar, '/packages/', 'pkg-a')?.link
      ).toBeUndefined()
      expect(
        findSidebarItemByText(rootSidebar, '/packages/', 'src')?.link
      ).toBeUndefined()
      expect(
        findSidebarItemByLink(
          rootSidebar,
          '/packages/',
          '/packages/pkg-a/src/pkg-a-docs'
        )?.text
      ).toBe('pkg-a-docs')
      expect(
        flattenSidebarLinksBySection(rootSidebar, '/packages/')
      ).not.toContain('/packages-docs/pkg-a/')
    },
  },
  {
    name: 'dynamic-routes',
    assert(snapshot) {
      expectDynamicRoute(snapshot, 'blog/hello-world.md', true)
      expectDynamicRoute(snapshot, 'blog/release-note.md', false)
      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootLinks = uniqueLinks(rootNav)
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      expect(rootLinks).toContain('/blog/hello-world')
      expect(rootLinks).not.toContain('/')
      expect(firstNavItem(rootNav)?.text).toBe('blog')
      expect(firstNavItem(rootNav)?.link).toBe('/blog/hello-world')
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/blog/')
      expect(
        Object.keys((rootSidebar ?? {}) as Record<string, unknown>)
      ).toEqual(['/blog/'])
      expect(flattenSidebarLinksBySection(rootSidebar, '/blog/')).toEqual([
        '/blog/hello-world',
        '/blog/release-note',
      ])
      expect(
        findSidebarItemByLink(rootSidebar, '/blog/', '/blog/hello-world')?.text
      ).toBe('hello-world')
      expect(
        findSidebarItemByLink(rootSidebar, '/blog/', '/blog/release-note')?.text
      ).toBe('release-note')
    },
  },
  {
    name: 'i18n-full-subdir',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)
      expect(snapshot.vitepress.site.localeKeys).toContain('root')
      expect(snapshot.vitepress.site.localeKeys).toContain('fr')
      expect(snapshot.vitepress.site.localeKeys).toContain('ja')
      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const frNav = snapshot.vitepress.site.localeThemeConfig.fr?.nav
      const jaNav = snapshot.vitepress.site.localeThemeConfig.ja?.nav
      const frSidebar = snapshot.vitepress.site.localeThemeConfig.fr?.sidebar
      const jaSidebar = snapshot.vitepress.site.localeThemeConfig.ja?.sidebar
      const frLinks = uniqueLinks(frNav)
      const jaLinks = uniqueLinks(jaNav)
      expect(uniqueLinks(rootNav)).toEqual([])
      expect(
        Object.keys((rootSidebar ?? {}) as Record<string, unknown>)
      ).toEqual([])
      expect(Array.isArray(frNav) ? frNav : []).toHaveLength(1)
      expect(Array.isArray(jaNav) ? jaNav : []).toHaveLength(1)
      expect(frLinks).toEqual(['/fr/guide/'])
      expect(jaLinks).toEqual(['/ja/guide/'])

      const frFirstNav = firstNavItem(frNav)
      const jaFirstNav = firstNavItem(jaNav)
      expect(frFirstNav?.text).toBe('guide')
      expect(frFirstNav?.link).toBe('/fr/guide/')
      expect(frFirstNav?.activeMatch).toBe('/fr/guide/')
      expect(jaFirstNav?.text).toBe('guide')
      expect(jaFirstNav?.link).toBe('/ja/guide/')
      expect(jaFirstNav?.activeMatch).toBe('/ja/guide/')

      expect(getSidebarLinksBySection(frSidebar, '/fr/guide/')).toEqual([
        '/fr/guide/faq',
        '/fr/guide/getting-started',
      ])
      expect(getSidebarLinksBySection(jaSidebar, '/ja/guide/')).toEqual([
        '/ja/guide/faq',
        '/ja/guide/getting-started',
      ])
      expect(flattenSidebarLinksBySection(frSidebar, '/guide/')).toEqual([])
      expect(flattenSidebarLinksBySection(jaSidebar, '/guide/')).toEqual([])
    },
  },
  {
    name: 'root-and-locale-auto-nav',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)
      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const frNav = snapshot.vitepress.site.localeThemeConfig.fr?.nav
      const frSidebar = snapshot.vitepress.site.localeThemeConfig.fr?.sidebar
      const jaNav = snapshot.vitepress.site.localeThemeConfig.ja?.nav
      const jaSidebar = snapshot.vitepress.site.localeThemeConfig.ja?.sidebar

      expect(uniqueLinks(rootNav)).toEqual(['/guide/'])
      expect(firstNavItem(rootNav)?.text).toBe('guide')
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/guide/')
      expect(flattenSidebarLinksBySection(rootSidebar, '/guide/')).toEqual([
        '/guide/intro',
      ])

      expect(uniqueLinks(frNav)).toEqual(['/fr/guide/'])
      expect(firstNavItem(frNav)?.text).toBe('guide')
      expect(firstNavItem(frNav)?.activeMatch).toBe('/fr/guide/')
      expect(flattenSidebarLinksBySection(frSidebar, '/fr/guide/')).toEqual([
        '/fr/guide/intro',
      ])

      expect(uniqueLinks(jaNav)).toEqual(['/ja/guide/'])
      expect(firstNavItem(jaNav)?.text).toBe('guide')
      expect(firstNavItem(jaNav)?.activeMatch).toBe('/ja/guide/')
      expect(flattenSidebarLinksBySection(jaSidebar, '/ja/guide/')).toEqual([
        '/ja/guide/intro',
      ])

      expect(flattenSidebarLinksBySection(rootSidebar, '/fr/guide/')).toEqual(
        []
      )
      expect(flattenSidebarLinksBySection(frSidebar, '/guide/')).toEqual([])
      expect(flattenSidebarLinksBySection(jaSidebar, '/guide/')).toEqual([])
    },
  },
  {
    name: 'root-manual-locale-auto',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)
      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const frNav = snapshot.vitepress.site.localeThemeConfig.fr?.nav
      const frSidebar = snapshot.vitepress.site.localeThemeConfig.fr?.sidebar
      const jaNav = snapshot.vitepress.site.localeThemeConfig.ja?.nav
      const jaSidebar = snapshot.vitepress.site.localeThemeConfig.ja?.sidebar

      expect(uniqueLinks(rootNav)).toEqual(['/manual-root/'])
      expect(firstNavItem(rootNav)?.text).toBe('Manual Root')
      expect(firstNavItem(rootNav)?.activeMatch).toBeUndefined()
      expect(flattenSidebarLinksBySection(rootSidebar, '/guide/')).toEqual([
        '/guide/intro',
      ])

      expect(uniqueLinks(frNav)).toEqual(['/fr/guide/'])
      expect(firstNavItem(frNav)?.activeMatch).toBe('/fr/guide/')
      expect(flattenSidebarLinksBySection(frSidebar, '/fr/guide/')).toEqual([
        '/fr/guide/intro',
      ])

      expect(uniqueLinks(jaNav)).toEqual(['/ja/guide/'])
      expect(firstNavItem(jaNav)?.activeMatch).toBe('/ja/guide/')
      expect(flattenSidebarLinksBySection(jaSidebar, '/ja/guide/')).toEqual([
        '/ja/guide/intro',
      ])
    },
  },
  {
    name: 'root-auto-locale-manual',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)
      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const frNav = snapshot.vitepress.site.localeThemeConfig.fr?.nav
      const frSidebar = snapshot.vitepress.site.localeThemeConfig.fr?.sidebar
      const jaNav = snapshot.vitepress.site.localeThemeConfig.ja?.nav
      const jaSidebar = snapshot.vitepress.site.localeThemeConfig.ja?.sidebar

      expect(uniqueLinks(rootNav)).toEqual(['/guide/'])
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/guide/')
      expect(flattenSidebarLinksBySection(rootSidebar, '/guide/')).toEqual([
        '/guide/intro',
      ])

      expect(uniqueLinks(frNav)).toEqual(['/fr/manual/'])
      expect(firstNavItem(frNav)?.text).toBe('Manual FR')
      expect(firstNavItem(frNav)?.activeMatch).toBeUndefined()
      expect(flattenSidebarLinksBySection(frSidebar, '/fr/guide/')).toEqual([
        '/fr/guide/intro',
      ])

      expect(uniqueLinks(jaNav)).toEqual(['/ja/manual/'])
      expect(firstNavItem(jaNav)?.text).toBe('Manual JA')
      expect(firstNavItem(jaNav)?.activeMatch).toBeUndefined()
      expect(flattenSidebarLinksBySection(jaSidebar, '/ja/guide/')).toEqual([
        '/ja/guide/intro',
      ])
    },
  },
  {
    name: 'exclude-only',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)
      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const frNav = snapshot.vitepress.site.localeThemeConfig.fr?.nav
      const frSidebar = snapshot.vitepress.site.localeThemeConfig.fr?.sidebar

      expect(uniqueLinks(rootNav)).toEqual(['/guide/'])
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/guide/')
      expect(flattenSidebarLinksBySection(rootSidebar, '/guide/')).toEqual([
        '/guide/intro',
      ])
      expect(
        flattenSidebarLinksBySection(rootSidebar, '/guide/')
      ).not.toContain('/guide/private/secret')

      expect(uniqueLinks(frNav)).toEqual(['/fr/guide/'])
      expect(firstNavItem(frNav)?.activeMatch).toBe('/fr/guide/')
      expect(flattenSidebarLinksBySection(frSidebar, '/fr/guide/')).toEqual([
        '/fr/guide/intro',
      ])
      expect(
        flattenSidebarLinksBySection(frSidebar, '/fr/guide/')
      ).not.toContain('/fr/guide/private/secret')
    },
  },
  {
    name: 'dynamic-routes-i18n',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)
      expectDynamicRoute(snapshot, 'blog/hello-world.md', true)
      expectDynamicRoute(snapshot, 'blog/release-note.md', false)
      expectDynamicRoute(snapshot, 'fr/blog/bonjour.md', true)
      expectDynamicRoute(snapshot, 'fr/blog/annonce.md', false)

      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const frNav = snapshot.vitepress.site.localeThemeConfig.fr?.nav
      const frSidebar = snapshot.vitepress.site.localeThemeConfig.fr?.sidebar

      expect(uniqueLinks(rootNav)).toEqual(['/blog/hello-world'])
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/blog/')
      expect(flattenSidebarLinksBySection(rootSidebar, '/blog/')).toEqual([
        '/blog/hello-world',
        '/blog/release-note',
      ])

      expect(uniqueLinks(frNav)).toEqual(['/fr/blog/bonjour'])
      expect(firstNavItem(frNav)?.activeMatch).toBe('/fr/blog/')
      expect(flattenSidebarLinksBySection(frSidebar, '/fr/blog/')).toEqual([
        '/fr/blog/bonjour',
        '/fr/blog/annonce',
      ])
    },
  },
  {
    name: 'dynamic-routes-rewrites',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)
      expect(
        snapshot.vitepress.rewritesMap['packages/alpha/docs/overview.md']
      ).toBe('packages-runtime/alpha/overview.md')
      expect(
        snapshot.vitepress.rewritesMap['packages/beta/docs/install.md']
      ).toBe('packages-runtime/beta/install.md')
      expectDynamicRoute(snapshot, 'packages/alpha/docs/overview.md', true)
      expectDynamicRoute(snapshot, 'packages/beta/docs/install.md', false)

      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      expect(firstNavItem(rootNav)?.text).toBe('packages-runtime')
      expect(firstNavItem(rootNav)?.link).toBe(
        '/packages-runtime/alpha/overview'
      )
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/packages-runtime/')
      expect(
        Array.from(
          new Set(
            flattenSidebarLinksBySection(rootSidebar, '/packages-runtime/')
          )
        )
      ).toEqual([
        '/packages-runtime/alpha/overview',
        '/packages-runtime/beta/install',
      ])
    },
  },
  {
    name: 'top-level-multi-sections',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)
      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar

      expect(uniqueLinks(rootNav)).toEqual(['/api/', '/guide/', '/overview'])
      expect(firstNavItem(rootNav)?.text).toBe('api')
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/api/')
      expect(flattenSidebarLinksBySection(rootSidebar, '/guide/')).toEqual([
        '/guide/getting-started',
      ])
      expect(flattenSidebarLinksBySection(rootSidebar, '/api/')).toEqual([
        '/api/reference',
      ])
    },
  },
  {
    name: 'override-key-collision',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)
      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      expect(uniqueLinks(rootNav)).toEqual(['/guide/', '/reference/'])
      expect(flattenSidebarLinksBySection(rootSidebar, '/guide/')).toEqual([
        '/guide/basic/',
        '/guide/basic/intro',
      ])
      expect(flattenSidebarLinksBySection(rootSidebar, '/reference/')).toEqual([
        '/reference/basic/',
        '/reference/basic/intro',
      ])

      const guideBasic = findSidebarItemByLink(
        rootSidebar,
        '/guide/',
        '/guide/basic/'
      )
      const guideIntro = findSidebarItemByLink(
        rootSidebar,
        '/guide/',
        '/guide/basic/intro'
      )
      const referenceBasic = findSidebarItemByLink(
        rootSidebar,
        '/reference/',
        '/reference/basic/'
      )
      const referenceIntro = findSidebarItemByLink(
        rootSidebar,
        '/reference/',
        '/reference/basic/intro'
      )

      expect(guideBasic?.text).toBe('Guide Basic')
      expect(guideIntro?.text).toBe('Guide Intro')
      expect(referenceBasic?.text).toBe('Reference Basic')
      expect(referenceIntro?.text).toBe('Reference Intro')
    },
  },
  {
    name: 'overrides-custom',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)

      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootLinks = uniqueLinks(rootNav)
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const nestedLinks = flattenSidebarLinksBySection(rootSidebar, '/guide/')

      expect(rootLinks).toEqual(['/guide/'])
      expect(firstNavItem(rootNav)?.text).toBe('指南导航')
      expect(snapshot.vitepress.rewrittenPages).toContain(
        'guide/basic/hidden.md'
      )

      const basicFolder = findSidebarItemByLink(
        rootSidebar,
        '/guide/',
        '/guide/basic/'
      )
      expect(basicFolder?.text).toBe('基础目录')
      expect(basicFolder?.collapsed).toBe(true)

      expect(nestedLinks).toContain('/guide/basic/alpha')
      expect(nestedLinks).not.toContain('/guide/basic/hidden')

      const alphaItem = findSidebarItemByLink(
        rootSidebar,
        '/guide/',
        '/guide/basic/alpha'
      )
      expect(alphaItem?.text).toBe('Alpha 自定义标题')
    },
  },
  {
    name: 'frontmatter-custom',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)

      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootLinks = uniqueLinks(rootNav)
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const nestedLinks = flattenSidebarLinksBySection(rootSidebar, '/guide/')

      expect(rootLinks).toEqual(['/guide/'])
      expect(firstNavItem(rootNav)?.text).toBe('guide')
      expect(nestedLinks).toContain('/guide/setup/')
      expect(nestedLinks).toContain('/guide/setup/article-title')
      expect(nestedLinks).toContain('/guide/setup/install')
      expect(nestedLinks).not.toContain('/guide/setup/hidden')
      expect(snapshot.vitepress.rewrittenPages).toContain(
        'guide/setup/hidden.md'
      )

      const setupFolder = findSidebarItemByLink(
        rootSidebar,
        '/guide/',
        '/guide/setup/'
      )
      expect(setupFolder?.collapsed).toBe(true)

      const articleItem = findSidebarItemByLink(
        rootSidebar,
        '/guide/',
        '/guide/setup/article-title'
      )
      const installItem = findSidebarItemByLink(
        rootSidebar,
        '/guide/',
        '/guide/setup/install'
      )
      expect(articleItem?.text).toBe('来自 H1 的标题')
      expect(installItem?.text).toBe('前缀安装')
      expect(installItem?.text).not.toBe('普通安装名')

      expect(nestedLinks.indexOf('/guide/setup/article-title')).toBeLessThan(
        nestedLinks.indexOf('/guide/setup/install')
      )
    },
  },
  {
    name: 'complex-combo-multi-level',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)

      expect(
        snapshot.vitepress.rewritesMap['packages/core/alpha/docs/overview.md']
      ).toBe('reference/core/alpha/overview.md')
      expect(
        snapshot.vitepress.rewritesMap[
          'fr/packages/core/alpha/docs/deep/getting-started.md'
        ]
      ).toBe('fr/reference/core/alpha/deep/getting-started.md')

      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const frNav = snapshot.vitepress.site.localeThemeConfig.fr?.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const frSidebar = snapshot.vitepress.site.localeThemeConfig.fr?.sidebar
      const rootNestedLinks = flattenSidebarLinksBySection(
        rootSidebar,
        '/reference/'
      )
      const frNestedLinks = flattenSidebarLinksBySection(
        frSidebar,
        '/fr/reference/'
      )

      expect(firstNavItem(rootNav)?.text).toBe('参考中心')
      expect(firstNavItem(rootNav)?.link).toBe('/reference/core/alpha/')
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/reference/')
      expect(firstNavItem(frNav)?.text).toBe('Référence')
      expect(firstNavItem(frNav)?.link).toBe('/fr/reference/core/alpha/')
      expect(firstNavItem(frNav)?.activeMatch).toBe('/fr/reference/')
      expect(
        Object.keys((rootSidebar ?? {}) as Record<string, unknown>)
      ).toEqual(['/reference/'])
      expect(Object.keys((frSidebar ?? {}) as Record<string, unknown>)).toEqual(
        ['/fr/reference/']
      )

      const alphaFolder = findSidebarItemByLink(
        rootSidebar,
        '/reference/',
        '/reference/core/alpha/'
      )
      const frAlphaFolder = findSidebarItemByLink(
        frSidebar,
        '/fr/reference/',
        '/fr/reference/core/alpha/'
      )
      expect(alphaFolder?.text).toBe('Alpha 模块')
      expect(alphaFolder?.collapsed).toBe(true)
      expect(frAlphaFolder?.text).toBe('Alpha FR')
      expect(frAlphaFolder?.collapsed).toBe(true)
      expect(
        findSidebarItemByText(rootSidebar, '/reference/', '核心分组')
      ).toBeDefined()
      expect(
        findSidebarItemByText(frSidebar, '/fr/reference/', '核心分组')
      ).toBeDefined()

      expect(rootNestedLinks).toEqual([
        '/reference/core/alpha/',
        '/reference/core/alpha/overview',
        '/reference/core/alpha/deep/getting-started',
      ])
      expect(frNestedLinks).toEqual([
        '/fr/reference/core/alpha/',
        '/fr/reference/core/alpha/overview',
        '/fr/reference/core/alpha/deep/getting-started',
      ])
      expect(rootNestedLinks).not.toContain('/reference/core/alpha/draft')
      expect(frNestedLinks).not.toContain('/fr/reference/core/alpha/draft')
      expect(snapshot.vitepress.rewrittenPages).toContain(
        'packages/core/alpha/docs/draft.md'
      )
      expect(snapshot.vitepress.rewrittenPages).toContain(
        'fr/packages/core/alpha/docs/draft.md'
      )
      expect(
        findSidebarItemByLink(
          rootSidebar,
          '/reference/',
          '/reference/core/alpha/overview'
        )?.text
      ).toBe('总览')
      expect(
        findSidebarItemByLink(
          frSidebar,
          '/fr/reference/',
          '/fr/reference/core/alpha/overview'
        )?.text
      ).toBe('Présentation')
      expect(
        findSidebarItemByLink(
          rootSidebar,
          '/reference/',
          '/reference/core/alpha/deep/getting-started'
        )?.text
      ).toBe('深层快速开始')
      expect(
        findSidebarItemByLink(
          frSidebar,
          '/fr/reference/',
          '/fr/reference/core/alpha/deep/getting-started'
        )?.text
      ).toBe('Guide de démarrage profond')
    },
  },
  {
    name: 'standalone-index-true',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)

      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const nestedLinks = flattenSidebarLinksBySection(rootSidebar, '/guide/')

      expect(uniqueLinks(rootNav)).toEqual(['/guide/getting-started/'])
      expect(firstNavItem(rootNav)?.text).toBe('guide')
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/guide/')
      expect(nestedLinks).toContain('/guide/')
      expect(nestedLinks).toContain('/guide/intro')
      expect(nestedLinks).toContain('/guide/getting-started/')
      expect(nestedLinks).toContain('/guide/getting-started/install')

      const nestedFolder = getSidebarSectionItems(
        rootSidebar,
        '/guide/'
      ).filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item as { text?: unknown; link?: unknown }).text ===
            'getting-started' &&
          (item as { link?: unknown }).link === undefined
      )
      expect(nestedFolder).toHaveLength(1)
    },
  },
  {
    name: 'sorter-custom',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)

      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const frNav = snapshot.vitepress.site.localeThemeConfig.fr?.nav
      const frSidebar = snapshot.vitepress.site.localeThemeConfig.fr?.sidebar

      expect(uniqueLinks(rootNav)).toEqual(['/guide/'])
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/guide/')
      expect(flattenSidebarLinksBySection(rootSidebar, '/guide/')).toEqual([
        '/guide/zeta',
        '/guide/alpha',
        '/guide/tools/',
        '/guide/tools/screwdriver',
        '/guide/tools/hammer',
      ])
      expect(flattenSidebarLinksBySection(frSidebar, '/fr/guide/')).toEqual([
        '/fr/guide/zeta',
        '/fr/guide/alpha',
        '/fr/guide/tools/',
        '/fr/guide/tools/screwdriver',
        '/fr/guide/tools/hammer',
      ])
      expect(uniqueLinks(frNav)).toEqual(['/fr/guide/'])
      expect(firstNavItem(frNav)?.activeMatch).toBe('/fr/guide/')
    },
  },
  {
    name: 'frontmatter-default-fields',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)

      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      const nestedLinks = flattenSidebarLinksBySection(rootSidebar, '/guide/')

      expect(uniqueLinks(rootNav)).toEqual(['/guide/'])
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/guide/')
      expect(nestedLinks).toEqual([
        '/guide/setup/',
        '/guide/setup/article-title',
        '/guide/setup/install',
      ])

      const setupFolder = findSidebarItemByLink(
        rootSidebar,
        '/guide/',
        '/guide/setup/'
      )
      expect(setupFolder?.collapsed).toBe(true)

      const articleItem = findSidebarItemByLink(
        rootSidebar,
        '/guide/',
        '/guide/setup/article-title'
      )
      const installItem = findSidebarItemByLink(
        rootSidebar,
        '/guide/',
        '/guide/setup/install'
      )
      expect(articleItem?.text).toBe('默认字段 H1 标题')
      expect(installItem?.text).toBe('默认字段安装页')
      expect(nestedLinks).not.toContain('/guide/setup/hidden')
    },
  },
  {
    name: 'sidebar-replace-conflict',
    assert(snapshot) {
      expectNoRootLocaleThemeOverride(snapshot)

      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar

      expect(uniqueLinks(rootNav)).toEqual(['/guide/'])
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/guide/')
      expect(
        Object.keys((rootSidebar ?? {}) as Record<string, unknown>)
      ).toEqual(['/guide/'])
      expect(flattenSidebarLinksBySection(rootSidebar, '/guide/')).toEqual([
        '/guide/install',
      ])
      expect(flattenSidebarLinksBySection(rootSidebar, '/manual/')).toEqual([])
      expect(
        findSidebarItemByLink(rootSidebar, '/guide/', '/guide/manual-entry')
      ).toBeUndefined()
    },
  },
  {
    name: 'dynamic-routes-multi-segment',
    assert(snapshot) {
      expectDynamicRoute(snapshot, 'blog/2024/hello-world.md', true)
      expectDynamicRoute(snapshot, 'blog/2025/release-note.md', false)
      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      expect(firstNavItem(rootNav)?.text).toBe('blog')
      expect(firstNavItem(rootNav)?.link).toBe('/blog/2024/hello-world')
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/blog/')
      expect(
        Object.keys((rootSidebar ?? {}) as Record<string, unknown>)
      ).toEqual(['/blog/'])
      expect(flattenSidebarLinksBySection(rootSidebar, '/blog/')).toEqual([
        '/blog/2024/hello-world',
        '/blog/2025/release-note',
      ])
      expect(
        findSidebarItemByText(rootSidebar, '/blog/', '2024')?.link
      ).toBeUndefined()
      expect(
        findSidebarItemByText(rootSidebar, '/blog/', '2025')?.link
      ).toBeUndefined()
      expect(
        findSidebarItemByLink(rootSidebar, '/blog/', '/blog/2024/hello-world')
          ?.text
      ).toBe('hello-world')
      expect(
        findSidebarItemByLink(rootSidebar, '/blog/', '/blog/2025/release-note')
          ?.text
      ).toBe('release-note')
    },
  },
  {
    name: 'summary-ignore',
    assert(snapshot) {
      expect(Object.keys(snapshot.vitepress.rewritesMap)).toEqual([])
      expect(snapshot.vitepress.rewrittenPages).toContain('SUMMARY.md')
      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      expect(uniqueLinks(rootNav)).toEqual(['/guide/'])
      expect(firstNavItem(rootNav)?.text).toBe('guide')
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/guide/')
      expect(
        Object.keys((rootSidebar ?? {}) as Record<string, unknown>)
      ).toEqual(['/guide/'])
      expect(flattenSidebarLinksBySection(rootSidebar, '/guide/')).toEqual([
        '/guide/intro',
        '/guide/setup',
      ])
      expect(
        findSidebarItemByLink(rootSidebar, '/guide/', '/guide/intro')?.text
      ).toBe('intro')
      expect(
        findSidebarItemByLink(rootSidebar, '/guide/', '/guide/setup')?.text
      ).toBe('setup')
      expect(
        flattenSidebarLinksBySection(rootSidebar, '/guide/')
      ).not.toContain('/summary')
      expect(
        findSidebarItemByText(rootSidebar, '/guide/', 'Summary')
      ).toBeUndefined()
    },
  },
  {
    name: 'hidden-pages-still-build',
    assert(snapshot) {
      const rootNav = snapshot.vitepress.site.themeConfig.nav
      const rootSidebar = snapshot.vitepress.site.themeConfig.sidebar
      expect(uniqueLinks(rootNav)).toEqual(['/guide/'])
      expect(firstNavItem(rootNav)?.text).toBe('guide')
      expect(firstNavItem(rootNav)?.activeMatch).toBe('/guide/')
      expect(flattenSidebarLinksBySection(rootSidebar, '/guide/')).toEqual([
        '/guide/public',
      ])
      expect(
        flattenSidebarLinksBySection(rootSidebar, '/guide/')
      ).not.toContain('/guide/hidden')
      expect(
        flattenSidebarLinksBySection(rootSidebar, '/guide/')
      ).not.toContain('/guide/internal/excluded')
      expect(snapshot.vitepress.rewrittenPages).toContain('guide/hidden.md')
      expect(snapshot.vitepress.rewrittenPages).toContain(
        'guide/internal/excluded.md'
      )
      expect(snapshot.vitepress.rewrittenPages).toContain('guide/public.md')
    },
  },
]

describe.sequential('example projects integration', () => {
  beforeAll(async () => {
    await rm(outputDir, { recursive: true, force: true })
    await mkdir(outputDir, { recursive: true })
  })

  for (const caseItem of cases) {
    it(
      caseItem.name,
      async () => {
        const outputFile = runBuild(caseItem.name)
        const snapshot = await readSnapshot(outputFile)
        caseItem.assert(snapshot)
      },
      120000
    )
  }
})
