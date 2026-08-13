import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import C3CompactionModal from '@/components/C3CompactionModal.vue'
import { useEditorStore } from '@/stores/editor'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import type { C3CompactionPlan, C3CompactionSource } from '@/utils/c3-compaction'
import * as c3CompactionModule from '@/utils/c3-compaction'
import { notify } from '@/utils/notification'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage } from './helpers/fake-image'
import { createSampleArray, makePngBlob } from './helpers/c3-fixtures'
import { resetFakeIndexedDB } from './fake-indexeddb'

function makePlan(): C3CompactionPlan {
  return {
    kind: 'plan',
    crop: { top: 0, right: 1, bottom: 7, left: 1 },
    newCharacterWidth: 14,
    newCharacterHeight: 9,
    newColumns: 2,
    newImageWidth: 32,
    newImageHeight: 9,
    importedCount: 2,
    oldFinalTextureHeight: 16,
    newFinalTextureHeight: 9,
    cellExtents: [],
  }
}

function makeSource(): C3CompactionSource {
  return {
    fontSpriteWidth: 32,
    fontSpriteHeight: 32,
    characterWidth: 16,
    characterHeight: 16,
    imageMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    imagePadding: { top: 0, right: 0, bottom: 0, left: 0 },
    importedCharacterSet: ['A', 'B'],
    appendedCharacterCount: 0,
  }
}

describe('C3CompactionModal', () => {
  let store: ReturnType<typeof useEditorStore>
  let wrapper: VueWrapper
  let pinia: ReturnType<typeof createPinia>
  const plan = makePlan()
  const source = makeSource()
  const repacked = new ImageData(32, 9)

  beforeEach(async () => {
    resetFakeIndexedDB()
    installMemoryLocalStorage()
    vi.spyOn(c3CompactionModule, 'verifyCanvasAlphaRoundTrip').mockReturnValue(true)
    pinia = createPinia()
    setActivePinia(pinia)
    store = useEditorStore()
    const image = new FakeImage(32, 32)
    const array = createSampleArray('AB', '[]')
    const parsed = parseC3InstanceArray(JSON.stringify(array))
    await store.importC3SpriteFont(
      image as unknown as HTMLImageElement,
      array,
      parsed,
      'c3-sprite.png',
      32,
      32,
      'image/png',
      makePngBlob(),
    )
    wrapper = mount(C3CompactionModal, {
      props: {
        visible: true,
        plan,
        repacked,
        source,
        oldGrid: { originX: 0, originY: 0, columns: 2 },
      },
      global: { plugins: [pinia] },
      attachTo: document.body,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    wrapper.unmount()
  })

  it('renders metrics, sprite previews and caveats', () => {
    expect(wrapper.find('.c3-compaction-modal').exists()).toBe(true)
    // 指标条包含 cell / 列数 / RGBA 等
    expect(wrapper.text()).toContain('16×16')
    expect(wrapper.text()).toContain('14×9')
    // Sprite 双预览 canvas 尺寸来自真实图片与 repacked 数据
    const canvases = wrapper.findAll('.sprite-view__pane canvas')
    expect(canvases).toHaveLength(2)
    expect((canvases[0].element as HTMLCanvasElement).width).toBe(32)
    expect((canvases[0].element as HTMLCanvasElement).height).toBe(32)
    expect((canvases[1].element as HTMLCanvasElement).width).toBe(32)
    expect((canvases[1].element as HTMLCanvasElement).height).toBe(9)
  })

  it('renders real C3 text previews for old and new baselines', async () => {
    const tabs = wrapper.findAll('.view-tabs__tab')
    expect(tabs).toHaveLength(2)
    await tabs[1].trigger('click')
    await nextTick()

    const textCanvases = wrapper.findAll('.text-view__canvas')
    expect(textCanvases).toHaveLength(2)
    const oldHeight = (textCanvases[0].element as HTMLCanvasElement).height
    const newHeight = (textCanvases[1].element as HTMLCanvasElement).height
    expect(oldHeight).toBeGreaterThan(0)
    expect(newHeight).toBeGreaterThan(0)
  })

  it('shows the real old grid column count from the candidate', async () => {
    // 非零 origin / 有效列数 3 的旧网格（与核心 computeOldGrid 一致）
    await wrapper.setProps({
      oldGrid: { originX: 12, originY: 10, columns: 3 },
    })
    await nextTick()
    expect(wrapper.text()).toContain('3 → 2')
  })

  it('notifies when canvas rendering fails (context unavailable)', async () => {
    const errorSpy = vi.spyOn(notify, 'error')
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
    try {
      // 切到 C3 文本 tab：imageToCanvas/imageDataToCanvas 抛错 → fail closed + notify
      await wrapper.findAll('.view-tabs__tab')[1].trigger('click')
      await nextTick()
      await nextTick()
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext
    }
  })

  it('cancel closes without changing the store', async () => {
    const configBefore = JSON.stringify(store.baseCellConfig)
    await wrapper.findAll('footer .btn')[0].trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(JSON.stringify(store.baseCellConfig)).toBe(configBefore)
  })

  it('apply succeeds through the atomic seam and closes', async () => {
    const applySpy = vi
      .spyOn(store, 'applyC3SpriteCompaction')
      .mockResolvedValue({ ok: true, plan })
    const successSpy = vi.spyOn(notify, 'success')

    await wrapper.findAll('footer .btn')[1].trigger('click')
    await nextTick()
    await nextTick()

    expect(applySpy).toHaveBeenCalledWith(plan, repacked)
    expect(successSpy).toHaveBeenCalled()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('apply typed failure keeps the modal and notifies', async () => {
    vi.spyOn(store, 'applyC3SpriteCompaction').mockResolvedValue({
      ok: false,
      code: 'persistence-failed',
    })
    const errorSpy = vi.spyOn(notify, 'error')

    await wrapper.findAll('footer .btn')[1].trigger('click')
    await nextTick()
    await nextTick()

    expect(errorSpy).toHaveBeenCalled()
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.find('.c3-compaction-modal').exists()).toBe(true)
  })

  it('prevents repeated apply clicks while applying', async () => {
    let resolveApply!: (value: { ok: boolean }) => void
    const applySpy = vi
      .spyOn(store, 'applyC3SpriteCompaction')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveApply = resolve as (value: { ok: boolean }) => void
          }),
      )

    const applyButton = wrapper.findAll('footer .btn')[1]
    await applyButton.trigger('click')
    await nextTick()
    await applyButton.trigger('click')
    await nextTick()

    expect(applySpy).toHaveBeenCalledTimes(1)
    resolveApply({ ok: true })
    await nextTick()
    await nextTick()
  })

  it('focuses the first control and traps Tab within the modal', async () => {
    await nextTick()
    // 打开时聚焦模态内第一个可聚焦控件（Sprite tab）
    const firstTab = wrapper.find('.view-tabs__tab').element as HTMLElement
    expect(document.activeElement).toBe(firstTab)

    const focusables = wrapper
      .findAll('button:not([disabled]), input')
      .map((el) => el.element as HTMLElement)
    const last = focusables[focusables.length - 1]

    // Tab 从最后一个回到第一个（从面板内派发，冒泡到 @keydown.stop）
    last.focus()
    last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    )
    await nextTick()
    expect(document.activeElement).toBe(firstTab)

    // Shift+Tab 从第一个回到最后一个
    firstTab.focus()
    firstTab.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
      }),
    )
    await nextTick()
    expect(document.activeElement).toBe(last)
  })

  it('closes on Escape but ignores Escape while applying', async () => {
    const panel = wrapper.find('.c3-compaction-modal__panel')
    panel.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)

    // applying 中 Escape 被忽略
    let resolveApply!: (value: { ok: boolean }) => void
    vi.spyOn(store, 'applyC3SpriteCompaction').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApply = resolve as (value: { ok: boolean }) => void
        }),
    )
    await wrapper.findAll('footer .btn')[1].trigger('click')
    await nextTick()
    panel.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
    resolveApply({ ok: true })
    await nextTick()
  })

  it('blocks underlying document/window key handlers while open', async () => {
    // 模拟底层编辑器注册的全局键盘监听（保存快捷键 / Canvas Space-pan）
    const docHandler = vi.fn()
    const winHandler = vi.fn()
    document.addEventListener('keydown', docHandler)
    window.addEventListener('keydown', winHandler)
    try {
      await nextTick()
      const tab = wrapper.find('.view-tabs__tab').element as HTMLElement
      tab.focus()

      // 从模态内触发 Ctrl/Cmd+S 与 Space：事件被 panel @keydown.stop 截断
      tab.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }),
      )
      tab.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
      )
      await nextTick()

      expect(docHandler).not.toHaveBeenCalled()
      expect(winHandler).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', docHandler)
      window.removeEventListener('keydown', winHandler)
    }
  })
})
