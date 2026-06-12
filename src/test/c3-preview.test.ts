import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useEditorStore } from '@/stores/editor'
import C3Preview from '@/components/C3Preview.vue'
import type { C3InstanceArray, C3ParsedData } from '@/utils/c3-parser'

function createMockImage(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img')
  Object.defineProperties(img, {
    width: { value: width },
    height: { value: height },
    complete: { value: true },
  })
  return img
}

function createParsedData(): C3ParsedData {
  return {
    characterWidth: 32,
    characterHeight: 32,
    characterSet: ['A', 'B', 'C', 'D'],
    spacingData: '[]',
    characterSpacing: 0,
    lineHeight: 0,
    displayWidthMap: new Map(),
    spaceWidth: null,
    rawArray: ['', true, 32, 32, 'ABCD', '[]', 0, 0, 0, 0, 0, 0, true, null, false] as C3InstanceArray,
  }
}

describe('C3Preview', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders preview canvas after importing C3 sprite font', async () => {
    const wrapper = mount(C3Preview)
    const store = useEditorStore()

    const image = createMockImage(256, 64)
    store.importC3SpriteFont(
      image,
      ['', true, 32, 32, 'ABCD', '[]', 0, 0, 0, 0, 0, 0, true, null, false],
      createParsedData(),
      'test.png',
      256,
      64,
    )

    await nextTick()
    await nextTick()
    await nextTick()

    const canvas = wrapper.find('canvas').element
    expect(canvas).toBeTruthy()
    expect(canvas.width).toBeGreaterThan(0)
    expect(canvas.height).toBeGreaterThan(0)
  })

  it('updates sample text when a new C3 font is imported', async () => {
    const wrapper = mount(C3Preview)
    const store = useEditorStore()

    const image = createMockImage(256, 64)
    store.importC3SpriteFont(
      image,
      ['', true, 32, 32, 'ABCD', '[]', 0, 0, 0, 0, 0, 0, true, null, false],
      createParsedData(),
      'test.png',
      256,
      64,
    )

    await nextTick()

    const input = wrapper.find('input.sample-input')
    expect((input.element as HTMLInputElement).value).toBe('ABCD')
  })
})
