import { describe, it, expect } from 'vitest'
import { parseC3InstanceArray, C3ParseError } from '@/utils/c3-parser'

function createValidArray(overrides?: Partial<{
  characterWidth: number
  characterHeight: number
  characterSet: string
  spacingData: string
  characterSpacing: number
  lineHeight: number
}>): string {
  const data = [
    'Hello', // 0: _text
    true, // 1: _enableBBCode
    overrides?.characterWidth ?? 16, // 2: _characterWidth
    overrides?.characterHeight ?? 16, // 3: _characterHeight
    overrides?.characterSet ?? 'ABCDEF', // 4: _characterSet
    overrides?.spacingData ?? '[[10,"IJ"],[14,".!"]]', // 5: spacingData
    1, // 6: _characterScale
    overrides?.characterSpacing ?? 2, // 7: _characterSpacing
    overrides?.lineHeight ?? 4, // 8: _lineHeight
    0, // 9: _horizontalAlign
    0, // 10: _verticalAlign
    0, // 11: _wrapByWord
    true, // 12: initially-visible
    null, // 13: origin
    false, // 14: read-aloud
  ]
  return JSON.stringify(data)
}

describe('parseC3InstanceArray', () => {
  it('should parse a valid C3 instance array', () => {
    const parsed = parseC3InstanceArray(createValidArray())

    expect(parsed.characterWidth).toBe(16)
    expect(parsed.characterHeight).toBe(16)
    expect(parsed.characterSet).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(parsed.characterSpacing).toBe(2)
    expect(parsed.lineHeight).toBe(4)
    expect(parsed.rawArray).toBeDefined()
  })

  it('should build a display width map from spacingData', () => {
    const parsed = parseC3InstanceArray(createValidArray())

    expect(parsed.displayWidthMap.get('I')).toBe(10)
    expect(parsed.displayWidthMap.get('J')).toBe(10)
    expect(parsed.displayWidthMap.get('.')).toBe(14)
    expect(parsed.displayWidthMap.get('!')).toBe(14)
  })

  it('should skip spacing entries whose width equals characterWidth', () => {
    const parsed = parseC3InstanceArray(
      createValidArray({
        characterWidth: 16,
        spacingData: '[[16,"AB"],[10,"C"]]',
      }),
    )

    expect(parsed.displayWidthMap.has('A')).toBe(false)
    expect(parsed.displayWidthMap.has('B')).toBe(false)
    expect(parsed.displayWidthMap.get('C')).toBe(10)
  })

  it('should record space width when present', () => {
    const parsed = parseC3InstanceArray(
      createValidArray({
        spacingData: '[[8," "]]',
      }),
    )

    expect(parsed.spaceWidth).toBe(8)
    expect(parsed.displayWidthMap.get(' ')).toBe(8)
  })

  it('should set spaceWidth to null when space is not in spacingData', () => {
    const parsed = parseC3InstanceArray(createValidArray())
    expect(parsed.spaceWidth).toBeNull()
  })

  it('should split characterSet by grapheme clusters', () => {
    const parsed = parseC3InstanceArray(
      createValidArray({ characterSet: 'a😀b' }),
    )

    expect(parsed.characterSet).toEqual(['a', '😀', 'b'])
  })

  it('should throw for invalid JSON', () => {
    expect(() => parseC3InstanceArray('not json')).toThrow(C3ParseError)
  })

  it('should throw when input is not an array', () => {
    expect(() => parseC3InstanceArray('{"foo":"bar"}')).toThrow(C3ParseError)
  })

  it('should throw when array has fewer than 6 elements', () => {
    expect(() => parseC3InstanceArray('[1,2,3,4,5]')).toThrow(C3ParseError)
  })

  it('should throw when characterWidth is not a positive integer', () => {
    expect(() =>
      parseC3InstanceArray(createValidArray({ characterWidth: -1 })),
    ).toThrow(C3ParseError)
    expect(() =>
      parseC3InstanceArray(createValidArray({ characterWidth: 16.5 })),
    ).toThrow(C3ParseError)
  })

  it('should throw when spacingData is not valid JSON', () => {
    expect(() =>
      parseC3InstanceArray(createValidArray({ spacingData: 'not json' })),
    ).toThrow(C3ParseError)
  })

  it('should throw when spacingData entries are malformed', () => {
    expect(() =>
      parseC3InstanceArray(createValidArray({ spacingData: '[[1,2,3]]' })),
    ).toThrow(C3ParseError)
    expect(() =>
      parseC3InstanceArray(createValidArray({ spacingData: '[["x","y"]]' })),
    ).toThrow(C3ParseError)
  })
})
