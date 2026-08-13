import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import * as c3CompactionModule from '@/utils/c3-compaction'
import * as c3CompactionDom from '@/utils/c3-compaction-dom'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage } from './helpers/fake-image'
import {
  createSampleArray,
  makePngBlob,
  makeSourceImageData,
} from './helpers/c3-fixtures'
import { resetFakeIndexedDB } from './fake-indexeddb'

describe('editorStore.prepareC3Compaction', () => {
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

    const result = store.prepareC3Compaction()

    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.plan.newCharacterWidth).toBe(14)
    expect(result.plan.newCharacterHeight).toBe(9)
    expect(result.plan.newColumns).toBe(2)
    expect(result.repacked.width).toBe(32)
    expect(result.repacked.height).toBe(9)
    expect(result.source.characterWidth).toBe(16)
    expect(result.source.fontSpriteWidth).toBe(32)
    // 候选携带与核心一致的旧网格元数据（32×32、margin/padding 0 → 原点 0、2 列）
    expect(result.oldGrid).toEqual({ originX: 0, originY: 0, columns: 2 })
  })

  it('reports no-savings when there is no cropping benefit', async () => {
    const store = await importSample()
    const full = new ImageData(32, 32)
    // 两个 cell 均在首行（y 0..15），内容铺满 cell → 无留白可裁
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 32; x++) {
        full.data[(y * 32 + x) * 4 + 3] = 255
      }
    }
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(full)

    const result = store.prepareC3Compaction()

    expect(result.kind).toBe('no-savings')
  })

  it('fails closed when alpha roundtrip fails', async () => {
    const store = await importSample()
    vi.spyOn(c3CompactionModule, 'verifyCanvasAlphaRoundTrip').mockReturnValue(false)

    expect(store.prepareC3Compaction()).toEqual({
      kind: 'error',
      code: 'alpha-roundtrip-failed',
    })
  })

  it('fails when the imported image has no visible content', async () => {
    const store = await importSample()
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(
      new ImageData(32, 32),
    )

    const result = store.prepareC3Compaction()

    expect(result.kind).toBe('error')
    if (result.kind !== 'error') return
    expect(result.code).toBe('no-imported-content')
  })

  it('rejects outside C3 mode', () => {
    const store = useEditorStore()
    expect(store.prepareC3Compaction()).toEqual({
      kind: 'error',
      code: 'invalid-grid',
    })
  })

  it('fails closed on invalid spacing data before reading pixels or analyzing', async () => {
    const store = await importSample()
    store.importedSpacingData = 'not-json'
    const imageSpy = vi.spyOn(c3CompactionDom, 'imageToImageData')

    const result = store.prepareC3Compaction()

    expect(result).toEqual({ kind: 'error', code: 'invalid-spacing-data' })
    // 像素读取与分析都未发生（fail closed 提前返回）
    expect(imageSpy).not.toHaveBeenCalled()
  })
})
