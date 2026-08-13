/**
 * C3 精简相关测试共用的样例构造。
 */
import type { C3InstanceArray } from '@/utils/c3-parser'
import type { C3CompactionSource } from '@/utils/c3-compaction'

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
