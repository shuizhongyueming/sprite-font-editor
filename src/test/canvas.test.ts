import { describe, it, expect } from 'vitest'
import { CanvasSpace, computeAutoFitSpriteSize } from '@/utils/canvas'

describe('CanvasSpace', () => {
  it('should initialize with correct properties', () => {
    const space = new CanvasSpace(
      100,  // canvasWidth
      100,  // canvasHeight
      10,   // cellWidth
      10,   // cellHeight
      { top: 1, right: 1, bottom: 1, left: 1 },  // cellMargin
      { top: 0, right: 0, bottom: 0, left: 0 },  // imageMargin
      { top: 2, right: 2, bottom: 2, left: 2 }   // imagePadding
    )

    expect(space.rows).toBeGreaterThan(0)
    expect(space.columns).toBeGreaterThan(0)
  })

  it('should calculate cell position correctly', () => {
    const space = new CanvasSpace(
      100, 100, 10, 10,
      { top: 0, right: 0, bottom: 0, left: 0 },
      { top: 0, right: 0, bottom: 0, left: 0 },
      { top: 0, right: 0, bottom: 0, left: 0 }
    )

    const pos = space.getCellPosition(1, 1)
    expect(pos.x).toBe(10)
    expect(pos.y).toBe(10)
  })

  it('should convert between index and row/col', () => {
    const space = new CanvasSpace(
      100, 100, 10, 10,
      { top: 0, right: 0, bottom: 0, left: 0 },
      { top: 0, right: 0, bottom: 0, left: 0 },
      { top: 0, right: 0, bottom: 0, left: 0 }
    )

    const rowCol = space.indexToRowCol(15)
    expect(rowCol.row).toBe(1)
    expect(rowCol.col).toBe(5)

    const index = space.rowColToIndex(2, 3)
    expect(index).toBe(23)
  })

  it('should handle margin correctly', () => {
    const space = new CanvasSpace(
      100, 100, 10, 10,
      { top: 5, right: 5, bottom: 5, left: 5 },
      { top: 10, right: 10, bottom: 10, left: 10 },
      { top: 0, right: 0, bottom: 0, left: 0 }
    )

    const pos = space.getCellPosition(0, 0)
    expect(pos.x).toBe(10)
    expect(pos.y).toBe(10)
  })
})

describe('computeAutoFitSpriteSize', () => {
  it('should expand height to fit all cells, keeping width unchanged', () => {
    // 64px 宽 / 16px 格 = 4 列，9 个字符需要 3 行 → 高度 48
    const result = computeAutoFitSpriteSize({
      totalCells: 9,
      cellWidth: 16,
      cellHeight: 16,
      width: 64,
    })

    expect(result).toEqual({ width: 64, height: 48 })
  })

  it('should fit exactly when cells fill complete rows', () => {
    const result = computeAutoFitSpriteSize({
      totalCells: 8,
      cellWidth: 16,
      cellHeight: 16,
      width: 64,
    })

    expect(result).toEqual({ width: 64, height: 32 })
  })

  it('should return null when width fits no column', () => {
    const result = computeAutoFitSpriteSize({
      totalCells: 4,
      cellWidth: 16,
      cellHeight: 16,
      width: 8,
    })

    expect(result).toBeNull()
  })

  it('should return null for invalid inputs', () => {
    expect(
      computeAutoFitSpriteSize({ totalCells: 4, cellWidth: 0, cellHeight: 16, width: 64 }),
    ).toBeNull()
    expect(
      computeAutoFitSpriteSize({ totalCells: 4, cellWidth: 16, cellHeight: 16, width: 0 }),
    ).toBeNull()
  })
})

// 实样回归：重排到 2048×1680、cell 99×105、scale≈0.7 时，显示空间的
// 画布 floor 与单元格 round 独立取整，16 行累积漂移超出一个 cell，
// rows 从 16 掉到 15（底行追加字符失去网格线且点击选不中）
describe('CanvasSpace gridCounts override', () => {
  const zeroBox = { top: 0, right: 0, bottom: 0, left: 0 }
  const scale = 0.7

  function makeDisplaySpace(gridCounts?: { rows: number; columns: number }) {
    return new CanvasSpace(
      Math.floor(2048 * scale),
      Math.floor(1680 * scale),
      Math.round(99 * scale),
      Math.round(105 * scale),
      zeroBox,
      zeroBox,
      zeroBox,
      Math.round(2048 * scale),
      Math.round(1680 * scale),
      gridCounts,
    )
  }

  it('display-space rounding drifts the derived row count', () => {
    const displaySpace = makeDisplaySpace()
    // 漂移证据：基准应为 16 行，显示空间独立取整算出 15 行
    expect(displaySpace.rows).toBe(15)
    expect(displaySpace.columns).toBe(20)
  })

  it('gridCounts override supplies base-space counts to all index math', () => {
    const baseSpace = new CanvasSpace(
      2048, 1680, 99, 105, zeroBox, zeroBox, zeroBox, 2048, 1680,
    )
    expect(baseSpace.rows).toBe(16)
    expect(baseSpace.columns).toBe(20)

    const displaySpace = makeDisplaySpace({
      rows: baseSpace.rows,
      columns: baseSpace.columns,
    })
    expect(displaySpace.rows).toBe(16)
    expect(displaySpace.columns).toBe(20)

    // 第 301 个 cell（index 300）= 底行第 1 格（重排后追加字符落位）
    expect(displaySpace.indexToRowCol(300)).toEqual({ row: 15, col: 0 })

    // positionToCell 的 rows 截断同样走 override：底行点击不再返回 null
    const cellTopLeft = displaySpace.getCellPosition(15, 0)
    expect(displaySpace.positionToCell(cellTopLeft.x + 1, cellTopLeft.y + 1)).toEqual({
      row: 15,
      col: 0,
    })
  })
})
