import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import type { C3InstanceArray } from '@/utils/c3-parser'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import * as c3CompactionModule from '@/utils/c3-compaction'
import * as c3CompactionDom from '@/utils/c3-compaction-dom'
import { C3GenerationStorage } from '@/utils/storage'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage } from './helpers/fake-image'
import {
  createSampleArray,
  makePngBlob,
  makeSourceImageData,
} from './helpers/c3-fixtures'
import { resetFakeIndexedDB } from './fake-indexeddb'

/**
 * 自定义加高路径（issue #19 store seam）：
 * prepareC3Rewrap 透传 options.outputHeight（≥ 密铺、≤ 16384），
 * applyC3SpriteRewrap 放宽高度等式为 repacked.height ≥ plan.newImageHeight，
 * fontSpriteHeight = repacked.height（余量行透明）。
 */
async function setupRewrapScenario() {
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
  vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(makeSourceImageData())
  return store
}

describe('editorStore rewrap custom output height', () => {
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

  it('prepares a taller repacked image when outputHeight exceeds the tiling height', async () => {
    const store = await setupRewrapScenario()

    const result = store.prepareC3Rewrap(16, { outputHeight: 48 })

    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    // 方案高度仍是精确密铺；加高只体现在 repacked 输出
    expect(result.plan.newImageHeight).toBe(32)
    expect(result.repacked.width).toBe(16)
    expect(result.repacked.height).toBe(48)
    // 密铺区域内容不变（B cell 位于 (0,16)，内容 x=2..13）
    expect(result.repacked.data[(16 * 16 + 2) * 4 + 3]).toBe(255)
    expect(result.repacked.data[(23 * 16 + 13) * 4 + 3]).toBe(255)
    // 加高余量行保持透明
    expect(result.repacked.data[(32 * 16 + 2) * 4 + 3]).toBe(0)
    expect(result.repacked.data[(47 * 16 + 13) * 4 + 3]).toBe(0)
  })

  it('rejects an outputHeight below the exact tiling height', async () => {
    const store = await setupRewrapScenario()

    const result = store.prepareC3Rewrap(16, { outputHeight: 16 })

    expect(result).toEqual({ kind: 'error', code: 'invalid-output-dimensions' })
  })

  it('rejects an outputHeight above the texture size limit', async () => {
    const store = await setupRewrapScenario()

    const result = store.prepareC3Rewrap(16, { outputHeight: 16385 })

    expect(result).toEqual({ kind: 'error', code: 'invalid-output-dimensions' })
  })

  it('applies a taller repacked image and sets fontSpriteHeight to repacked.height', async () => {
    const store = await setupRewrapScenario()
    const preparation = store.prepareC3Rewrap(16, { outputHeight: 48 })
    if (preparation.kind !== 'plan') {
      throw new Error('expected a rewrap plan')
    }
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(16, 48) as unknown as HTMLImageElement,
    )

    const result = await store.applyC3SpriteRewrap(
      preparation.plan,
      preparation.repacked,
    )

    expect(result.ok).toBe(true)
    // fontSpriteHeight = repacked.height（余量行透明），宽度精确等于目标宽度
    expect(store.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(store.baseImageConfig.fontSpriteHeight).toBe(48)
    expect(store.originalImageWidth).toBe(16)
    expect(store.originalImageHeight).toBe(48)
    expect(store.canvasBaseHeight).toBe(48)

    // 持久化：active generation 记录加高后的 Font Sprite 尺寸与图片尺寸
    const generation = C3GenerationStorage.readActiveC3Generation()!
    const generalState = generation.generalState as {
      baseImageConfig: { fontSpriteWidth?: number; fontSpriteHeight?: number }
    }
    expect(generalState.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(generalState.baseImageConfig.fontSpriteHeight).toBe(48)
    expect(generation.c3Config.originalImageWidth).toBe(16)
    expect(generation.c3Config.originalImageHeight).toBe(48)
    const asset = await C3GenerationStorage.loadActiveC3ImageAsset()
    expect(asset?.width).toBe(16)
    expect(asset?.height).toBe(48)
  })

  it('still rejects a repacked image shorter than the plan tiling height', async () => {
    const store = await setupRewrapScenario()
    const preparation = store.prepareC3Rewrap(16)
    if (preparation.kind !== 'plan') {
      throw new Error('expected a rewrap plan')
    }
    const tooShort = new ImageData(preparation.plan.targetWidth, 16)

    const result = await store.applyC3SpriteRewrap(
      preparation.plan,
      tooShort,
    )

    expect(result).toEqual({ ok: false, code: 'invalid-output-dimensions' })
    expect(store.baseImageConfig.fontSpriteWidth).toBe(32)
    expect(store.c3InstanceArray).not.toBeNull()
  })

  it('keeps the c3-instance array byte-identical when applying a taller rewrap', async () => {
    const store = await setupRewrapScenario()
    const preparation = store.prepareC3Rewrap(16, { outputHeight: 48 })
    if (preparation.kind !== 'plan') {
      throw new Error('expected a rewrap plan')
    }
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(16, 48) as unknown as HTMLImageElement,
    )

    await store.applyC3SpriteRewrap(preparation.plan, preparation.repacked)

    const array = store.c3InstanceArray as C3InstanceArray
    expect(array[2]).toBe(16)
    expect(array[3]).toBe(16)
    expect(array[4]).toBe('AB')
    expect(array[5]).toBe('[]')
  })

  it('rejects a repacked image taller than the texture size limit', async () => {
    const store = await setupRewrapScenario()
    const preparation = store.prepareC3Rewrap(16)
    if (preparation.kind !== 'plan') {
      throw new Error('expected a rewrap plan')
    }
    const tooTall = new ImageData(preparation.plan.targetWidth, 16385)

    const result = await store.applyC3SpriteRewrap(preparation.plan, tooTall)

    expect(result).toEqual({ ok: false, code: 'invalid-output-dimensions' })
    expect(store.baseImageConfig.fontSpriteWidth).toBe(32)
    expect(store.originalImageHeight).toBe(32)
  })
})
