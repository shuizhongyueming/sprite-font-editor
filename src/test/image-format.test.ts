import { describe, it, expect } from 'vitest'
import { resolveAlphaSafeImageMimeType } from '@/utils/image-format'

describe('resolveAlphaSafeImageMimeType', () => {
  it('preserves webp sources', () => {
    expect(resolveAlphaSafeImageMimeType('image/webp')).toBe('image/webp')
  })

  it('keeps png as png', () => {
    expect(resolveAlphaSafeImageMimeType('image/png')).toBe('image/png')
  })

  it('falls back to lossless png for jpeg and unknown formats', () => {
    expect(resolveAlphaSafeImageMimeType('image/jpeg')).toBe('image/png')
    expect(resolveAlphaSafeImageMimeType('image/gif')).toBe('image/png')
    expect(resolveAlphaSafeImageMimeType('')).toBe('image/png')
  })
})
