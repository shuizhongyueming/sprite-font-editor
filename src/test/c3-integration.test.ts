import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import { buildSpacingData, buildC3InstanceArray } from '@/utils/c3-export'

function createSampleArray(
  characterSet: string = 'ABCDEF',
  spacingData: string = '[]',
): string {
  return JSON.stringify([
    'Sample',
    true,
    16,
    16,
    characterSet,
    spacingData,
    1,
    2,
    4,
    0,
    0,
    0,
    true,
    null,
    false,
  ])
}

function createImage(width: number, height: number): HTMLImageElement {
  const image = new Image()
  image.width = width
  image.height = height
  return image
}

describe('C3 import → append → export round-trip', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should preserve non-font fields and update characterSet/spacingData', () => {
    const store = useEditorStore()
    const rawArray = JSON.parse(createSampleArray('AB', '[[10,"A"]]')) as [
      string,
      boolean,
      number,
      number,
      string,
      string,
      number,
      number,
      number,
      number,
      number,
      number,
      boolean,
      unknown,
      boolean,
    ]
    const parsed = parseC3InstanceArray(createSampleArray('AB', '[[10,"A"]]'))
    const image = createImage(64, 64)

    store.importC3SpriteFont(image, rawArray, parsed)
    store.appendC3Characters(['C', 'D'])
    // Set appended characters to the default cell width so they are skipped
    // from spacing data, matching C3 behavior.
    store.updateC3AppendedDisplayWidth(0, 16)
    store.updateC3AppendedDisplayWidth(1, 16)

    const exportedArray = store.c3ExportInstanceArray
    expect(exportedArray).not.toBeNull()

    const array = exportedArray!
    expect(array[0]).toBe('Sample')
    expect(array[1]).toBe(true)
    expect(array[2]).toBe(16)
    expect(array[3]).toBe(16)
    expect(array[4]).toBe('ABCD')
    expect(array[5]).toBe('[[10,"A"]]')
    expect(array[6]).toBe(1)
    expect(array[7]).toBe(2)
    expect(array[8]).toBe(4)
    expect(array[9]).toBe(0)
    expect(array[10]).toBe(0)
    expect(array[11]).toBe(0)
    expect(array[12]).toBe(true)
    expect(array[13]).toBeNull()
    expect(array[14]).toBe(false)
  })

  it('should include appended characters in exported spacing data', () => {
    const store = useEditorStore()
    const rawArray = JSON.parse(createSampleArray('AB')) as [
      string,
      boolean,
      number,
      number,
      string,
      string,
      number,
      number,
      number,
      number,
      number,
      number,
      boolean,
      unknown,
      boolean,
    ]
    const parsed = parseC3InstanceArray(createSampleArray('AB'))
    const image = createImage(64, 64)

    store.importC3SpriteFont(image, rawArray, parsed)
    store.appendC3Characters(['C'])
    store.updateC3AppendedDisplayWidth(0, 10)

    const exportedArray = store.c3ExportInstanceArray
    expect(exportedArray).not.toBeNull()

    const spacingTuples = JSON.parse(exportedArray![5]) as Array<[number, string]>
    expect(spacingTuples).toContainEqual([10, 'C'])
  })

  it('should keep imported spacing overrides in exported spacing data', () => {
    const store = useEditorStore()
    const rawArray = JSON.parse(createSampleArray('AB', '[[10,"A"]]')) as [
      string,
      boolean,
      number,
      number,
      string,
      string,
      number,
      number,
      number,
      number,
      number,
      number,
      boolean,
      unknown,
      boolean,
    ]
    const parsed = parseC3InstanceArray(createSampleArray('AB', '[[10,"A"]]'))
    const image = createImage(64, 64)

    store.importC3SpriteFont(image, rawArray, parsed)

    const exportedArray = store.c3ExportInstanceArray
    const spacingTuples = JSON.parse(exportedArray![5]) as Array<[number, string]>
    expect(spacingTuples).toContainEqual([10, 'A'])
  })
})

describe('spacing data grouping logic', () => {
  it('should group multiple characters that share the same display width', () => {
    const map = new Map<string, number>([
      ['A', 12],
      ['B', 12],
      ['C', 12],
      ['D', 8],
    ])

    const spacingData = buildSpacingData(map, 16, ['A', 'B', 'C', 'D'])
    const parsed = JSON.parse(spacingData) as Array<[number, string]>

    expect(parsed).toContainEqual([12, 'ABC'])
    expect(parsed).toContainEqual([8, 'D'])
  })

  it('should skip display widths equal to characterWidth', () => {
    const map = new Map<string, number>([
      ['A', 16],
      ['B', 16],
      ['C', 10],
    ])

    const spacingData = buildSpacingData(map, 16, ['A', 'B', 'C'])
    const parsed = JSON.parse(spacingData) as Array<[number, string]>

    expect(parsed).toHaveLength(1)
    expect(parsed).toContainEqual([10, 'C'])
  })

  it('should produce a JSON string in C3 format', () => {
    const map = new Map<string, number>([['A', 10]])

    const spacingData = buildSpacingData(map, 16, ['A'])
    expect(spacingData).toBe('[[10,"A"]]')
  })
})

describe('buildC3InstanceArray', () => {
  it('should only modify indices 4 and 5', () => {
    const original = JSON.parse(createSampleArray('AB', '[[10,"A"]]')) as [
      string,
      boolean,
      number,
      number,
      string,
      string,
      number,
      number,
      number,
      number,
      number,
      number,
      boolean,
      unknown,
      boolean,
    ]

    const updated = buildC3InstanceArray(original, ['A', 'B', 'C'], '[]')

    for (let i = 0; i < original.length; i++) {
      if (i === 4) {
        expect(updated[i]).toBe('ABC')
      } else if (i === 5) {
        expect(updated[i]).toBe('[]')
      } else {
        expect(updated[i]).toBe(original[i])
      }
    }
  })
})
