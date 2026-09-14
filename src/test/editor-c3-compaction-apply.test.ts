import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import type { C3InstanceArray } from '@/utils/c3-parser'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import {
  analyzeC3SpriteCompaction,
  repackC3ImportedCells,
} from '@/utils/c3-compaction'
import type { C3CompactionPlan } from '@/utils/c3-compaction'
import * as c3CompactionModule from '@/utils/c3-compaction'
import * as c3CompactionDom from '@/utils/c3-compaction-dom'
import * as c3CharRenderer from '@/utils/c3-char-renderer'
import { C3GenerationStorage } from '@/utils/storage'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage } from './helpers/fake-image'
import {
  createSampleArray,
  makePngBlob,
  makeSourceImageData,
  makeSource,
} from './helpers/c3-fixtures'
import { resetFakeIndexedDB, failNextIndexedDBPut } from './fake-indexeddb'

async function setupCompactionScenario(options?: { filename?: string; mimeType?: string }) {
  const store = useEditorStore()
  const image = new FakeImage(32, 32)
  const array = createSampleArray('AB', '[[10,"A"]]')
  const parsed = parseC3InstanceArray(JSON.stringify(array))
  await store.importC3SpriteFont(
    image as unknown as HTMLImageElement,
    array,
    parsed,
    options?.filename ?? 'c3-sprite.png',
    32,
    32,
    options?.mimeType ?? 'image/png',
    makePngBlob(),
  )

  const sourceImageData = makeSourceImageData()
  const source = makeSource()
  const analysis = analyzeC3SpriteCompaction(sourceImageData, source)
  if (analysis.kind !== 'plan') {
    throw new Error('expected a compaction plan')
  }

  const plan = analysis
  const repack = repackC3ImportedCells(sourceImageData, plan, source)
  if (repack.kind !== 'ok') {
    throw new Error('expected repack success')
  }

  return { store, image, array, parsed, plan, repacked: repack.image }
}

describe('editorStore.applyC3SpriteCompaction', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetFakeIndexedDB()
    installMemoryLocalStorage()
    vi.stubGlobal('Image', FakeImage)
    vi.spyOn(c3CompactionModule, 'verifyCanvasAlphaRoundTrip').mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('applies the plan atomically and establishes the compacted baseline', async () => {
    const { store, plan, repacked } = await setupCompactionScenario()
    const decoded = new FakeImage(plan.newImageWidth, plan.newImageHeight)
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      decoded as unknown as HTMLImageElement,
    )
    store.selectedCharIndex = 7
    const triggerBefore = store.renderTrigger

    const result = await store.applyC3SpriteCompaction(plan, repacked)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // 基线配置
    expect(store.baseCellConfig.width).toBe(14)
    expect(store.baseCellConfig.height).toBe(9)
    expect(store.baseCellConfig.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(store.baseCellConfig.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })

    expect(store.baseImageConfig.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(store.baseImageConfig.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(store.baseImageConfig.fontSpriteWidth).toBe(32)
    expect(store.baseImageConfig.fontSpriteHeight).toBe(9)

    expect(store.originalImageWidth).toBe(32)
    expect(store.originalImageHeight).toBe(9)
    expect(store.baseImageMimeType).toBe('image/png')
    // pinia store 代理会 reactive 包装对象值，不能断言 ===；断言尺寸与身份分离
    expect((store.c3ImportedImage as unknown as FakeImage).width).toBe(32)
    expect((store.c3ImportedImage as unknown as FakeImage).height).toBe(9)
    expect((store.baseImage as unknown as FakeImage).width).toBe(32)
    expect((store.baseImage as unknown as FakeImage).height).toBe(9)
    expect(store.c3ImportedImage).not.toBeNull()
    expect(store.c3ImportedImageFilename).toBe('c3-sprite.png')

    // C3 instance 基线：2/3 新 cell，4 只含导入字符集，5 为清理后 spacing
    const array = store.c3InstanceArray!
    expect(array[2]).toBe(14)
    expect(array[3]).toBe(9)
    expect(array[4]).toBe('AB')
    expect(array[5]).toBe(store.importedSpacingData)

    // 未覆盖字符的默认宽度跟随新 cell；显式 spacing 保持（等旧宽度的冗余项已删）
    expect(store.importedSpacingData).toBe('[[10,"A"]]')

    // 非字体字段逐个保持
    const original = createSampleArray()
    expect(array[0]).toBe(original[0])
    expect(array[1]).toBe(original[1])
    expect(array[6]).toBe(original[6])
    expect(array[7]).toBe(original[7])
    expect(array[8]).toBe(original[8])
    expect(array[9]).toBe(original[9])
    expect(array[10]).toBe(original[10])
    expect(array[11]).toBe(original[11])
    expect(array[12]).toBe(original[12])
    expect(array[13]).toBe(original[13])
    expect(array[14]).toBe(original[14])

    // 瞬时选择态清除、画布尺寸刷新、一次重绘
    expect(store.selectedCharIndex).toBeNull()
    expect(store.canvasBaseWidth).toBe(32)
    expect(store.canvasBaseHeight).toBe(9)
    expect(store.renderTrigger).toBe(triggerBefore + 1)

    // 持久化：active generation 指向新状态，asset 为新图尺寸
    const generation = C3GenerationStorage.readActiveC3Generation()!
    const persistedArray = JSON.parse(generation.c3Config.instanceArrayJson) as C3InstanceArray
    expect(persistedArray[2]).toBe(14)
    expect(persistedArray[3]).toBe(9)
    expect(persistedArray[4]).toBe('AB')
    expect(persistedArray[5]).toBe('[[10,"A"]]')
    const generalState = generation.generalState as {
      baseCellConfig: { width: number; height: number }
      baseImageConfig: { fontSpriteHeight?: number }
    }
    expect(generalState.baseCellConfig.width).toBe(14)
    expect(generalState.baseCellConfig.height).toBe(9)
    expect(generalState.baseImageConfig.fontSpriteHeight).toBe(9)

    const asset = await C3GenerationStorage.loadActiveC3ImageAsset()
    expect(asset?.width).toBe(32)
    expect(asset?.height).toBe(9)
  })

  it('preserves the webp source format instead of forcing png', async () => {
    const { store, plan, repacked } = await setupCompactionScenario({
      filename: 'c3-sprite.webp',
      mimeType: 'image/webp',
    })
    const webpBlob = new Blob(['fake-webp-bytes'], { type: 'image/webp' })
    const encodeSpy = vi
      .spyOn(c3CompactionDom, 'encodeC3RepackedImage')
      .mockResolvedValue(webpBlob)
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(plan.newImageWidth, plan.newImageHeight) as unknown as HTMLImageElement,
    )

    const result = await store.applyC3SpriteCompaction(plan, repacked)

    expect(result.ok).toBe(true)
    expect(encodeSpy).toHaveBeenCalledWith(expect.anything(), 'image/webp')
    expect(store.baseImageMimeType).toBe('image/webp')

    const generation = C3GenerationStorage.readActiveC3Generation()!
    const generalState = generation.generalState as { baseImageMimeType?: string }
    expect(generalState.baseImageMimeType).toBe('image/webp')
    const asset = await C3GenerationStorage.loadActiveC3ImageAsset()
    expect(asset?.blob.type).toBe('image/webp')
  })

  it('applies a width-only compaction where the height cannot shrink', async () => {
    const { store } = await setupCompactionScenario()
    // 高度方向上下只剩 1px 安全边（crop top/bottom = 0），仅横向有收益：
    // 16x16 -> 12x16，newFinalTextureHeight 与旧值相同（列数不变）
    const plan: C3CompactionPlan = {
      kind: 'plan',
      crop: { top: 0, right: 2, bottom: 0, left: 2 },
      newCharacterWidth: 12,
      newCharacterHeight: 16,
      newColumns: 2,
      newImageWidth: 32,
      newImageHeight: 16,
      importedCount: 2,
      oldFinalTextureHeight: 16,
      newFinalTextureHeight: 16,
      cellExtents: [],
    }
    const repacked = new ImageData(32, 16)
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(32, 16) as unknown as HTMLImageElement,
    )

    const result = await store.applyC3SpriteCompaction(plan, repacked)

    expect(result.ok).toBe(true)
    expect(store.baseCellConfig.width).toBe(12)
    expect(store.baseCellConfig.height).toBe(16)
  })

  it('rejects a plan whose crop no longer matches the current cell config', async () => {
    const { store } = await setupCompactionScenario()
    // newCharacterWidth 与 crop 等式不一致（16-2-2=12 ≠ 13）→ plan 期后配置被改动
    const plan: C3CompactionPlan = {
      kind: 'plan',
      crop: { top: 0, right: 2, bottom: 0, left: 2 },
      newCharacterWidth: 13,
      newCharacterHeight: 16,
      newColumns: 2,
      newImageWidth: 32,
      newImageHeight: 16,
      importedCount: 2,
      oldFinalTextureHeight: 16,
      newFinalTextureHeight: 16,
      cellExtents: [],
    }
    const repacked = new ImageData(32, 16)

    const result = await store.applyC3SpriteCompaction(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'invalid-output-dimensions' })
  })

  it('recomputes appended horizontal metrics against the compacted structure without remeasuring', async () => {
    const { store, plan, repacked } = await setupCompactionScenario()
    const measureSpy = vi
      .spyOn(c3CharRenderer, 'measureGlyphBounds')
      .mockReturnValue({ width: 8, height: 12, left: 2, top: 0 })
    store.appendC3Characters(['C'])
    store.updateC3AppendedExtraSpacing(0, 3)
    // append 对每个追加字符度量一次；此后 apply 只重实测导入 sheet，不得重测字形
    expect(measureSpy).toHaveBeenCalledTimes(1)
    // 导入图无内容（测试环境像素读取为空）→ 追加时 metrics 缺失，走旧口径
    expect(store.c3AppendedEntries[0].autoDisplayWidth).toBe(8)
    expect(store.c3AppendedEntries[0].autoBearingOffset).toBe(0)

    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(32, 9) as unknown as HTMLImageElement,
    )

    const result = await store.applyC3SpriteCompaction(plan, repacked)
    expect(result.ok).toBe(true)

    // apply 不重测字形（纯像素实测 + 公式重算）
    expect(measureSpy).toHaveBeenCalledTimes(1)
    // issue #21 有意为之的行为变化：精简改变 cell/像素布局 → metrics 变为
    // bearing 1 / overhang 1 → autoDisplayWidth = round(1+8−1) = 8、
    // autoBearingOffset = bearing − padding.left = 1，追加条目按新结构重算
    expect(store.c3AppendedEntries[0].autoDisplayWidth).toBe(8)
    expect(store.c3AppendedEntries[0].autoBearingOffset).toBe(1)
    expect(store.c3AppendedEntries[0].autoGlyphHeight).toBe(12)
    expect(store.c3AppendedEntries[0].extraSpacing).toBe(3)
    expect(store.c3AppendedEntries[0].char).toBe('C')
  })

  it('fails closed when verifyCanvasAlphaRoundTrip is false', async () => {
    const { store, plan, repacked } = await setupCompactionScenario()
    vi.spyOn(c3CompactionModule, 'verifyCanvasAlphaRoundTrip').mockReturnValue(false)
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(32, 9) as unknown as HTMLImageElement,
    )

    const snapshot = JSON.stringify(store.baseCellConfig)
    const generationBefore = C3GenerationStorage.readActiveC3GenerationId()

    const result = await store.applyC3SpriteCompaction(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'alpha-roundtrip-failed' })
    expect(JSON.stringify(store.baseCellConfig)).toBe(snapshot)
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(generationBefore)
  })

  it('fails closed when PNG encoding fails and leaves everything unchanged', async () => {
    const { store, plan, repacked } = await setupCompactionScenario()
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(null)

    const configBefore = JSON.stringify(store.baseCellConfig)
    const instanceBefore = store.c3InstanceArray
    const activeBefore = C3GenerationStorage.readActiveC3GenerationId()

    const result = await store.applyC3SpriteCompaction(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'unreliable-canvas' })
    expect(JSON.stringify(store.baseCellConfig)).toBe(configBefore)
    expect(store.c3InstanceArray).toBe(instanceBefore)
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(activeBefore)
  })

  it('fails closed when PNG decoding fails', async () => {
    const { store, plan, repacked } = await setupCompactionScenario()
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(null)

    const result = await store.applyC3SpriteCompaction(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'unreliable-canvas' })
    expect(store.baseCellConfig.width).toBe(16)
  })

  it('rejects repacked dimensions that mismatch the plan', async () => {
    const { store, plan } = await setupCompactionScenario()
    const wrong = new ImageData(plan.newImageWidth, plan.newImageHeight + 1)
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(32, 9) as unknown as HTMLImageElement,
    )

    const result = await store.applyC3SpriteCompaction(plan, wrong)

    expect(result).toEqual({ ok: false, code: 'invalid-output-dimensions' })
    expect(store.baseCellConfig.width).toBe(16)
    expect(C3GenerationStorage.readActiveC3Generation()!.c3Config.importedSpacingData).toBe('[[10,"A"]]')
  })

  it('rejects repacked data whose cell does not match the plan', async () => {
    const { store, plan, repacked } = await setupCompactionScenario()
    // 构造一个尺寸一致但列数/行数与 plan 冲突的 repacked 数据
    const tampered = new ImageData(plan.newImageWidth, plan.newImageHeight)
    tampered.data.set(repacked.data)
    const tamperedPlan = { ...plan, newColumns: plan.newColumns - 1 }
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(32, 9) as unknown as HTMLImageElement,
    )

    const result = await store.applyC3SpriteCompaction(tamperedPlan, tampered)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid-output-dimensions')
  })

  it('fails closed when staging persistence fails and cleans staged data', async () => {
    const { store, plan, repacked } = await setupCompactionScenario()
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(32, 9) as unknown as HTMLImageElement,
    )
    failNextIndexedDBPut()

    const activeBefore = C3GenerationStorage.readActiveC3GenerationId()
    const result = await store.applyC3SpriteCompaction(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'persistence-failed' })
    expect(store.baseCellConfig.width).toBe(16)
    // active 指针未被触碰，active generation 仍是旧的
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(activeBefore)
    expect(
      C3GenerationStorage.readActiveC3Generation()?.c3Config.importedSpacingData,
    ).toBe('[[10,"A"]]')
  })

  it('fails closed when the active-pointer commit throws and discards the staged generation', async () => {
    const { store, plan, repacked } = await setupCompactionScenario()
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(32, 9) as unknown as HTMLImageElement,
    )
    const ls = installMemoryLocalStorage()
    ls.failNextSetItem('sprite-font-editor-c3-active-generation')

    const activeBefore = C3GenerationStorage.readActiveC3GenerationId()
    const result = await store.applyC3SpriteCompaction(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'persistence-failed' })
    expect(store.baseCellConfig.width).toBe(16)
    expect(store.originalImageHeight).toBe(32)
    // 指针未被改写，staged keys 已清理
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(activeBefore)
    let staged = 0
    for (const key of ls.raw.keys()) {
      if (key.startsWith('sprite-font-editor-c3-')) {
        staged++
      }
    }
    expect(staged).toBe(0)
  })

  it('keeps a successful apply even if post-commit cleanup throws', async () => {
    const { store, plan, repacked } = await setupCompactionScenario()
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(32, 9) as unknown as HTMLImageElement,
    )
    vi.spyOn(C3GenerationStorage, 'prune').mockImplementationOnce(() => {
      throw new Error('cleanup boom')
    })

    const result = await store.applyC3SpriteCompaction(plan, repacked)

    // post-commit 清理失败不得回滚或失败已成功提交
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(store.baseCellConfig.width).toBe(14)
    }
  })

  it('rejects apply outside C3 mode', async () => {
    const store = useEditorStore()
    const plan = {
      kind: 'plan' as const,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      newCharacterWidth: 14,
      newCharacterHeight: 9,
      newColumns: 2,
      newImageWidth: 32,
      newImageHeight: 9,
      importedCount: 2,
      oldFinalTextureHeight: 16,
      newFinalTextureHeight: 9,
      cellExtents: [],
    }
    const repacked = new ImageData(32, 9)

    const result = await store.applyC3SpriteCompaction(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'invalid-grid' })
  })
})
