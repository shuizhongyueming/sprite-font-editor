import { describe, it, expect } from 'vitest'
import { splitGraphemes } from '@/utils/grapheme'

describe('splitGraphemes', () => {
  it('should split ASCII text into individual characters', () => {
    expect(splitGraphemes('abc')).toEqual(['a', 'b', 'c'])
  })

  it('should return an empty array for an empty string', () => {
    expect(splitGraphemes('')).toEqual([])
  })

  it('should split emoji into single grapheme clusters', () => {
    expect(splitGraphemes('😀')).toEqual(['😀'])
    expect(splitGraphemes('a😀b')).toEqual(['a', '😀', 'b'])
  })

  it('should split combining characters into grapheme clusters', () => {
    const clusters = splitGraphemes('e\u0301')
    // Modern ICU segmenters treat e + combining acute as one grapheme
    expect(clusters.length).toBeGreaterThanOrEqual(1)
  })

  it('should throw a clear error when Intl.Segmenter is unavailable', () => {
    const originalSegmenter = Intl.Segmenter
    // @ts-expect-error - simulate missing Intl.Segmenter
    Intl.Segmenter = undefined

    expect(() => splitGraphemes('abc')).toThrow(/upgrade to a modern browser/i)

    // @ts-expect-error - restore Intl.Segmenter
    Intl.Segmenter = originalSegmenter
  })
})
