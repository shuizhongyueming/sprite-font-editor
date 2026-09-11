import { describe, it, expect } from 'vitest'
import {
  computeC3RewrapPlan,
  rewrapC3ImportedCells,
  computeC3RewrapCandidates,
  findMostSquareC3RewrapCandidate,
  C3_MAX_TEXTURE_SIZE,
} from '@/utils/c3-rewrap'
import type { C3RewrapPlan, C3RewrapCandidate } from '@/utils/c3-rewrap'
import type { C3CompactionSource } from '@/utils/c3-compaction'

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

/** Paint an opaque content rect at local (2,2)-(13,13) inside a 16x16 cell at (ox, oy). */
function paintCell(
  img: ImageData,
  ox: number,
  oy: number,
  rgb: readonly [number, number, number] = [255, 0, 0],
): void {
  for (let y = 2; y <= 13; y++) {
    for (let x = 2; x <= 13; x++) {
      setPixel(img, ox + x, oy + y, 255, rgb)
    }
  }
}

/** Paint the four 16x16 cells of a 32x32 sheet with distinct RGB per cell. */
function makeFourCellImage(): ImageData {
  const img = makeImageData(32, 32)
  paintCell(img, 0, 0, [255, 0, 0])
  paintCell(img, 16, 0, [0, 255, 0])
  paintCell(img, 0, 16, [0, 0, 255])
  paintCell(img, 16, 16, [255, 255, 0])
  return img
}

function buildSource(
  overrides?: Partial<C3CompactionSource>,
): C3CompactionSource {
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

function getPlan(
  img: ImageData,
  source: C3CompactionSource,
  targetWidth: number,
): C3RewrapPlan {
  const result = computeC3RewrapPlan(img, source, targetWidth)
  expect(result.kind).toBe('plan')
  if (result.kind !== 'plan') throw new Error('expected plan')
  return result
}

describe('computeC3RewrapPlan', () => {
  it('computes columns, rows and the exact tiling height for a target width', () => {
    const img = makeFourCellImage()

    const plan = getPlan(img, buildSource(), 50)

    expect(plan).toEqual({
      kind: 'plan',
      targetWidth: 50,
      newColumns: 3,
      newRows: 2,
      newImageHeight: 32,
      importedCount: 4,
      oldColumns: 2,
      oldFontSpriteWidth: 32,
      oldFinalTextureHeight: 32,
    })
  })

  it('counts appended characters in rows and in the old/new final texture heights', () => {
    const img = makeFourCellImage()
    const source = buildSource({ appendedCharacterCount: 5 })

    const plan = getPlan(img, source, 16)

    // 总字符 4+5=9：1 列 → 9 行；旧 2 列 → ceil(9/2)=5 行
    expect(plan.newColumns).toBe(1)
    expect(plan.newRows).toBe(9)
    expect(plan.newImageHeight).toBe(144)
    expect(plan.oldFinalTextureHeight).toBe(80)
  })

  it('allows a target width equal to characterWidth (single column)', () => {
    const img = makeFourCellImage()

    const plan = getPlan(img, buildSource(), 16)

    expect(plan.newColumns).toBe(1)
    expect(plan.newRows).toBe(4)
    expect(plan.newImageHeight).toBe(64)
  })

  it('allows a reverse re-wrap to a sheet wider than the current font sprite', () => {
    const img = makeFourCellImage()

    const plan = getPlan(img, buildSource(), 64)

    expect(plan.newColumns).toBe(4)
    expect(plan.newRows).toBe(1)
    expect(plan.newImageHeight).toBe(16)
  })

  it('allows single-character and single-row sheets', () => {
    const img = makeImageData(16, 16)
    paintCell(img, 0, 0)
    const source = buildSource({
      fontSpriteWidth: 16,
      fontSpriteHeight: 16,
      importedCharacterSet: ['A'],
    })

    const plan = getPlan(img, source, 32)

    expect(plan.oldColumns).toBe(1)
    expect(plan.newColumns).toBe(2)
    expect(plan.newRows).toBe(1)
    expect(plan.newImageHeight).toBe(16)
  })

  it('allows extreme aspect ratios up to the texture size cap', () => {
    const img = makeFourCellImage()

    const plan = getPlan(img, buildSource(), C3_MAX_TEXTURE_SIZE)

    expect(plan.newColumns).toBe(1024)
    expect(plan.newRows).toBe(1)
    expect(plan.newImageHeight).toBe(16)
  })

  it('rejects a target width below characterWidth', () => {
    const img = makeFourCellImage()

    const result = computeC3RewrapPlan(img, buildSource(), 15)

    expect(result).toEqual({
      kind: 'error',
      code: 'invalid-output-dimensions',
    })
  })

  it('rejects non-positive and non-integer target widths', () => {
    const img = makeFourCellImage()

    for (const width of [0, -16, 16.5, Number.NaN]) {
      expect(computeC3RewrapPlan(img, buildSource(), width)).toEqual({
        kind: 'error',
        code: 'invalid-output-dimensions',
      })
    }
  })

  it('rejects a target width above the texture size cap', () => {
    const img = makeFourCellImage()

    expect(
      computeC3RewrapPlan(img, buildSource(), C3_MAX_TEXTURE_SIZE + 1),
    ).toEqual({ kind: 'error', code: 'invalid-output-dimensions' })
  })

  it('rejects when the resulting tiling height exceeds the texture size cap', () => {
    // 2000 个导入字符按旧 2 列密铺为 32×16000；重排到 1 列 → 32000 高 > 上限
    const importedCharacterSet = Array.from({ length: 2000 }, () => 'A')
    const img = makeImageData(32, 16000)
    const source = buildSource({
      fontSpriteHeight: 16000,
      importedCharacterSet,
    })

    const result = computeC3RewrapPlan(img, source, 16)

    expect(result).toEqual({
      kind: 'error',
      code: 'invalid-output-dimensions',
    })
  })

  it('returns no-layout-change when the new column count matches the current grid', () => {
    const img = makeFourCellImage()

    expect(computeC3RewrapPlan(img, buildSource(), 32)).toEqual({
      kind: 'no-layout-change',
      oldColumns: 2,
      targetWidth: 32,
    })
    // 同一列桶内的其它宽度（floor(47/16)=2）同样命中
    expect(computeC3RewrapPlan(img, buildSource(), 47).kind).toBe(
      'no-layout-change',
    )
  })

  it('blocks content with alpha >= 16 outside the imported cell union', () => {
    const img = makeImageData(48, 32)
    paintCell(img, 0, 0)
    paintCell(img, 16, 0)
    paintCell(img, 0, 16)
    paintCell(img, 16, 16)
    setPixel(img, 33, 0, 255)

    const result = computeC3RewrapPlan(
      img,
      buildSource({ fontSpriteWidth: 32 }),
      50,
    )

    expect(result).toEqual({
      kind: 'error',
      code: 'content-outside-imported-cells',
    })
  })

  it('allows sub-threshold alpha dust and RGB noise outside the imported cells', () => {
    const img = makeImageData(48, 32)
    paintCell(img, 0, 0)
    paintCell(img, 16, 0)
    paintCell(img, 0, 16)
    paintCell(img, 16, 16)
    // alpha 15 碎像素 + 全透明 RGB 噪点都在覆盖表之外，不得阻断
    setPixel(img, 33, 0, 15)
    for (let x = 32; x < 48; x++) {
      img.data[(0 * 48 + x) * 4] = 255
      img.data[(0 * 48 + x) * 4 + 1] = 255
      img.data[(0 * 48 + x) * 4 + 2] = 255
    }

    const result = computeC3RewrapPlan(
      img,
      buildSource({ fontSpriteWidth: 32 }),
      50,
    )

    expect(result.kind).toBe('plan')
  })

  it('places the old grid at the imageMargin + imagePadding origin', () => {
    // origin (6,6)：image 侧可用 36、fontSprite 侧可用 60 → 2×2 网格
    const img = makeImageData(48, 48)
    const source = buildSource({
      fontSpriteWidth: 64,
      fontSpriteHeight: 64,
      imageMargin: { top: 4, right: 4, bottom: 4, left: 4 },
      imagePadding: { top: 2, right: 2, bottom: 2, left: 2 },
    })
    paintCell(img, 6, 6)
    paintCell(img, 22, 6)
    paintCell(img, 6, 22)
    paintCell(img, 22, 22)
    // 覆盖表外的杂点（左上角 margin/padding 区）必须阻断
    setPixel(img, 1, 1, 255)

    const blocked = computeC3RewrapPlan(img, source, 50)
    expect(blocked).toEqual({
      kind: 'error',
      code: 'content-outside-imported-cells',
    })

    setPixel(img, 1, 1, 0)
    const plan = getPlan(img, source, 50)
    expect(plan.oldColumns).toBe(2)
  })

  it('returns invalid-grid when imported characters exceed the old grid capacity', () => {
    const img = makeImageData(32, 16)

    const result = computeC3RewrapPlan(img, buildSource(), 50)

    expect(result).toEqual({ kind: 'error', code: 'invalid-grid' })
  })

  it('returns no-imported-content for an empty imported character set', () => {
    const img = makeImageData(32, 32)

    const result = computeC3RewrapPlan(
      img,
      buildSource({ importedCharacterSet: [] }),
      50,
    )

    expect(result).toEqual({ kind: 'error', code: 'no-imported-content' })
  })

  it('returns invalid-grid for an invalid source configuration', () => {
    const img = makeFourCellImage()

    expect(
      computeC3RewrapPlan(
        img,
        buildSource({ imageMargin: { top: -1, right: 0, bottom: 0, left: 0 } }),
        50,
      ),
    ).toEqual({ kind: 'error', code: 'invalid-grid' })
    expect(
      computeC3RewrapPlan(
        img,
        buildSource({ appendedCharacterCount: 1.5 }),
        50,
      ),
    ).toEqual({ kind: 'error', code: 'invalid-grid' })
  })

  it('fails closed on unreliable pixel data', () => {
    const bad = makeImageData(4, 4)
    Object.defineProperty(bad, 'data', { value: new Uint8ClampedArray(16) })

    const result = computeC3RewrapPlan(bad, buildSource(), 50)

    expect(result).toEqual({ kind: 'error', code: 'unreliable-canvas' })
  })
})

describe('rewrapC3ImportedCells', () => {
  it('repacks imported cells row-major into the new column count at the exact target width', () => {
    const img = makeFourCellImage()
    const source = buildSource()
    const plan = getPlan(img, source, 50)

    const result = rewrapC3ImportedCells(img, plan, source)

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    const out = result.image
    expect(out.width).toBe(50)
    expect(out.height).toBe(32)

    // row-major 3 列：char0 → (0,0)，char1 → (1,0)，char2 → (2,0)，char3 → (0,1)
    expect(out.data[(2 * out.width + 2) * 4]).toBe(255) // char0 red
    expect(out.data[(2 * out.width + 2) * 4 + 1]).toBe(0)
    expect(out.data[(2 * out.width + 18) * 4 + 1]).toBe(255) // char1 green
    expect(out.data[(2 * out.width + 34) * 4 + 2]).toBe(255) // char2 blue
    expect(out.data[(18 * out.width + 2) * 4]).toBe(255) // char3 yellow
    expect(out.data[(18 * out.width + 2) * 4 + 1]).toBe(255)
    // char3 不得落到第 2 列（保持顺序，不重排）
    expect(out.data[(18 * out.width + 34) * 4 + 3]).toBe(0)

    // 右侧余量（3×16=48 到目标宽度 50）整列透明
    for (let y = 0; y < out.height; y++) {
      for (let x = 48; x < 50; x++) {
        expect(out.data[(y * out.width + x) * 4 + 3]).toBe(0)
      }
    }
    // cell 内部留白不污染相邻 cell
    expect(out.data[(2 * out.width + 14) * 4 + 3]).toBe(0)
    expect(out.data[(2 * out.width + 15) * 4 + 3]).toBe(0)
    expect(out.data[(2 * out.width + 30) * 4 + 3]).toBe(0)
    expect(out.data[(2 * out.width + 31) * 4 + 3]).toBe(0)
  })

  it('copies RGBA verbatim without scaling, including low-alpha pixels', () => {
    const img = makeFourCellImage()
    setPixel(img, 5, 5, 128, [10, 20, 30])
    setPixel(img, 8, 8, 15, [1, 2, 3])
    const source = buildSource()
    const plan = getPlan(img, source, 50)

    const result = rewrapC3ImportedCells(img, plan, source)

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    const out = result.image
    // char0 仍在 cell (0,0)：局部坐标不变，四通道原样
    expect(out.data[(5 * out.width + 5) * 4]).toBe(10)
    expect(out.data[(5 * out.width + 5) * 4 + 1]).toBe(20)
    expect(out.data[(5 * out.width + 5) * 4 + 2]).toBe(30)
    expect(out.data[(5 * out.width + 5) * 4 + 3]).toBe(128)
    expect(out.data[(8 * out.width + 8) * 4]).toBe(1)
    expect(out.data[(8 * out.width + 8) * 4 + 3]).toBe(15)

    const countNonTransparent = (im: ImageData): number => {
      let n = 0
      for (let i = 3; i < im.data.length; i += 4) {
        if (im.data[i] !== 0) n++
      }
      return n
    }
    // 4 个 cell × 12×12 内容 + 2 个单独像素，逐像素数量不变（不缩放）
    expect(countNonTransparent(out)).toBe(countNonTransparent(img))
  })

  it('keeps fully transparent imported cells at their index with transparent output', () => {
    const img = makeImageData(32, 32)
    paintCell(img, 0, 0)
    paintCell(img, 0, 16)
    const source = buildSource()
    const plan = getPlan(img, source, 16)
    expect(plan.newColumns).toBe(1)
    expect(plan.newRows).toBe(4)

    const result = rewrapC3ImportedCells(img, plan, source)

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    const out = result.image
    expect(out.width).toBe(16)
    expect(out.height).toBe(64)
    // char0 内容在 (2,2)；char1 整格透明；char2 内容在 (2,34)；char3 整格透明
    expect(out.data[(2 * out.width + 2) * 4 + 3]).toBe(255)
    expect(out.data[(34 * out.width + 2) * 4 + 3]).toBe(255)
    for (let y = 16; y < 32; y++) {
      for (let x = 0; x < 16; x++) {
        expect(out.data[(y * out.width + x) * 4 + 3]).toBe(0)
      }
    }
    for (let y = 48; y < 64; y++) {
      for (let x = 0; x < 16; x++) {
        expect(out.data[(y * out.width + x) * 4 + 3]).toBe(0)
      }
    }
  })

  it('supports a custom taller output height with transparent trailing rows', () => {
    const img = makeFourCellImage()
    const source = buildSource()
    const plan = getPlan(img, source, 50)

    const result = rewrapC3ImportedCells(img, plan, source, {
      outputHeight: 64,
    })

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    const out = result.image
    expect(out.width).toBe(50)
    expect(out.height).toBe(64)
    expect(out.data[(2 * out.width + 2) * 4 + 3]).toBe(255)
    // 加高部分（密铺 32 行之外）保持透明
    for (let y = 32; y < 64; y++) {
      for (let x = 0; x < 50; x++) {
        expect(out.data[(y * out.width + x) * 4 + 3]).toBe(0)
      }
    }
  })

  it('accepts a custom height exactly at the tiling height or the texture size cap', () => {
    const img = makeFourCellImage()
    const source = buildSource()
    const plan = getPlan(img, source, 50)

    const exact = rewrapC3ImportedCells(img, plan, source, {
      outputHeight: plan.newImageHeight,
    })
    expect(exact.kind).toBe('ok')

    const atCap = rewrapC3ImportedCells(img, plan, source, {
      outputHeight: C3_MAX_TEXTURE_SIZE,
    })
    expect(atCap.kind).toBe('ok')
    if (atCap.kind === 'ok') {
      expect(atCap.image.height).toBe(C3_MAX_TEXTURE_SIZE)
    }
  })

  it('rejects a custom output height below the tiling height or non-integer', () => {
    const img = makeFourCellImage()
    const source = buildSource()
    const plan = getPlan(img, source, 50)

    for (const outputHeight of [0, 31, 31.5, Number.NaN]) {
      expect(
        rewrapC3ImportedCells(img, plan, source, { outputHeight }),
      ).toEqual({ kind: 'error', code: 'invalid-output-dimensions' })
    }
  })

  it('rejects a custom output height above the texture size cap', () => {
    const img = makeFourCellImage()
    const source = buildSource()
    const plan = getPlan(img, source, 50)

    expect(
      rewrapC3ImportedCells(img, plan, source, {
        outputHeight: C3_MAX_TEXTURE_SIZE + 1,
      }),
    ).toEqual({ kind: 'error', code: 'invalid-output-dimensions' })
  })

  it('allows output dimensions exactly at the texture size cap', () => {
    const img = makeFourCellImage()
    const source = buildSource()
    const plan = getPlan(img, source, C3_MAX_TEXTURE_SIZE)

    const result = rewrapC3ImportedCells(img, plan, source)

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.image.width).toBe(C3_MAX_TEXTURE_SIZE)
    expect(result.image.height).toBe(16)
    // 极端宽高比下内容仍在第一个 cell
    expect(result.image.data[(2 * result.image.width + 2) * 4 + 3]).toBe(255)
  })

  it('fails closed when the plan disagrees with the source', () => {
    const img = makeFourCellImage()
    const source = buildSource()
    const plan = getPlan(img, source, 50)

    // importedCount 与导入字符集不一致
    expect(
      rewrapC3ImportedCells(img, { ...plan, importedCount: 5 }, source),
    ).toEqual({ kind: 'error', code: 'invalid-output-dimensions' })
    // 新列数与 floor(targetWidth / characterWidth) 不一致
    expect(
      rewrapC3ImportedCells(img, { ...plan, newColumns: 2 }, source),
    ).toEqual({ kind: 'error', code: 'invalid-output-dimensions' })
    // 密铺高度与 行数 × characterHeight 不一致
    expect(
      rewrapC3ImportedCells(img, { ...plan, newImageHeight: 16 }, source),
    ).toEqual({ kind: 'error', code: 'invalid-output-dimensions' })
    // 目标宽度越过尺寸上限
    expect(
      rewrapC3ImportedCells(
        img,
        { ...plan, targetWidth: C3_MAX_TEXTURE_SIZE + 32, newColumns: 1025 },
        source,
      ),
    ).toEqual({ kind: 'error', code: 'invalid-output-dimensions' })
    // plan 记录的旧列数与当前 source/image 推导出的旧网格不一致
    expect(
      rewrapC3ImportedCells(img, { ...plan, oldColumns: 3 }, source),
    ).toEqual({ kind: 'error', code: 'invalid-grid' })
  })

  it('fails closed on a zero imported count in the plan', () => {
    const img = makeFourCellImage()
    const source = buildSource()
    const plan = getPlan(img, source, 50)

    expect(
      rewrapC3ImportedCells(img, { ...plan, importedCount: 0 }, source),
    ).toEqual({ kind: 'error', code: 'invalid-output-dimensions' })
  })

  it('fails closed on unreliable pixel data or an invalid source', () => {
    const img = makeFourCellImage()
    const source = buildSource()
    const plan = getPlan(img, source, 50)

    const bad = makeImageData(4, 4)
    Object.defineProperty(bad, 'data', { value: new Uint8ClampedArray(16) })
    expect(rewrapC3ImportedCells(bad, plan, source)).toEqual({
      kind: 'error',
      code: 'unreliable-canvas',
    })

    expect(
      rewrapC3ImportedCells(
        img,
        plan,
        buildSource({ imagePadding: { top: -1, right: 0, bottom: 0, left: 0 } }),
      ),
    ).toEqual({ kind: 'error', code: 'invalid-grid' })
  })

  it('respects the imageMargin + imagePadding origin when copying pixels', () => {
    const img = makeImageData(48, 48)
    const source = buildSource({
      fontSpriteWidth: 64,
      fontSpriteHeight: 64,
      imageMargin: { top: 4, right: 4, bottom: 4, left: 4 },
      imagePadding: { top: 2, right: 2, bottom: 2, left: 2 },
    })
    paintCell(img, 6, 6, [255, 0, 0])
    paintCell(img, 22, 6, [0, 255, 0])
    paintCell(img, 6, 22, [0, 0, 255])
    paintCell(img, 22, 22, [255, 255, 0])
    const plan = getPlan(img, source, 50)

    const result = rewrapC3ImportedCells(img, plan, source)

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    const out = result.image
    // char1 从旧 (22,6) 搬到新 cell (1,0)
    expect(out.data[(2 * out.width + 18) * 4 + 1]).toBe(255)
    // char3 从旧 (22,22) 搬到新 cell (0,1)
    expect(out.data[(18 * out.width + 2) * 4]).toBe(255)
  })
})

describe('computeC3RewrapCandidates', () => {
  it('computes columns, rows and tiling height per width, preserving order', () => {
    const candidates = computeC3RewrapCandidates([512, 1024, 48], {
      characterWidth: 16,
      characterHeight: 16,
      totalCharacterCount: 100,
    })

    expect(candidates).toEqual([
      { targetWidth: 512, columns: 32, rows: 4, imageHeight: 64 },
      { targetWidth: 1024, columns: 64, rows: 2, imageHeight: 32 },
      { targetWidth: 48, columns: 3, rows: 34, imageHeight: 544 },
    ])
  })

  it('skips widths that cannot form a column', () => {
    const candidates = computeC3RewrapCandidates(
      [8, 15.5, 0, -32, Number.NaN],
      {
        characterWidth: 16,
        characterHeight: 16,
        totalCharacterCount: 4,
      },
    )

    expect(candidates).toEqual([])
  })

  it('returns an empty list for zero characters or invalid geometry', () => {
    expect(
      computeC3RewrapCandidates([512], {
        characterWidth: 16,
        characterHeight: 16,
        totalCharacterCount: 0,
      }),
    ).toEqual([])
    expect(
      computeC3RewrapCandidates([512], {
        characterWidth: 0,
        characterHeight: 16,
        totalCharacterCount: 4,
      }),
    ).toEqual([])
  })

  it('skips candidates whose tiling height exceeds the texture size cap', () => {
    const candidates = computeC3RewrapCandidates([16, 2048], {
      characterWidth: 16,
      characterHeight: 16,
      totalCharacterCount: 2000,
    })

    // 16 宽 → 1 列 → 2000 行 = 32000 高，越过上限被跳过
    expect(candidates).toEqual([
      { targetWidth: 2048, columns: 128, rows: 16, imageHeight: 256 },
    ])
  })

  it('skips widths above the texture size cap but keeps the boundary', () => {
    const candidates = computeC3RewrapCandidates(
      [C3_MAX_TEXTURE_SIZE, C3_MAX_TEXTURE_SIZE + 1],
      {
        characterWidth: 16,
        characterHeight: 16,
        totalCharacterCount: 4,
      },
    )

    expect(candidates).toEqual([
      {
        targetWidth: C3_MAX_TEXTURE_SIZE,
        columns: 1024,
        rows: 1,
        imageHeight: 16,
      },
    ])
  })

  it('includes a width equal to characterWidth as a single-column candidate', () => {
    const candidates = computeC3RewrapCandidates([16], {
      characterWidth: 16,
      characterHeight: 16,
      totalCharacterCount: 4,
    })

    expect(candidates).toEqual([
      { targetWidth: 16, columns: 1, rows: 4, imageHeight: 64 },
    ])
  })
})

describe('findMostSquareC3RewrapCandidate', () => {
  it('picks the candidate with the smallest |log2(W/H)|', () => {
    const candidates = computeC3RewrapCandidates([256, 512, 128], {
      characterWidth: 16,
      characterHeight: 16,
      totalCharacterCount: 64,
    })

    // 256×64 → |log2(4)|=2；512×32 → |log2(16)|=4；128×128 → |log2(1)|=0
    expect(findMostSquareC3RewrapCandidate(candidates)?.targetWidth).toBe(128)
  })

  it('breaks ties by the smaller total area', () => {
    const wide: C3RewrapCandidate = {
      targetWidth: 256,
      columns: 16,
      rows: 16,
      imageHeight: 256,
    }
    const small: C3RewrapCandidate = {
      targetWidth: 128,
      columns: 8,
      rows: 8,
      imageHeight: 128,
    }

    // 两者 W/H 均为 1，面积 65536 vs 16384 → 取小者
    expect(
      findMostSquareC3RewrapCandidate([wide, small])?.targetWidth,
    ).toBe(128)
    expect(
      findMostSquareC3RewrapCandidate([small, wide])?.targetWidth,
    ).toBe(128)
  })

  it('keeps the first candidate on an exact tie', () => {
    const candidate: C3RewrapCandidate = {
      targetWidth: 128,
      columns: 8,
      rows: 8,
      imageHeight: 128,
    }

    expect(findMostSquareC3RewrapCandidate([candidate, { ...candidate }])).toBe(
      candidate,
    )
  })

  it('returns null for an empty candidate list', () => {
    expect(findMostSquareC3RewrapCandidate([])).toBeNull()
  })
})
