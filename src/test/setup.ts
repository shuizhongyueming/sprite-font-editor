// 测试环境设置
import { vi } from 'vitest'

// 模拟 localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

// @ts-ignore
global.localStorage = localStorageMock

// 模拟 FontFace API
class MockFontFace {
  family: string
  source: any
  loaded: Promise<MockFontFace>
  
  constructor(family: string, source: any) {
    this.family = family
    this.source = source
    this.loaded = Promise.resolve(this)
  }
  
  load() {
    return this.loaded
  }
}

// @ts-ignore
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
    } as any
  }
  return null
})

// 模拟 Canvas toDataURL
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock')

// 模拟 URL.createObjectURL
URL.createObjectURL = vi.fn(() => 'blob:mock')
URL.revokeObjectURL = vi.fn()
