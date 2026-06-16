import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { triggerDownload, exportCanvasToPNG, exportCanvasToImage, dataURLToBlob, blobToDataURL, saveWithFilePicker } from '@/utils/download'

describe('download utils', () => {
  let mockLink: {
    href: string
    download: string
    style: { display: string }
    click: ReturnType<typeof vi.fn>
  }
  let mockCanvas: {
    toDataURL: ReturnType<typeof vi.fn>
    toBlob: ReturnType<typeof vi.fn>
  }
  let originalShowSaveFilePicker: typeof window.showSaveFilePicker | undefined

  beforeEach(() => {
    mockLink = {
      href: '',
      download: '',
      style: { display: '' },
      click: vi.fn(),
    }

    mockCanvas = {
      toDataURL: vi.fn((type: string) => {
        if (type === 'image/png') {
          return 'data:image/png;base64,mockpng'
        }
        if (type === 'image/jpeg') {
          return 'data:image/jpeg;base64,mockjpeg'
        }
        return 'data:image/png;base64,mock'
      }),
      toBlob: vi.fn((callback: BlobCallback, type?: string | null) => {
        const blob = new Blob(['mock'], { type: type || 'image/png' })
        callback(blob)
      }),
    }

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return mockLink as unknown as HTMLElement
      }
      if (tagName === 'canvas') {
        return mockCanvas as unknown as HTMLCanvasElement
      }
      return document.createElement.bind(document)(tagName)
    })

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as Node)

    originalShowSaveFilePicker = window.showSaveFilePicker
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.showSaveFilePicker = originalShowSaveFilePicker as typeof window.showSaveFilePicker
  })

  describe('triggerDownload', () => {
    it('should create and click download link', () => {
      const dataURL = 'data:image/png;base64,test'
      const filename = 'test.png'

      triggerDownload(dataURL, filename)

      expect(mockLink.href).toBe(dataURL)
      expect(mockLink.download).toBe(filename)
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink)
      expect(mockLink.click).toHaveBeenCalled()
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink)
    })
  })

  describe('saveWithFilePicker', () => {
    it('should return false when File System Access API is not supported', async () => {
      window.showSaveFilePicker = undefined as unknown as typeof window.showSaveFilePicker

      const blob = new Blob(['test'], { type: 'image/png' })
      const result = await saveWithFilePicker(blob, 'test.png')

      expect(result).toBe(false)
    })

    it('should save file using showSaveFilePicker when available', async () => {
      const mockWritable = {
        write: vi.fn(),
        close: vi.fn(),
      }
      const mockHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      }
      window.showSaveFilePicker = vi.fn().mockResolvedValue(mockHandle) as unknown as typeof window.showSaveFilePicker

      const blob = new Blob(['test'], { type: 'image/png' })
      const result = await saveWithFilePicker(blob, 'test.png')

      expect(result).toBe(true)
      expect(window.showSaveFilePicker).toHaveBeenCalledWith({
        suggestedName: 'test.png',
        types: undefined,
      })
      expect(mockHandle.createWritable).toHaveBeenCalled()
      expect(mockWritable.write).toHaveBeenCalledWith(blob)
      expect(mockWritable.close).toHaveBeenCalled()
    })

    it('should return true when user cancels the picker', async () => {
      window.showSaveFilePicker = vi.fn().mockRejectedValue(new DOMException('User cancelled', 'AbortError')) as unknown as typeof window.showSaveFilePicker

      const blob = new Blob(['test'], { type: 'image/png' })
      const result = await saveWithFilePicker(blob, 'test.png')

      expect(result).toBe(true)
    })
  })

  describe('exportCanvasToImage', () => {
    it('should export canvas to PNG by default', async () => {
      window.showSaveFilePicker = undefined as unknown as typeof window.showSaveFilePicker

      await exportCanvasToPNG(mockCanvas as unknown as HTMLCanvasElement)

      expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png', undefined)
      expect(mockLink.download).toBe('sprite-font.png')
    })

    it('should export canvas to JPEG when source mime type is image/jpeg', async () => {
      window.showSaveFilePicker = undefined as unknown as typeof window.showSaveFilePicker

      await exportCanvasToImage(mockCanvas as unknown as HTMLCanvasElement, {
        filename: 'sprite-font.jpg',
        sourceMimeType: 'image/jpeg',
      })

      expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.9)
      expect(mockLink.download).toBe('sprite-font.jpg')
    })

    it('should replace filename extension to match source mime type', async () => {
      window.showSaveFilePicker = undefined as unknown as typeof window.showSaveFilePicker

      await exportCanvasToImage(mockCanvas as unknown as HTMLCanvasElement, {
        filename: 'sprite-font.png',
        sourceMimeType: 'image/jpeg',
      })

      expect(mockLink.download).toBe('sprite-font.jpg')
    })
  })

  describe('dataURLToBlob', () => {
    it('should convert data URL to blob', () => {
      const dataURL = 'data:image/png;base64,iVBORw0KGgo='
      const blob = dataURLToBlob(dataURL)

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/png')
    })
  })

  describe('blobToDataURL', () => {
    it('should convert blob to data URL', async () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const dataURL = await blobToDataURL(blob)

      expect(dataURL).toContain('data:text/plain;base64,')
    })

    it('should handle empty blob', async () => {
      const blob = new Blob([])
      const dataURL = await blobToDataURL(blob)

      expect(dataURL).toContain('data:application/octet-stream;base64,')
    })
  })
})
