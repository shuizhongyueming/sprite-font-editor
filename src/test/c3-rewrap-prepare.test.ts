import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'
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
import { resetFakeIndexedDB } from './fake-indexeddb'

describe('editorStore.prepareC3Rewrap', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetFakeIndexedDB()
    installMemoryLocalStorage()
    vi.spyOn(c3CompactionModule, 'verifyCanvasAlphaRoundTrip').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function importSample() {
    const store = useEditorStore()
    const image = new FakeImage(32, 32)
    const array = createSampleArray('AB', '[]')
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

  it('prepares a plan + repacked candidate from real pixels', async () => {
    const store = await importSample()
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(makeSourceImageData())

    const result = store.prepareC3Rewrap(16)

    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.plan).toEqual({
      kind: 'plan',
      targetWidth: 16,
      newColumns: 1,
      newRows: 2,
      newImageHeight: 32,
      importedCount: 2,
      oldColumns: 2,
      oldFontSpriteWidth: 32,
      oldFinalTextureHeight: 16,
    })
    expect(result.repacked.width).toBe(16)
    expect(result.repacked.height).toBe(32)
    // 像素按新列数物理重排：B 从旧 (16,0) 搬到 (0,16)，cell 内内容 x=2..13 原样
    expect(result.repacked.data[(16 * 16 + 2) * 4 + 3]).toBe(255)
    expect(result.repacked.data[(23 * 16 + 13) * 4 + 3]).toBe(255)
    // 右侧余量保持透明
    expect(result.repacked.data[(0 * 16 + 14) * 4 + 3]).toBe(0)
    expect(result.source.characterWidth).toBe(16)
    expect(result.source.fontSpriteWidth).toBe(32)
  })

  it('does not touch any store state or persistence', async () => {
    const store = await importSample()
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(makeSourceImageData())
    const before = {
      baseCellConfig: JSON.parse(JSON.stringify(store.baseCellConfig)),
      baseImageConfig: JSON.parse(JSON.stringify(store.baseImageConfig)),
      originalImageWidth: store.originalImageWidth,
      originalImageHeight: store.originalImageHeight,
      importedSpacingData: store.importedSpacingData,
      appendedEntries: JSON.parse(JSON.stringify(store.c3AppendedEntries)),
      generationId: C3GenerationStorage.readActiveC3GenerationId(),
    }

    const result = store.prepareC3Rewrap(16)

    expect(result.kind).toBe('plan')
    expect(JSON.parse(JSON.stringify(store.baseCellConfig))).toEqual(before.baseCellConfig)
    expect(JSON.parse(JSON.stringify(store.baseImageConfig))).toEqual(before.baseImageConfig)
    expect(store.originalImageWidth).toBe(before.originalImageWidth)
    expect(store.originalImageHeight).toBe(before.originalImageHeight)
    expect(store.importedSpacingData).toBe(before.importedSpacingData)
    expect(JSON.parse(JSON.stringify(store.c3AppendedEntries))).toEqual(before.appendedEntries)
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(before.generationId)
  })

  it('counts appended characters in the row count without remeasuring them', async () => {
    const store = await importSample()
    const measureSpy = vi
      .spyOn(c3CharRenderer, 'measureGlyphBounds')
      .mockReturnValue({ width: 8, height: 12 })
    store.appendC3Characters(['C'])
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(makeSourceImageData())

    const result = store.prepareC3Rewrap(16)

    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.plan.newRows).toBe(3)
    expect(result.plan.newImageHeight).toBe(48)
    expect(result.plan.oldFinalTextureHeight).toBe(32)
    expect(result.repacked.height).toBe(48)
    // prepare 不重测/不改动追加条目（度量次数与 append 后相同）
    expect(measureSpy).toHaveBeenCalledTimes(1)
    expect(store.c3AppendedEntries[0].autoDisplayWidth).toBe(8)
  })

  it('reports no-layout-change when the target keeps the same column count', async () => {
    const store = await importSample()
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(makeSourceImageData())

    expect(store.prepareC3Rewrap(32)).toEqual({
      kind: 'no-layout-change',
      oldColumns: 2,
      targetWidth: 32,
    })
  })

  it('fails closed when alpha roundtrip fails', async () => {
    const store = await importSample()
    vi.spyOn(c3CompactionModule, 'verifyCanvasAlphaRoundTrip').mockReturnValue(false)

    expect(store.prepareC3Rewrap(16)).toEqual({
      kind: 'error',
      code: 'alpha-roundtrip-failed',
    })
  })

  it('blocks when content sits outside the imported cells', async () => {
    const store = await importSample()
    const image = makeSourceImageData()
    image.data[(31 * 32 + 31) * 4 + 3] = 255
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(image)

    const result = store.prepareC3Rewrap(16)

    expect(result).toEqual({ kind: 'error', code: 'content-outside-imported-cells' })
  })

  it('rejects a target width smaller than the cell width', async () => {
    const store = await importSample()
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(makeSourceImageData())

    expect(store.prepareC3Rewrap(8)).toEqual({
      kind: 'error',
      code: 'invalid-output-dimensions',
    })
  })

  it('reports no-imported-content when the imported character set is empty', async () => {
    const store = await importSample()
    store.importedCharacterSet = ''
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(makeSourceImageData())

    const result = store.prepareC3Rewrap(16)

    expect(result).toEqual({ kind: 'error', code: 'no-imported-content' })
  })

  it('rejects outside C3 mode', () => {
    const store = useEditorStore()
    expect(store.prepareC3Rewrap(16)).toEqual({
      kind: 'error',
      code: 'invalid-grid',
    })
  })
})
