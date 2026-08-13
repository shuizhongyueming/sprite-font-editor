import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  imageToCanvas,
  imageDataToCanvas,
  renderC3TextPreview,
  buildC3TextDisplayWidthMaps,
} from '@/utils/c3-preview-renderer'
import type { C3AppendedEntry } from '@/utils/c3-export'

/** 共享同一 2d context mock，使测试与 renderer 内部分享同一 spy 实例 */
function installSharedContext() {
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 16 })),
    putImageData: vi.fn(),
    getImageData: vi.fn(
      (_x: number, _y: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
      }),
    ),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    lineJoin: '',
    imageSmoothingEnabled: false,
  } as unknown as CanvasRenderingContext2D

  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
  spy.mockImplementation((type: string) =>
    type === '2d' ? ctx : null,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext

  return { ctx, spy }
}

function makeImage(width: number, height: number): HTMLImageElement {
  const img = new Image()
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true })
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true })
  img.width = width
  img.height = height
  return img
}

function makeAppendedEntry(overrides: Partial<C3AppendedEntry> = {}): C3AppendedEntry {
  return {
    char: '王',
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    autoDisplayWidth: 100,
    autoGlyphHeight: 120,
    extraSpacing: 0,
    distributionOffset: 0,
    ...overrides,
  }
}

describe('c3-preview-renderer', () => {
  beforeEach(() => {
    installSharedContext()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('draws images and ImageData into canvases at natural size', () => {
    const image = makeImage(40, 16)
    const fromImage = imageToCanvas(image)
    expect(fromImage.width).toBe(40)
    expect(fromImage.height).toBe(16)

    const imageData = new ImageData(24, 12)
    const fromData = imageDataToCanvas(imageData)
    expect(fromData.width).toBe(24)
    expect(fromData.height).toBe(12)
  })

  it('throws when the canvas context is unavailable (no silent fake success)', () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
    try {
      expect(() => imageToCanvas(makeImage(32, 24))).toThrow()
      expect(() => imageDataToCanvas(new ImageData(8, 8))).toThrow()
      const canvas = document.createElement('canvas')
      expect(() =>
        renderC3TextPreview(canvas, {
          sourceCanvas: document.createElement('canvas'),
          characterWidth: 32,
          characterHeight: 32,
          characterSpacing: 0,
          lineHeight: 0,
          importedCharacterSet: [],
          appendedEntries: [],
          displayWidthMap: new Map(),
          spaceWidth: 32,
          sampleText: '',
          containerWidth: 100,
          sourceGrid: { originX: 0, originY: 0, columns: 1 },
          cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
          font: { fontFamily: 'Arial', fontSize: 16, color: '#000000' },
        }),
      ).toThrow()
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext
    }
  })

  it('advances by the default step (characterWidth) plus characterSpacing', () => {
    const { ctx } = installSharedContext()
    const drawImageSpy = vi.spyOn(ctx, 'drawImage')

    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = 2048
    sourceCanvas.height = 672
    const canvas = document.createElement('canvas')

    renderC3TextPreview(canvas, {
      sourceCanvas,
      characterWidth: 132,
      characterHeight: 112,
      characterSpacing: 4,
      lineHeight: 12,
      importedCharacterSet: ['A', 'B'],
      appendedEntries: [],
      displayWidthMap: new Map(),
      spaceWidth: 132,
      sampleText: 'AB',
      containerWidth: 460,
      sourceGrid: { originX: 0, originY: 0, columns: 15 },
      cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
      font: { fontFamily: 'Arial', fontSize: 84, color: '#000000' },
    })

    expect(drawImageSpy).toHaveBeenCalledTimes(2)
    // A 在 x=0；B 推进 132（默认步进）+ 4（characterSpacing）
    const secondCall = drawImageSpy.mock.calls[1] as unknown[]
    expect(secondCall[5] as number).toBe(136)
  })

  it('honors explicit spacing from the displayWidthMap (kept across old/new)', () => {
    const { ctx } = installSharedContext()
    const drawImageSpy = vi.spyOn(ctx, 'drawImage')

    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = 2048
    sourceCanvas.height = 672
    const canvas = document.createElement('canvas')

    const common = {
      sourceCanvas,
      characterHeight: 112,
      characterSpacing: 4,
      lineHeight: 12,
      importedCharacterSet: ['A', 'B', 'c'],
      appendedEntries: [],
      displayWidthMap: new Map([['c', 120]]),
      spaceWidth: 132,
      sampleText: 'Ac',
      containerWidth: 460,
      cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
      font: { fontFamily: 'Arial', fontSize: 84, color: '#000000' },
    }

    // 新旧 characterWidth 不同，但显式 spacing（c→120）的显示宽保持同值
    renderC3TextPreview(canvas, {
      ...common,
      characterWidth: 149,
      sourceGrid: { originX: 0, originY: 0, columns: 13 },
    })
    const oldSecond = drawImageSpy.mock.calls[1] as unknown[]
    drawImageSpy.mockClear()

    renderC3TextPreview(canvas, {
      ...common,
      characterWidth: 132,
      sourceGrid: { originX: 0, originY: 0, columns: 15 },
    })
    const newSecond = drawImageSpy.mock.calls[1] as unknown[]

    // 第二个字符 c 是显式 spacing：推进 = 前字符默认步进 + spacing + characterSpacing
    expect(oldSecond[5] as number).toBe(149 + 4)
    expect(newSecond[5] as number).toBe(132 + 4)
  })

  it('produces different wrap rows and heights for old/new default steps', () => {
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = 2048
    sourceCanvas.height = 672
    const canvas = document.createElement('canvas')

    const sample = 'ABCDEFGHIJKLM'
    const common = {
      sourceCanvas,
      characterSpacing: 4,
      lineHeight: 12,
      importedCharacterSet: [...sample],
      appendedEntries: [],
      displayWidthMap: new Map<string, number>(),
      spaceWidth: 300,
      sampleText: sample,
      containerWidth: 300,
      cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
      font: { fontFamily: 'Arial', fontSize: 84, color: '#000000' },
    }

    // 旧默认步进 149：149*2+4=302 > 300 → 每行 1 个（12 次换行）
    // 新默认步进 132：132*2+4=268 ≤ 300 → 每行 2 个（6 次换行）
    const oldHeight = renderC3TextPreview(canvas, {
      ...common,
      characterWidth: 149,
      characterHeight: 180,
      sourceGrid: { originX: 0, originY: 0, columns: 13 },
    })
    const newHeight = renderC3TextPreview(canvas, {
      ...common,
      characterWidth: 132,
      characterHeight: 112,
      sourceGrid: { originX: 0, originY: 0, columns: 15 },
    })

    expect(oldHeight).toBe(12 * (180 + 12) + 180)
    expect(newHeight).toBe(6 * (112 + 12) + 112)
    expect(newHeight).toBeLessThan(oldHeight)
  })

  it('advances the next character by an explicit spacing value (kept across old/new)', () => {
    const { ctx } = installSharedContext()
    const drawImageSpy = vi.spyOn(ctx, 'drawImage')

    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = 2048
    sourceCanvas.height = 672
    const canvas = document.createElement('canvas')

    // 'AcX'：A 默认步进、c 显式 spacing 120、X 在 c 之后
    const common = {
      sourceCanvas,
      characterHeight: 112,
      characterSpacing: 4,
      lineHeight: 12,
      importedCharacterSet: ['A', 'B', 'c', 'X'],
      appendedEntries: [],
      displayWidthMap: new Map([['c', 120]]),
      spaceWidth: 132,
      sampleText: 'AcX',
      containerWidth: 460,
      cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
      font: { fontFamily: 'Arial', fontSize: 84, color: '#000000' },
    }

    // 旧：X 的 dstX = 149 + 4 + 120 + 4 = 277（默认步进 149 随旧 cell）
    renderC3TextPreview(canvas, {
      ...common,
      characterWidth: 149,
      sourceGrid: { originX: 0, originY: 0, columns: 13 },
    })
    const oldX = drawImageSpy.mock.calls[2] as unknown[]

    drawImageSpy.mockClear()
    // 新：X 的 dstX = 132 + 4 + 120 + 4 = 260（默认步进 132 随新 cell）
    renderC3TextPreview(canvas, {
      ...common,
      characterWidth: 132,
      sourceGrid: { originX: 0, originY: 0, columns: 15 },
    })
    const newX = drawImageSpy.mock.calls[2] as unknown[]

    // 显式 spacing 120 保持同值；只有默认步进随 old/new cell 变化
    expect(oldX[5] as number).toBe(149 + 4 + 120 + 4)
    expect(newX[5] as number).toBe(132 + 4 + 120 + 4)
  })

  it('renders appended characters dynamically with cell clipping', () => {
    const { ctx } = installSharedContext()
    const clipSpy = vi.spyOn(ctx, 'clip')
    const drawImageSpy = vi.spyOn(ctx, 'drawImage')

    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = 2048
    sourceCanvas.height = 672
    const canvas = document.createElement('canvas')

    const entry = makeAppendedEntry({ char: '王', autoDisplayWidth: 100 })
    renderC3TextPreview(canvas, {
      sourceCanvas,
      characterWidth: 132,
      characterHeight: 112,
      characterSpacing: 4,
      lineHeight: 12,
      importedCharacterSet: ['A'],
      appendedEntries: [entry],
      displayWidthMap: new Map([['王', 100]]),
      spaceWidth: 132,
      sampleText: 'A王',
      containerWidth: 460,
      sourceGrid: { originX: 0, originY: 0, columns: 15 },
      cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
      font: { fontFamily: 'Arial', fontSize: 84, color: '#000000' },
    })

    // A 走 imported drawImage；王 走 renderC3AppendedCharacter（内部 clip 到 cell，
    // glyph 通过 drawImage 绘制到目标 context）
    expect(drawImageSpy).toHaveBeenCalledTimes(2)
    expect(clipSpy).toHaveBeenCalled()
  })

  it('uses the compaction grid origin and columns for imported cells (non-zero origin, wide source)', () => {
    const { ctx } = installSharedContext()
    const drawImageSpy = vi.spyOn(ctx, 'drawImage')

    // source 画布宽 256 > fontSpriteWidth 128；margin 8、padding 4 → originX=12
    // 有效宽 = min(256-8-8-8, 128-8) = min(232, 120) = 120 → columns = floor(120/32) = 3
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = 256
    sourceCanvas.height = 96
    const canvas = document.createElement('canvas')

    renderC3TextPreview(canvas, {
      sourceCanvas,
      characterWidth: 32,
      characterHeight: 32,
      characterSpacing: 2,
      lineHeight: 4,
      importedCharacterSet: ['A', 'B', 'C', 'D', 'E'],
      appendedEntries: [],
      displayWidthMap: new Map(),
      spaceWidth: 32,
      sampleText: 'AD',
      containerWidth: 300,
      sourceGrid: { originX: 12, originY: 10, columns: 3 },
      cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
      font: { fontFamily: 'Arial', fontSize: 16, color: '#000000' },
    })

    // A: index 0 → srcCol 0, srcRow 0 → sx=12, sy=10
    const aCall = drawImageSpy.mock.calls[0] as unknown[]
    expect(aCall[1] as number).toBe(12)
    expect(aCall[2] as number).toBe(10)
    // D: index 3 → srcCol 0, srcRow 1 → sx=12, sy=10+32=42
    const dCall = drawImageSpy.mock.calls[1] as unknown[]
    expect(dCall[1] as number).toBe(12)
    expect(dCall[2] as number).toBe(42)
  })

  it('keeps an appended display width equal to the old characterWidth in the new pane', () => {
    const entry = makeAppendedEntry({
      char: '王',
      autoDisplayWidth: 149,
      extraSpacing: 0,
    })
    const result = buildC3TextDisplayWidthMaps({
      importedSpacingData: '[[149,"c"]]',
      oldCharacterWidth: 149,
      appendedEntries: [entry],
      globalExtraSpacing: 0,
    })
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    const { old: oldMap, new: newMap } = result

    // imported 旧宽冗余项：两侧都回退默认（旧 pane 也忽略）
    expect(oldMap.has('c')).toBe(false)
    expect(newMap.has('c')).toBe(false)
    // appended 显式宽 149：两侧都保留（追加字符不缩放）
    expect(oldMap.get('王')).toBe(149)
    expect(newMap.get('王')).toBe(149)
  })

  it('returns a typed error instead of degrading silently on invalid spacing data', () => {
    const entry = makeAppendedEntry({ char: '王', autoDisplayWidth: 149 })
    const badJson = buildC3TextDisplayWidthMaps({
      importedSpacingData: 'not-json',
      oldCharacterWidth: 149,
      appendedEntries: [entry],
      globalExtraSpacing: 0,
    })
    expect(badJson).toEqual({ kind: 'error', code: 'invalid-spacing-data' })

    const badShape = buildC3TextDisplayWidthMaps({
      importedSpacingData: '[[120]]',
      oldCharacterWidth: 149,
      appendedEntries: [entry],
      globalExtraSpacing: 0,
    })
    expect(badShape).toEqual({ kind: 'error', code: 'invalid-spacing-data' })
  })

  it('new-pane rendering advances by the appended width even when it equals the old characterWidth', () => {
    const { ctx } = installSharedContext()
    const drawImageSpy = vi.spyOn(ctx, 'drawImage')

    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = 2048
    sourceCanvas.height = 672
    const canvas = document.createElement('canvas')

    // 新 cell 34；王（appended，宽 149 = 旧 characterWidth）后跟 A
    const entry = makeAppendedEntry({
      char: '王',
      autoDisplayWidth: 149,
      extraSpacing: 0,
    })
    renderC3TextPreview(canvas, {
      sourceCanvas,
      characterWidth: 34,
      characterHeight: 24,
      characterSpacing: 4,
      lineHeight: 4,
      importedCharacterSet: ['A'],
      appendedEntries: [entry],
      displayWidthMap: new Map([['王', 149]]),
      spaceWidth: 34,
      sampleText: '王A',
      containerWidth: 400,
      sourceGrid: { originX: 0, originY: 0, columns: 15 },
      cellPadding: { top: 0, right: 0, bottom: 0, left: 0 },
      font: { fontFamily: 'Arial', fontSize: 84, color: '#000000' },
    })

    // 王（appended glyph drawImage）+ A（imported drawImage）
    const aCall = drawImageSpy.mock.calls[1] as unknown[]
    // A 的位置按王 的显式宽 149 推进（而非新默认 34）
    expect(aCall[5] as number).toBe(149 + 4)
  })
})
