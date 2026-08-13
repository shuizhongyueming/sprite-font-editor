import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import Toolbar from '@/components/Toolbar.vue'
import { useEditorStore } from '@/stores/editor'
import type { C3InstanceArray } from '@/utils/c3-parser'
import type { C3CompactionPlan } from '@/utils/c3-compaction'
import * as c3CompactionModule from '@/utils/c3-compaction'
import { notify } from '@/utils/notification'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage } from './helpers/fake-image'
import { resetFakeIndexedDB } from './fake-indexeddb'

function makeArray(): C3InstanceArray {
  return [
    'Sample',
    true,
    16,
    16,
    'AB',
    '[]',
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

function makeSource() {
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

describe('Toolbar compact button', () => {
  let store: ReturnType<typeof useEditorStore>
  let wrapper: VueWrapper
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    resetFakeIndexedDB()
    installMemoryLocalStorage()
    vi.spyOn(c3CompactionModule, 'verifyCanvasAlphaRoundTrip').mockReturnValue(true)
    pinia = createPinia()
    setActivePinia(pinia)
    store = useEditorStore()
    wrapper = mount(Toolbar, {
      global: { plugins: [pinia] },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    wrapper.unmount()
  })

  async function enterC3Mode() {
    store.isC3Mode = true
    store.c3ImportedImage = new FakeImage(32, 32) as unknown as HTMLImageElement
    store.c3InstanceArray = makeArray()
    await nextTick()
  }

  it('is hidden in normal mode and visible in C3 mode with an imported baseline', async () => {
    expect(wrapper.find('.btn-compact').exists()).toBe(false)

    await enterC3Mode()
    expect(wrapper.find('.btn-compact').exists()).toBe(true)
    // 文案/标题由 i18n 提供（默认英文 'Compact'，中文环境 '精简'）
    expect(wrapper.find('.btn-compact').text().trim().length).toBeGreaterThan(0)
    expect(wrapper.find('.btn-compact').attributes('title')).toBeTruthy()
    // aria-label 使用完整短标题（c3CompactButtonTitle），title 保留完整 tooltip
    expect(wrapper.find('.btn-compact').attributes('aria-label')).toBeTruthy()
    expect(wrapper.find('.btn-compact').attributes('aria-label')).not.toBe(
      wrapper.find('.btn-compact').attributes('title'),
    )
  })

  it('reports no-savings without opening the modal', async () => {
    await enterC3Mode()
    const infoSpy = vi.spyOn(notify, 'info')
    vi.spyOn(store, 'prepareC3Compaction').mockReturnValue({
      kind: 'no-savings',
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    await wrapper.find('.btn-compact').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()

    expect(infoSpy).toHaveBeenCalled()
    expect(wrapper.find('.c3-compaction-modal').exists()).toBe(false)
  })

  it('maps typed errors to user notifications and stays closed', async () => {
    await enterC3Mode()
    const errorSpy = vi.spyOn(notify, 'error')
    vi.spyOn(store, 'prepareC3Compaction').mockReturnValue({
      kind: 'error',
      code: 'alpha-roundtrip-failed',
    })

    await wrapper.find('.btn-compact').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()

    expect(errorSpy).toHaveBeenCalled()
    expect(wrapper.find('.c3-compaction-modal').exists()).toBe(false)
  })

  it('maps invalid-spacing-data to a user notification and does not open the modal', async () => {
    await enterC3Mode()
    const errorSpy = vi.spyOn(notify, 'error')
    vi.spyOn(store, 'prepareC3Compaction').mockReturnValue({
      kind: 'error',
      code: 'invalid-spacing-data',
    })

    await wrapper.find('.btn-compact').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()

    expect(errorSpy).toHaveBeenCalled()
    expect(wrapper.find('.c3-compaction-modal').exists()).toBe(false)
  })

  it('opens the modal when a plan is prepared', async () => {
    await enterC3Mode()
    vi.spyOn(store, 'prepareC3Compaction').mockReturnValue({
      kind: 'plan',
      plan: makePlan(),
      repacked: new ImageData(32, 9),
      source: makeSource(),
      oldGrid: { originX: 0, originY: 0, columns: 2 },
    })

    await wrapper.find('.btn-compact').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()

    expect(wrapper.find('.c3-compaction-modal').exists()).toBe(true)
  })

  it('notifies and recovers when prepare throws', async () => {
    await enterC3Mode()
    const errorSpy = vi.spyOn(notify, 'error')
    vi.spyOn(store, 'prepareC3Compaction').mockImplementation(() => {
      throw new Error('boom')
    })

    await wrapper.find('.btn-compact').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()

    expect(errorSpy).toHaveBeenCalled()
    expect(wrapper.find('.c3-compaction-modal').exists()).toBe(false)
  })

  it('shows the busy/disabled state before the synchronous analysis runs', async () => {
    await enterC3Mode()
    let prepareCalled = false
    vi.spyOn(store, 'prepareC3Compaction').mockImplementation(() => {
      prepareCalled = true
      return { kind: 'no-savings', crop: { top: 0, right: 0, bottom: 0, left: 0 } }
    })

    // 同步派发 click：handler 执行到第一个 await（nextTick）即挂起
    wrapper.find('.btn-compact').element.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
    await nextTick()

    // 分析让出绘制（macrotask）期间：busy/disabled 已可观察，prepare 尚未调用
    expect(prepareCalled).toBe(false)
    expect(wrapper.find('.btn-compact').attributes('disabled')).toBeDefined()

    // 让出 macrotask 后同步分析才执行
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(prepareCalled).toBe(true)
    await nextTick()
    expect(wrapper.find('.btn-compact').attributes('disabled')).toBeUndefined()
  })
})
