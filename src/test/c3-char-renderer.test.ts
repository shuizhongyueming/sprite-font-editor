import { describe, it, expect, vi } from 'vitest'
import {
  measureGlyphBounds,
  measureGlyphDisplayWidth,
  renderC3AppendedCharacter,
} from '@/utils/c3-char-renderer'
import { measureGlyphExtent } from '@/utils/char-renderer'

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

      expect(bounds).toEqual({ width: 0, height: 0, left: 0, top: 0 })
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
      expect(bounds.left).toBe(5)
      expect(bounds.top).toBe(10)

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

      expect(bounds).toEqual({ width: 32, height: 48, left: 0, top: 0 })

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

    it('clips to the cell boundary with save → clip → render → restore ordering', () => {
      const canvas = document.createElement('canvas')
      const targetCtx = canvas.getContext('2d') as CanvasRenderingContext2D
      const saveSpy = vi.spyOn(targetCtx, 'save')
      const restoreSpy = vi.spyOn(targetCtx, 'restore')
      const beginPathSpy = vi.spyOn(targetCtx, 'beginPath')
      const rectSpy = vi.spyOn(targetCtx, 'rect')
      const clipSpy = vi.spyOn(targetCtx, 'clip')

      renderC3AppendedCharacter({
        char: 'A',
        targetCtx,
        baseCellX: 10,
        baseCellY: 20,
        baseCellWidth: 32,
        baseCellHeight: 24,
        renderScale: 1,
        charMargin: { top: 0, right: 0, bottom: 0, left: 0 },
        cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
        fontFamily: 'Arial',
        fontSize: 16,
        color: '#000000',
      })

      expect(saveSpy).toHaveBeenCalledBefore(beginPathSpy)
      expect(beginPathSpy).toHaveBeenCalledBefore(rectSpy)
      expect(rectSpy).toHaveBeenCalledWith(10, 20, 32, 24)
      expect(rectSpy).toHaveBeenCalledBefore(clipSpy)
      expect(clipSpy).toHaveBeenCalledBefore(restoreSpy)
    })

    it('scales the clip rect by renderScale to match the scaled drawing', () => {
      const canvas = document.createElement('canvas')
      const targetCtx = canvas.getContext('2d') as CanvasRenderingContext2D
      const rectSpy = vi.spyOn(targetCtx, 'rect')

      renderC3AppendedCharacter({
        char: 'A',
        targetCtx,
        baseCellX: 10,
        baseCellY: 20,
        baseCellWidth: 32,
        baseCellHeight: 24,
        renderScale: 2,
        charMargin: { top: 0, right: 0, bottom: 0, left: 0 },
        cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
        fontFamily: 'Arial',
        fontSize: 16,
        color: '#000000',
      })

      expect(rectSpy).toHaveBeenCalledWith(20, 40, 64, 48)
    })

    it('restores the context even when rendering throws', () => {
      const canvas = document.createElement('canvas')
      const targetCtx = canvas.getContext('2d') as CanvasRenderingContext2D
      const restoreSpy = vi.spyOn(targetCtx, 'restore')
      vi.spyOn(targetCtx, 'drawImage').mockImplementation(() => {
        throw new Error('render boom')
      })

      expect(() =>
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
        }),
      ).toThrow('render boom')
      expect(restoreSpy).toHaveBeenCalled()
    })

    it('does not fit-scale appended glyphs; only the clip rect changes with the cell', () => {
      // 定制 2d context：getImageData 返回画布自身尺寸、字形 alpha 内容 140×120
      const originalGetContext = HTMLCanvasElement.prototype.getContext
      const drawCalls: unknown[][] = []
      HTMLCanvasElement.prototype.getContext = vi.fn(function (
        this: HTMLCanvasElement,
        type: string,
      ) {
        if (type !== '2d') return null
        const data = new Uint8ClampedArray(this.width * this.height * 4)
        for (let y = 0; y < 120 && y < this.height; y++) {
          for (let x = 0; x < 140 && x < this.width; x++) {
            data[(y * this.width + x) * 4 + 3] = 255
          }
        }
        return {
          clearRect: vi.fn(),
          fillText: vi.fn(),
          strokeText: vi.fn(),
          measureText: vi.fn(() => ({
            width: 140,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: 140,
            actualBoundingBoxAscent: 120,
            actualBoundingBoxDescent: 0,
          })),
          putImageData: vi.fn(),
          // getImageData 用请求尺寸构造（renderCharacterOnCanvas 先 getContext 后设 canvas 尺寸）
          getImageData: vi.fn(
            (_x: number, _y: number, w: number, h: number) => {
              const d = new Uint8ClampedArray(w * h * 4)
              for (let yy = 0; yy < 120 && yy < h; yy++) {
                for (let xx = 0; xx < 140 && xx < w; xx++) {
                  d[(yy * w + xx) * 4 + 3] = 255
                }
              }
              return { data: d, width: w, height: h }
            },
          ),
          drawImage: vi.fn((...args: unknown[]) => {
            drawCalls.push(args)
          }),
          save: vi.fn(),
          restore: vi.fn(),
          beginPath: vi.fn(),
          rect: vi.fn(),
          clip: vi.fn(),
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          font: '',
          lineJoin: '',
        } as unknown as CanvasRenderingContext2D
      }) as unknown as typeof HTMLCanvasElement.prototype.getContext

      try {
        const targetCanvas = document.createElement('canvas')
        const targetCtx = targetCanvas.getContext('2d') as CanvasRenderingContext2D
        const rectCalls: unknown[][] = []
        vi.spyOn(targetCtx, 'rect').mockImplementation((...args: unknown[]) => {
          rectCalls.push(args)
        })

        const base = {
          char: '王',
          targetCtx,
          renderScale: 1,
          charMargin: { top: 0, right: 0, bottom: 0, left: 0 },
          cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
          fontFamily: 'Arial',
          fontSize: 16,
          color: '#000000',
        }
        renderC3AppendedCharacter({
          ...base,
          baseCellX: 0,
          baseCellY: 0,
          baseCellWidth: 149,
          baseCellHeight: 180,
        })
        renderC3AppendedCharacter({
          ...base,
          baseCellX: 0,
          baseCellY: 0,
          baseCellWidth: 132,
          baseCellHeight: 112,
        })

        // 字形目标绘制尺寸不变（原尺寸 140×120，不做 fit 缩放）
        expect(drawCalls).toHaveLength(2)
        expect(drawCalls[0][7]).toBe(140)
        expect(drawCalls[0][8]).toBe(120)
        expect(drawCalls[1][7]).toBe(140)
        expect(drawCalls[1][8]).toBe(120)
        // 变化的只有 clip rect（大 cell → 小 cell）
        expect(rectCalls[0]).toEqual([0, 0, 149, 180])
        expect(rectCalls[1]).toEqual([0, 0, 132, 112])
      } finally {
        HTMLCanvasElement.prototype.getContext = originalGetContext
      }
    })

    it('keeps the glyph size unchanged even when the cell is far smaller than 2× the glyph', () => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext
      const drawCalls: unknown[][] = []
      HTMLCanvasElement.prototype.getContext = vi.fn(function (
        this: HTMLCanvasElement,
        type: string,
      ) {
        if (type !== '2d') return null
        const data = new Uint8ClampedArray(this.width * this.height * 4)
        for (let y = 0; y < 120 && y < this.height; y++) {
          for (let x = 0; x < 140 && x < this.width; x++) {
            data[(y * this.width + x) * 4 + 3] = 255
          }
        }
        return {
          clearRect: vi.fn(),
          fillText: vi.fn(),
          strokeText: vi.fn(),
          measureText: vi.fn(() => ({
            width: 140,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: 140,
            actualBoundingBoxAscent: 120,
            actualBoundingBoxDescent: 0,
          })),
          putImageData: vi.fn(),
          getImageData: vi.fn(
            (_x: number, _y: number, w: number, h: number) => {
              const d = new Uint8ClampedArray(w * h * 4)
              for (let yy = 0; yy < 120 && yy < h; yy++) {
                for (let xx = 0; xx < 140 && xx < w; xx++) {
                  d[(yy * w + xx) * 4 + 3] = 255
                }
              }
              return { data: d, width: w, height: h }
            },
          ),
          drawImage: vi.fn((...args: unknown[]) => {
            drawCalls.push(args)
          }),
          save: vi.fn(),
          restore: vi.fn(),
          beginPath: vi.fn(),
          rect: vi.fn(),
          clip: vi.fn(),
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          font: '',
          lineJoin: '',
        } as unknown as CanvasRenderingContext2D
      }) as unknown as typeof HTMLCanvasElement.prototype.getContext

      try {
        const targetCanvas = document.createElement('canvas')
        const targetCtx = targetCanvas.getContext('2d') as CanvasRenderingContext2D
        const rectCalls: unknown[][] = []
        vi.spyOn(targetCtx, 'rect').mockImplementation((...args: unknown[]) => {
          rectCalls.push(args)
        })

        // 字形 140×120 远大于新 cell 34×24（2×cell 仅 68×48）
        renderC3AppendedCharacter({
          char: '王',
          targetCtx,
          baseCellX: 0,
          baseCellY: 0,
          baseCellWidth: 34,
          baseCellHeight: 24,
          renderScale: 1,
          charMargin: { top: 0, right: 0, bottom: 0, left: 0 },
          cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
          fontFamily: 'Arial',
          fontSize: 84,
          color: '#000000',
        })

        // 离屏尺寸由字形上界（≈144×124）决定，glyph 未被提前截断
        expect(drawCalls).toHaveLength(1)
        expect(drawCalls[0][7]).toBe(140)
        expect(drawCalls[0][8]).toBe(120)
        // clip 仍严格到 cell
        expect(rectCalls[0]).toEqual([0, 0, 34, 24])
      } finally {
        HTMLCanvasElement.prototype.getContext = originalGetContext
      }
    })
  })

  describe('measureGlyphExtent', () => {
    it('falls back with a console.warn when the canvas context is unavailable', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const originalGetContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
      try {
        const extent = measureGlyphExtent({
          text: 'A',
          fontFamily: 'Arial',
          fontSize: 16,
        })
        // fontSize × 2 保守回退
        expect(extent).toEqual({ width: 32, height: 32 })
        expect(warnSpy).toHaveBeenCalled()
      } finally {
        HTMLCanvasElement.prototype.getContext = originalGetContext
        warnSpy.mockRestore()
      }
    })

    it('falls back with a console.warn when measureText throws', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const originalGetContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
        if (type !== '2d') return null
        return {
          measureText: vi.fn(() => {
            throw new Error('measure boom')
          }),
          font: '',
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          lineJoin: '',
        } as unknown as CanvasRenderingContext2D
      }) as unknown as typeof HTMLCanvasElement.prototype.getContext
      try {
        const extent = measureGlyphExtent({
          text: 'A',
          fontFamily: 'Arial',
          fontSize: 16,
        })
        // 回退：width = 0 + fontSize + 0 + SAFETY(4) = 20；height = fontSize + ceil(16*0.2=3.2→4) + 4 = 24
        expect(extent).toEqual({ width: 20, height: 24 })
        expect(warnSpy).toHaveBeenCalled()
      } finally {
        HTMLCanvasElement.prototype.getContext = originalGetContext
        warnSpy.mockRestore()
      }
    })
  })
})
