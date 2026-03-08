import { describe, expect, it, vi } from 'vitest'
import type { AutoNavPluginOptions } from '../../src/types/plugin'
import type { Item } from '../../src/types/public'
import { normalizeOptions } from '../../src/core/normalizeOptions'

function createItem(options: {
  name: string
  index: number
  optionOrder?: number
  frontmatterOrder?: number
  frontmatterPrefixOrder?: number
}): Item {
  const frontmatter: Record<string, unknown> = {}
  if (options.frontmatterOrder !== undefined) {
    frontmatter.order = options.frontmatterOrder
  }
  if (options.frontmatterPrefixOrder !== undefined) {
    frontmatter.navOrder = options.frontmatterPrefixOrder
  }
  return {
    index: options.index,
    name: options.name,
    isFolder: false,
    options: {
      order: options.optionOrder,
    },
    frontmatter,
    children: [],
  }
}

describe('normalizeOptions', () => {
  describe('T101 include 归一化', () => {
    it('支持 string / array / 空值 / 非法值', () => {
      expect(normalizeOptions({ include: '**/*.md' }).include).toEqual([
        '**/*.md',
      ])
      expect(
        normalizeOptions({
          include: ['guide/**/*.md', '', '  ', 123 as unknown as string],
        }).include
      ).toEqual(['guide/**/*.md'])
      expect(normalizeOptions({ include: '' }).include).toBeUndefined()
      expect(
        normalizeOptions({ include: 1 as unknown as string }).include
      ).toBeUndefined()
    })

    it('支持 exclude 归一化与去重', () => {
      const normalized = normalizeOptions({
        exclude: ['**/draft/**', '  ', '**/draft/**', 1 as unknown as string],
      })
      expect(normalized.exclude).toEqual(['**/draft/**'])

      expect(normalizeOptions({ exclude: '**/*.tmp' }).exclude).toEqual([
        '**/*.tmp',
      ])
      expect(normalizeOptions({ exclude: '' }).exclude).toBeUndefined()
    })

    it('include/exclude 全部为空白值时回退 undefined', () => {
      expect(normalizeOptions({ include: ['', '  '] }).include).toBeUndefined()
      expect(normalizeOptions({ exclude: ['', '  '] }).exclude).toBeUndefined()
    })
  })

  describe('T102 standaloneIndex 默认与语义', () => {
    it('默认 false，显式 true 生效', () => {
      expect(normalizeOptions({}).standaloneIndex).toBe(false)
      expect(normalizeOptions({ standaloneIndex: true }).standaloneIndex).toBe(
        true
      )
      expect(normalizeOptions({ standaloneIndex: false }).standaloneIndex).toBe(
        false
      )
    })
  })

  describe('T103 overrides key 规范化', () => {
    it('规范化路径 key 并在重名冲突时后写覆盖前写', () => {
      const normalized = normalizeOptions({
        overrides: {
          'guide/getting-started.md': { visible: false },
          './guide/getting-started': { displayName: '快速开始' },
          '\\guide\\overview.md': { collapsed: true },
        },
      })

      expect(normalized.overrides['guide/getting-started']).toEqual({
        visible: true,
        preferArticleTitle: false,
        displayName: '快速开始',
      })
      expect(normalized.overrides['guide/overview']).toEqual({
        visible: true,
        preferArticleTitle: false,
        collapsed: true,
      })
    })

    it('overrides 中可解析 preferArticleTitle 与 order', () => {
      const normalized = normalizeOptions({
        overrides: {
          'guide/with-order.md': {
            order: 7,
            preferArticleTitle: true,
          },
        },
      })

      expect(normalized.overrides['guide/with-order']).toEqual({
        visible: true,
        preferArticleTitle: true,
        order: 7,
      })
    })

    it('非法 overrides value 与空 key 会被安全跳过/回退', () => {
      const normalized = normalizeOptions({
        overrides: {
          './': { visible: false },
          'guide/invalid.md': 1 as unknown as {
            visible?: boolean
          },
        },
      })

      expect(normalized.overrides['']).toBeUndefined()
      expect(normalized.overrides['guide/invalid']).toEqual({
        visible: true,
        preferArticleTitle: false,
      })
    })
  })

  describe('T104 frontmatterKeyPrefix / preferArticleTitle 默认行为', () => {
    it('类型层支持 exclude 传入单个字符串，并保持归一化结果一致', () => {
      const options: AutoNavPluginOptions = {
        exclude: 'drafts/**/*.md',
      }

      expect(normalizeOptions(options).exclude).toEqual(['drafts/**/*.md'])
    })

    it('默认值稳定，非法值回退默认', () => {
      const defaults = normalizeOptions({})
      expect(defaults.frontmatterKeyPrefix).toBe('')
      expect(defaults.preferArticleTitle).toBe(false)

      const invalids = normalizeOptions({
        frontmatterKeyPrefix: 1 as unknown as string,
        preferArticleTitle: 'true' as unknown as boolean,
      })
      expect(invalids.frontmatterKeyPrefix).toBe('')
      expect(invalids.preferArticleTitle).toBe(false)
    })

    it('frontmatterKeyPrefix 与 preferArticleTitle 支持显式合法值', () => {
      const normalized = normalizeOptions({
        frontmatterKeyPrefix: 'nav',
        preferArticleTitle: true,
        dev: {
          watchDebounceMs: 10,
          cache: false,
          logLevel: 'debug',
        },
      })
      expect(normalized.frontmatterKeyPrefix).toBe('nav')
      expect(normalized.preferArticleTitle).toBe(true)
      expect(normalized.dev).toEqual({
        watchDebounceMs: 10,
        cache: false,
        logLevel: 'debug',
      })
    })

    it('options 非对象时使用完整默认值', () => {
      const normalized = normalizeOptions(1 as unknown as AutoNavPluginOptions)
      expect(normalized.include).toBeUndefined()
      expect(normalized.exclude).toBeUndefined()
      expect(normalized.frontmatterKeyPrefix).toBe('')
      expect(normalized.preferArticleTitle).toBe(false)
    })
  })

  describe('T105 sorter 存在/缺失/异常返回', () => {
    it('存在 sorter 时优先使用用户 sorter', () => {
      const customSorter = vi.fn<AutoNavPluginOptions['sorter']>(() => -1)
      const normalized = normalizeOptions({
        sorter: customSorter,
      })

      const a = createItem({ name: 'a', index: 0, frontmatterOrder: 10 })
      const b = createItem({ name: 'b', index: 1, frontmatterOrder: 1 })
      const result = normalized.sorter(a, b)

      expect(result).toBe(-1)
      expect(customSorter).toHaveBeenCalledOnce()
    })

    it('缺失 sorter 时使用默认排序', () => {
      const normalized = normalizeOptions({})
      const a = createItem({ name: 'a', index: 0, optionOrder: 10 })
      const b = createItem({ name: 'b', index: 1, frontmatterOrder: 1 })

      expect(normalized.sorter(a, b)).toBeGreaterThan(0)
    })

    it('sorter 抛异常或返回异常值时回退默认排序', () => {
      const a = createItem({ name: 'a', index: 0, frontmatterPrefixOrder: 10 })
      const b = createItem({ name: 'b', index: 1, frontmatterPrefixOrder: 1 })

      const thrower = normalizeOptions({
        sorter: () => {
          throw new Error('boom')
        },
      })
      expect(thrower.sorter(a, b, 'nav')).toBeGreaterThan(0)

      const invalid = normalizeOptions({
        sorter: () => Number.NaN,
      })
      expect(invalid.sorter(a, b, 'nav')).toBeGreaterThan(0)
    })

    it('默认 sorter 支持 index、name 与完全相等回退', () => {
      const sorter = normalizeOptions({}).sorter

      const byIndexA = createItem({ name: 'same', index: 1 })
      const byIndexB = createItem({ name: 'same', index: 2 })
      expect(sorter(byIndexA, byIndexB)).toBeLessThan(0)

      const byNameA = createItem({ name: 'alpha', index: 1 })
      const byNameB = createItem({ name: 'beta', index: 1 })
      expect(sorter(byNameA, byNameB)).toBeLessThan(0)

      const equalA = createItem({ name: 'same', index: 1 })
      const equalB = createItem({ name: 'same', index: 1 })
      expect(sorter(equalA, equalB)).toBe(0)
    })

    it('当 item.options 非对象时会回退到 frontmatter 排序', () => {
      const sorter = normalizeOptions({}).sorter
      const a = createItem({
        name: 'a',
        index: 0,
        frontmatterOrder: 3,
      })
      const b = createItem({
        name: 'b',
        index: 1,
        frontmatterOrder: 1,
      })
      ;(a as unknown as { options: unknown }).options = null
      ;(b as unknown as { options: unknown }).options = null

      expect(sorter(a, b)).toBeGreaterThan(0)
    })

    it('默认 sorter 覆盖单边 order 与非字符串 name 分支', () => {
      const sorter = normalizeOptions({}).sorter
      const withOrder = createItem({
        name: 'with-order',
        index: 1,
        optionOrder: 1,
      })
      const withoutOrder = createItem({
        name: 'without-order',
        index: 0,
      })
      expect(sorter(withOrder, withoutOrder)).toBeLessThan(0)
      expect(sorter(withoutOrder, withOrder)).toBeGreaterThan(0)

      const weird = createItem({
        name: 'normal',
        index: 0,
      })
      ;(weird as unknown as { name: unknown }).name = 1
      ;(weird as unknown as { frontmatter: unknown }).frontmatter = null
      expect(sorter(weird, withoutOrder)).toBeLessThanOrEqual(0)
    })
  })
})
