import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import {
  analyzeC3SpriteCompaction,
  repackC3ImportedCells,
} from '@/utils/c3-compaction'
import type { C3CompactionSource } from '@/utils/c3-compaction'
import * as c3CompactionModule from '@/utils/c3-compaction'
import * as c3CompactionDom from '@/utils/c3-compaction-dom'
import * as c3CharRenderer from '@/utils/c3-char-renderer'
import { buildProjectFiles, exportProjectToZip } from '@/utils/project-export'
import {
  parseProjectFiles,
  readZipProject,
} from '@/utils/project-import'
import { C3GenerationStorage } from '@/utils/storage'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage } from './helpers/fake-image'
import {
  createSampleArray,
  makePngBlob,
  makeSourceImageData,
  makeSource,
} from './helpers/c3-fixtures'
import { resetFakeIndexedDB } from './fake-indexeddb'

async function importAndCompact(
  store: ReturnType<typeof useEditorStore>,
  imageFilename = 'c3-sprite.png',
): Promise<{ repacked: ImageData }> {
  const image = new FakeImage(32, 32)
  const array = createSampleArray()
  const parsed = parseC3InstanceArray(JSON.stringify(array))
  await store.importC3SpriteFont(
    image as unknown as HTMLImageElement,
    array,
    parsed,
    imageFilename,
    32,
    32,
    'image/png',
    makePngBlob(),
  )

  const sourceImageData = makeSourceImageData()
  const source = makeSource()
  const analysis = analyzeC3SpriteCompaction(sourceImageData, source)
  if (analysis.kind !== 'plan') {
    throw new Error('expected a compaction plan')
  }
  const repack = repackC3ImportedCells(sourceImageData, analysis, source)
  if (repack.kind !== 'ok') {
    throw new Error('expected repack success')
  }

  vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
  vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
    new FakeImage(analysis.newImageWidth, analysis.newImageHeight) as unknown as HTMLImageElement,
  )

  const result = await store.applyC3SpriteCompaction(analysis, repack.image)
  expect(result.ok).toBe(true)
  return { repacked: repack.image }
}

function createMockImageLoader(width: number, height: number) {
  return vi.fn(async () => new FakeImage(width, height) as unknown as HTMLImageElement)
}

describe('C3 compaction project round-trip', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetFakeIndexedDB()
    installMemoryLocalStorage()
    vi.stubGlobal('Image', FakeImage)
    vi.spyOn(c3CompactionModule, 'verifyCanvasAlphaRoundTrip').mockReturnValue(true)
    vi.spyOn(c3CharRenderer, 'measureGlyphBounds').mockReturnValue({ width: 8, height: 12, left: 2, top: 0 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('exports the compacted image and baseline, then restores the same layering', async () => {
    const store = useEditorStore()
    await importAndCompact(store)
    store.appendC3Characters(['C'])
    store.updateC3AppendedExtraSpacing(0, 3)

    const files = await buildProjectFiles(store)

    // 导出图片来自 generation asset（精简 PNG），文件名保持 .png
    expect(files.projectJson.mode).toBe('c3')
    expect(files.imageFilename).toBe('c3-sprite.png')
    expect(files.imageBlob.type).toBe('image/png')
    // 基线配置已精简
    expect(files.projectJson.state.baseCellConfig.width).toBe(14)
    expect(files.projectJson.state.baseCellConfig.height).toBe(9)
    expect(files.projectJson.state.baseImageConfig.fontSpriteHeight).toBe(9)
    expect(files.projectJson.state.originalImageWidth).toBe(32)
    expect(files.projectJson.state.originalImageHeight).toBe(9)
    expect(files.c3InstanceArray?.[2]).toBe(14)
    expect(files.c3InstanceArray?.[3]).toBe(9)
    expect(files.c3InstanceArray?.[4]).toBe('AB')
    expect(files.projectJson.state.c3AppendedEntries).toHaveLength(1)
    // generation 不进入 project 文件
    expect(JSON.stringify(files.projectJson)).not.toContain('imageAssetId')
    expect(JSON.stringify(files.projectJson)).not.toContain('active-generation')
    expect(JSON.stringify(files.c3InstanceArray)).not.toContain('generation')

    // 导入到新 store：恢复同一可编辑分层
    const map = new Map<string, Blob>()
    map.set('project.json', new Blob([JSON.stringify(files.projectJson, null, 2)]))
    map.set(files.imageFilename, files.imageBlob)
    map.set(files.projectJson.c3Instance!, new Blob([JSON.stringify(files.c3InstanceArray, null, 2)]))

    const projectData = await parseProjectFiles(map, createMockImageLoader(32, 9))
    expect(projectData.state.baseCellConfig.width).toBe(14)
    expect(projectData.state.originalImageWidth).toBe(32)
    expect(projectData.state.originalImageHeight).toBe(9)

    setActivePinia(createPinia())
    const target = useEditorStore()
    await target.applyProject(projectData)

    expect(target.isC3Mode).toBe(true)
    expect(target.baseCellConfig.width).toBe(14)
    expect(target.baseCellConfig.height).toBe(9)
    expect(target.baseImageConfig.fontSpriteWidth).toBe(32)
    expect(target.baseImageConfig.fontSpriteHeight).toBe(9)
    expect(target.originalImageWidth).toBe(32)
    expect(target.originalImageHeight).toBe(9)
    expect(target.c3InstanceArray?.[2]).toBe(14)
    expect(target.c3InstanceArray?.[5]).toBe('[]')
    expect(target.c3AppendedEntries).toHaveLength(1)
    expect(target.c3AppendedEntries[0].char).toBe('C')
    expect(target.c3AppendedEntries[0].extraSpacing).toBe(3)
    expect(target.c3ImportedImageFilename).toBe('c3-sprite.png')
    // 导入建立 coherent 本地 generation
    const generation = C3GenerationStorage.readActiveC3Generation()
    expect(generation).not.toBeNull()
    expect(generation!.c3Config.originalImageWidth).toBe(32)
    expect(generation!.c3Config.originalImageHeight).toBe(9)
    expect(generation!.c3Config.imageAssetId).toBeDefined()
  })

  it('re-analyzing a restored compacted baseline yields no-savings (no isCompacted flag)', async () => {
    const store = useEditorStore()
    const { repacked } = await importAndCompact(store)

    // 模拟刷新恢复后的基线（无损：编码/解码往返不改变 repacked 像素）
    const source2: C3CompactionSource = {
      fontSpriteWidth: 32,
      fontSpriteHeight: 9,
      characterWidth: 14,
      characterHeight: 9,
      imageMargin: { top: 0, right: 0, bottom: 0, left: 0 },
      imagePadding: { top: 0, right: 0, bottom: 0, left: 0 },
      importedCharacterSet: ['A', 'B'],
      appendedCharacterCount: 0,
    }
    const secondAnalysis = analyzeC3SpriteCompaction(repacked, source2)
    expect(secondAnalysis.kind).toBe('no-savings')
  })

  it('normalizes a non-PNG C3 logical filename for project export while keeping it in the store', async () => {
    const store = useEditorStore()
    await importAndCompact(store, 'c3-sprite.jpg')

    expect(store.c3ImportedImageFilename).toBe('c3-sprite.jpg')

    const files = await buildProjectFiles(store)
    // PNG blob 不以误导性的 .jpg 扩展名写入
    expect(files.imageFilename).toBe('c3-sprite.png')
    expect(files.imageBlob.type).toBe('image/png')
  })

  it('keeps non-PNG MIME and extension consistent on export (transparent WebP import)', async () => {
    const store = useEditorStore()
    const image = new FakeImage(32, 32)
    const array = createSampleArray()
    const parsed = parseC3InstanceArray(JSON.stringify(array))
    const webpBlob = new Blob(['webp-bytes'], { type: 'image/webp' })
    await store.importC3SpriteFont(
      image as unknown as HTMLImageElement,
      array,
      parsed,
      'c3-sprite.webp',
      32,
      32,
      'image/webp',
      webpBlob,
    )

    const files = await buildProjectFiles(store)

    // 未精简的透明 WebP：保留原扩展名，不强制 .png，保证 MIME 与扩展名一致
    expect(files.imageFilename).toBe('c3-sprite.webp')
    expect(files.imageBlob.type).toBe('image/webp')
    expect(files.projectJson.image).toBe('c3-sprite.webp')
  })

  it('supports ZIP export/import round-trip of a compacted project', async () => {
    const store = useEditorStore()
    await importAndCompact(store)

    const zipBlob = await exportProjectToZip(store)
    const map = await readZipProject(zipBlob)

    expect(map.has('project.json')).toBe(true)
    expect(map.has('c3-sprite.png')).toBe(true)
    expect(map.has('c3-instance.json')).toBe(true)

    const projectData = await parseProjectFiles(map, createMockImageLoader(32, 9))
    expect(projectData.mode).toBe('c3')
    expect(projectData.state.baseCellConfig.width).toBe(14)
  })

  it('recomputes auto horizontal metrics while preserving user-tuned fields across a round-trip without remeasuring', async () => {
    const store = useEditorStore()
    const image = new FakeImage(32, 32)
    const array = createSampleArray('AB', '[]')
    const parsed = parseC3InstanceArray(JSON.stringify(array))
    const measureSpy = vi
      .spyOn(c3CharRenderer, 'measureGlyphBounds')
      .mockReturnValue({ width: 8, height: 12, left: 2, top: 0 })
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
    const measureCallsAfterAppend = measureSpy.mock.calls.length

    // 手动设置非默认 metrics/extra/margin/distribution（模拟用户调整）。
    // autoDisplayWidth/autoBearingOffset 是自动量（issue #21）：
    // 精简 apply 时按新 sheet 结构重算覆盖，extra/margin/distribution 保持
    const entry = store.c3AppendedEntries[0]
    entry.autoDisplayWidth = 118
    entry.autoGlyphHeight = 96
    entry.extraSpacing = 5
    entry.margin = { top: 2, right: 1, bottom: 3, left: 4 }
    entry.distributionOffset = 6

    // 分析 + 应用（真实候选路径）
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(
      makeSourceImageData(),
    )
    const prepared = store.prepareC3Compaction()
    expect(prepared.kind).toBe('plan')
    if (prepared.kind !== 'plan') return
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(
      makePngBlob(),
    )
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(32, 9) as unknown as HTMLImageElement,
    )
    const applied = await store.applyC3SpriteCompaction(
      prepared.plan,
      prepared.repacked,
    )
    expect(applied.ok).toBe(true)

    // issue #21 有意为之：cell 缩到 14×9 后实测 bearing 1/overhang −1，
    // 自动量重算为 autoDisplayWidth = round(1+8+1) = 10、
    // autoBearingOffset = bearing − padding.left = 1
    expect(store.c3AppendedEntries[0].autoDisplayWidth).toBe(10)
    expect(store.c3AppendedEntries[0].autoBearingOffset).toBe(1)
    // 用户调整字段不被重算触碰
    expect(store.c3AppendedEntries[0].autoGlyphHeight).toBe(96)
    expect(store.c3AppendedEntries[0].extraSpacing).toBe(5)
    expect(store.c3AppendedEntries[0].margin).toEqual({ top: 2, right: 1, bottom: 3, left: 4 })
    expect(store.c3AppendedEntries[0].distributionOffset).toBe(6)

    // export → import
    const files = await buildProjectFiles(store)
    const map = new Map<string, Blob>()
    map.set(
      'project.json',
      new Blob([JSON.stringify(files.projectJson, null, 2)]),
    )
    map.set(files.imageFilename, files.imageBlob)
    map.set(
      files.projectJson.c3Instance!,
      new Blob([JSON.stringify(files.c3InstanceArray, null, 2)]),
    )

    // 恢复阶段读取精简后的 asset：mock 换成 14 宽 cell 的精简布局
    //（内容相对新 cell 左缘 x=1..12，与 repack 裁剪结果一致），
    // 保证恢复时重实测 metrics 与 apply 时一致（bearing 1/overhang −1）
    const compactedSheet = new ImageData(32, 9)
    for (const originX of [0, 14]) {
      for (let y = 0; y <= 7; y++) {
        for (let x = 1; x <= 12; x++) {
          compactedSheet.data[(y * 32 + originX + x) * 4 + 3] = 255
        }
      }
    }
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(compactedSheet)
    const projectData = await parseProjectFiles(
      map,
      createMockImageLoader(32, 9),
    )

    setActivePinia(createPinia())
    const target = useEditorStore()
    await target.applyProject(projectData)

    // 自动水平量经导出/导入保持重算后的值，用户调整字段逐字段保持，且未重测
    expect(
      JSON.parse(JSON.stringify(target.c3AppendedEntries)),
    ).toEqual(JSON.parse(JSON.stringify(store.c3AppendedEntries)))
    expect(target.c3AppendedEntries[0].autoDisplayWidth).toBe(10)
    expect(target.c3AppendedEntries[0].autoBearingOffset).toBe(1)
    expect(target.c3AppendedEntries[0].autoGlyphHeight).toBe(96)
    expect(target.c3AppendedEntries[0].extraSpacing).toBe(5)
    expect(measureSpy.mock.calls.length).toBe(measureCallsAfterAppend)
  })
})
