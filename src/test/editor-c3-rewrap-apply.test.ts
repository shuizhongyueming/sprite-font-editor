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
  makeSourceImageData,
} from './helpers/c3-fixtures'
import { resetFakeIndexedDB, failNextIndexedDBPut } from './fake-indexeddb'

async function setupRewrapScenario() {
  const store = useEditorStore()
  const image = new FakeImage(32, 32)
  const array = createSampleArray('AB', '[[10,"A"]]')
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

  vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(makeSourceImageData())
  const preparation = store.prepareC3Rewrap(16)
  if (preparation.kind !== 'plan') {
    throw new Error('expected a rewrap plan')
  }

  return { store, image, array, parsed, plan: preparation.plan, repacked: preparation.repacked }
}

describe('editorStore.applyC3SpriteRewrap', () => {
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

  it('applies the rewrap atomically and establishes the rewrapped baseline', async () => {
    const { store, plan, repacked } = await setupRewrapScenario()
    const decoded = new FakeImage(plan.targetWidth, plan.newImageHeight)
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      decoded as unknown as HTMLImageElement,
    )
    store.selectedCharIndex = 7
    const triggerBefore = store.renderTrigger

    const result = await store.applyC3SpriteRewrap(plan, repacked)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // cell 尺寸与数据不变（重排不改 cell）
    expect(store.baseCellConfig.width).toBe(16)
    expect(store.baseCellConfig.height).toBe(16)
    expect(store.baseCellConfig.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(store.baseCellConfig.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })

    // image margin/padding 归零，Font Sprite 尺寸 = 目标宽度 × 含追加的最终密铺高度
    expect(store.baseImageConfig.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(store.baseImageConfig.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(store.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(store.baseImageConfig.fontSpriteHeight).toBe(32)

    expect(store.originalImageWidth).toBe(16)
    expect(store.originalImageHeight).toBe(32)
    expect(store.baseImageMimeType).toBe('image/png')
    expect((store.c3ImportedImage as unknown as FakeImage).width).toBe(16)
    expect((store.c3ImportedImage as unknown as FakeImage).height).toBe(32)
    expect((store.baseImage as unknown as FakeImage).width).toBe(16)
    expect((store.baseImage as unknown as FakeImage).height).toBe(32)
    expect(store.c3ImportedImage).not.toBeNull()
    expect(store.c3ImportedImageFilename).toBe('c3-sprite.png')

    // c3-instance 逐字节不变（含 spacingData，重排不做 spacing 迁移）
    const array = store.c3InstanceArray!
    expect(array[2]).toBe(16)
    expect(array[3]).toBe(16)
    expect(array[4]).toBe('AB')
    expect(array[5]).toBe('[[10,"A"]]')
    expect(store.importedSpacingData).toBe('[[10,"A"]]')

    // 非字体字段逐个保持
    const original = createSampleArray('AB', '[[10,"A"]]')
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
    expect(store.canvasBaseWidth).toBe(16)
    expect(store.canvasBaseHeight).toBe(32)
    expect(store.renderTrigger).toBe(triggerBefore + 1)

    // 持久化：active generation 指向重排后状态，asset 为重排图尺寸
    const generation = C3GenerationStorage.readActiveC3Generation()!
    const persistedArray = JSON.parse(generation.c3Config.instanceArrayJson) as C3InstanceArray
    expect(persistedArray[2]).toBe(16)
    expect(persistedArray[3]).toBe(16)
    expect(persistedArray[4]).toBe('AB')
    expect(persistedArray[5]).toBe('[[10,"A"]]')
    const generalState = generation.generalState as {
      baseCellConfig: { width: number; height: number }
      baseImageConfig: { fontSpriteWidth?: number; fontSpriteHeight?: number }
    }
    expect(generalState.baseCellConfig.width).toBe(16)
    expect(generalState.baseCellConfig.height).toBe(16)
    expect(generalState.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(generalState.baseImageConfig.fontSpriteHeight).toBe(32)
    expect(generation.c3Config.originalImageWidth).toBe(16)
    expect(generation.c3Config.originalImageHeight).toBe(32)

    const asset = await C3GenerationStorage.loadActiveC3ImageAsset()
    expect(asset?.width).toBe(16)
    expect(asset?.height).toBe(32)
  })

  it('keeps appended entries deep-equal without remeasuring', async () => {
    const { store } = await setupRewrapScenario()
    const measureSpy = vi
      .spyOn(c3CharRenderer, 'measureGlyphBounds')
      .mockReturnValue({ width: 8, height: 12 })
    store.appendC3Characters(['C'])
    store.updateC3AppendedExtraSpacing(0, 3)
    // append 对每个追加字符度量一次；此后 prepare/apply 均不得重测
    expect(measureSpy).toHaveBeenCalledTimes(1)
    const entriesBefore = JSON.parse(JSON.stringify(store.c3AppendedEntries))
    const characterSetBefore = store.c3EffectiveCharacterSet

    const preparation = store.prepareC3Rewrap(16)
    if (preparation.kind !== 'plan') {
      throw new Error('expected a rewrap plan')
    }
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(16, 48) as unknown as HTMLImageElement,
    )

    const result = await store.applyC3SpriteRewrap(preparation.plan, preparation.repacked)

    expect(result.ok).toBe(true)
    // apply 后度量次数不增长（重排不重测追加字符，只按新布局重渲染）
    expect(measureSpy).toHaveBeenCalledTimes(1)
    // 追加字符计入最终高度：3 字符 1 列 → 3 行 × 16
    expect(store.baseImageConfig.fontSpriteHeight).toBe(48)
    expect(JSON.parse(JSON.stringify(store.c3AppendedEntries))).toEqual(entriesBefore)
    expect(store.c3EffectiveCharacterSet).toBe(characterSetBefore)
    expect(store.c3AppendedEntries[0].autoDisplayWidth).toBe(8)
    expect(store.c3AppendedEntries[0].autoGlyphHeight).toBe(12)
    expect(store.c3AppendedEntries[0].extraSpacing).toBe(3)
  })

  it('fails closed when verifyCanvasAlphaRoundTrip is false', async () => {
    const { store, plan, repacked } = await setupRewrapScenario()
    vi.spyOn(c3CompactionModule, 'verifyCanvasAlphaRoundTrip').mockReturnValue(false)
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())

    const snapshot = JSON.stringify(store.baseImageConfig)
    const generationBefore = C3GenerationStorage.readActiveC3GenerationId()

    const result = await store.applyC3SpriteRewrap(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'alpha-roundtrip-failed' })
    expect(JSON.stringify(store.baseImageConfig)).toBe(snapshot)
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(generationBefore)
  })

  it('fails closed when PNG encoding fails and leaves everything unchanged', async () => {
    const { store, plan, repacked } = await setupRewrapScenario()
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(null)

    const configBefore = JSON.stringify(store.baseImageConfig)
    const instanceBefore = store.c3InstanceArray
    const activeBefore = C3GenerationStorage.readActiveC3GenerationId()

    const result = await store.applyC3SpriteRewrap(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'unreliable-canvas' })
    expect(JSON.stringify(store.baseImageConfig)).toBe(configBefore)
    expect(store.c3InstanceArray).toBe(instanceBefore)
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(activeBefore)
  })

  it('fails closed when PNG decoding fails', async () => {
    const { store, plan, repacked } = await setupRewrapScenario()
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(null)

    const result = await store.applyC3SpriteRewrap(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'unreliable-canvas' })
    expect(store.baseImageConfig.fontSpriteWidth).toBe(32)
  })

  it('rejects repacked dimensions that mismatch the plan', async () => {
    const { store, plan } = await setupRewrapScenario()
    // 宽度必须精确等于 targetWidth（高度已按 #19 放宽为 ≥ 密铺高度，见自定义加高测试）
    const wrong = new ImageData(plan.targetWidth + 16, plan.newImageHeight)

    const result = await store.applyC3SpriteRewrap(plan, wrong)

    expect(result).toEqual({ ok: false, code: 'invalid-output-dimensions' })
    expect(store.baseImageConfig.fontSpriteWidth).toBe(32)
    expect(
      C3GenerationStorage.readActiveC3Generation()!.c3Config.importedSpacingData,
    ).toBe('[[10,"A"]]')
  })

  it('rejects a plan whose grid equations no longer match the current source', async () => {
    const { store, plan, repacked } = await setupRewrapScenario()
    // newColumns 与 floor(targetWidth / characterWidth) 不一致 → plan 期后配置被改动
    const tampered = { ...plan, newColumns: plan.newColumns + 1 }

    const result = await store.applyC3SpriteRewrap(tampered, repacked)

    expect(result).toEqual({ ok: false, code: 'invalid-output-dimensions' })
  })

  it('rejects a plan whose old columns no longer match the current grid', async () => {
    const { store, plan, repacked } = await setupRewrapScenario()
    const tampered = { ...plan, oldColumns: plan.oldColumns - 1 }

    const result = await store.applyC3SpriteRewrap(tampered, repacked)

    expect(result).toEqual({ ok: false, code: 'invalid-grid' })
  })

  it('rejects a rewrap that keeps the same column count', async () => {
    const { store, plan } = await setupRewrapScenario()
    const sameLayoutPlan = {
      ...plan,
      targetWidth: 32,
      newColumns: 2,
      newRows: 1,
      newImageHeight: 16,
    }
    const repacked = new ImageData(32, 16)

    const result = await store.applyC3SpriteRewrap(sameLayoutPlan, repacked)

    expect(result).toEqual({ ok: false, code: 'no-layout-change' })
    expect(store.baseImageConfig.fontSpriteWidth).toBe(32)
  })

  it('fails closed when staging persistence fails', async () => {
    const { store, plan, repacked } = await setupRewrapScenario()
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(16, 32) as unknown as HTMLImageElement,
    )
    failNextIndexedDBPut()

    const activeBefore = C3GenerationStorage.readActiveC3GenerationId()
    const result = await store.applyC3SpriteRewrap(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'persistence-failed' })
    expect(store.baseImageConfig.fontSpriteWidth).toBe(32)
    // active 指针未被触碰，active generation 仍是旧的
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(activeBefore)
    expect(
      C3GenerationStorage.readActiveC3Generation()?.c3Config.importedSpacingData,
    ).toBe('[[10,"A"]]')
  })

  it('fails closed when the active-pointer commit throws and discards the staged generation', async () => {
    const { store, plan, repacked } = await setupRewrapScenario()
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(16, 32) as unknown as HTMLImageElement,
    )
    const ls = installMemoryLocalStorage()
    ls.failNextSetItem('sprite-font-editor-c3-active-generation')

    const activeBefore = C3GenerationStorage.readActiveC3GenerationId()
    const result = await store.applyC3SpriteRewrap(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'persistence-failed' })
    expect(store.baseImageConfig.fontSpriteWidth).toBe(32)
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
    const { store, plan, repacked } = await setupRewrapScenario()
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(16, 32) as unknown as HTMLImageElement,
    )
    vi.spyOn(C3GenerationStorage, 'prune').mockImplementationOnce(() => {
      throw new Error('cleanup boom')
    })

    const result = await store.applyC3SpriteRewrap(plan, repacked)

    // post-commit 清理失败不得回滚或失败已成功提交
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(store.baseImageConfig.fontSpriteWidth).toBe(16)
    }
  })

  it('rejects apply outside C3 mode', async () => {
    const store = useEditorStore()
    const plan = {
      kind: 'plan' as const,
      targetWidth: 16,
      newColumns: 1,
      newRows: 2,
      newImageHeight: 32,
      importedCount: 2,
      oldColumns: 2,
      oldFontSpriteWidth: 32,
      oldFinalTextureHeight: 32,
    }
    const repacked = new ImageData(16, 32)

    const result = await store.applyC3SpriteRewrap(plan, repacked)

    expect(result).toEqual({ ok: false, code: 'invalid-grid' })
  })
})
