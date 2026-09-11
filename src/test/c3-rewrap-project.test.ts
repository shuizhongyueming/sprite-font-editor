import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import type { C3InstanceArray } from '@/utils/c3-parser'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import * as c3CompactionModule from '@/utils/c3-compaction'
import * as c3CompactionDom from '@/utils/c3-compaction-dom'
import * as c3CharRenderer from '@/utils/c3-char-renderer'
import { buildProjectFiles, exportProjectToZip } from '@/utils/project-export'
import { parseProjectFiles, readZipProject } from '@/utils/project-import'
import { C3GenerationStorage } from '@/utils/storage'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage } from './helpers/fake-image'
import {
  createSampleArray,
  makePngBlob,
  makeSourceImageData,
  makeSpriteSheetImageData,
  appendedCellPosition,
  createMockImageLoader,
} from './helpers/c3-fixtures'
import { resetFakeIndexedDB } from './fake-indexeddb'

/**
 * 导入 32×32（A、B 两个 16×16 cell）→ 追加 C → 重排到 16（1 列）。
 * 追加条目带非默认 margin/distribution（模拟用户调整），供往返保持断言。
 */
async function importAndRewrap(store: ReturnType<typeof useEditorStore>) {
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

  store.appendC3Characters(['C'])
  store.updateC3AppendedExtraSpacing(0, 3)
  store.c3AppendedEntries[0].margin = { top: 2, right: 1, bottom: 3, left: 4 }
  store.c3AppendedEntries[0].distributionOffset = 6
  const entriesBefore = JSON.parse(JSON.stringify(store.c3AppendedEntries))
  const effectiveSetBefore = store.c3EffectiveCharacterSet

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

  return { entriesBefore, effectiveSetBefore, plan: preparation.plan }
}

/** 重排后的 Project 导入到新 store（ZIP 路径与文件路径共用同一解析） */
async function roundTrip(store: ReturnType<typeof useEditorStore>, width: number, height: number) {
  const zipBlob = await exportProjectToZip(store)
  const map = await readZipProject(zipBlob)
  const projectData = await parseProjectFiles(map, createMockImageLoader(width, height))
  setActivePinia(createPinia())
  const target = useEditorStore()
  await target.applyProject(projectData)
  return { map, target }
}

describe('C3 rewrap project round-trip', () => {
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

  it('exports the rewrapped baseline and restores the same editable layering', async () => {
    const store = useEditorStore()
    const { entriesBefore, effectiveSetBefore } = await importAndRewrap(store)

    const files = await buildProjectFiles(store)

    // 导出图片来自 generation asset（重排 PNG），文件名保持 .png
    expect(files.projectJson.mode).toBe('c3')
    expect(files.imageFilename).toBe('c3-sprite.png')
    expect(files.imageBlob.type).toBe('image/png')
    // 重排基底：cell 尺寸不变，Font Sprite 尺寸 = 目标宽度 × 含追加的最终密铺高度
    expect(files.projectJson.state.baseCellConfig.width).toBe(16)
    expect(files.projectJson.state.baseCellConfig.height).toBe(16)
    expect(files.projectJson.state.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(files.projectJson.state.baseImageConfig.fontSpriteHeight).toBe(48)
    expect(files.projectJson.state.originalImageWidth).toBe(16)
    expect(files.projectJson.state.originalImageHeight).toBe(48)
    // 应用后 image margin/padding 归零
    expect(files.projectJson.state.baseImageConfig.margin).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })
    expect(files.projectJson.state.baseImageConfig.padding).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })
    expect(files.c3InstanceArray?.[2]).toBe(16)
    expect(files.c3InstanceArray?.[3]).toBe(16)
    expect(files.c3InstanceArray?.[4]).toBe('AB')
    expect(files.c3InstanceArray?.[5]).toBe('[[10,"A"]]')
    expect(files.projectJson.state.c3AppendedEntries).toHaveLength(1)
    // generation 不进入 project 文件
    expect(JSON.stringify(files.projectJson)).not.toContain('imageAssetId')
    expect(JSON.stringify(files.projectJson)).not.toContain('active-generation')
    expect(JSON.stringify(files.c3InstanceArray)).not.toContain('generation')

    // 导入到新 store：恢复同一可编辑分层
    const map = new Map<string, Blob>()
    map.set('project.json', new Blob([JSON.stringify(files.projectJson, null, 2)]))
    map.set(files.imageFilename, files.imageBlob)
    map.set(
      files.projectJson.c3Instance!,
      new Blob([JSON.stringify(files.c3InstanceArray, null, 2)]),
    )
    const projectData = await parseProjectFiles(map, createMockImageLoader(16, 48))

    setActivePinia(createPinia())
    const target = useEditorStore()
    await target.applyProject(projectData)

    expect(target.isC3Mode).toBe(true)
    expect(target.baseCellConfig.width).toBe(16)
    expect(target.baseCellConfig.height).toBe(16)
    expect(target.baseCellConfig.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(target.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(target.baseImageConfig.fontSpriteHeight).toBe(48)
    expect(target.baseImageConfig.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(target.baseImageConfig.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(target.originalImageWidth).toBe(16)
    expect(target.originalImageHeight).toBe(48)
    expect(target.c3InstanceArray?.[2]).toBe(16)
    expect(target.c3InstanceArray?.[3]).toBe(16)
    expect(target.c3InstanceArray?.[4]).toBe('AB')
    expect(target.c3InstanceArray?.[5]).toBe('[[10,"A"]]')
    expect(target.importedSpacingData).toBe('[[10,"A"]]')
    // 追加字符数据逐字段保持（margin/distribution/extraSpacing 不重测覆盖）
    expect(JSON.parse(JSON.stringify(target.c3AppendedEntries))).toEqual(entriesBefore)
    expect(target.c3AppendedEntries[0].char).toBe('C')
    expect(target.c3AppendedEntries[0].extraSpacing).toBe(3)
    expect(target.c3EffectiveCharacterSet).toBe(effectiveSetBefore)
    expect(target.c3ImportedImageFilename).toBe('c3-sprite.png')
    expect(target.baseImageMimeType).toBe('image/png')
    // 渲染落位（cellIndex 映射）保持一致：C 的 cellIndex = 2，1 列 → (0, 32)
    expect(appendedCellPosition(target, 0)).toEqual({ x: 0, y: 32 })
    // 导入建立 coherent 本地 generation
    const generation = C3GenerationStorage.readActiveC3Generation()
    expect(generation).not.toBeNull()
    expect(generation!.c3Config.originalImageWidth).toBe(16)
    expect(generation!.c3Config.originalImageHeight).toBe(48)
    expect(generation!.c3Config.imageAssetId).toBeDefined()
  })

  it('supports ZIP export/import round-trip of a rewrapped project', async () => {
    const store = useEditorStore()
    await importAndRewrap(store)

    const { map, target } = await roundTrip(store, 16, 48)

    expect(map.has('project.json')).toBe(true)
    expect(map.has('c3-sprite.png')).toBe(true)
    expect(map.has('c3-instance.json')).toBe(true)

    expect(target.isC3Mode).toBe(true)
    expect(target.baseCellConfig.width).toBe(16)
    expect(target.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(target.baseImageConfig.fontSpriteHeight).toBe(48)
    expect(target.originalImageWidth).toBe(16)
    expect(target.originalImageHeight).toBe(48)
    expect(target.c3AppendedEntries).toHaveLength(1)
  })

  it('stays rewrappable after a project round-trip', async () => {
    const store = useEditorStore()
    await importAndRewrap(store)
    const { target } = await roundTrip(store, 16, 48)

    // 刷新后的基底：16×48，1 列，导入 cell 两格（A、B），追加行透明
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(
      makeSpriteSheetImageData(1, 3, 16, 16, 2),
    )
    const preparation = target.prepareC3Rewrap(32)
    expect(preparation.kind).toBe('plan')
    if (preparation.kind !== 'plan') return
    expect(preparation.plan.oldColumns).toBe(1)
    expect(preparation.plan.newColumns).toBe(2)
    // 3 字符 2 列 → 2 行 × 16 = 32 高
    expect(preparation.plan.newRows).toBe(2)
    expect(preparation.plan.newImageHeight).toBe(32)

    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(32, 32) as unknown as HTMLImageElement,
    )
    const result = await target.applyC3SpriteRewrap(
      preparation.plan,
      preparation.repacked,
    )
    expect(result.ok).toBe(true)
    expect(target.baseImageConfig.fontSpriteWidth).toBe(32)
    expect(target.baseImageConfig.fontSpriteHeight).toBe(32)
    expect(target.originalImageWidth).toBe(32)
    expect(target.originalImageHeight).toBe(32)
    // 追加字符按新布局落位：2 列 → C（cellIndex 2）→ (0, 16)
    expect(appendedCellPosition(target, 0)).toEqual({ x: 0, y: 16 })
    // 再次重排同样是合法 generation
    const generation = C3GenerationStorage.readActiveC3Generation()!
    expect(generation.c3Config.originalImageWidth).toBe(32)
    expect(generation.c3Config.originalImageHeight).toBe(32)
    const persistedArray = JSON.parse(generation.c3Config.instanceArrayJson) as C3InstanceArray
    expect(persistedArray[2]).toBe(16)
    expect(persistedArray[4]).toBe('AB')
  })

  it('stays compactible after a project round-trip', async () => {
    const store = useEditorStore()
    await importAndRewrap(store)
    const { target } = await roundTrip(store, 16, 48)

    // 与 makeSourceImageData 同形状的内容（每个 16×16 cell 内 x=2..13、y=0..7）
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(
      makeSpriteSheetImageData(1, 3, 16, 16, 2),
    )
    const prepared = target.prepareC3Compaction()
    expect(prepared.kind).toBe('plan')
    if (prepared.kind !== 'plan') return
    expect(prepared.plan.newCharacterWidth).toBe(14)
    expect(prepared.plan.newCharacterHeight).toBe(9)

    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(16, 18) as unknown as HTMLImageElement,
    )
    const applied = await target.applyC3SpriteCompaction(
      prepared.plan,
      prepared.repacked,
    )
    expect(applied.ok).toBe(true)

    // 精简语义：cell 缩小、instance 更新、spacing 只删等于旧 characterWidth 的冗余项
    expect(target.baseCellConfig.width).toBe(14)
    expect(target.baseCellConfig.height).toBe(9)
    expect(target.c3InstanceArray?.[2]).toBe(14)
    expect(target.c3InstanceArray?.[3]).toBe(9)
    expect(target.c3InstanceArray?.[4]).toBe('AB')
    expect(target.c3InstanceArray?.[5]).toBe('[[10,"A"]]')
    // 精简保持 fontSpriteWidth；导入基图 = 16×18（仅导入 cell），
    // 最终纹理高度 27 = 含追加的总字符数密铺（3 字符 1 列 × 9）
    expect(target.baseImageConfig.fontSpriteWidth).toBe(16)
    expect(target.baseImageConfig.fontSpriteHeight).toBe(27)
    expect(target.originalImageWidth).toBe(16)
    expect(target.originalImageHeight).toBe(18)
    expect(target.c3AppendedEntries).toHaveLength(1)
    expect(target.c3AppendedEntries[0].char).toBe('C')
    // 追加字符按精简后布局落位：cell 14×9，1 列 → C（cellIndex 2）→ (0, 18)
    expect(appendedCellPosition(target, 0)).toEqual({ x: 0, y: 18 })
  })
})
