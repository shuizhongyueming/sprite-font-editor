import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { triggerDownload, exportCanvasToPNG, exportCanvasToJPEG, dataURLToBlob, blobToDataURL } from '@/utils/download'

describe('download utils', () => {
  let mockLink: {
    href: string
    download: string
    style: { display: string }
    click: ReturnType<typeof vi.fn>
  }
  let mockCanvas: {
    toDataURL: ReturnType<typeof vi.fn>
  }

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
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  describe('exportCanvasToPNG', () => {
    it('should export canvas to PNG with default filename', () => {
      exportCanvasToPNG(mockCanvas as unknown as HTMLCanvasElement)

      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png')
      expect(mockLink.download).toBe('sprite-font.png')
    })
  })

  describe('exportCanvasToJPEG', () => {
    it('should export canvas to JPEG with default quality', () => {
      exportCanvasToJPEG(mockCanvas as unknown as HTMLCanvasElement)

      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.9)
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
