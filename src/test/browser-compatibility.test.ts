/**
 * 浏览器兼容性测试
 * 验证项目中使用的 API 在各浏览器中的兼容性
 */

import { describe, it, expect } from 'vitest'

describe('Browser Compatibility', () => {
  describe('FontFace API', () => {
    it('should support FontFace constructor', () => {
      expect(typeof FontFace).toBe('function')
    })

    it('should support document.fonts', () => {
      expect(typeof document.fonts).toBe('object')
      expect(typeof document.fonts.add).toBe('function')
      expect(typeof document.fonts.delete).toBe('function')
    })
  })

  describe('Canvas 2D API', () => {
    it('should support canvas element', () => {
      const canvas = document.createElement('canvas')
      expect(canvas).toBeInstanceOf(HTMLCanvasElement)
    })

    it('should support 2d context', () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      expect(ctx).not.toBeNull()
    })

    it('should support canvas toDataURL', () => {
      const canvas = document.createElement('canvas')
      expect(typeof canvas.toDataURL).toBe('function')
    })

    it('should support getContext with willReadFrequently', () => {
      const canvas = document.createElement('canvas')
      expect(() => {
        canvas.getContext('2d', { willReadFrequently: true })
      }).not.toThrow()
    })

    it('should support ImageData', () => {
      expect(typeof ImageData).toBe('function')
      const imageData = new ImageData(100, 100)
      expect(imageData).toBeInstanceOf(ImageData)
      expect(imageData.data).toBeInstanceOf(Uint8ClampedArray)
    })
  })

  describe('File API', () => {
    it('should support File constructor', () => {
      expect(typeof File).toBe('function')
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      expect(file).toBeInstanceOf(File)
    })

    it('should support FileReader', () => {
      expect(typeof FileReader).toBe('function')
      const reader = new FileReader()
      expect(reader).toBeInstanceOf(FileReader)
    })

    it('should support Blob', () => {
      expect(typeof Blob).toBe('function')
      const blob = new Blob(['content'])
      expect(blob).toBeInstanceOf(Blob)
    })
  })

  describe('URL API', () => {
    it('should support URL.createObjectURL', () => {
      expect(typeof URL.createObjectURL).toBe('function')
    })

    it('should support URL.revokeObjectURL', () => {
      expect(typeof URL.revokeObjectURL).toBe('function')
    })
  })

  describe('localStorage', () => {
    it('should support localStorage', () => {
      expect(typeof localStorage).toBe('object')
      expect(typeof localStorage.setItem).toBe('function')
      expect(typeof localStorage.getItem).toBe('function')
      expect(typeof localStorage.removeItem).toBe('function')
    })
  })

  describe('ES2020+ Features', () => {
    it('should support optional chaining', () => {
      const obj: any = { a: { b: 1 } }
      expect(obj?.a?.b).toBe(1)
      expect(obj?.c?.d).toBeUndefined()
    })

    it('should support nullish coalescing', () => {
      const a = null
      const b = undefined
      const c = 0
      expect(a ?? 'default').toBe('default')
      expect(b ?? 'default').toBe('default')
      expect(c ?? 'default').toBe(0)
    })

    it('should support async/await', async () => {
      const result = await Promise.resolve(42)
      expect(result).toBe(42)
    })
  })

  describe('CSS Features', () => {
    it('should support CSS Grid', () => {
      expect(typeof document.createElement('div').style.grid).toBe('string')
    })

    it('should support CSS Flexbox', () => {
      expect(typeof document.createElement('div').style.flex).toBe('string')
    })

    it('should support CSS Variables', () => {
      expect(typeof document.documentElement.style.setProperty).toBe('function')
    })
  })

  describe('Responsive Design', () => {
    it('should support matchMedia', () => {
      expect(typeof window.matchMedia).toBe('function')
    })

    it('should support resize event', () => {
      expect(typeof window.addEventListener).toBe('function')
    })
  })
})
