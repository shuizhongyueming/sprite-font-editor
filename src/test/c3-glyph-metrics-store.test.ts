import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import * as c3CompactionDom from '@/utils/c3-compaction-dom'
import * as c3CharRenderer from '@/utils/c3-char-renderer'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage } from './helpers/fake-image'
import { createSampleArray, makePngBlob } from './helpers/c3-fixtures'
import { resetFakeIndexedDB } from './fake-indexeddb'

/**
 * issue #21 store 级验证：导入 sheet 实测结构（bearing/overhang 中位数）
 * 与追加字符的 effective bearing/overhang 统一，使混排跨界间距与组内
 * 间距遵循同一公式（相邻视觉间距 = 后字 bearing − 前字 overhang）。
 */

/** 32×32 两列 sheet：A、B 内容均为 cell 内 x=2..13、y=0..7 */
function makeImportedSheet(): ImageData {
  const img = new ImageData(32, 32)
  for (const originX of [0, 16]) {
    for (let y = 0; y <= 7; y++) {
      for (let x = 2; x <= 13; x++) {
        img.data[(y * 32 + originX + x) * 4 + 3] = 255
      }
    }
  }
  return img
}

async function importWithSheet(spacingData: string) {
  const store = useEditorStore()
  const image = new FakeImage(32, 32)
  const array = createSampleArray('AB', spacingData)
  const parsed = parseC3InstanceArray(JSON.stringify(array))
  await store.importC3SpriteFont(
    image as unknown as HTMLImageElement,
    array,
    parsed,
    'c3-sprite.png',
    32,
    32,
    'image/png',
    makePngBlob(),
  )
  return store
}

describe('C3 glyph metrics alignment (issue #21)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetFakeIndexedDB()
    installMemoryLocalStorage()
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(makeImportedSheet())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('measures imported sheet metrics as bearing/overhang medians', async () => {
    const store = await importWithSheet('[[10,"A"]]')
    // A advance 10 → overhang 14−10 = 4；B 缺省 advance 16 → overhang 14−16 = −2
    // bearing 中位数 2；overhang 中位数 round((4+(−2))/2) = 1
    expect(store.c3ImportedGlyphMetrics).toEqual({ bearing: 2, overhang: 1 })
  })

  it('appends characters whose effective bearing/overhang match the imported medians', async () => {
    const store = await importWithSheet('[[10,"A"]]')
    vi.spyOn(c3CharRenderer, 'measureGlyphBounds').mockReturnValue({
      width: 8,
      height: 12,
      left: 2,
      top: 0,
    })
    store.appendC3Characters(['C'])

    const entry = store.c3AppendedEntries[0]
    const metrics = store.c3ImportedGlyphMetrics!
    // 新口径 advance：round(bearing 2 + glyphWidth 8 − overhang 1) = 9
    expect(entry.autoDisplayWidth).toBe(9)
    // 渲染链锚定：ink 左缘 = padding.left + autoBearingOffset（+ margin.left），
    // offset 为全条目统一值 bearing − padding.left
    expect(entry.autoBearingOffset).toBe(2)
    expect(entry.autoGlyphWidth).toBe(8)

    // 渲染左缘不变量：padding.left + autoBearingOffset === metrics.bearing
    expect(store.baseCellConfig.padding.left + entry.autoBearingOffset!).toBe(
      metrics.bearing,
    )
    // overhang 不变量：bearing + glyphWidth − advance === metrics.overhang
    //（导入→追加、追加→导入跨界间距与组内同公式：后字 bearing − 前字 overhang）
    expect(
      metrics.bearing + entry.autoGlyphWidth! - entry.autoDisplayWidth,
    ).toBe(metrics.overhang)

    // 水平偏移确实进入渲染输入（getEffectiveCharMargin 同一 helper 路径）
    expect(store.getEffectiveCharMargin(0).left).toBe(
      entry.autoBearingOffset! + entry.margin.left,
    )
  })

  it('anchors the bearing offset to the render chain, independent of glyph ink offset', async () => {
    const store = await importWithSheet('[[10,"A"]]')
    // 渲染链按 alpha bbox 裁剪后 ink 左缘恒锚在 padding.left + margin.left，
    // 与字体自身 ink 偏移无关：两次度量 left 不同，offset 必须相同
    const boundsSpy = vi.spyOn(c3CharRenderer, 'measureGlyphBounds')
    boundsSpy.mockReturnValue({ width: 8, height: 12, left: 6, top: 0 })
    store.appendC3Characters(['C'])
    boundsSpy.mockReturnValue({ width: 8, height: 12, left: 0, top: 0 })
    store.appendC3Characters(['D'])

    expect(store.c3AppendedEntries[0].autoBearingOffset).toBe(2)
    expect(store.c3AppendedEntries[1].autoBearingOffset).toBe(2)
    expect(store.c3AppendedEntries[0].autoDisplayWidth).toBe(9)
    expect(store.getEffectiveCharMargin(0).left).toBe(2)
  })

  it('keeps the legacy advance formula when the imported sheet has no measurable content', async () => {
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(new ImageData(32, 32))
    const store = await importWithSheet('[[10,"A"]]')
    expect(store.c3ImportedGlyphMetrics).toBeNull()

    vi.spyOn(c3CharRenderer, 'measureGlyphBounds').mockReturnValue({
      width: 8,
      height: 12,
      left: 2,
      top: 0,
    })
    store.appendC3Characters(['C'])

    // metrics 缺失 → 旧口径 width + padding.left，且水平偏移 0（旧行为）
    expect(store.c3AppendedEntries[0].autoDisplayWidth).toBe(8)
    expect(store.c3AppendedEntries[0].autoBearingOffset).toBe(0)
    expect(store.getEffectiveCharMargin(0).left).toBe(0)
  })

  it('upgrades legacy entries on recalculate and recomputes them on rewrap', async () => {
    const store = await importWithSheet('[[10,"A"]]')
    vi.spyOn(c3CharRenderer, 'measureGlyphBounds').mockReturnValue({
      width: 8,
      height: 12,
      left: 2,
      top: 0,
    })
    store.appendC3Characters(['C'])

    // 模拟旧数据：抹掉新字段（保守迁移后缺省的形态）
    const legacy = store.c3AppendedEntries[0] as Record<string, unknown>
    delete legacy.autoGlyphWidth
    delete legacy.autoBearingOffset
    store.c3AppendedEntries[0].autoDisplayWidth = 8

    // 重算垂直度量时顺便升级：写入 width/offset，advance 按新口径
    store.recalculateC3AppendedVerticalMetrics()
    const upgraded = store.c3AppendedEntries[0]
    expect(upgraded.autoGlyphWidth).toBe(8)
    expect(upgraded.autoBearingOffset).toBe(2)
    expect(upgraded.autoDisplayWidth).toBe(9)
  })

  it('recomputes the bearing offset when cell padding.left changes', async () => {
    const store = await importWithSheet('[[10,"A"]]')
    vi.spyOn(c3CharRenderer, 'measureGlyphBounds').mockReturnValue({
      width: 8,
      height: 12,
      left: 2,
      top: 0,
    })
    store.appendC3Characters(['C'])
    // bearing 2 − padding.left 0 = 2
    expect(store.c3AppendedEntries[0].autoBearingOffset).toBe(2)

    store.baseCellConfig.padding.left = 3
    await nextTick()

    // 重算为 bearing 2 − padding.left 3 = −1，渲染左缘不变量保持成立；
    // metrics 存在时 advance 与 padding 无关，保持 9
    const entry = store.c3AppendedEntries[0]
    expect(entry.autoBearingOffset).toBe(-1)
    expect(entry.autoDisplayWidth).toBe(9)
    expect(store.baseCellConfig.padding.left + entry.autoBearingOffset!).toBe(
      store.c3ImportedGlyphMetrics!.bearing,
    )
  })
})
