import { describe, it, expect } from 'vitest'
import {
  measureImportedGlyphMetrics,
  computeAppendedAdvance,
  computeBearingOffset,
  type C3GlyphCellProbe,
} from '@/utils/c3-glyph-metrics'
import { C3_CONTENT_ALPHA_MIN } from '@/utils/c3-compaction'

/** 全透明 ImageData */
function makeImage(width: number, height: number): ImageData {
  return new ImageData(width, height)
}

/** 在 (originX, originY) cell 内画一个实心矩形内容块（含 minX/maxX/minY/maxY） */
function paintContent(
  img: ImageData,
  originX: number,
  originY: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  alpha = 255,
): void {
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      img.data[((originY + y) * img.width + originX + x) * 4 + 3] = alpha
    }
  }
}

function probe(
  originX: number,
  originY: number,
  width: number,
  height: number,
  advance?: number,
): C3GlyphCellProbe {
  return { originX, originY, width, height, advance: advance ?? width }
}

describe('measureImportedGlyphMetrics', () => {
  it('returns null when no cell has visible pixels', () => {
    const img = makeImage(32, 16)
    const cells = [probe(0, 0, 16, 16), probe(16, 0, 16, 16)]
    expect(measureImportedGlyphMetrics(img, cells)).toBeNull()
  })

  it('measures bearing and overhang of a single cell', () => {
    const img = makeImage(16, 16)
    // 内容 x=2..7 → bearing 2、rightEdge = 8；advance 显式 10 → overhang = 8−10 = −2
    paintContent(img, 0, 0, 2, 7, 3, 9)
    const cells = [probe(0, 0, 16, 16, 10)]
    expect(measureImportedGlyphMetrics(img, cells)).toEqual({
      bearing: 2,
      overhang: -2,
    })
  })

  it('falls back to cell width as advance when none is given', () => {
    const img = makeImage(16, 16)
    paintContent(img, 0, 0, 2, 7, 0, 7)
    const cells = [probe(0, 0, 16, 16)]
    // rightEdge 8 − advance 16 = −8
    expect(measureImportedGlyphMetrics(img, cells)).toEqual({
      bearing: 2,
      overhang: -8,
    })
  })

  it('takes the median across an odd number of cells', () => {
    const img = makeImage(48, 16)
    // bearing 2 / 5 / 2，overhang 各自 = rightEdge − advance（advance = cell 宽 16）
    paintContent(img, 0, 0, 2, 9, 0, 7) // bearing 2, rightEdge 10 → overhang −6
    paintContent(img, 16, 0, 5, 11, 0, 7) // bearing 5, rightEdge 12 → overhang −4
    paintContent(img, 32, 0, 2, 13, 0, 7) // bearing 2, rightEdge 14 → overhang −2
    const cells = [probe(0, 0, 16, 16), probe(16, 0, 16, 16), probe(32, 0, 16, 16)]
    expect(measureImportedGlyphMetrics(img, cells)).toEqual({
      bearing: 2,
      overhang: -4,
    })
  })

  it('averages the two middle values and rounds for an even number of cells', () => {
    const img = makeImage(32, 16)
    paintContent(img, 0, 0, 1, 7, 0, 7) // bearing 1
    paintContent(img, 16, 0, 4, 7, 0, 7) // bearing 4
    // overhangs：rightEdge 8 − 10 = −2；8 − 12 = −4
    const cells = [probe(0, 0, 16, 16, 10), probe(16, 0, 16, 16, 12)]
    // bearing round((1+4)/2) = round(2.5) = 3；overhang round((−2−4)/2) = −3
    expect(measureImportedGlyphMetrics(img, cells)).toEqual({
      bearing: 3,
      overhang: -3,
    })
  })

  it('skips empty cells without distorting the median', () => {
    const img = makeImage(48, 16)
    paintContent(img, 0, 0, 2, 7, 0, 7) // bearing 2
    // 中间 cell 为空（跳过）
    paintContent(img, 32, 0, 2, 7, 0, 7) // bearing 2
    const cells = [probe(0, 0, 16, 16), probe(16, 0, 16, 16), probe(32, 0, 16, 16)]
    expect(measureImportedGlyphMetrics(img, cells)).toEqual({
      bearing: 2,
      overhang: -8,
    })
  })

  it('returns null when every cell is empty after skipping', () => {
    const img = makeImage(32, 16)
    paintContent(img, 0, 0, 2, 7, 0, 7, C3_CONTENT_ALPHA_MIN - 1)
    expect(measureImportedGlyphMetrics(img, [probe(0, 0, 16, 16)])).toBeNull()
  })

  it('treats alpha at the content threshold as content', () => {
    const img = makeImage(16, 16)
    paintContent(img, 0, 0, 3, 7, 0, 7, C3_CONTENT_ALPHA_MIN)
    expect(measureImportedGlyphMetrics(img, [probe(0, 0, 16, 16)])?.bearing).toBe(3)
  })

  it('clips cells that extend past the image bounds', () => {
    const img = makeImage(20, 10)
    paintContent(img, 8, 0, 0, 11, 0, 7) // 内容伸到 x=19（图宽 20）
    const cells = [probe(8, 0, 16, 16, 16)]
    // 可见 maxX = 19 → rightEdge 20；bearing 0、overhang = 20−8−16 = −4
    expect(measureImportedGlyphMetrics(img, cells)).toEqual({
      bearing: 0,
      overhang: -4,
    })
  })
})

describe('computeAppendedAdvance', () => {
  it('uses the legacy width + padding formula when metrics are missing', () => {
    expect(computeAppendedAdvance(8, null, 3)).toBe(11)
  })

  it('uses bearing + glyphWidth − overhang when metrics exist', () => {
    expect(computeAppendedAdvance(8, { bearing: 10, overhang: 4 }, 3)).toBe(14)
  })

  it('clamps the result to at least 1', () => {
    expect(computeAppendedAdvance(2, { bearing: 0, overhang: 12 }, 0)).toBe(1)
  })

  it('rounds fractional medians', () => {
    expect(computeAppendedAdvance(8, { bearing: 2.5, overhang: -1.5 }, 0)).toBe(12)
  })
})

describe('computeBearingOffset', () => {
  it('returns 0 when metrics are missing', () => {
    expect(computeBearingOffset(null, 4)).toBe(0)
  })

  it('compensates the difference between bearing and padding.left', () => {
    // 渲染链锚定：ink 左缘落在 padding.left + margin.left，
    // offset = bearing − padding.left 使其精确等于导入 bearing
    expect(computeBearingOffset({ bearing: 10, overhang: 4 }, 6)).toBe(4)
    expect(computeBearingOffset({ bearing: 10, overhang: 4 }, 12)).toBe(-2)
    expect(computeBearingOffset({ bearing: 2, overhang: 1 }, 0)).toBe(2)
  })
})
