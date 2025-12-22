import { describe, it, expect } from 'vitest'
import { isValidImageFile, isValidFontFile } from '@/utils/file'

describe('file utils', () => {
  describe('isValidImageFile', () => {
    it('should accept valid image files', () => {
      const validFiles = [
        { name: 'test.png', type: 'image/png' },
        { name: 'test.jpg', type: 'image/jpeg' },
        { name: 'test.jpeg', type: 'image/jpeg' },
        { name: 'test.gif', type: 'image/gif' },
        { name: 'test.webp', type: 'image/webp' },
      ]

      validFiles.forEach(file => {
        expect(isValidImageFile(file as File)).toBe(true)
      })
    })

    it('should reject invalid image files', () => {
      const invalidFiles = [
        { name: 'test.txt', type: 'text/plain' },
        { name: 'test.pdf', type: 'application/pdf' },
      ]

      invalidFiles.forEach(file => {
        expect(isValidImageFile(file as File)).toBe(false)
      })
    })

    it('should accept files with valid extensions', () => {
      expect(isValidImageFile({ name: 'test.png', type: '' } as File)).toBe(true)
      expect(isValidImageFile({ name: 'test.jpg', type: '' } as File)).toBe(true)
    })

    it('should accept uppercase extensions', () => {
      expect(isValidImageFile({ name: 'test.PNG', type: '' } as File)).toBe(true)
      expect(isValidImageFile({ name: 'test.JPG', type: '' } as File)).toBe(true)
    })
  })

  describe('isValidFontFile', () => {
    it('should accept valid font files', () => {
      const validFiles = [
        { name: 'test.ttf', type: 'font/ttf' },
        { name: 'test.otf', type: 'font/otf' },
        { name: 'test.woff', type: 'font/woff' },
        { name: 'test.woff2', type: 'font/woff2' },
      ]

      validFiles.forEach(file => {
        expect(isValidFontFile(file as File)).toBe(true)
      })
    })

    it('should reject invalid font files', () => {
      const invalidFiles = [
        { name: 'test.txt', type: 'text/plain' },
        { name: 'test.png', type: 'image/png' },
      ]

      invalidFiles.forEach(file => {
        expect(isValidFontFile(file as File)).toBe(false)
      })
    })

    it('should accept uppercase extensions', () => {
      expect(isValidFontFile({ name: 'test.TTF', type: '' } as File)).toBe(true)
      expect(isValidFontFile({ name: 'test.OTF', type: '' } as File)).toBe(true)
    })
  })
})
