/**
 * C3 精简/重排测试共用的样例构造与断言 helper。
 */
import { vi } from 'vitest'
import type { C3InstanceArray } from '@/utils/c3-parser'
import type { C3CompactionSource } from '@/utils/c3-compaction'
import type { useEditorStore } from '@/stores/editor'
import { CanvasSpace } from '@/utils/canvas'
import { splitGraphemes } from '@/utils/grapheme'
import { FakeImage } from './fake-image'

export function createSampleArray(characterSet = 'AB', spacingData = '[]'): C3InstanceArray {
  return [
    'Sample',
    true,
    16,
    16,
    characterSet,
    spacingData,
    1,
    2,
    4,
    0,
    0,
    0,
    true,
    null,
    false,
  ] as unknown as C3InstanceArray
}

export function makePngBlob(): Blob {
  return new Blob(['fake-png-bytes'], { type: 'image/png' })
}

/**
 * 构造一个 32x32 的导入图：两个 16x16 cell（A 左、B 右），
 * 内容位于每个 cell 的 x=2..13、y=0..7（四边各有留白），
 * 保证 analyze 产出有收益的 plan（newW=14, newH=9）。
 */
export function makeSourceImageData(): ImageData {
  const img = new ImageData(32, 32)
  const paint = (ox: number, oy: number) => {
    for (let y = 0; y <= 7; y++) {
      for (let x = 2; x <= 13; x++) {
        img.data[((oy + y) * img.width + (ox + x)) * 4 + 3] = 255
      }
    }
  }
  paint(0, 0) // cell A
  paint(16, 0) // cell B
  return img
}

export function makeSource(): C3CompactionSource {
  return {
    fontSpriteWidth: 32,
    fontSpriteHeight: 32,
    characterWidth: 16,
    characterHeight: 16,
    imageMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    imagePadding: { top: 0, right: 0, bottom: 0, left: 0 },
    importedCharacterSet: ['A', 'B'],
    appendedCharacterCount: 0,
  }
}

/**
 * 重排/精简集成测试共用的 fixture 构造（test-fixtures/c3/ 入库前的等价合成入口：
 * sprite.png + instance-array.json 的语义等价物，cell 尺寸取实样 99×105）。
 */

/** 通用 instance array：任意 cell 尺寸与字符集 */
export function createFixtureArray(
  characterWidth: number,
  characterHeight: number,
  characterSet: string,
  spacingData = '[]',
): C3InstanceArray {
  return [
    'Sample',
    true,
    characterWidth,
    characterHeight,
    characterSet,
    spacingData,
    1,
    2,
    4,
    0,
    0,
    0,
    true,
    null,
    false,
  ] as unknown as C3InstanceArray
}

/**
 * 在指定 cell 原点绘制确定性不透明内容：形状与 makeSourceImageData 一致
 * （x=2..13、y=0..7，保证 analyze 产出有收益的 plan），RGB 由 seed 区分，
 * 供像素级位置断言使用。内容严格落在 cell 内（四周留白），
 * 重排的 content-outside-imported-cells 校验可通过。
 */
export function paintTraceableCell(
  img: ImageData,
  originX: number,
  originY: number,
  seed: number,
): void {
  for (let y = 0; y <= 7; y++) {
    for (let x = 2; x <= 13; x++) {
      const idx = ((originY + y) * img.width + originX + x) * 4
      img.data[idx] = (seed * 41) % 256
      img.data[idx + 1] = (seed * 67) % 256
      img.data[idx + 2] = (seed * 97) % 256
      img.data[idx + 3] = 255
    }
  }
}

/**
 * 按 row-major 绘制 count 个 cell 的 sprite sheet。
 * rows 可大于 ceil(count / columns)（追加字符占位行保持透明）。
 * sheetWidth 可大于 columns × cellWidth（精简/重排后的右侧透明余量）。
 */
export function makeSpriteSheetImageData(
  columns: number,
  rows: number,
  cellWidth: number,
  cellHeight: number,
  count: number,
  sheetWidth?: number,
): ImageData {
  const img = new ImageData(sheetWidth ?? columns * cellWidth, rows * cellHeight)
  for (let i = 0; i < count; i++) {
    paintTraceableCell(
      img,
      (i % columns) * cellWidth,
      Math.floor(i / columns) * cellHeight,
      i + 1,
    )
  }
  return img
}

/** 与 makeSource 同形的任意尺寸 source 构造 */
export function makeFixtureSource(options: {
  fontSpriteWidth: number
  fontSpriteHeight: number
  characterWidth: number
  characterHeight: number
  importedCharacterSet: string[]
  appendedCharacterCount?: number
}): C3CompactionSource {
  return {
    fontSpriteWidth: options.fontSpriteWidth,
    fontSpriteHeight: options.fontSpriteHeight,
    characterWidth: options.characterWidth,
    characterHeight: options.characterHeight,
    imageMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    imagePadding: { top: 0, right: 0, bottom: 0, left: 0 },
    importedCharacterSet: options.importedCharacterSet,
    appendedCharacterCount: options.appendedCharacterCount ?? 0,
  }
}

/** 读取某个 cell 原点处内容像素（内容形状左上角 x=2、y=0） */
export function cellAnchorPixel(
  img: ImageData,
  originX: number,
  originY: number,
): [number, number, number, number] {
  const idx = (originY * img.width + originX + 2) * 4
  return [
    img.data[idx],
    img.data[idx + 1],
    img.data[idx + 2],
    img.data[idx + 3],
  ]
}

/** 追加字符按最终布局的渲染落位（与 CanvasArea.renderC3AppendedCharacters 同一映射） */
export function appendedCellPosition(
  store: ReturnType<typeof useEditorStore>,
  appendedIndex: number,
) {
  const space = new CanvasSpace(
    store.originalImageWidth,
    store.originalImageHeight,
    store.baseCellConfig.width,
    store.baseCellConfig.height,
    store.baseCellConfig.margin,
    store.baseImageConfig.margin,
    store.baseImageConfig.padding,
    store.baseImageConfig.fontSpriteWidth,
    store.baseImageConfig.fontSpriteHeight,
  )
  const importedCount = splitGraphemes(store.importedCharacterSet).length
  const { row, col } = space.indexToRowCol(importedCount + appendedIndex)
  return space.getCellPosition(row, col)
}

/** parseProjectFiles 的图片加载替身：按指定尺寸返回 FakeImage */
export function createMockImageLoader(width: number, height: number) {
  return vi.fn(
    async () => new FakeImage(width, height) as unknown as HTMLImageElement,
  )
}
