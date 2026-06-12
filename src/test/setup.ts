// 测试环境设置
import { vi } from 'vitest'

// 模拟 localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

// @ts-expect-error global.localStorage is mocked for tests
global.localStorage = localStorageMock

// 模拟 FontFace API
class MockFontFace {
  family: string
  source: string | ArrayBuffer
  loaded: Promise<MockFontFace>

  constructor(family: string, source: string | ArrayBuffer) {
    this.family = family
    this.source = source
    this.loaded = Promise.resolve(this)
  }

  load() {
    return this.loaded
  }
}

// @ts-expect-error global.FontFace is mocked for tests
global.FontFace = MockFontFace

// 模拟 document.fonts
if (!document.fonts) {
  Object.defineProperty(document, 'fonts', {
    value: {
      add: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      ready: Promise.resolve(),
    },
    writable: true,
  })
}

// 模拟 matchMedia
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
  })
}

// 模拟 ImageData
if (typeof ImageData === 'undefined') {
  // @ts-expect-error global.ImageData is mocked for tests
  global.ImageData = class ImageData {
    data: Uint8ClampedArray
    width: number
    height: number
    colorSpace: PredefinedColorSpace

    constructor(
      dataOrWidth: Uint8ClampedArray | number,
      widthOrHeight: number,
      settings?: ImageDataSettings,
    ) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth
        this.height = widthOrHeight
        this.data = new Uint8ClampedArray(this.width * this.height * 4)
      } else {
        this.data = dataOrWidth
        this.width = widthOrHeight
        this.height = settings?.colorSpace ? 1 : 1
      }
      this.colorSpace = settings?.colorSpace ?? 'srgb'
    }
  }
}

// 模拟 HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
  if (contextType === '2d') {
    return {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 16 })),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(10000),
        width: 100,
        height: 100,
      })),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      lineJoin: '',
    } as unknown as CanvasRenderingContext2D
  }
  return null
}) as unknown as typeof HTMLCanvasElement.prototype.getContext

// 模拟 Canvas toDataURL
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock')

// 模拟 URL.createObjectURL
URL.createObjectURL = vi.fn(() => 'blob:mock')
URL.revokeObjectURL = vi.fn()
