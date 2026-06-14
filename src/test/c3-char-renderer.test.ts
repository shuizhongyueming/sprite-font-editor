import { describe, it, expect, vi } from 'vitest'
import {
  measureGlyphBounds,
  measureGlyphDisplayWidth,
  renderC3AppendedCharacter,
} from '@/utils/c3-char-renderer'

function mockCanvasAlphaRectangle(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
) {
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  const imageWidth = 32
  const imageHeight = 32
  const data = new Uint8ClampedArray(imageWidth * imageHeight * 4)

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      data[(y * imageWidth + x) * 4 + 3] = 255
    }
  }

  HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
    if (contextType !== '2d') return null
    return {
      ...originalGetContext.call(document.createElement('canvas'), '2d')!,
      clearRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      getImageData: vi.fn(() => ({
        data,
        width: imageWidth,
        height: imageHeight,
      })),
    } as unknown as CanvasRenderingContext2D
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext

  return () => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
  }
}

describe('c3-char-renderer', () => {
  describe('measureGlyphBounds', () => {
    it('should return zero bounds when no visible pixels are found', () => {
      const bounds = measureGlyphBounds({
        text: 'A',
        fontFamily: 'Arial',
        fontSize: 16,
        characterWidth: 32,
        characterHeight: 32,
        padding: { top: 0, right: 0, bottom: 0, left: 4 },
      })

      expect(bounds).toEqual({ width: 0, height: 0 })
    })

    it('should detect visible glyph bounds from alpha data', () => {
      const restore = mockCanvasAlphaRectangle(5, 7, 10, 14)

      const bounds = measureGlyphBounds({
        text: 'A',
        fontFamily: 'Arial',
        fontSize: 16,
        characterWidth: 32,
        characterHeight: 32,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      })

      expect(bounds.width).toBe(3)
      expect(bounds.height).toBe(5)

      restore()
    })

    it('should use character dimensions when canvas context is unavailable', () => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = vi.fn(() => null)

      const bounds = measureGlyphBounds({
        text: 'A',
        fontFamily: 'Arial',
        fontSize: 16,
        characterWidth: 32,
        characterHeight: 48,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      })

      expect(bounds).toEqual({ width: 32, height: 48 })

      HTMLCanvasElement.prototype.getContext = originalGetContext
    })
  })

  describe('measureGlyphDisplayWidth', () => {
    it('should return left padding when no visible pixels are found', () => {
      const width = measureGlyphDisplayWidth({
        text: 'A',
        fontFamily: 'Arial',
        fontSize: 16,
        characterWidth: 32,
        characterHeight: 32,
        padding: { top: 0, right: 0, bottom: 0, left: 4 },
      })

      // The mocked getImageData returns a transparent image, so no visible
      // glyph width is detected and only the left padding is returned.
      expect(width).toBe(4)
    })

    it('should detect visible glyph width from alpha data', () => {
      const restore = mockCanvasAlphaRectangle(10, 15, 0, 31)

      const width = measureGlyphDisplayWidth({
        text: 'A',
        fontFamily: 'Arial',
        fontSize: 16,
        characterWidth: 32,
        characterHeight: 32,
        padding: { top: 0, right: 0, bottom: 0, left: 5 },
      })

      expect(width).toBe(5 + 15 - 10 + 1)

      restore()
    })

    it('should use character width when canvas context is unavailable', () => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = vi.fn(() => null)

      const width = measureGlyphDisplayWidth({
        text: 'A',
        fontFamily: 'Arial',
        fontSize: 16,
        characterWidth: 32,
        characterHeight: 32,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      })

      expect(width).toBe(32)

      HTMLCanvasElement.prototype.getContext = originalGetContext
    })
  })

  describe('renderC3AppendedCharacter', () => {
    it('should draw the character to the target context', () => {
      const canvas = document.createElement('canvas')
      const targetCtx = canvas.getContext('2d') as CanvasRenderingContext2D
      const drawImageSpy = vi.spyOn(targetCtx, 'drawImage')

      renderC3AppendedCharacter({
        char: 'A',
        targetCtx,
        baseCellX: 0,
        baseCellY: 0,
        baseCellWidth: 32,
        baseCellHeight: 32,
        renderScale: 1,
        charMargin: { top: 0, right: 0, bottom: 0, left: 0 },
        cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
        fontFamily: 'Arial',
        fontSize: 16,
        color: '#000000',
      })

      expect(drawImageSpy).toHaveBeenCalled()
    })
  })
})
