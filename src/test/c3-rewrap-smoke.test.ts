import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import C3RewrapModal from '@/components/C3RewrapModal.vue'
import { useEditorStore } from '@/stores/editor'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import * as c3CompactionModule from '@/utils/c3-compaction'
import * as c3CompactionDom from '@/utils/c3-compaction-dom'
import * as c3CharRenderer from '@/utils/c3-char-renderer'
import { exportProjectToZip } from '@/utils/project-export'
import { parseProjectFiles, readZipProject } from '@/utils/project-import'
import { C3GenerationStorage } from '@/utils/storage'
import { setLanguage } from '@/utils/i18n'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage, flushImageLoads } from './helpers/fake-image'
import {
  createFixtureArray,
  makePngBlob,
  makeSpriteSheetImageData,
  appendedCellPosition,
  createMockImageLoader,
} from './helpers/c3-fixtures'
import { resetFakeIndexedDB } from './fake-indexeddb'

/**
 * 入库 fixture 冒烟（test-fixtures/c3/ 尚未入库，此处为等价合成 fixture）：
 * sprite.png = 512×420（5 列 × 4 行，cell 取实样 99×105，西里尔字符集 20 个），
 * instance-array.json = createFixtureArray(99, 105, CHARSET)。
 * 用户路径：导入 → 重排到 1024 → Sprite/C3 文本双预览 → 应用 →
 * 刷新恢复（新 pinia）→ ZIP 往返。
 */

const CELL_W = 99
const CELL_H = 105
const COLUMNS = 5
const ROWS = 4
// sheet 宽 512（5 列 × 99 = 495，右侧透明余量，贴近实样非整除布局）
const SHEET_WIDTH = 512
const SHEET_H = ROWS * CELL_H // 420
const CHARSET = 'АБВГДЕЖЗИКЛМНОПРСТУФ' // 20 个西里尔字符
const TARGET_W = 1024
const TOTAL = 22 // 20 导入 + Ю、Я 追加
const NEW_COLS = Math.floor(TARGET_W / CELL_W) // 10
const NEW_ROWS = Math.ceil(TOTAL / NEW_COLS) // 3
const NEW_H = NEW_ROWS * CELL_H // 315

/** restoreAssets 里 new Image() 解码重排 asset 后应带出重排图尺寸（1024×315） */
class RestoredImage extends FakeImage {
  set src(_url: string) {
    this.width = TARGET_W
    this.height = NEW_H
    this.naturalWidth = TARGET_W
    this.naturalHeight = NEW_H
    queueMicrotask(() => this.onload?.())
  }
}

describe('C3 rewrap fixture smoke', () => {
  let store: ReturnType<typeof useEditorStore>
  let wrapper: VueWrapper
  let pinia: ReturnType<typeof createPinia>

  beforeEach(async () => {
    resetFakeIndexedDB()
    installMemoryLocalStorage()
    setLanguage('en-US')
    vi.stubGlobal('Image', FakeImage)
    vi.spyOn(c3CompactionModule, 'verifyCanvasAlphaRoundTrip').mockReturnValue(true)
    vi.spyOn(c3CharRenderer, 'measureGlyphBounds').mockReturnValue({ width: 8, height: 12, left: 2, top: 0 })

    pinia = createPinia()
    setActivePinia(pinia)
    store = useEditorStore()

    // 导入 fixture（等价 test-fixtures/c3/ 的 sprite.png + instance-array.json）
    const image = new FakeImage(SHEET_WIDTH, SHEET_H)
    const array = createFixtureArray(CELL_W, CELL_H, CHARSET)
    const parsed = parseC3InstanceArray(JSON.stringify(array))
    await store.importC3SpriteFont(
      image as unknown as HTMLImageElement,
      array,
      parsed,
      'sprite.png',
      SHEET_WIDTH,
      SHEET_H,
      'image/png',
      makePngBlob(),
    )
    store.appendC3Characters(['Ю', 'Я'])

    // DOM seams：像素读取返回 fixture 图，编码/解码走既定 mock
    vi.spyOn(c3CompactionDom, 'imageToImageData').mockReturnValue(
      makeSpriteSheetImageData(COLUMNS, ROWS, CELL_W, CELL_H, CHARSET.length, SHEET_WIDTH),
    )
    vi.spyOn(c3CompactionDom, 'encodeC3RepackedImage').mockResolvedValue(makePngBlob())
    vi.spyOn(c3CompactionDom, 'decodeC3PngBlob').mockResolvedValue(
      new FakeImage(TARGET_W, NEW_H) as unknown as HTMLImageElement,
    )

    // 真实 prepare seam：打开弹窗自动选最方的「会改变布局」候选 = 1024
    wrapper = mount(C3RewrapModal, {
      props: { visible: true },
      global: { plugins: [pinia] },
      attachTo: document.body,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    wrapper.unmount()
  })

  it('walks the full user path: import → prepare 1024 → dual preview → apply → refresh → ZIP', async () => {
    // ---- prepare 1024：弹窗打开即自动 prepare 最方且改变布局的候选 ----
    await nextTick()
    expect(wrapper.find('.metrics').text()).toContain(String(TARGET_W))
    expect(wrapper.find('.issue-banner').exists()).toBe(false)

    // ---- Sprite 双预览：旧基底 512×420，新基底 1024×315（含追加行密铺） ----
    const spriteCanvases = wrapper.findAll('.sprite-view__pane canvas')
    expect(spriteCanvases).toHaveLength(2)
    expect((spriteCanvases[0].element as HTMLCanvasElement).width).toBe(SHEET_WIDTH)
    expect((spriteCanvases[0].element as HTMLCanvasElement).height).toBe(SHEET_H)
    expect((spriteCanvases[1].element as HTMLCanvasElement).width).toBe(TARGET_W)
    expect((spriteCanvases[1].element as HTMLCanvasElement).height).toBe(NEW_H)

    // ---- C3 文本双预览：旧/新布局各一张可渲染画布 ----
    await wrapper.findAll('.view-tabs__tab')[1].trigger('click')
    await nextTick()
    const textCanvases = wrapper.findAll('.text-view__canvas')
    expect(textCanvases).toHaveLength(2)
    expect((textCanvases[0].element as HTMLCanvasElement).height).toBeGreaterThan(0)
    expect((textCanvases[1].element as HTMLCanvasElement).height).toBeGreaterThan(0)

    // ---- apply：busy 先绘制（按钮同步进入 applying 态），完成后关闭弹窗 ----
    const applyBtn = wrapper.findAll('footer .btn')[1]
    expect(applyBtn.attributes('disabled')).toBeUndefined()
    await applyBtn.trigger('click')
    await nextTick()
    expect(wrapper.findAll('footer .btn')[1].attributes('disabled')).toBeDefined()
    // store 原子应用含持久化异步链（fake IDB 多次 macrotask），等待关闭事件
    await vi.waitFor(() => expect(wrapper.emitted('close')).toHaveLength(1))

    // 应用结果：重排基底精确 = 目标宽度 × 含追加的密铺高度
    expect(store.isC3Mode).toBe(true)
    expect(store.baseCellConfig.width).toBe(CELL_W)
    expect(store.baseCellConfig.height).toBe(CELL_H)
    expect(store.baseImageConfig.fontSpriteWidth).toBe(TARGET_W)
    expect(store.baseImageConfig.fontSpriteHeight).toBe(NEW_H)
    expect(store.baseImageConfig.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(store.baseImageConfig.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(store.originalImageWidth).toBe(TARGET_W)
    expect(store.originalImageHeight).toBe(NEW_H)
    expect(store.c3InstanceArray?.[2]).toBe(CELL_W)
    expect(store.c3InstanceArray?.[3]).toBe(CELL_H)
    expect(store.c3InstanceArray?.[4]).toBe(CHARSET)
    expect(store.c3AppendedEntries).toHaveLength(2)
    // 追加字符按最终布局渲染：10 列 → Ю（index 20）= (0, 210)，Я（index 21）= (99, 210)
    expect(appendedCellPosition(store, 0)).toEqual({ x: 0, y: 2 * CELL_H })
    expect(appendedCellPosition(store, 1)).toEqual({ x: CELL_W, y: 2 * CELL_H })

    // ---- 模拟刷新恢复：新 pinia 实例，持久化数据不动 ----
    vi.stubGlobal('Image', RestoredImage)
    setActivePinia(createPinia())
    const fresh = useEditorStore()
    fresh.loadFromLocalStorage()
    await fresh.restoreAssets()
    await flushImageLoads()

    expect(fresh.isC3Mode).toBe(true)
    expect(fresh.baseCellConfig.width).toBe(CELL_W)
    expect(fresh.baseCellConfig.height).toBe(CELL_H)
    expect(fresh.baseImageConfig.fontSpriteWidth).toBe(TARGET_W)
    expect(fresh.baseImageConfig.fontSpriteHeight).toBe(NEW_H)
    expect(fresh.originalImageWidth).toBe(TARGET_W)
    expect(fresh.originalImageHeight).toBe(NEW_H)
    expect(fresh.importedCharacterSet).toBe(CHARSET)
    expect(fresh.c3AppendedEntries).toHaveLength(2)
    expect(fresh.c3AppendedEntries.map((e) => e.char)).toEqual(['Ю', 'Я'])
    expect(fresh.c3ImportedImageFilename).toBe('sprite.png')
    expect((fresh.c3ImportedImage as unknown as FakeImage).width).toBe(TARGET_W)
    expect((fresh.c3ImportedImage as unknown as FakeImage).height).toBe(NEW_H)
    expect(C3GenerationStorage.readActiveC3Generation()).not.toBeNull()

    // ---- ZIP 往返：重排后的工作代完整保持 ----
    const zipBlob = await exportProjectToZip(fresh)
    const map = await readZipProject(zipBlob)
    expect(map.has('project.json')).toBe(true)
    expect(map.has('sprite.png')).toBe(true)
    expect(map.has('c3-instance.json')).toBe(true)

    const projectData = await parseProjectFiles(
      map,
      createMockImageLoader(TARGET_W, NEW_H),
    )
    setActivePinia(createPinia())
    const target = useEditorStore()
    await target.applyProject(projectData)

    expect(target.isC3Mode).toBe(true)
    expect(target.baseCellConfig.width).toBe(CELL_W)
    expect(target.baseCellConfig.height).toBe(CELL_H)
    expect(target.baseImageConfig.fontSpriteWidth).toBe(TARGET_W)
    expect(target.baseImageConfig.fontSpriteHeight).toBe(NEW_H)
    expect(target.baseImageConfig.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(target.originalImageWidth).toBe(TARGET_W)
    expect(target.originalImageHeight).toBe(NEW_H)
    expect(target.c3InstanceArray?.[2]).toBe(CELL_W)
    expect(target.c3InstanceArray?.[3]).toBe(CELL_H)
    expect(target.c3InstanceArray?.[4]).toBe(CHARSET)
    expect(target.c3AppendedEntries.map((e) => e.char)).toEqual(['Ю', 'Я'])
    expect(appendedCellPosition(target, 1)).toEqual({ x: CELL_W, y: 2 * CELL_H })
    expect(C3GenerationStorage.readActiveC3Generation()?.c3Config.imageAssetId).toBeDefined()
  })
})
