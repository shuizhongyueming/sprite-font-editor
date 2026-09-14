import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import * as c3CompactionModule from '@/utils/c3-compaction'
import * as c3CharRenderer from '@/utils/c3-char-renderer'
import {
  C3GenerationStorage,
  C3ConfigStorage,
  C3ImageStorage,
  C3_STORAGE_VERSION,
} from '@/utils/storage'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage, flushImageLoads } from './helpers/fake-image'
import { createSampleArray, makePngBlob } from './helpers/c3-fixtures'
import type { MemoryLocalStorage } from './helpers/memory-local-storage'
import * as c3CompactionDom from '@/utils/c3-compaction-dom'
import { resetFakeIndexedDB } from './fake-indexeddb'

/** restoreAssets 里 new Image() 解码 blob 后应带出 asset 尺寸 */
class LoadableImage extends FakeImage {
  set src(url: string) {
    this.width = 32
    this.height = 32
    this.naturalWidth = 32
    this.naturalHeight = 32
    queueMicrotask(() => this.onload?.())
  }
}

/** 解码失败的 Image stub（src setter 触发 onerror） */
class FailImage extends FakeImage {
  set src(_url: string) {
    queueMicrotask(() => this.onerror?.())
  }
}

async function importSample(store: ReturnType<typeof useEditorStore>) {
  const image = new FakeImage(32, 32)
  const array = createSampleArray()
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
  return { image, array, parsed }
}

describe('C3 generation restore and persistence flow', () => {
  let ls: MemoryLocalStorage

  beforeEach(() => {
    setActivePinia(createPinia())
    resetFakeIndexedDB()
    ls = installMemoryLocalStorage()
    vi.stubGlobal('Image', LoadableImage)
    vi.spyOn(c3CompactionModule, 'verifyCanvasAlphaRoundTrip').mockReturnValue(true)
    vi.spyOn(c3CharRenderer, 'measureGlyphBounds').mockReturnValue({ width: 8, height: 12, left: 2, top: 0 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('imports through a coherent active generation with a versioned image asset', async () => {
    const store = useEditorStore()
    await importSample(store)

    const generationId = C3GenerationStorage.readActiveC3GenerationId()
    expect(generationId).not.toBeNull()

    const generation = C3GenerationStorage.readActiveC3Generation()!
    expect(generation.c3Config.version).toBe(C3_STORAGE_VERSION)
    expect(generation.c3Config.importedCharacterSet).toBe('AB')
    expect(generation.c3Config.originalImageWidth).toBe(32)
    expect(generation.c3Config.originalImageHeight).toBe(32)
    expect(generation.c3Config.imageAssetId).toBeDefined()
    expect((generation.generalState as { isC3Mode: boolean }).isC3Mode).toBe(true)

    const asset = await C3GenerationStorage.loadActiveC3ImageAsset()
    expect(asset?.width).toBe(32)
    expect(asset?.height).toBe(32)
    expect(asset?.blob).toEqual(makePngBlob())
  })

  it('keeps state coherent through generation commits on later saves, reusing the asset', async () => {
    const store = useEditorStore()
    await importSample(store)

    const genA = C3GenerationStorage.readActiveC3GenerationId()!
    const assetIdA = C3GenerationStorage.readC3Generation(genA)!.c3Config.imageAssetId!

    store.appendC3Characters(['C'])
    store.updateC3AppendedExtraSpacing(0, 5)

    await vi.waitFor(() => {
      const current = C3GenerationStorage.readActiveC3GenerationId()
      expect(current).not.toBe(genA)
    })

    const genB = C3GenerationStorage.readActiveC3Generation()!
    expect(genB.c3Config.imageAssetId).toBe(assetIdA) // 图片 asset 复用
    expect(genB.c3Config.appendedEntries).toHaveLength(1)
    expect(genB.c3Config.appendedEntries[0].extraSpacing).toBe(5)
    expect((genB.generalState as { isC3Mode: boolean }).isC3Mode).toBe(true)
    // 旧 generation 已清理，asset 仍可解析
    expect(C3GenerationStorage.readC3Generation(genA)).toBeNull()
    expect(await C3GenerationStorage.loadActiveC3ImageAsset()).not.toBeNull()
  })

  it('restores one coherent active generation after a refresh', async () => {
    const store = useEditorStore()
    await importSample(store)
    const importGenId = C3GenerationStorage.readActiveC3GenerationId()!
    store.appendC3Characters(['C'])
    await vi.waitFor(() => {
      expect(C3GenerationStorage.readActiveC3GenerationId()).not.toBe(importGenId)
    })

    const genId = C3GenerationStorage.readActiveC3GenerationId()!
    const gen = C3GenerationStorage.readC3Generation(genId)!
    const assetId = gen.c3Config.imageAssetId!

    // 刷新：新 pinia 实例，持久化数据不动
    setActivePinia(createPinia())
    const fresh = useEditorStore()
    fresh.loadFromLocalStorage()
    await fresh.restoreAssets()
    await flushImageLoads()

    expect(fresh.isC3Mode).toBe(true)
    expect(fresh.baseCellConfig.width).toBe(16)
    expect(fresh.baseCellConfig.height).toBe(16)
    expect(fresh.importedCharacterSet).toBe('AB')
    expect(fresh.c3InstanceArray?.[2]).toBe(16)
    expect(fresh.c3InstanceArray?.[4]).toBe('AB')
    expect(fresh.c3AppendedEntries).toHaveLength(1)
    expect(fresh.c3AppendedEntries[0].char).toBe('C')
    expect(fresh.c3ImportedImageFilename).toBe('c3-sprite.png')
    expect(fresh.baseImageMimeType).toBe('image/png')
    expect(fresh.c3ImportedImage).not.toBeNull()
    expect((fresh.c3ImportedImage as unknown as FakeImage).width).toBe(32)
    // 恢复的是同一个 active generation，且 asset 指针一致
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(genId)
    expect(C3GenerationStorage.readActiveC3Generation()!.c3Config.imageAssetId).toBe(assetId)
  })

  it('migrates legacy fixed-key C3 storage into an active generation deterministically', async () => {
    const store = useEditorStore()
    const array = createSampleArray('AB', '[[10,"A"]]')

    // 预置 legacy 固定数据（普通状态 key + C3 v2 固定 key + 固定图片 asset）
    localStorage.setItem(
      'sprite-font-editor-state',
      JSON.stringify({
        baseCellConfig: {
          width: 16,
          height: 16,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
        },
        baseImageConfig: {
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          fontSpriteWidth: 32,
          fontSpriteHeight: 32,
        },
        cellAlignment: { horizontal: 'left', vertical: 'middle' },
        characterStyle: {
          fontFamily: 'Arial',
          fontSize: 16,
          color: '#000000',
          outline: { enabled: false, color: '#ffffff', width: 1 },
          pixelStyle: false,
        },
        insertPointConfig: { mode: 'auto', startCellIndex: 0 },
        characterEntries: [],
        gridConfig: {
          enabled: true,
          cellBorder: true,
          cellBorderColor: 'rgba(0, 255, 0, 0.5)',
          cellBorderWidth: 1,
          marginLines: false,
          marginLineColor: 'rgba(255, 0, 0, 0.3)',
          paddingLines: false,
          paddingLineColor: 'rgba(0, 0, 255, 0.3)',
        },
        canvasBg: 'white',
        canvasViewMode: 'fit',
        isC3Mode: true,
        baseImageFilename: '',
        baseImageMimeType: 'image/png',
        fontFilename: '',
      }),
    )
    C3ConfigStorage.save({
      version: 2,
      instanceArrayJson: JSON.stringify(array),
      importedCharacterSet: 'AB',
      importedSpacingData: '[[10,"A"]]',
      importedCharacterSpacing: 0,
      importedLineHeight: 0,
      globalExtraSpacing: 0,
      appendedEntries: [],
      originalImageWidth: 32,
      originalImageHeight: 32,
      imageFilename: 'c3-sprite.png',
    })
    await C3ImageStorage.save(makePngBlob(), 32, 32)

    expect(C3GenerationStorage.readActiveC3GenerationId()).toBeNull()

    store.loadFromLocalStorage()
    expect(store.isC3Mode).toBe(true)
    expect(store.c3InstanceArray).toEqual(array)
    expect(store.importedSpacingData).toBe('[[10,"A"]]')
    expect(store.baseCellConfig.width).toBe(16)

    await store.restoreAssets()
    await flushImageLoads()

    // 迁移后建立 active generation，固定数据清理
    const generationId = C3GenerationStorage.readActiveC3GenerationId()
    expect(generationId).not.toBeNull()
    const generation = C3GenerationStorage.readActiveC3Generation()!
    expect(generation.c3Config.version).toBe(C3_STORAGE_VERSION)
    expect(generation.c3Config.importedCharacterSet).toBe('AB')
    expect(generation.c3Config.importedSpacingData).toBe('[[10,"A"]]')
    expect(generation.c3Config.imageAssetId).toBeDefined()
    expect(localStorage.getItem('sprite-font-editor-state')).toBeNull()
    expect(C3ConfigStorage.load()).toBeNull()
    expect(await C3ImageStorage.load()).toBeNull()
    // 图片恢复为 asset 内容
    expect(store.c3ImportedImage).not.toBeNull()
    expect(store.baseImageMimeType).toBe('image/png')
  })

  it('normal mode saves keep legacy behavior and clear stale C3 generations', async () => {
    const store = useEditorStore()
    await importSample(store)
    expect(C3GenerationStorage.readActiveC3GenerationId()).not.toBeNull()

    // 清空后进入普通模式
    store.clearState()
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBeNull()

    const image = new FakeImage(32, 32)
    await store.setBaseImage(image as unknown as HTMLImageElement, makePngBlob(), 'sprite.png')
    store.characterEntries = [{ char: 'X', margin: { top: 0, right: 0, bottom: 0, left: 0 } }]
    store.saveToLocalStorage()

    expect(C3GenerationStorage.readActiveC3GenerationId()).toBeNull()
    const saved = JSON.parse(localStorage.getItem('sprite-font-editor-state')!)
    expect(saved.isC3Mode).toBe(false)
    expect(saved.characterEntries).toHaveLength(1)
  })

  it('falls back to legacy image restore when the active generation is corrupt', async () => {
    const store = useEditorStore()
    const array = createSampleArray()

    // 损坏的 active 指针（指向不存在的 generation）+ legacy 固定数据
    localStorage.setItem('sprite-font-editor-c3-active-generation', 'gen-corrupt')
    localStorage.setItem('sprite-font-editor-state', JSON.stringify({ isC3Mode: true }))
    C3ConfigStorage.save({
      version: 2,
      instanceArrayJson: JSON.stringify(array),
      importedCharacterSet: 'AB',
      importedSpacingData: '[]',
      importedCharacterSpacing: 0,
      importedLineHeight: 0,
      globalExtraSpacing: 0,
      appendedEntries: [],
      originalImageWidth: 32,
      originalImageHeight: 32,
      imageFilename: 'c3-sprite.png',
    })
    await C3ImageStorage.save(makePngBlob(), 32, 32)

    store.loadFromLocalStorage()
    // generation 不可读 → 回退 legacy，恢复 C3 refs
    expect(store.isC3Mode).toBe(true)
    expect(store.c3InstanceArray).toEqual(array)

    await store.restoreAssets()
    await flushImageLoads()

    // 迁移建立新的 active generation 并恢复图片，不因损坏指针丢图
    expect(C3GenerationStorage.readActiveC3GenerationId()).not.toBe('gen-corrupt')
    expect(store.c3ImportedImage).not.toBeNull()
    expect(store.baseImageMimeType).toBe('image/png')
  })

  it('serializes concurrent saves and leaves no orphan generations', async () => {
    const store = useEditorStore()
    await importSample(store)
    const importGenId = C3GenerationStorage.readActiveC3GenerationId()!

    // 紧接两次 fire-and-forget 保存：两个 persist 串行提交
    store.appendC3Characters(['C'])
    store.updateC3AppendedExtraSpacing(0, 5)

    await vi.waitFor(() => {
      expect(
        C3GenerationStorage.readActiveC3Generation()?.c3Config.appendedEntries[0]?.extraSpacing,
      ).toBe(5)
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    // 最终状态胜出；只保留 active 一个 generation（指针 + state + config = 3 个 key），无孤儿
    expect(C3GenerationStorage.readActiveC3Generation()?.c3Config.appendedEntries).toHaveLength(1)
    expect(C3GenerationStorage.readActiveC3GenerationId()).not.toBe(importGenId)
    const generationKeys = [...ls.raw.keys()].filter((k) =>
      k.startsWith('sprite-font-editor-c3-'),
    )
    expect(generationKeys.length).toBe(3)
  })

  it('fails closed when the active generation image asset is missing', async () => {
    const store = useEditorStore()
    const array = createSampleArray()

    // 完整 generation（state + config 带 imageAssetId），但 IDB 没有该 asset
    const genId = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true },
      c3Config: {
        version: C3_STORAGE_VERSION,
        instanceArrayJson: JSON.stringify(array),
        importedCharacterSet: 'AB',
        importedSpacingData: '[]',
        importedCharacterSpacing: 0,
        importedLineHeight: 0,
        globalExtraSpacing: 0,
        appendedEntries: [],
        originalImageWidth: 32,
        originalImageHeight: 32,
        imageFilename: 'c3-sprite.png',
        imageAssetId: 'c3-image-missing',
      },
      image: null,
    })
    C3GenerationStorage.commit(genId)

    store.loadFromLocalStorage()
    expect(store.isC3Mode).toBe(true)

    await store.restoreAssets()
    await flushImageLoads()

    // 无 legacy 可回退 → fail-closed 清空，绝不呈现半恢复项目
    expect(store.isC3Mode).toBe(false)
    expect(store.c3InstanceArray).toBeNull()
    expect(store.c3ImportedImage).toBeNull()
    expect(store.baseImage).toBeNull()
  })

  it('fails closed when the import image cannot be encoded to PNG', async () => {
    const store = useEditorStore()
    const image = new FakeImage(32, 32)
    const array = createSampleArray()
    const parsed = parseC3InstanceArray(JSON.stringify(array))
    vi.spyOn(c3CompactionDom, 'imageElementToPngBlob').mockResolvedValue(null)

    await expect(
      store.importC3SpriteFont(
        image as unknown as HTMLImageElement,
        array,
        parsed,
      ),
    ).rejects.toThrow()
  })

  it('fails closed when the C3 image asset cannot be decoded on restore', async () => {
    const store = useEditorStore()
    await importSample(store)
    expect(C3GenerationStorage.readActiveC3GenerationId()).not.toBeNull()

    // 刷新：asset 存在但图片解码失败（onerror）
    vi.stubGlobal('Image', FailImage)
    setActivePinia(createPinia())
    const fresh = useEditorStore()
    fresh.loadFromLocalStorage()
    expect(fresh.isC3Mode).toBe(true)

    await fresh.restoreAssets()
    await flushImageLoads()

    // fail-closed 清空，绝不呈现半恢复项目
    expect(fresh.isC3Mode).toBe(false)
    expect(fresh.c3ImportedImage).toBeNull()
    expect(fresh.baseImage).toBeNull()
  })

  it('save fails loudly when no reusable image asset exists', async () => {
    const store = useEditorStore()
    const { notify } = await import('@/utils/notification')
    const errorSpy = vi.spyOn(notify, 'error')

    // 模拟 import 失败后的半状态：C3 模式但没有任何 generation/asset
    store.setC3Mode(true)
    store.saveToLocalStorage()

    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled())
  })
})
