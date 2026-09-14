import { describe, it, expect, vi } from 'vitest'
import { encodeC3RepackedImage, imageToImageData } from '@/utils/c3-compaction-dom'

function makeImage(width: number, height: number): HTMLImageElement {
  const img = new Image()
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true })
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true })
  img.width = width
  img.height = height
  return img
}

describe('c3-compaction-dom imageToImageData', () => {
  it('extracts ImageData at natural size from an image element', () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type !== '2d') return null
      return {
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn(
          (_x: number, _y: number, width: number, height: number) => ({
            data: new Uint8ClampedArray(width * height * 4),
            width,
            height,
          }),
        ),
        imageSmoothingEnabled: false,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        lineJoin: '',
      } as unknown as CanvasRenderingContext2D
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext

    try {
      const imageData = imageToImageData(makeImage(32, 24))
      expect(imageData).not.toBeNull()
      expect(imageData!.width).toBe(32)
      expect(imageData!.height).toBe(24)
      expect(imageData!.data.length).toBe(32 * 24 * 4)
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext
    }
  })

  it('returns null when the canvas context is unavailable', () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
    try {
      expect(imageToImageData(makeImage(32, 24))).toBeNull()
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext
    }
  })
})

describe('encodeC3RepackedImage', () => {
  it('encodes lossless png by default', async () => {
    const blob = await encodeC3RepackedImage(new ImageData(4, 4))

    expect(blob?.type).toBe('image/png')
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/png',
      undefined,
    )
  })

  it('encodes webp at maximum quality when requested', async () => {
    const blob = await encodeC3RepackedImage(new ImageData(4, 4), 'image/webp')

    expect(blob?.type).toBe('image/webp')
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/webp',
      1,
    )
  })
})
