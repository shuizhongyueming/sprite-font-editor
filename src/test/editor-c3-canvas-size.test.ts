import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'

function createFakeImage(width: number, height: number): HTMLImageElement {
  return { width, height } as HTMLImageElement
}

describe('C3 模式画布基础尺寸', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('非 C3 模式下画布基础尺寸等于图片尺寸', async () => {
    const store = useEditorStore()
    await store.setBaseImage(createFakeImage(64, 32))

    expect(store.canvasBaseWidth).toBe(64)
    expect(store.canvasBaseHeight).toBe(32)
  })

  it('C3 模式下画布基础尺寸为 max(图片, fontSprite)（逐轴向）', async () => {
    const store = useEditorStore()
    await store.setBaseImage(createFakeImage(64, 64))
    store.setC3Mode(true)

    store.baseImageConfig.fontSpriteWidth = 128
    store.baseImageConfig.fontSpriteHeight = 32

    expect(store.canvasBaseWidth).toBe(128)
    // 高度不小于导入图片高度
    expect(store.canvasBaseHeight).toBe(64)
  })

  it('refreshCanvasSize 按画布基础尺寸重算显示尺寸', async () => {
    const store = useEditorStore()
    await store.setBaseImage(createFakeImage(64, 64))
    store.setC3Mode(true)
    store.setCanvasViewMode('actual')

    store.baseImageConfig.fontSpriteWidth = 128
    store.refreshCanvasSize()

    expect(store.canvasWidth).toBe(128)
    expect(store.canvasHeight).toBe(64)
    expect(store.canvasScale).toBe(1)
  })

  it('autoFitC3FontSpriteSize 按字符总数扩展高度，宽度不变', async () => {
    const store = useEditorStore()
    await store.setBaseImage(createFakeImage(64, 64))
    store.setC3Mode(true)

    store.baseCellConfig.width = 16
    store.baseCellConfig.height = 16
    store.baseImageConfig.fontSpriteWidth = 64
    store.baseImageConfig.fontSpriteHeight = 64
    store.importedCharacterSet = 'ABCD'

    // 追加 5 个字符 → 共 9 个，4 列 → 3 行 → 高度 48
    for (let i = 0; i < 5; i++) {
      store.c3AppendedEntries.push({
        char: String(i),
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        autoDisplayWidth: 16,
        autoGlyphHeight: 16,
        extraSpacing: 0,
        distributionOffset: 0,
      })
    }

    store.autoFitC3FontSpriteSize()

    expect(store.baseImageConfig.fontSpriteWidth).toBe(64)
    expect(store.baseImageConfig.fontSpriteHeight).toBe(48)
  })

  it('非 C3 模式调用 autoFitC3FontSpriteSize 不生效', async () => {
    const store = useEditorStore()
    await store.setBaseImage(createFakeImage(64, 64))

    store.autoFitC3FontSpriteSize()

    expect(store.baseImageConfig.fontSpriteHeight).toBeUndefined()
  })
})
