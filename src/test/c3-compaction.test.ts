import { describe, it, expect, vi } from 'vitest'
import {
  analyzeC3SpriteCompaction,
  repackC3ImportedCells,
  migrateC3SpacingData,
  alphaRoundTrips,
  verifyCanvasAlphaRoundTrip,
  rankC3CellExtents,
} from '@/utils/c3-compaction'
import type { C3CompactionPlan, C3CompactionSource } from '@/utils/c3-compaction'

function makeImageData(width: number, height: number): ImageData {
  return new ImageData(width, height)
}

function setPixel(
  img: ImageData,
  x: number,
  y: number,
  alpha = 255,
  rgb: readonly [number, number, number] = [255, 0, 0],
): void {
  const idx = (y * img.width + x) * 4
  img.data[idx] = rgb[0]
  img.data[idx + 1] = rgb[1]
  img.data[idx + 2] = rgb[2]
  img.data[idx + 3] = alpha
}

/** Paint an opaque content rect at local coordinates inside a 16x16 cell whose origin is (ox, oy). */
function paintLocal(
  img: ImageData,
  ox: number,
  oy: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      setPixel(img, ox + x, oy + y)
    }
  }
}

function buildSource(overrides?: Partial<C3CompactionSource>): C3CompactionSource {
  return {
    fontSpriteWidth: 32,
    fontSpriteHeight: 32,
    characterWidth: 16,
    characterHeight: 16,
    imageMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    imagePadding: { top: 0, right: 0, bottom: 0, left: 0 },
    importedCharacterSet: ['A', 'B', 'C', 'D'],
    appendedCharacterCount: 0,
    ...overrides,
  }
}

describe('analyzeC3SpriteCompaction', () => {
  it('computes a uniform crop and the new grid dimensions', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 3, 2, 12, 12)
    paintLocal(img, 16, 0, 3, 2, 12, 12)
    paintLocal(img, 0, 16, 3, 2, 12, 12)
    paintLocal(img, 16, 16, 3, 2, 12, 12)

    const result = analyzeC3SpriteCompaction(img, buildSource())

    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.crop).toEqual({ top: 1, right: 2, bottom: 2, left: 2 })
    expect(result.newCharacterWidth).toBe(12)
    expect(result.newCharacterHeight).toBe(13)
    expect(result.newColumns).toBe(2)
    // 导入基图宽度保持 fontSpriteWidth（32），列跨度为 2×12
    expect(result.newImageWidth).toBe(32)
    expect(result.newImageHeight).toBe(26)
    expect(result.oldFinalTextureHeight).toBe(32)
    expect(result.newFinalTextureHeight).toBe(26)
    expect(result.importedCount).toBe(4)
  })

  it('reports content spans for non-empty imported cells only', () => {
    const img = makeImageData(32, 32)
    // cell 0: local (3,2)-(12,12) → 留白 top2/right3/bottom3/left3 → 跨度 10×11
    paintLocal(img, 0, 0, 3, 2, 12, 12)
    // cell 1 全透明：不参与榜单
    // cell 2: local (2,2)-(13,13) → 跨度 12×12
    paintLocal(img, 0, 16, 2, 2, 13, 13)
    // cell 3: 单像素 local (5,7) → 跨度 1×1
    setPixel(img, 16 + 5, 16 + 7)

    const result = analyzeC3SpriteCompaction(img, buildSource())

    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.cellExtents).toEqual([
      { index: 0, contentWidth: 10, contentHeight: 11 },
      { index: 2, contentWidth: 12, contentHeight: 12 },
      { index: 3, contentWidth: 1, contentHeight: 1 },
    ])
  })

  it('takes per-side minima across non-empty cells and zeroes a side that touches content', () => {
    const img = makeImageData(32, 32)
    // cell 0: local (2,2)-(13,13) → blanks 2/2/2/2
    paintLocal(img, 0, 0, 2, 2, 13, 13)
    // cells 1-3: local (4,3)-(15,12) → left 4, top 3, right 0, bottom 3
    paintLocal(img, 16, 0, 4, 3, 15, 12)
    paintLocal(img, 0, 16, 4, 3, 15, 12)
    paintLocal(img, 16, 16, 4, 3, 15, 12)

    const result = analyzeC3SpriteCompaction(img, buildSource())

    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.crop).toEqual({ top: 1, right: 0, bottom: 1, left: 1 })
    expect(result.newCharacterWidth).toBe(15)
    expect(result.newCharacterHeight).toBe(14)
  })

  it('treats alpha >= 16 as content, ignores RGB and sub-threshold alpha, and excludes empty cells from minima', () => {
    const img = makeImageData(32, 32)
    // boundary content pixel: alpha=16 in cell 0
    setPixel(img, 8, 8, 16)
    // sub-threshold dust (alpha 15) nearer every edge must not extend the bbox
    setPixel(img, 2, 2, 15)
    setPixel(img, 13, 13, 15)
    // RGB noise on every transparent pixel, including cells 1-3
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (img.data[(y * 32 + x) * 4 + 3] === 0) {
          img.data[(y * 32 + x) * 4] = (x + y) % 256
          img.data[(y * 32 + x) * 4 + 1] = 255
          img.data[(y * 32 + x) * 4 + 2] = 128
        }
      }
    }

    const result = analyzeC3SpriteCompaction(img, buildSource())

    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    // only the alpha=16 pixel at (8,8) participates: top 8, bottom 7, left 8, right 7
    expect(result.crop).toEqual({ top: 7, right: 6, bottom: 6, left: 7 })
    expect(result.newCharacterWidth).toBe(3)
    expect(result.newCharacterHeight).toBe(3)
  })

  it('treats cells with only sub-threshold alpha as empty (no-imported-content)', () => {
    const img = makeImageData(32, 32)
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        setPixel(img, x, y, 15)
      }
    }

    const result = analyzeC3SpriteCompaction(img, buildSource())

    expect(result).toEqual({ kind: 'error', code: 'no-imported-content' })
  })

  it('returns no-imported-content when every imported cell is fully transparent', () => {
    const img = makeImageData(32, 32)
    const result = analyzeC3SpriteCompaction(img, buildSource())
    expect(result).toEqual({ kind: 'error', code: 'no-imported-content' })
  })

  it('returns no-imported-content when the imported character set is empty', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 2, 2, 13, 13)
    const result = analyzeC3SpriteCompaction(
      img,
      buildSource({ importedCharacterSet: [] }),
    )
    expect(result).toEqual({ kind: 'error', code: 'no-imported-content' })
  })

  it('blocks when content (alpha >= 16) exists outside the imported cell union', () => {
    const img = makeImageData(48, 32)
    paintLocal(img, 0, 0, 2, 2, 13, 13)
    paintLocal(img, 16, 0, 2, 2, 13, 13)
    paintLocal(img, 0, 16, 2, 2, 13, 13)
    paintLocal(img, 16, 16, 2, 2, 13, 13)
    setPixel(img, 33, 0, 255)

    const result = analyzeC3SpriteCompaction(
      img,
      buildSource({ fontSpriteWidth: 32 }),
    )

    expect(result).toEqual({
      kind: 'error',
      code: 'content-outside-imported-cells',
    })
  })

  it('allows fully transparent pixels (including RGB noise) outside imported cells', () => {
    const img = makeImageData(48, 32)
    paintLocal(img, 0, 0, 2, 2, 13, 13)
    paintLocal(img, 16, 0, 2, 2, 13, 13)
    paintLocal(img, 0, 16, 2, 2, 13, 13)
    paintLocal(img, 16, 16, 2, 2, 13, 13)
    for (let x = 32; x < 48; x++) {
      img.data[(0 * 48 + x) * 4] = 255
      img.data[(0 * 48 + x) * 4 + 1] = 255
      img.data[(0 * 48 + x) * 4 + 2] = 255
    }

    const result = analyzeC3SpriteCompaction(
      img,
      buildSource({ fontSpriteWidth: 32 }),
    )

    expect(result.kind).toBe('plan')
  })

  it('allows sub-threshold alpha dust outside imported cells', () => {
    const img = makeImageData(48, 32)
    paintLocal(img, 0, 0, 2, 2, 13, 13)
    paintLocal(img, 16, 0, 2, 2, 13, 13)
    paintLocal(img, 0, 16, 2, 2, 13, 13)
    paintLocal(img, 16, 16, 2, 2, 13, 13)
    // alpha 15 dust beyond the last column must not block application
    setPixel(img, 33, 0, 15)

    const result = analyzeC3SpriteCompaction(
      img,
      buildSource({ fontSpriteWidth: 32 }),
    )

    expect(result.kind).toBe('plan')
  })

  it('blocks with invalid-grid when imported cells extend beyond the image bounds', () => {
    const img = makeImageData(32, 16)
    const result = analyzeC3SpriteCompaction(img, buildSource())
    expect(result).toEqual({ kind: 'error', code: 'invalid-grid' })
  })

  it('blocks invalid grid configuration such as a negative image margin', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 2, 2, 13, 13)
    const result = analyzeC3SpriteCompaction(
      img,
      buildSource({ imageMargin: { top: -1, right: 0, bottom: 0, left: 0 } }),
    )
    expect(result).toEqual({ kind: 'error', code: 'invalid-grid' })
  })

  it('fails closed on unreliable pixel data', () => {
    const bad = makeImageData(4, 4)
    Object.defineProperty(bad, 'data', { value: new Uint8ClampedArray(16) })
    const result = analyzeC3SpriteCompaction(bad, buildSource())
    expect(result).toEqual({ kind: 'error', code: 'unreliable-canvas' })
  })

  it('returns no-savings when content already touches every side', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 0, 0, 15, 15)
    paintLocal(img, 16, 0, 0, 0, 15, 15)
    paintLocal(img, 0, 16, 0, 0, 15, 15)
    paintLocal(img, 16, 16, 0, 0, 15, 15)

    const result = analyzeC3SpriteCompaction(img, buildSource())

    expect(result.kind).toBe('no-savings')
    if (result.kind !== 'no-savings') return
    expect(result.crop).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })

  it('returns no-savings when the final texture area is not reduced', () => {
    const img = makeImageData(32, 32)
    // two characters in one row; crop only reduces width, height stays 16
    paintLocal(img, 0, 0, 3, 0, 12, 15)
    paintLocal(img, 16, 0, 3, 0, 12, 15)

    const result = analyzeC3SpriteCompaction(
      img,
      buildSource({ importedCharacterSet: ['A', 'B'] }),
    )

    expect(result.kind).toBe('no-savings')
    if (result.kind !== 'no-savings') return
    expect(result.crop).toEqual({ top: 0, right: 2, bottom: 0, left: 2 })
  })

  it('re-analysis of an already compacted sheet yields no-savings (1px safety edge)', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 1, 1, 14, 14)
    paintLocal(img, 16, 0, 1, 1, 14, 14)
    paintLocal(img, 0, 16, 1, 1, 14, 14)
    paintLocal(img, 16, 16, 1, 1, 14, 14)

    const result = analyzeC3SpriteCompaction(img, buildSource())

    expect(result).toEqual({
      kind: 'no-savings',
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
    })
  })

  it('blocks a negative or non-integer appended character count', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 2, 2, 13, 13)

    expect(
      analyzeC3SpriteCompaction(
        img,
        buildSource({ appendedCharacterCount: -1 }),
      ),
    ).toEqual({ kind: 'error', code: 'invalid-grid' })
    expect(
      analyzeC3SpriteCompaction(
        img,
        buildSource({ appendedCharacterCount: 1.5 }),
      ),
    ).toEqual({ kind: 'error', code: 'invalid-grid' })
  })

  it('returns a plan when narrower cells let appended characters use fewer rows', () => {
    const img = makeImageData(32, 32)
    // horizontal-only crop: content local x 3..9, full height → crop {0,5,0,2}
    paintLocal(img, 0, 0, 3, 0, 9, 15)
    paintLocal(img, 16, 0, 3, 0, 9, 15)
    paintLocal(img, 0, 16, 3, 0, 9, 15)
    paintLocal(img, 16, 16, 3, 0, 9, 15)

    const result = analyzeC3SpriteCompaction(
      img,
      buildSource({ appendedCharacterCount: 100 }),
    )

    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.newCharacterWidth).toBe(9)
    expect(result.newCharacterHeight).toBe(16)
    expect(result.newColumns).toBe(3)
    // 导入基图高度（4 个导入字符）：ceil(4/3)*16 = 32
    expect(result.newImageHeight).toBe(32)
    // 最终纹理（104 字符）：旧 2 列 ceil(104/2)*16 = 832 → 新 3 列 ceil(104/3)*16 = 560
    expect(result.oldFinalTextureHeight).toBe(832)
    expect(result.newFinalTextureHeight).toBe(560)
  })
})

describe('repackC3ImportedCells', () => {
  it('repacks imported cells row-major into the new grid with a uniform crop', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 3, 2, 12, 12)
    paintLocal(img, 16, 0, 3, 2, 12, 12)
    paintLocal(img, 0, 16, 3, 2, 12, 12)
    paintLocal(img, 16, 16, 3, 2, 12, 12)
    // distinctive RGB on one glyph pixel to prove channels are preserved
    setPixel(img, 5, 5, 255, [10, 20, 30])

    const src = buildSource()
    const analysis = analyzeC3SpriteCompaction(img, src)
    expect(analysis.kind).toBe('plan')
    if (analysis.kind !== 'plan') return

    const result = repackC3ImportedCells(img, analysis, src)

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return

    const out = result.image
    expect(out.width).toBe(32) // 保持 fontSpriteWidth
    expect(out.height).toBe(26)

    // char 0 → new cell (0,0); crop {1,2,2,2}: content local (3,2) → out (1,1)
    expect(out.data[(1 * out.width + 1) * 4 + 3]).toBe(255)
    // distinctive RGB at source (5,5) → out (3,4) survived
    expect(out.data[(4 * out.width + 3) * 4]).toBe(10)
    expect(out.data[(4 * out.width + 3) * 4 + 1]).toBe(20)
    expect(out.data[(4 * out.width + 3) * 4 + 2]).toBe(30)
    expect(out.data[(4 * out.width + 3) * 4 + 3]).toBe(255)
    // crop edges are transparent
    expect(out.data[(1 * out.width + 0) * 4 + 3]).toBe(0)
    expect(out.data[(0 * out.width + 1) * 4 + 3]).toBe(0)

    // char 2 → new cell (1,0) at dst (0,13)
    expect(out.data[(14 * out.width + 1) * 4 + 3]).toBe(255)

    // 最后可用列（2×12=24）之后的余量保持透明
    for (let y = 0; y < out.height; y++) {
      for (let x = 24; x < 32; x++) {
        expect(out.data[(y * out.width + x) * 4 + 3]).toBe(0)
      }
    }
  })

  it('keeps fully transparent imported cells at their index in the repacked image', () => {
    const img = makeImageData(32, 32)
    // cells 0 and 2 have content; cells 1 and 3 are fully transparent
    paintLocal(img, 0, 0, 2, 2, 13, 13)
    paintLocal(img, 0, 16, 2, 2, 13, 13)

    const src = buildSource()
    const analysis = analyzeC3SpriteCompaction(img, src)
    expect(analysis.kind).toBe('plan')
    if (analysis.kind !== 'plan') return
    expect(analysis.crop).toEqual({ top: 1, right: 1, bottom: 1, left: 1 })
    expect(analysis.newCharacterWidth).toBe(14)
    expect(analysis.newCharacterHeight).toBe(14)

    const result = repackC3ImportedCells(img, analysis, src)
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return

    const out = result.image
    // char 0 content at out (1,1); char 2 content at out (1,15)
    expect(out.data[(1 * out.width + 1) * 4 + 3]).toBe(255)
    expect(out.data[(15 * out.width + 1) * 4 + 3]).toBe(255)
    // fully transparent char 1 occupies cell (0,1): x in [14,28), y in [0,14)
    for (let y = 0; y < 14; y++) {
      for (let x = 14; x < 28; x++) {
        expect(out.data[(y * out.width + x) * 4 + 3]).toBe(0)
      }
    }
  })

  it('never scales glyph pixels', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 4, 6, 8, 8)
    paintLocal(img, 16, 0, 4, 6, 8, 8)
    paintLocal(img, 0, 16, 4, 6, 8, 8)
    paintLocal(img, 16, 16, 4, 6, 8, 8)

    const src = buildSource()
    const analysis = analyzeC3SpriteCompaction(img, src)
    expect(analysis.kind).toBe('plan')
    if (analysis.kind !== 'plan') return

    const result = repackC3ImportedCells(img, analysis, src)
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return

    const countContent = (im: ImageData): number => {
      let n = 0
      for (let i = 3; i < im.data.length; i += 4) {
        if (im.data[i] !== 0) n++
      }
      return n
    }
    // four cells × a 5x3 glyph each, dimensions preserved exactly
    expect(countContent(result.image)).toBe(4 * 5 * 3)
  })

  it('repacks row-major into a different column count preserving order', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 5, 5, 10, 10)
    paintLocal(img, 16, 0, 5, 5, 10, 10)
    paintLocal(img, 0, 16, 5, 5, 10, 10)
    paintLocal(img, 16, 16, 5, 5, 10, 10)

    const src = buildSource()
    const analysis = analyzeC3SpriteCompaction(img, src)
    expect(analysis.kind).toBe('plan')
    if (analysis.kind !== 'plan') return
    expect(analysis.newColumns).toBe(4)
    expect(analysis.newCharacterWidth).toBe(8)
    expect(analysis.newCharacterHeight).toBe(8)

    const result = repackC3ImportedCells(img, analysis, src)
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return

    const out = result.image
    expect(out.width).toBe(32)
    expect(out.height).toBe(8)
    // content of each char at out (cellCol*8 + 1, 1)
    expect(out.data[(1 * out.width + 1) * 4 + 3]).toBe(255)
    expect(out.data[(1 * out.width + 9) * 4 + 3]).toBe(255)
    expect(out.data[(1 * out.width + 17) * 4 + 3]).toBe(255)
    expect(out.data[(1 * out.width + 25) * 4 + 3]).toBe(255)
    // blank gap between the cropped cells
    expect(out.data[(1 * out.width + 7) * 4 + 3]).toBe(0)
    expect(out.data[(1 * out.width + 8) * 4 + 3]).toBe(0)
  })

  it('returns invalid-output-dimensions for a plan whose crop exceeds the cell', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 2, 2, 13, 13)
    const src = buildSource()
    const badPlan: C3CompactionPlan = {
      kind: 'plan',
      crop: { top: 0, right: 10, bottom: 0, left: 10 },
      newCharacterWidth: 6,
      newCharacterHeight: 16,
      newColumns: 2,
      newImageWidth: 32,
      newImageHeight: 16,
      importedCount: 1,
      oldFinalTextureHeight: 32,
      newFinalTextureHeight: 16,
      cellExtents: [],
    }

    const result = repackC3ImportedCells(img, badPlan, src)

    expect(result).toEqual({ kind: 'error', code: 'invalid-output-dimensions' })
  })

  it('fails closed when the plan image width does not match the font sprite width', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 2, 2, 13, 13)
    const src = buildSource()
    const plan: C3CompactionPlan = {
      kind: 'plan',
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      newCharacterWidth: 16,
      newCharacterHeight: 16,
      newColumns: 2,
      newImageWidth: 24, // 必须等于 fontSpriteWidth 32
      newImageHeight: 16,
      importedCount: 1,
      oldFinalTextureHeight: 32,
      newFinalTextureHeight: 16,
      cellExtents: [],
    }

    expect(repackC3ImportedCells(img, plan, src)).toEqual({
      kind: 'error',
      code: 'invalid-output-dimensions',
    })
  })

  it('fails closed when the plan imported count mismatches the source character set', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 2, 2, 13, 13)
    const src = buildSource() // 4 个导入字符
    const plan: C3CompactionPlan = {
      kind: 'plan',
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      newCharacterWidth: 16,
      newCharacterHeight: 16,
      newColumns: 2,
      newImageWidth: 32,
      newImageHeight: 16, // ceil(2/2)*16
      importedCount: 2, // 与 source.importedCharacterSet.length=4 不一致
      oldFinalTextureHeight: 32,
      newFinalTextureHeight: 32,
      cellExtents: [],
    }

    expect(repackC3ImportedCells(img, plan, src)).toEqual({
      kind: 'error',
      code: 'invalid-output-dimensions',
    })
  })

  it('fails closed on a zero imported count', () => {
    const img = makeImageData(32, 32)
    paintLocal(img, 0, 0, 2, 2, 13, 13)
    const src = buildSource()
    const plan: C3CompactionPlan = {
      kind: 'plan',
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      newCharacterWidth: 16,
      newCharacterHeight: 16,
      newColumns: 2,
      newImageWidth: 32,
      newImageHeight: 0,
      importedCount: 0,
      oldFinalTextureHeight: 0,
      newFinalTextureHeight: 0,
      cellExtents: [],
    }

    expect(repackC3ImportedCells(img, plan, src)).toEqual({
      kind: 'error',
      code: 'invalid-output-dimensions',
    })
  })
})

describe('rankC3CellExtents', () => {
  const extent = (index: number, contentWidth: number, contentHeight = 0) => ({
    index,
    contentWidth,
    contentHeight,
  })

  it('sorts by span descending and takes the top three ranks', () => {
    const result = rankC3CellExtents(
      [extent(0, 10), extent(1, 30), extent(2, 20), extent(3, 5), extent(4, 40)],
      'contentWidth',
    )

    expect(result.map((e) => e.index)).toEqual([4, 1, 2])
  })

  it('includes every tie within the third rank without a hard cap', () => {
    const result = rankC3CellExtents(
      [extent(0, 10), extent(1, 10), extent(2, 30), extent(3, 20), extent(4, 10), extent(5, 5)],
      'contentWidth',
    )

    expect(result.map((e) => e.index)).toEqual([2, 3, 0, 1, 4])
  })

  it('ranks contentWidth and contentHeight independently', () => {
    const result = rankC3CellExtents(
      [
        { index: 0, contentWidth: 1, contentHeight: 50 },
        { index: 1, contentWidth: 99, contentHeight: 2 },
      ],
      'contentHeight',
    )

    expect(result.map((e) => e.index)).toEqual([0, 1])
  })
})

describe('migrateC3SpacingData', () => {
  it('keeps explicit advances different from the old characterWidth and removes redundant ones', () => {
    const result = migrateC3SpacingData('[[10,"AB"],[16,"C"],[12,"."]]', 16)

    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.spacingData).toBe('[[10,"AB"],[12,"."]]')
    expect(result.keptEntries).toBe(2)
    expect(result.removedEntries).toBe(1)
  })

  it('preserves valid grouping and character strings verbatim', () => {
    const result = migrateC3SpacingData('[[8,"IJ"],[14,".!"],[3,"😀a"]]', 16)

    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.spacingData).toBe('[[8,"IJ"],[14,".!"],[3,"😀a"]]')
    expect(result.keptEntries).toBe(3)
    expect(result.removedEntries).toBe(0)
  })

  it('keeps a space width override when it differs from the old default', () => {
    const result = migrateC3SpacingData('[[8," "]]', 16)

    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.spacingData).toBe('[[8," "]]')
    expect(result.removedEntries).toBe(0)
  })

  it('removes every entry when all equal the old characterWidth', () => {
    const result = migrateC3SpacingData('[[16,"AB"],[16,"CD"]]', 16)

    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.spacingData).toBe('[]')
    expect(result.keptEntries).toBe(0)
    expect(result.removedEntries).toBe(2)
  })

  it('does not subtract the crop from explicit advances', () => {
    const result = migrateC3SpacingData('[[10,"AB"]]', 16)

    expect(result.kind).toBe('migrated')
    if (result.kind !== 'migrated') return
    expect(result.spacingData).toBe('[[10,"AB"]]')
  })

  it('returns invalid-spacing-data for malformed input', () => {
    expect(migrateC3SpacingData('not json', 16)).toEqual({
      kind: 'error',
      code: 'invalid-spacing-data',
    })
    expect(migrateC3SpacingData('[[10, 20]]', 16)).toEqual({
      kind: 'error',
      code: 'invalid-spacing-data',
    })
    expect(migrateC3SpacingData('[[10,"A",5]]', 16)).toEqual({
      kind: 'error',
      code: 'invalid-spacing-data',
    })
  })

  it('returns invalid-grid for a non-positive old characterWidth', () => {
    expect(migrateC3SpacingData('[[10,"A"]]', 0)).toEqual({
      kind: 'error',
      code: 'invalid-grid',
    })
  })
})

describe('alpha round-trip', () => {
  it('alphaRoundTrips returns true for identical alpha channels', () => {
    const source = makeImageData(4, 1)
    const readback = makeImageData(4, 1)
    const alphas = [0, 1, 254, 255]
    for (let i = 0; i < 4; i++) {
      source.data[i * 4 + 3] = alphas[i]
      readback.data[i * 4 + 3] = alphas[i]
    }
    expect(alphaRoundTrips(source, readback)).toBe(true)
  })

  it('alphaRoundTrips ignores RGB and detects an alpha mismatch', () => {
    const source = makeImageData(4, 1)
    const readback = makeImageData(4, 1)
    for (let i = 0; i < 4; i++) {
      source.data[i * 4] = 200
      source.data[i * 4 + 1] = 100
      source.data[i * 4 + 2] = 50
      source.data[i * 4 + 3] = [0, 1, 254, 255][i]
      readback.data[i * 4] = 0
      readback.data[i * 4 + 1] = 0
      readback.data[i * 4 + 2] = 0
      readback.data[i * 4 + 3] = [0, 1, 254, 255][i]
    }
    expect(alphaRoundTrips(source, readback)).toBe(true)

    readback.data[3] = 2
    expect(alphaRoundTrips(source, readback)).toBe(false)
  })

  it('alphaRoundTrips returns false for mismatched dimensions', () => {
    const a = makeImageData(2, 2)
    const b = makeImageData(4, 1)
    expect(alphaRoundTrips(a, b)).toBe(false)
  })

  it('verifyCanvasAlphaRoundTrip fails closed when the canvas context is unreliable', () => {
    // jsdom mock 2d context 没有 putImageData → 必须 fail closed
    expect(verifyCanvasAlphaRoundTrip()).toBe(false)
  })

  it('alphaRoundTrips applies per-pixel alpha tolerance', () => {
    const source = makeImageData(4, 1)
    const readback = makeImageData(4, 1)
    const sent = [0, 1, 254, 255]
    for (let i = 0; i < 4; i++) {
      source.data[i * 4 + 3] = sent[i]
    }
    // Chrome 151+ (macOS) 实测漂移 ±1：容差 2 内放行
    const drifted = [1, 2, 253, 255]
    for (let i = 0; i < 4; i++) {
      readback.data[i * 4 + 3] = drifted[i]
    }
    expect(alphaRoundTrips(source, readback, 2)).toBe(true)
    // 超出容差（255 → 252 偏差 3）仍判定不一致
    readback.data[15] = 252
    expect(alphaRoundTrips(source, readback, 2)).toBe(false)
  })

  it('verifyCanvasAlphaRoundTrip tolerates ±2 drift but fails on corruption', () => {
    const withReadback = (alphas: number[]) => {
      const fakeCtx = {
        putImageData: () => {},
        getImageData: () => {
          const readback = new ImageData(4, 1)
          for (let i = 0; i < 4; i++) {
            readback.data[i * 4 + 3] = alphas[i]
          }
          return readback
        },
      }
      const fakeCanvas = {
        width: 0,
        height: 0,
        getContext: () => fakeCtx,
      }
      return vi
        .spyOn(document, 'createElement')
        .mockReturnValue(fakeCanvas as unknown as HTMLCanvasElement)
    }

    // 探针写入 alpha 0/1/254/255；±1 漂移（GPU 路径实测）放行
    let spy = withReadback([1, 2, 253, 255])
    try {
      expect(verifyCanvasAlphaRoundTrip()).toBe(true)
    } finally {
      spy.mockRestore()
    }

    // 读回被清零（真实腐坏）→ fail closed
    spy = withReadback([0, 0, 0, 0])
    try {
      expect(verifyCanvasAlphaRoundTrip()).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })
})
