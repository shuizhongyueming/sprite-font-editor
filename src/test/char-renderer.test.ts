import { describe, it, expect } from 'vitest'
import { calculateCharRenderSize, calculateAlignment } from '@/utils/char-renderer'

describe('char-renderer', () => {
  describe('calculateCharRenderSize', () => {
    it('should calculate size with containment', () => {
      const result = calculateCharRenderSize(
        20, // textWidth
        16, // textHeight
        28, // availableWidth
        28  // availableHeight
      )

      expect(result.width).toBe(20)
      expect(result.height).toBe(16)
      expect(result.scale).toBe(1)
    })

    it('should calculate size without margin', () => {
      const result = calculateCharRenderSize(
        20,
        16,
        32,
        32
      )

      expect(result.width).toBe(20)
      expect(result.height).toBe(16)
      expect(result.scale).toBe(1)
    })

    it('should handle large text', () => {
      const result = calculateCharRenderSize(
        100, // 文本宽度大于单元格
        80,
        32,
        32
      )

      expect(result.width).toBe(32)
      expect(result.height).toBe(25.6)
      expect(result.scale).toBe(0.32)
    })
  })

  describe('calculateAlignment', () => {
    it('should center align correctly', () => {
      const result = calculateAlignment(
        20, // renderWidth
        16, // renderHeight
        32, // availableWidth
        32, // availableHeight
        'center',
        'middle'
      )

      expect(result.x).toBe(6)
      expect(result.y).toBe(8)
    })

    it('should left-top align correctly', () => {
      const result = calculateAlignment(
        20,
        16,
        32,
        32,
        'left',
        'top'
      )

      expect(result.x).toBe(0)
      expect(result.y).toBe(0)
    })

    it('should right-bottom align correctly', () => {
      const result = calculateAlignment(
        20,
        16,
        32,
        32,
        'right',
        'bottom'
      )

      expect(result.x).toBe(12)
      expect(result.y).toBe(16)
    })
  })
})
