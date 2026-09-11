import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import type { C3InstanceArray } from '@/utils/c3-parser'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import * as c3CompactionModule from '@/utils/c3-compaction'
import * as c3CompactionDom from '@/utils/c3-compaction-dom'
import * as c3CharRenderer from '@/utils/c3-char-renderer'
import { C3GenerationStorage } from '@/utils/storage'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage } from './helpers/fake-image'
import {
  createSampleArray,
  makePngBlob,
  makeSpriteSheetImageData,
  cellAnchorPixel,
  appendedCellPosition,
} from './helpers/c3-fixtures'
import { resetFakeIndexedDB } from './fake-indexeddb'

// spacingData 含一条等于旧 characterWidth 的冗余项（[16,"A"]），
// 供精简「只删 cw 等值冗余项」语义的可观测断言；重排则要求 spacing 逐字节不动。
const SPACING_WITH_REDUNDANT = '[[16,"A"],[10,"B"]]'

async function importSample(store: ReturnType<typeof useEditorStore>) {
  const image = new FakeImage(32, 32)
  const array = createSampleArray('AB', SPACING_WITH_REDUNDANT)
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
  store.appendC3Characters(['C'])
  store.updateC3AppendedExtraSpacing(0, 3)
  store.c3AppendedEntries[0].margin = { top: 2, right: 1, bottom: 3, left: 4 }
  store.c3AppendedEntries[0].distributionOffset = 6
  return JSON.parse(JSON.stringify(store.c3AppendedEntries))
}

function mockEncodeDecode(width: number, height: number) {
  vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
  vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
    new FakeImage(width, height) as unknown as HTMLImageElement,
  )
}

/**
 * 精简像素断言：char i 的内容像素从旧原点 + crop 偏移搬到新 cell 原点，
 * RGB 由 seed 区分，证明像素身份与位置都正确。
 */
function expectCompactedCellAt(
  source: ImageData,
  repacked: ImageData,
  plan: {
    crop: { left: number; top: number }
    newColumns: number
    newCharacterWidth: number
    newCharacterHeight: number
  },
  oldColumns: number,
  oldCellWidth: number,
  oldCellHeight: number,
  i: number,
) {
  const oldCol = i % oldColumns
  const oldRow = Math.floor(i / oldColumns)
  const newCol = i % plan.newColumns
  const newRow = Math.floor(i / plan.newColumns)
  expect(
    cellAnchorPixel(
      repacked,
      newCol * plan.newCharacterWidth,
      newRow * plan.newCharacterHeight,
    ),
  ).toEqual(
    cellAnchorPixel(
      source,
      oldCol * oldCellWidth + plan.crop.left,
      oldRow * oldCellHeight + plan.crop.top,
    ),
  )
}

/**
 * 重排像素断言：char i 的 RGBA 原样搬到 (i % cols, ⌊i/cols⌋) 的新 cell 原点。
 */
function expectRewrappedCellAt(
  source: ImageData,
  repacked: ImageData,
  newColumns: number,
  cellWidth: number,
  cellHeight: number,
  i: number,
) {
  const oldCol = i % Math.floor(source.width / cellWidth)
  const oldRow = Math.floor(i / Math.floor(source.width / cellWidth))
  const newCol = i % newColumns
  const newRow = Math.floor(i / newColumns)
  expect(cellAnchorPixel(repacked, newCol * cellWidth, newRow * cellHeight)).toEqual(
    cellAnchorPixel(source, oldCol * cellWidth, oldRow * cellHeight),
  )
}

describe('C3 rewrap × compaction combination', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetFakeIndexedDB()
    installMemoryLocalStorage()
    vi.stubGlobal('Image', FakeImage)
    vi.spyOn(c3CompactionModule, 'verifyCanvasAlphaRoundTrip').mockReturnValue(true)
    vi.spyOn(c3CharRenderer, 'measureGlyphBounds').mockReturnValue({ width: 8, height: 12 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('compact then rewrap produces a valid generation', async () => {
    const store = useEditorStore()
    const entriesBefore = await importSample(store)

    // 1) 精简：32×32 → cell 14×9（fontSpriteWidth 保持 32，导入基图 32×9）
    const compactSource = makeSpriteSheetImageData(2, 1, 16, 16, 2)
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(compactSource)
    const compacted = store.prepareC3Compaction()
    expect(compacted.kind).toBe('plan')
    if (compacted.kind !== 'plan') return
    expect(compacted.plan.newCharacterWidth).toBe(14)
    expect(compacted.plan.newCharacterHeight).toBe(9)
    expect(compacted.repacked.width).toBe(32)
    expect(compacted.repacked.height).toBe(9)
    expectCompactedCellAt(compactSource, compacted.repacked, compacted.plan, 2, 16, 16, 0)
    expectCompactedCellAt(compactSource, compacted.repacked, compacted.plan, 2, 16, 16, 1)

    mockEncodeDecode(32, 18)
    const compactApplied = await store.applyC3SpriteCompaction(
      compacted.plan,
      compacted.repacked,
    )
    expect(compactApplied.ok).toBe(true)

    // 精简语义：cell 缩小、instance 更新、只删 cw 等值冗余项、margin/padding 归零
    expect(store.baseCellConfig.width).toBe(14)
    expect(store.baseCellConfig.height).toBe(9)
    expect(store.c3InstanceArray?.[2]).toBe(14)
    expect(store.c3InstanceArray?.[3]).toBe(9)
    expect(store.c3InstanceArray?.[5]).toBe('[[10,"B"]]')
    expect(store.importedSpacingData).toBe('[[10,"B"]]')
    expect(store.baseImageConfig.fontSpriteWidth).toBe(32)
    expect(store.baseImageConfig.fontSpriteHeight).toBe(18)
    expect(store.baseImageConfig.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(store.baseImageConfig.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(JSON.parse(JSON.stringify(store.c3AppendedEntries))).toEqual(entriesBefore)

    // 2) 重排：14×9 cell 基线（32×18，2 列）→ 目标 16（⌊16/14⌋=1 列）
    // 精简后的导入基图带右侧透明余量（28 用过列 < 32 fontSpriteWidth）
    const rewrapSource = makeSpriteSheetImageData(2, 2, 14, 9, 2, 32)
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(rewrapSource)
    const rewrapped = store.prepareC3Rewrap(16)
    expect(rewrapped.kind).toBe('plan')
    if (rewrapped.kind !== 'plan') return
    expect(rewrapped.plan.oldColumns).toBe(2)
    expect(rewrapped.plan.newColumns).toBe(1)
    expect(rewrapped.plan.newRows).toBe(3)
    expect(rewrapped.repacked.width).toBe(16)
    expect(rewrapped.repacked.height).toBe(27)
    expectRewrappedCellAt(rewrapSource, rewrapped.repacked, 1, 14, 9, 0)
    expectRewrappedCellAt(rewrapSource, rewrapped.repacked, 1, 14, 9, 1)

    mockEncodeDecode(16, 27)
    const rewrapApplied = await store.applyC3SpriteRewrap(
      rewrapped.plan,
      rewrapped.repacked,
    )
    expect(rewrapApplied.ok).toBe(true)

    // 重排语义：cell 尺寸与 c3-instance/spacingData 逐字节不动，margin/padding 归零
    expect(store.baseCellConfig.width).toBe(14)
    expect(store.baseCellConfig.height).toBe(9)
    expect(store.c3InstanceArray?.[2]).toBe(14)
    expect(store.c3InstanceArray?.[3]).toBe(9)
    expect(store.c3InstanceArray?.[4]).toBe('AB')
    expect(store.c3InstanceArray?.[5]).toBe('[[10,"B"]]')
    expect(store.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(store.baseImageConfig.fontSpriteHeight).toBe(27)
    expect(store.baseImageConfig.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(store.baseImageConfig.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(store.originalImageWidth).toBe(16)
    expect(store.originalImageHeight).toBe(27)
    // 追加字符原样保留，按最终布局渲染：cellIndex 2、1 列 → (0, 18)
    expect(JSON.parse(JSON.stringify(store.c3AppendedEntries))).toEqual(entriesBefore)
    expect(store.c3EffectiveCharacterSet).toBe('ABC')
    expect(appendedCellPosition(store, 0)).toEqual({ x: 0, y: 18 })

    // 两次组合后仍是合法 generation（尺寸精确、spacing 保持精简后的迁移结果）
    const generation = C3GenerationStorage.readActiveC3Generation()!
    expect(generation.c3Config.originalImageWidth).toBe(16)
    expect(generation.c3Config.originalImageHeight).toBe(27)
    expect(generation.c3Config.importedSpacingData).toBe('[[10,"B"]]')
    expect(generation.c3Config.appendedEntries).toHaveLength(1)
    const persistedArray = JSON.parse(generation.c3Config.instanceArrayJson) as C3InstanceArray
    expect(persistedArray[2]).toBe(14)
    expect(persistedArray[3]).toBe(9)
    expect(persistedArray[5]).toBe('[[10,"B"]]')
  })

  it('rewrap then compact produces a valid generation', async () => {
    const store = useEditorStore()
    const entriesBefore = await importSample(store)

    // 1) 重排：32×32（2 列）→ 目标 16（1 列，3 行密铺 48 高）
    const rewrapSource = makeSpriteSheetImageData(2, 1, 16, 16, 2)
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(rewrapSource)
    const rewrapped = store.prepareC3Rewrap(16)
    expect(rewrapped.kind).toBe('plan')
    if (rewrapped.kind !== 'plan') return
    expect(rewrapped.plan.oldColumns).toBe(2)
    expect(rewrapped.plan.newColumns).toBe(1)
    expect(rewrapped.repacked.width).toBe(16)
    expect(rewrapped.repacked.height).toBe(48)
    expectRewrappedCellAt(rewrapSource, rewrapped.repacked, 1, 16, 16, 0)
    expectRewrappedCellAt(rewrapSource, rewrapped.repacked, 1, 16, 16, 1)

    mockEncodeDecode(16, 48)
    const rewrapApplied = await store.applyC3SpriteRewrap(
      rewrapped.plan,
      rewrapped.repacked,
    )
    expect(rewrapApplied.ok).toBe(true)

    // 重排语义：cell 与 c3-instance/spacingData 不动，margin/padding 归零
    expect(store.baseCellConfig.width).toBe(16)
    expect(store.baseCellConfig.height).toBe(16)
    expect(store.c3InstanceArray?.[2]).toBe(16)
    expect(store.c3InstanceArray?.[3]).toBe(16)
    expect(store.c3InstanceArray?.[5]).toBe(SPACING_WITH_REDUNDANT)
    expect(store.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(store.baseImageConfig.fontSpriteHeight).toBe(48)
    expect(store.baseImageConfig.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(store.baseImageConfig.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(JSON.parse(JSON.stringify(store.c3AppendedEntries))).toEqual(entriesBefore)

    // 2) 精简：16×48（1 列，16×16 cell）→ cell 14×9（导入基图 16×18）
    const compactSource = makeSpriteSheetImageData(1, 3, 16, 16, 2)
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(compactSource)
    const compacted = store.prepareC3Compaction()
    expect(compacted.kind).toBe('plan')
    if (compacted.kind !== 'plan') return
    expect(compacted.plan.newCharacterWidth).toBe(14)
    expect(compacted.plan.newCharacterHeight).toBe(9)
    expect(compacted.repacked.width).toBe(16)
    expect(compacted.repacked.height).toBe(18)
    expect(compacted.plan.newFinalTextureHeight).toBe(27)
    expectCompactedCellAt(compactSource, compacted.repacked, compacted.plan, 1, 16, 16, 0)
    expectCompactedCellAt(compactSource, compacted.repacked, compacted.plan, 1, 16, 16, 1)

    mockEncodeDecode(16, 18)
    const compactApplied = await store.applyC3SpriteCompaction(
      compacted.plan,
      compacted.repacked,
    )
    expect(compactApplied.ok).toBe(true)

    // 精简语义：cell 缩小、instance 更新、只删 cw 等值冗余项（16 → [16,"A"] 被删）
    expect(store.baseCellConfig.width).toBe(14)
    expect(store.baseCellConfig.height).toBe(9)
    expect(store.c3InstanceArray?.[2]).toBe(14)
    expect(store.c3InstanceArray?.[3]).toBe(9)
    expect(store.c3InstanceArray?.[4]).toBe('AB')
    expect(store.c3InstanceArray?.[5]).toBe('[[10,"B"]]')
    expect(store.importedSpacingData).toBe('[[10,"B"]]')
    // fontSpriteWidth 保持 16；导入基图 16×18，最终纹理高度 27 = 3 字符 1 列 × 9
    expect(store.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(store.baseImageConfig.fontSpriteHeight).toBe(27)
    expect(store.originalImageWidth).toBe(16)
    expect(store.originalImageHeight).toBe(18)
    // 追加字符原样保留，按最终布局渲染：cellIndex 2、1 列 → (0, 18)
    expect(JSON.parse(JSON.stringify(store.c3AppendedEntries))).toEqual(entriesBefore)
    expect(store.c3EffectiveCharacterSet).toBe('ABC')
    expect(appendedCellPosition(store, 0)).toEqual({ x: 0, y: 18 })

    // 两次组合后仍是合法 generation
    const generation = C3GenerationStorage.readActiveC3Generation()!
    expect(generation.c3Config.originalImageWidth).toBe(16)
    expect(generation.c3Config.originalImageHeight).toBe(18)
    expect(generation.c3Config.importedSpacingData).toBe('[[10,"B"]]')
    expect(generation.c3Config.appendedEntries).toHaveLength(1)
    const generalState = generation.generalState as {
      baseCellConfig: { width: number; height: number }
      baseImageConfig: { fontSpriteWidth?: number; fontSpriteHeight?: number }
    }
    expect(generalState.baseCellConfig.width).toBe(14)
    expect(generalState.baseCellConfig.height).toBe(9)
    expect(generalState.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(generalState.baseImageConfig.fontSpriteHeight).toBe(27)
  })
})
