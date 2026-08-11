import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildSpacingData,
  buildC3InstanceArray,
  exportC3SpriteFont,
  type C3AppendedEntry,
} from '@/utils/c3-export'
import type { C3InstanceArray } from '@/utils/c3-parser'

function createInstanceArray(
  characterSet: string = 'ABCDEF',
  spacingData: string = '[]',
): C3InstanceArray {
  return [
    'Hello',
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
  ] as unknown as C3InstanceArray
}

describe('buildSpacingData', () => {
  it('should group characters by display width', () => {
    const map = new Map<string, number>([
      ['A', 10],
      ['B', 10],
      ['C', 14],
    ])

    const spacingData = buildSpacingData(map, 16, ['A', 'B', 'C'])
    const parsed = JSON.parse(spacingData) as Array<[number, string]>

    expect(parsed).toHaveLength(2)
    expect(parsed).toContainEqual([10, 'AB'])
    expect(parsed).toContainEqual([14, 'C'])
  })

  it('should skip characters whose display width equals characterWidth', () => {
    const map = new Map<string, number>([
      ['A', 16],
      ['B', 10],
    ])

    const spacingData = buildSpacingData(map, 16, ['A', 'B'])
    const parsed = JSON.parse(spacingData) as Array<[number, string]>

    expect(parsed).toHaveLength(1)
    expect(parsed).toContainEqual([10, 'B'])
  })

  it('should skip characters not present in the display width map', () => {
    const map = new Map<string, number>([['A', 10]])

    const spacingData = buildSpacingData(map, 16, ['A', 'B'])
    const parsed = JSON.parse(spacingData) as Array<[number, string]>

    expect(parsed).toHaveLength(1)
    expect(parsed).toContainEqual([10, 'A'])
  })

  it('should return an empty array when no overrides exist', () => {
    const spacingData = buildSpacingData(new Map(), 16, ['A', 'B'])
    expect(spacingData).toBe('[]')
  })
})

describe('buildC3InstanceArray', () => {
  it('should update characterSet and spacingData while preserving other fields', () => {
    const original = createInstanceArray('ABC', '[[10,"A"]]')
    const updated = buildC3InstanceArray(original, ['A', 'B', 'C', 'D'], '[[12,"AB"]]')

    expect(updated[4]).toBe('ABCD')
    expect(updated[5]).toBe('[[12,"AB"]]')
    expect(updated[0]).toBe('Hello')
    expect(updated[1]).toBe(true)
    expect(updated[2]).toBe(16)
    expect(updated[3]).toBe(16)
    expect(updated[6]).toBe(1)
    expect(updated[7]).toBe(2)
    expect(updated[8]).toBe(4)
  })

  it('should not mutate the original array', () => {
    const original = createInstanceArray('ABC', '[]')
    const updated = buildC3InstanceArray(original, ['A', 'B'], '[[10,"A"]]')

    expect(original[4]).toBe('ABC')
    expect(updated[4]).toBe('AB')
  })
})

describe('exportC3SpriteFont', () => {
  let mockLink: {
    href: string
    download: string
    style: { display: string }
    click: ReturnType<typeof vi.fn>
  }
  let originalCreateElement: typeof document.createElement

  beforeEach(() => {
    mockLink = {
      href: '',
      download: '',
      style: { display: '' },
      click: vi.fn(),
    }

    originalCreateElement = document.createElement.bind(document)

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return mockLink as unknown as HTMLElement
      }
      if (tagName === 'canvas') {
        const canvas = originalCreateElement(tagName) as HTMLCanvasElement
        canvas.toBlob = vi.fn((callback: BlobCallback) => {
          callback(new Blob(['mock'], { type: 'image/png' }))
        }) as unknown as typeof canvas.toBlob
        return canvas
      }
      return originalCreateElement(tagName)
    })

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as Node)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should trigger a PNG download and return the updated array', async () => {
    const original = createInstanceArray('ABC', '[]')
    const image = new Image()
    image.width = 64
    image.height = 64

    const onDownload = vi.fn()
    const result = await exportC3SpriteFont({
      originalArray: original,
      importedCharacterSet: 'ABC',
      characterSet: ['A', 'B', 'C', 'D'],
      spacingData: '[[10,"A"]]',
      baseImage: image,
      c3ImportedImage: null,
      baseCellConfig: {
        width: 16,
        height: 16,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      baseImageConfig: {
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      appendedEntries: [] as C3AppendedEntry[],
      characterStyle: {
        fontFamily: 'Arial',
        fontSize: 16,
        color: '#000000',
        outline: { enabled: false, color: '#ffffff', width: 1 },
        pixelStyle: false,
      },
      filename: 'test-export.png',
      onDownload,
    })

    expect(result[4]).toBe('ABCD')
    expect(result[5]).toBe('[[10,"A"]]')
    expect(mockLink.download).toBe('test-export.png')
    expect(onDownload).toHaveBeenCalled()
  })

  it('should size the export canvas to max(image, fontSprite) per axis', async () => {
    const original = createInstanceArray('ABC', '[]')
    const image = new Image()
    image.width = 64
    image.height = 64

    const createdCanvases: HTMLCanvasElement[] = []
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return mockLink as unknown as HTMLElement
      }
      if (tagName === 'canvas') {
        const canvas = originalCreateElement(tagName) as HTMLCanvasElement
        canvas.toBlob = vi.fn((callback: BlobCallback) => {
          callback(new Blob(['mock'], { type: 'image/png' }))
        }) as unknown as typeof canvas.toBlob
        createdCanvases.push(canvas)
        return canvas
      }
      return originalCreateElement(tagName)
    })

    await exportC3SpriteFont({
      originalArray: original,
      importedCharacterSet: 'ABC',
      characterSet: ['A', 'B', 'C'],
      spacingData: '[]',
      baseImage: image,
      c3ImportedImage: null,
      baseCellConfig: {
        width: 16,
        height: 16,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      baseImageConfig: {
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        fontSpriteWidth: 64,
        fontSpriteHeight: 128,
      },
      appendedEntries: [] as C3AppendedEntry[],
      characterStyle: {
        fontFamily: 'Arial',
        fontSize: 16,
        color: '#000000',
        outline: { enabled: false, color: '#ffffff', width: 1 },
        pixelStyle: false,
      },
      filename: 'test-export.png',
    })

    const exportCanvas = createdCanvases.find(
      (canvas) => canvas.width === 64 && canvas.height === 128,
    )
    expect(exportCanvas).toBeDefined()
  })
})
