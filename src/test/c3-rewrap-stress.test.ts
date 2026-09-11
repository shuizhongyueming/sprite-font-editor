import { describe, it, expect } from 'vitest'
import {
  computeC3RewrapPlan,
  rewrapC3ImportedCells,
  C3_MAX_TEXTURE_SIZE,
  type C3RewrapPlan,
} from '@/utils/c3-rewrap'
import type { C3CompactionSource } from '@/utils/c3-compaction'
import {
  makeFixtureSource,
  makeSpriteSheetImageData,
  cellAnchorPixel,
} from './helpers/c3-fixtures'

/**
 * C3 重排压力基线（issue #20，参考机记录不设 CI 硬阈值）。
 *
 * 主矩阵：4096 宽 sheet（1024 导入 cell + 512 追加字符，cell 64×64），
 * 重排到 512 / 1024 / 2048 / 自定义 1600。
 * 硬门槛（断言）：各档 prepare/repack 不失败、输出宽度精确等于目标宽度、
 * 高度精确等于 ⌈总字符数 ÷ 列数⌉ × cellHeight 密铺、抽样像素位置正确。
 *
 * 分段耗时：plan / repack 为纯函数可实测；imageToImageData 与 encode/decode
 * 依赖真实 canvas 2D（jsdom 无真实 canvas，setup.ts 的 getContext 桩不处理
 * 真实像素、getImageData 固定返回 100×100），耗时不具备测量意义，记为 n/a
 * 并由发布前人工走查在真实浏览器补录。
 */

interface TierResult {
  targetWidth: number
  columns: number
  rows: number
  height: number
  planMs: number
  repackMs: number
}

const IMPORTED = 1024
const APPENDED = 512
const TOTAL = IMPORTED + APPENDED

/** 主矩阵 cell（合理值）：4096 整除 64，各档高度均 ≤ C3_MAX_TEXTURE_SIZE */
const CELL = 64
const OLD_COLUMNS = Math.floor(4096 / CELL) // 64
const OLD_ROWS = Math.ceil(IMPORTED / OLD_COLUMNS) // 16
const SHEET_HEIGHT = OLD_ROWS * CELL // 1024

const TARGET_WIDTHS = [512, 1024, 2048, 1600]

function buildSource(): C3CompactionSource {
  return makeFixtureSource({
    fontSpriteWidth: 4096,
    fontSpriteHeight: SHEET_HEIGHT,
    characterWidth: CELL,
    characterHeight: CELL,
    importedCharacterSet: Array.from(
      { length: IMPORTED },
      (_, i) => String.fromCharCode(33 + (i % 90)),
    ),
    appendedCharacterCount: APPENDED,
  })
}

/** 抽样像素硬门槛：char i 的锚点像素原样落在新布局的 (i % cols, ⌊i/cols⌋) */
function expectSampledPixels(
  source: ImageData,
  repacked: ImageData,
  plan: C3RewrapPlan,
) {
  // 首/次 cell、首行末/次行首（行跨界）、中间行首（row-major 跨界）、末 cell
  const middleRowStart = OLD_COLUMNS * (OLD_ROWS / 2) // 512 = 第 8 行首
  for (const i of [0, 1, OLD_COLUMNS - 1, OLD_COLUMNS, middleRowStart, IMPORTED - 1]) {
    const newCol = i % plan.newColumns
    const newRow = Math.floor(i / plan.newColumns)
    const oldCol = i % OLD_COLUMNS
    const oldRow = Math.floor(i / OLD_COLUMNS)
    expect(
      cellAnchorPixel(repacked, newCol * CELL, newRow * CELL),
    ).toEqual(cellAnchorPixel(source, oldCol * CELL, oldRow * CELL))
  }
}

describe('C3 rewrap stress baseline', () => {
  it('rewraps a 4096-wide sheet (1024 imported + 512 appended) to each tier', () => {
    const source = buildSource()
    const sheet = makeSpriteSheetImageData(OLD_COLUMNS, OLD_ROWS, CELL, CELL, IMPORTED)
    const results: TierResult[] = []

    for (const targetWidth of TARGET_WIDTHS) {
      const planStart = performance.now()
      const planResult = computeC3RewrapPlan(sheet, source, targetWidth)
      const planEnd = performance.now()
      expect(planResult.kind).toBe('plan')
      if (planResult.kind !== 'plan') return
      expect(planResult.importedCount).toBe(IMPORTED)
      expect(planResult.newColumns).toBe(Math.floor(targetWidth / CELL))
      expect(planResult.newRows).toBe(Math.ceil(TOTAL / planResult.newColumns))
      expect(planResult.newImageHeight).toBe(planResult.newRows * CELL)
      expect(planResult.newImageHeight).toBeLessThanOrEqual(C3_MAX_TEXTURE_SIZE)

      const repackStart = performance.now()
      const repack = rewrapC3ImportedCells(sheet, planResult, source)
      const repackEnd = performance.now()
      expect(repack.kind).toBe('ok')
      if (repack.kind !== 'ok') return

      // 硬门槛：输出宽度精确等于目标宽度，高度精确等于密铺高度
      expect(repack.image.width).toBe(targetWidth)
      expect(repack.image.height).toBe(planResult.newImageHeight)
      expectSampledPixels(sheet, repack.image, planResult)

      results.push({
        targetWidth,
        columns: planResult.newColumns,
        rows: planResult.newRows,
        height: repack.image.height,
        planMs: planEnd - planStart,
        repackMs: repackEnd - repackStart,
      })
    }

    console.log(
      '[StressBaseline] 4096×%d sheet, %d imported + %d appended, cell %d×%d (jsdom 参考机)',
      SHEET_HEIGHT,
      IMPORTED,
      APPENDED,
      CELL,
      CELL,
    )
    console.table(
      results.map((r) => ({
        target: r.targetWidth,
        'cols×rows': `${r.columns}×${r.rows}`,
        height: r.height,
        'plan ms': Number(r.planMs.toFixed(1)),
        'repack ms': Number(r.repackMs.toFixed(1)),
        'imageToImageData ms': 'n/a (无真实 canvas)',
        'encode-decode ms': 'n/a (无真实 canvas)',
      })),
    )
  })

  it('records the real-sample cell (99×105): 512 tier fails closed on the texture cap', () => {
    // 实样 cell 99×105：512 档密铺高度 308×105 = 32340 > 16384，
    // fail-closed 阻断（设计内行为，非性能问题）
    const cellW = 99
    const cellH = 105
    const columns = Math.floor(4096 / cellW) // 41
    const rows = Math.ceil(IMPORTED / columns) // 25
    const source = makeFixtureSource({
      fontSpriteWidth: 4096,
      fontSpriteHeight: rows * cellH,
      characterWidth: cellW,
      characterHeight: cellH,
      importedCharacterSet: Array.from(
        { length: IMPORTED },
        (_, i) => String.fromCharCode(33 + (i % 90)),
      ),
      appendedCharacterCount: APPENDED,
    })
    const sheet = makeSpriteSheetImageData(columns, rows, cellW, cellH, IMPORTED, 4096)

    const blocked = computeC3RewrapPlan(sheet, source, 512)
    expect(blocked).toEqual({ kind: 'error', code: 'invalid-output-dimensions' })

    // 1200 档（12 列 × 128 行 = 13440 ≤ 16384）可应用，顺带记录分段耗时
    const planStart = performance.now()
    const planResult = computeC3RewrapPlan(sheet, source, 1200)
    const planEnd = performance.now()
    expect(planResult.kind).toBe('plan')
    if (planResult.kind !== 'plan') return

    const repackStart = performance.now()
    const repack = rewrapC3ImportedCells(sheet, planResult, source)
    const repackEnd = performance.now()
    expect(repack.kind).toBe('ok')
    if (repack.kind !== 'ok') return
    expect(repack.image.width).toBe(1200)
    expect(repack.image.height).toBe(13440)
    for (const i of [0, columns, IMPORTED - 1]) {
      const newCol = i % planResult.newColumns
      const newRow = Math.floor(i / planResult.newColumns)
      expect(cellAnchorPixel(repack.image, newCol * cellW, newRow * cellH)).toEqual(
        cellAnchorPixel(sheet, (i % columns) * cellW, Math.floor(i / columns) * cellH),
      )
    }

    console.log(
      '[StressBaseline] 实样 cell 99×105：512 档被 16384 纹理上限 fail-closed 阻断；1200 档通过',
    )
    console.table([
      {
        target: 1200,
        'cols×rows': `${planResult.newColumns}×${planResult.newRows}`,
        height: repack.image.height,
        'plan ms': Number((planEnd - planStart).toFixed(1)),
        'repack ms': Number((repackEnd - repackStart).toFixed(1)),
        'imageToImageData ms': 'n/a (无真实 canvas)',
        'encode-decode ms': 'n/a (无真实 canvas)',
      },
    ])
  })
})
