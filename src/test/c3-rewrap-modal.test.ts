import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import C3RewrapModal from '@/components/C3RewrapModal.vue'
import { useEditorStore } from '@/stores/editor'
import type { C3RewrapPreparationResult } from '@/stores/editor'
import { parseC3InstanceArray } from '@/utils/c3-parser'
import * as c3CompactionModule from '@/utils/c3-compaction'
import { notify } from '@/utils/notification'
import { setLanguage, t } from '@/utils/i18n'
import { installMemoryLocalStorage } from './helpers/memory-local-storage'
import { FakeImage } from './helpers/fake-image'
import { createSampleArray, makePngBlob, makeSource } from './helpers/c3-fixtures'
import { resetFakeIndexedDB } from './fake-indexeddb'

/**
 * 弹窗内 prepare 的替身：纯几何产出 plan/repacked（cw=ch=16，2 个导入字符），
 * 列数不变（width 32-47）时返回 no-layout-change。
 */
function fakePrepare(
  width: number,
  options?: { outputHeight?: number },
): C3RewrapPreparationResult {
  const columns = Math.floor(width / 16)
  if (columns === 2) {
    return { kind: 'no-layout-change', oldColumns: 2, targetWidth: width }
  }
  const rows = Math.ceil(2 / columns)
  const tiling = rows * 16
  const outputHeight = options?.outputHeight ?? tiling
  return {
    kind: 'plan',
    plan: {
      kind: 'plan',
      targetWidth: width,
      newColumns: columns,
      newRows: rows,
      newImageHeight: tiling,
      importedCount: 2,
      oldColumns: 2,
      oldFontSpriteWidth: 32,
      oldFinalTextureHeight: 16,
    },
    repacked: new ImageData(width, outputHeight),
    source: makeSource(),
  }
}

describe('C3RewrapModal', () => {
  let store: ReturnType<typeof useEditorStore>
  let wrapper: VueWrapper
  let pinia: ReturnType<typeof createPinia>
  let prepareSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    resetFakeIndexedDB()
    installMemoryLocalStorage()
    setLanguage('en-US')
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
    prepareSpy = vi
      .spyOn(store, 'prepareC3Rewrap')
      .mockImplementation((width: number, options?: { outputHeight?: number }) =>
        fakePrepare(width, options),
      )
    wrapper = mount(C3RewrapModal, {
      props: { visible: true },
      global: { plugins: [pinia] },
      attachTo: document.body,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    wrapper.unmount()
  })

  function applyButton() {
    return wrapper.findAll('footer .btn')[1]
  }

  /** 等待自定义输入路径的 150ms prepare debounce 落定 */
  async function flushPrepareDebounce() {
    await new Promise((resolve) => setTimeout(resolve, 160))
    await nextTick()
  }

  it('renders preset chips with column × row → height annotations and a unique most-square marker', () => {
    const chips = wrapper.findAll('.width-chip')
    expect(chips).toHaveLength(4)
    // 512/1024/2048/4096 均可用（即使远大于当前宽度 32）
    for (const chip of chips) {
      expect(chip.attributes('disabled')).toBeUndefined()
    }
    // 每个 chip 标注「列数 × 行数 → 新高度」（2 字符：各宽度均 1 行 16px 高）
    const annotations = chips.map((chip) => chip.find('.width-chip__annotation').text())
    expect(annotations).toEqual([
      '32 × 1 → 16',
      '64 × 1 → 16',
      '128 × 1 → 16',
      '256 × 1 → 16',
    ])
    // 最方标记唯一（512×16 最接近正方形）
    expect(wrapper.findAll('.width-chip--most-square')).toHaveLength(1)
    expect(wrapper.findAll('.width-chip__badge')).toHaveLength(1)
    expect(chips[0].find('.width-chip__badge').exists()).toBe(true)
  })

  it('selects the most square layout-changing preset on open and prepares it', () => {
    expect(prepareSpy).toHaveBeenCalledWith(512, undefined)
    expect(wrapper.find('.width-chip--active').exists()).toBe(true)
    // 指标行反映当前 prepare 结果
    expect(wrapper.find('.metrics').text()).toContain('512')
    expect(wrapper.find('.metrics').text()).toContain('2 → 32')
  })

  it('marks presets below the character width as disabled with a reason title', async () => {
    store.baseCellConfig.width = 600
    store.baseCellConfig.height = 600
    await nextTick()

    const chips = wrapper.findAll('.width-chip')
    // 512 < characterWidth 600：禁用 chip 保留且 title 说明原因（不静默消失）
    expect(chips[0].attributes('disabled')).toBeDefined()
    expect(chips[0].attributes('title')).toContain('600')
    expect(chips[1].attributes('disabled')).toBeUndefined()
    // 输入层同时拒绝 512：错误提示 + 应用禁用
    expect(wrapper.find('.width-selector__error').text()).toContain('600')
    expect(applyButton().attributes('disabled')).toBeDefined()
  })

  it('updates metrics and the new sprite preview when a chip is selected', async () => {
    await wrapper.findAll('.width-chip')[1].trigger('click')
    await nextTick()

    expect(prepareSpy).toHaveBeenCalledWith(1024, undefined)
    expect(wrapper.find('.metrics').text()).toContain('1024')
    const newCanvas = wrapper.findAll('.sprite-view__pane canvas')[1]
      .element as HTMLCanvasElement
    expect(newCanvas.width).toBe(1024)
    expect(newCanvas.height).toBe(16)
  })

  it('runs chip selection immediately and cancels a pending input debounce', async () => {
    await wrapper.find('[data-testid="rewrap-custom-width"]').setValue('2048')
    await nextTick()
    // 不等待输入 debounce：点击 chip 立即 prepare，并取消 pending 的 2048
    await wrapper.findAll('.width-chip')[0].trigger('click')
    await nextTick()

    expect(prepareSpy).toHaveBeenCalledWith(512, undefined)
    await flushPrepareDebounce()
    expect(
      prepareSpy.mock.calls.some((call: unknown[]) => call[0] === 2048),
    ).toBe(false)
  })

  it('rejects a custom width below the character width at the input layer', async () => {
    await wrapper.find('[data-testid="rewrap-custom-width"]').setValue('8')
    await nextTick()

    expect(wrapper.find('.width-selector__error').text()).toContain('16')
    expect(applyButton().attributes('disabled')).toBeDefined()
    expect(prepareSpy.mock.calls.some((call: unknown[]) => call[0] === 8)).toBe(false)
  })

  it('shows the no-layout-change notice and disables apply for an unchanged column count', async () => {
    await wrapper.find('[data-testid="rewrap-custom-width"]').setValue('32')
    await flushPrepareDebounce()

    expect(prepareSpy).toHaveBeenCalledWith(32, undefined)
    expect(wrapper.find('.issue-banner').text()).toContain(
      t('c3RewrapNoLayoutChange'),
    )
    expect(wrapper.find('.issue-banner').classes()).toContain('issue-banner--info')
    expect(applyButton().attributes('disabled')).toBeDefined()
  })

  it('rejects a custom height below the exact tiling height at the input layer', async () => {
    await wrapper.find('[data-testid="rewrap-custom-width"]').setValue('16')
    await nextTick()
    await wrapper.find('[data-testid="rewrap-custom-height"]').setValue('16')
    await nextTick()

    // width 16 → 1 列 2 行 → 密铺高度 32；输入 16 被输入层拒绝
    expect(wrapper.find('.width-selector__error').text()).toContain('32')
    expect(applyButton().attributes('disabled')).toBeDefined()
    expect(
      prepareSpy.mock.calls.some(
        (call: unknown[]) =>
          (call[1] as { outputHeight?: number } | undefined)?.outputHeight === 16,
      ),
    ).toBe(false)
  })

  it('prepares with a custom output height and grows the new sprite preview', async () => {
    await wrapper.find('[data-testid="rewrap-custom-width"]').setValue('16')
    await wrapper.find('[data-testid="rewrap-custom-height"]').setValue('48')
    await flushPrepareDebounce()

    expect(prepareSpy).toHaveBeenCalledWith(16, { outputHeight: 48 })
    expect(wrapper.find('.metrics').text()).toContain('16×48')
    const newCanvas = wrapper.findAll('.sprite-view__pane canvas')[1]
      .element as HTMLCanvasElement
    expect(newCanvas.width).toBe(16)
    expect(newCanvas.height).toBe(48)
    expect(applyButton().attributes('disabled')).toBeUndefined()
  })

  it('renders real C3 text previews for old and new baselines', async () => {
    await wrapper.findAll('.view-tabs__tab')[1].trigger('click')
    await nextTick()

    const textCanvases = wrapper.findAll('.text-view__canvas')
    expect(textCanvases).toHaveLength(2)
    expect((textCanvases[0].element as HTMLCanvasElement).height).toBeGreaterThan(0)
    expect((textCanvases[1].element as HTMLCanvasElement).height).toBeGreaterThan(0)
  })

  it('cancel closes without changing the store', async () => {
    const configBefore = JSON.stringify(store.baseCellConfig)
    await wrapper.findAll('footer .btn')[0].trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(JSON.stringify(store.baseCellConfig)).toBe(configBefore)
  })

  it('apply succeeds through the atomic seam and closes', async () => {
    const preparation = fakePrepare(512)
    if (preparation.kind !== 'plan') throw new Error('expected plan')
    const applySpy = vi
      .spyOn(store, 'applyC3SpriteRewrap')
      .mockResolvedValue({ ok: true, plan: preparation.plan })
    const successSpy = vi.spyOn(notify, 'success')

    await applyButton().trigger('click')
    await nextTick()
    await nextTick()

    expect(applySpy).toHaveBeenCalledWith(preparation.plan, preparation.repacked)
    expect(successSpy).toHaveBeenCalled()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('apply typed failure keeps the modal open and notifies', async () => {
    const errorSpy = vi.spyOn(notify, 'error')
    vi.spyOn(store, 'applyC3SpriteRewrap').mockResolvedValue({
      ok: false,
      code: 'persistence-failed',
    })

    await applyButton().trigger('click')
    await nextTick()
    await nextTick()

    expect(errorSpy).toHaveBeenCalled()
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.find('.c3-rewrap-modal').exists()).toBe(true)
  })

  it('prevents repeated apply clicks while applying', async () => {
    let resolveApply!: (value: { ok: boolean }) => void
    const applySpy = vi
      .spyOn(store, 'applyC3SpriteRewrap')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveApply = resolve as (value: { ok: boolean }) => void
          }),
      )

    await applyButton().trigger('click')
    await nextTick()
    await applyButton().trigger('click')
    await nextTick()

    expect(applySpy).toHaveBeenCalledTimes(1)
    resolveApply({ ok: true })
    await nextTick()
    await nextTick()
  })

  it('closes on Escape but ignores Escape while applying', async () => {
    const panel = wrapper.find('.c3-rewrap-modal__panel')
    panel.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)

    let resolveApply!: (value: { ok: boolean }) => void
    vi.spyOn(store, 'applyC3SpriteRewrap').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApply = resolve as (value: { ok: boolean }) => void
        }),
    )
    await applyButton().trigger('click')
    await nextTick()
    panel.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
    resolveApply({ ok: true })
    await nextTick()
  })

  it('focuses the first control and traps Tab within the modal', async () => {
    await nextTick()
    const firstChip = wrapper.find('.width-chip').element as HTMLElement
    expect(document.activeElement).toBe(firstChip)

    const focusables = wrapper
      .findAll('button:not([disabled]), input')
      .map((el) => el.element as HTMLElement)
    const last = focusables[focusables.length - 1]

    last.focus()
    last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    )
    await nextTick()
    expect(document.activeElement).toBe(firstChip)

    firstChip.focus()
    firstChip.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    )
    await nextTick()
    expect(document.activeElement).toBe(last)
  })

  it('blocks underlying document/window key handlers while open', async () => {
    const docHandler = vi.fn()
    const winHandler = vi.fn()
    document.addEventListener('keydown', docHandler)
    window.addEventListener('keydown', winHandler)
    try {
      await nextTick()
      const chip = wrapper.find('.width-chip').element as HTMLElement
      chip.focus()

      chip.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }),
      )
      chip.dispatchEvent(
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
