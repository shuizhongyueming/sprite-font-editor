import { describe, it, expect } from 'vitest'
import { CanvasSpace } from '@/utils/canvas'

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
