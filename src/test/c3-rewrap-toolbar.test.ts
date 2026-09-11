import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import Toolbar from '@/components/Toolbar.vue'
import { useEditorStore } from '@/stores/editor'
import type { C3RewrapPreparationResult } from '@/stores/editor'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import * as c3CompactionModule from '@/utils/c3-compaction'
import { setLanguage } from '@/utils/i18n'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage } from './helpers/fake-image'
import { createSampleArray, makePngBlob, makeSource } from './helpers/c3-fixtures'
import { resetFakeIndexedDB } from './fake-indexeddb'

function fakePrepare(width: number): C3RewrapPreparationResult {
  const columns = Math.floor(width / 16)
  if (columns === 2) {
    return { kind: 'no-layout-change', oldColumns: 2, targetWidth: width }
  }
  const rows = Math.ceil(2 / columns)
  return {
    kind: 'plan',
    plan: {
      kind: 'plan',
      targetWidth: width,
      newColumns: columns,
      newRows: rows,
      newImageHeight: rows * 16,
      importedCount: 2,
      oldColumns: 2,
      oldFontSpriteWidth: 32,
      oldFinalTextureHeight: 16,
    },
    repacked: new ImageData(width, rows * 16),
    source: makeSource(),
  }
}

describe('Toolbar re-wrap button', () => {
  let store: ReturnType<typeof useEditorStore>
  let wrapper: VueWrapper
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    resetFakeIndexedDB()
    installMemoryLocalStorage()
    setLanguage('en-US')
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
    await nextTick()
  }

  it('is hidden in normal mode and visible in C3 mode next to the compact button', async () => {
    expect(wrapper.find('.btn-rewrap').exists()).toBe(false)

    await enterC3Mode()
    const button = wrapper.find('.btn-rewrap')
    expect(button.exists()).toBe(true)
    // 紧邻精简按钮（C3 区前两位操作）
    const c3Buttons = wrapper.findAll('.btn-compact, .btn-rewrap')
    expect(c3Buttons).toHaveLength(2)
    expect(c3Buttons[1].classes()).toContain('btn-rewrap')
    expect(button.text().trim().length).toBeGreaterThan(0)
    expect(button.attributes('title')).toBeTruthy()
    expect(button.attributes('aria-label')).toBeTruthy()
    expect(button.attributes('aria-label')).not.toBe(button.attributes('title'))
  })

  it('opens the modal instantly with the prepared candidate (no analysis wait)', async () => {
    await enterC3Mode()
    const prepareSpy = vi
      .spyOn(store, 'prepareC3Rewrap')
      .mockImplementation((width: number) => fakePrepare(width))

    await wrapper.find('.btn-rewrap').trigger('click')
    await nextTick()

    // 纯几何计算同步完成：弹窗立即出现并携带 prepare 结果
    expect(wrapper.find('.c3-rewrap-modal').exists()).toBe(true)
    expect(prepareSpy).toHaveBeenCalled()
    expect(wrapper.find('.metrics').text()).toContain('512')
  })

  it('surfaces a typed prepare failure inside the modal instead of notifying', async () => {
    await enterC3Mode()
    vi.spyOn(store, 'prepareC3Rewrap').mockReturnValue({
      kind: 'error',
      code: 'content-outside-imported-cells',
    })

    await wrapper.find('.btn-rewrap').trigger('click')
    await nextTick()

    // 弹窗照常打开（即时打开），阻断错误以 typed 文案展示且应用禁用
    expect(wrapper.find('.c3-rewrap-modal').exists()).toBe(true)
    expect(wrapper.find('.issue-banner').text()).toContain(
      'outside the imported character cells',
    )
    const footerButtons = wrapper.findAll('.c3-rewrap-modal footer .btn')
    expect(footerButtons[1].attributes('disabled')).toBeDefined()
  })

  it('closes the modal through the cancel flow without touching the store', async () => {
    await enterC3Mode()
    vi.spyOn(store, 'prepareC3Rewrap').mockImplementation((width: number) =>
      fakePrepare(width),
    )

    await wrapper.find('.btn-rewrap').trigger('click')
    await nextTick()
    expect(wrapper.find('.c3-rewrap-modal').exists()).toBe(true)

    const configBefore = JSON.stringify(store.baseCellConfig)
    await wrapper.findAll('.c3-rewrap-modal footer .btn')[0].trigger('click')
    await nextTick()

    expect(wrapper.find('.c3-rewrap-modal').exists()).toBe(false)
    expect(JSON.stringify(store.baseCellConfig)).toBe(configBefore)
  })
})
