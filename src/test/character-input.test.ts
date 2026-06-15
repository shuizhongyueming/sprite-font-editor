import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useEditorStore } from '@/stores/editor'
import CharacterInput from '@/components/CharacterInput.vue'
import { parseC3InstanceArray } from '@/utils/c3-parser'

function createImage(width: number, height: number): HTMLImageElement {
  const image = new Image()
  image.width = width
  image.height = height
  return image
}

function createSampleArray(characterSet: string = 'AB'): string {
  return JSON.stringify([
    'Sample',
    true,
    16,
    16,
    characterSet,
    '[]',
    1,
    0,
    0,
    0,
    0,
    0,
    true,
    null,
    false,
  ])
}

function importC3Font(
  store: ReturnType<typeof useEditorStore>,
  characterSet: string = 'AB',
) {
  const rawArray = JSON.parse(createSampleArray(characterSet)) as [
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
  const parsed = parseC3InstanceArray(createSampleArray(characterSet))
  const image = createImage(64, 64)
  store.importC3SpriteFont(image, rawArray, parsed)
}

describe('CharacterInput C3 character list', () => {
  let wrapper: VueWrapper<InstanceType<typeof CharacterInput>>

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.restoreAllMocks()
  })

  describe('imported characters', () => {
    it('shows only the first 10 imported characters by default when there are more', async () => {
      const store = useEditorStore()
      const chars = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)).join('')
      importC3Font(store, chars)

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const importedSection = wrapper.findAll('.character-section')[0]
      const items = importedSection.findAll('.character-item')
      expect(items.length).toBe(10)

      const toggleBtn = importedSection.find('.button-group--toggle-only .btn-outline-secondary')
      expect(toggleBtn.exists()).toBe(true)
      expect(toggleBtn.text()).toBe('Show more')
    })

    it('shows all imported characters after clicking show more', async () => {
      const store = useEditorStore()
      const chars = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)).join('')
      importC3Font(store, chars)

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const importedSection = wrapper.findAll('.character-section')[0]
      const toggleBtn = importedSection.find('.button-group--toggle-only .btn-outline-secondary')
      await toggleBtn.trigger('click')
      await nextTick()

      const items = importedSection.findAll('.character-item')
      expect(items.length).toBe(12)
      expect(toggleBtn.text()).toBe('Show less')
    })

    it('does not show the toggle button when imported characters are 10 or fewer', async () => {
      const store = useEditorStore()
      importC3Font(store, 'ABCDE')

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const importedSection = wrapper.findAll('.character-section')[0]
      const items = importedSection.findAll('.character-item')
      expect(items.length).toBe(5)

      const toggleBtn = importedSection.find('.button-group--toggle-only .btn-outline-secondary')
      expect(toggleBtn.exists()).toBe(false)
    })
  })

  describe('appended characters', () => {
    it('shows only the first 10 appended characters by default when there are more', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)))

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const appendedSection = wrapper.findAll('.character-section')[1]
      const items = appendedSection.findAll('.character-item')
      expect(items.length).toBe(10)

      const toggleBtn = appendedSection.find('.button-group__actions .btn-outline-secondary')
      expect(toggleBtn.exists()).toBe(true)
      expect(toggleBtn.text()).toBe('Show more')
    })

    it('shows all appended characters after clicking show more', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)))

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const appendedSection = wrapper.findAll('.character-section')[1]
      const toggleBtn = appendedSection.find('.button-group__actions .btn-outline-secondary')
      await toggleBtn.trigger('click')
      await nextTick()

      const items = appendedSection.findAll('.character-item')
      expect(items.length).toBe(12)
      expect(toggleBtn.text()).toBe('Show less')
    })

    it('does not show the toggle button when appended characters are 10 or fewer', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(['C', 'D', 'E'])

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const appendedSection = wrapper.findAll('.character-section')[1]
      const items = appendedSection.findAll('.character-item')
      expect(items.length).toBe(3)

      const toggleBtn = appendedSection.find('.button-group__actions .btn-outline-secondary')
      expect(toggleBtn.exists()).toBe(false)
    })

    it('resets expansion when clearing all appended characters', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)))

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const appendedSection = wrapper.findAll('.character-section')[1]
      const toggleBtn = appendedSection.find('.button-group__actions .btn-outline-secondary')
      await toggleBtn.trigger('click')
      await nextTick()

      expect(appendedSection.findAll('.character-item').length).toBe(12)

      const clearBtn = appendedSection.find('.button-group__actions .btn-outline-danger')
      await clearBtn.trigger('click')
      await nextTick()

      expect(store.c3AppendedEntries.length).toBe(0)
      expect(wrapper.findAll('.character-section').length).toBe(1)
    })

    it('selects the correct appended character by original index when collapsed', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)))

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const appendedSection = wrapper.findAll('.character-section')[1]
      const items = appendedSection.findAll('.character-item')
      await items[5]!.trigger('click')
      await nextTick()

      expect(store.selectedCharIndex).toBe(5)
    })
  })
})
