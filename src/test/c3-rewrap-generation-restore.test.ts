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
import { FakeImage, flushImageLoads } from './helpers/fake-image'
import {
  createSampleArray,
  makePngBlob,
  makeSourceImageData,
} from './helpers/c3-fixtures'
import { resetFakeIndexedDB } from './fake-indexeddb'

/** restoreAssets 里 new Image() 解码重排 asset 后应带出重排图尺寸（16 宽 × 3 行密铺 48 高） */
class RewrappedImage extends FakeImage {
  set src(_url: string) {
    this.width = 16
    this.height = 48
    this.naturalWidth = 16
    this.naturalHeight = 48
    queueMicrotask(() => this.onload?.())
  }
}

describe('C3 rewrap generation commit and restore flow', () => {
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

  it('persists the rewrap as a new generation and restores it after a refresh', async () => {
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
    const importGenId = C3GenerationStorage.readActiveC3GenerationId()!

    const measureSpy = vi
      .spyOn(c3CharRenderer, 'measureGlyphBounds')
      .mockReturnValue({ width: 8, height: 12 })
    store.appendC3Characters(['C'])
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(makeSourceImageData())
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
    // apply 不重测追加字符（度量次数与 append 后相同）
    expect(measureSpy).toHaveBeenCalledTimes(1)

    // 新 generation 原子提交：active 指向重排后状态，旧 generation 已清理
    const genId = C3GenerationStorage.readActiveC3GenerationId()!
    expect(genId).not.toBe(importGenId)
    expect(C3GenerationStorage.readC3Generation(importGenId)).toBeNull()

    const generation = C3GenerationStorage.readActiveC3Generation()!
    const generalState = generation.generalState as {
      baseCellConfig: { width: number; height: number }
      baseImageConfig: { fontSpriteWidth?: number; fontSpriteHeight?: number }
    }
    expect(generalState.baseCellConfig.width).toBe(16)
    expect(generalState.baseCellConfig.height).toBe(16)
    expect(generalState.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(generalState.baseImageConfig.fontSpriteHeight).toBe(48)
    expect(generation.c3Config.originalImageWidth).toBe(16)
    expect(generation.c3Config.originalImageHeight).toBe(48)
    expect(generation.c3Config.importedSpacingData).toBe('[[10,"A"]]')
    expect(generation.c3Config.appendedEntries).toHaveLength(1)
    expect(generation.c3Config.appendedEntries[0].char).toBe('C')
    const persistedArray = JSON.parse(generation.c3Config.instanceArrayJson) as C3InstanceArray
    expect(persistedArray[2]).toBe(16)
    expect(persistedArray[3]).toBe(16)
    expect(persistedArray[4]).toBe('AB')
    expect(persistedArray[5]).toBe('[[10,"A"]]')

    const asset = await C3GenerationStorage.loadActiveC3ImageAsset()
    expect(asset?.width).toBe(16)
    expect(asset?.height).toBe(48)
    expect(asset?.blob).toEqual(makePngBlob())

    // 刷新：新 pinia 实例，持久化数据不动，恢复同一 active generation
    vi.stubGlobal('Image', RewrappedImage)
    setActivePinia(createPinia())
    const fresh = useEditorStore()
    fresh.loadFromLocalStorage()
    await fresh.restoreAssets()
    await flushImageLoads()

    expect(fresh.isC3Mode).toBe(true)
    expect(fresh.baseCellConfig.width).toBe(16)
    expect(fresh.baseCellConfig.height).toBe(16)
    expect(fresh.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(fresh.baseImageConfig.fontSpriteHeight).toBe(48)
    expect(fresh.originalImageWidth).toBe(16)
    expect(fresh.originalImageHeight).toBe(48)
    expect(fresh.importedCharacterSet).toBe('AB')
    expect(fresh.importedSpacingData).toBe('[[10,"A"]]')
    expect(fresh.c3InstanceArray?.[2]).toBe(16)
    expect(fresh.c3InstanceArray?.[4]).toBe('AB')
    expect(fresh.c3AppendedEntries).toHaveLength(1)
    expect(fresh.c3AppendedEntries[0].char).toBe('C')
    expect(fresh.c3AppendedEntries[0].extraSpacing).toBe(0)
    expect(fresh.c3ImportedImageFilename).toBe('c3-sprite.png')
    expect(fresh.baseImageMimeType).toBe('image/png')
    expect(fresh.c3ImportedImage).not.toBeNull()
    expect((fresh.c3ImportedImage as unknown as FakeImage).width).toBe(16)
    expect((fresh.c3ImportedImage as unknown as FakeImage).height).toBe(48)
    // 恢复的是同一个 active generation，且 asset 指针一致
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(genId)
    expect(C3GenerationStorage.readActiveC3Generation()!.c3Config.imageAssetId).toBe(
      generation.c3Config.imageAssetId,
    )
  })
})
