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
    it('shows only the first 12 imported characters by default when there are more', async () => {
      const store = useEditorStore()
      const chars = Array.from({ length: 14 }, (_, i) => String.fromCharCode(65 + i)).join('')
      importC3Font(store, chars)

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const importedSection = wrapper.findAll('.character-section')[0]
      const items = importedSection.findAll('.character-item')
      expect(items.length).toBe(12)

      const toggleBtn = importedSection.find('.button-group--toggle-only .btn-outline-secondary')
      expect(toggleBtn.exists()).toBe(true)
      expect(toggleBtn.text()).toBe('Show more')
    })

    it('shows all imported characters after clicking show more', async () => {
      const store = useEditorStore()
      const chars = Array.from({ length: 14 }, (_, i) => String.fromCharCode(65 + i)).join('')
      importC3Font(store, chars)

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const importedSection = wrapper.findAll('.character-section')[0]
      const toggleBtn = importedSection.find('.button-group--toggle-only .btn-outline-secondary')
      await toggleBtn.trigger('click')
      await nextTick()

      const items = importedSection.findAll('.character-item')
      expect(items.length).toBe(14)
      expect(toggleBtn.text()).toBe('Show less')
    })

    it('does not show the toggle button when imported characters are 12 or fewer', async () => {
      const store = useEditorStore()
      importC3Font(store, 'ABCDEFGHIJKL')

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const importedSection = wrapper.findAll('.character-section')[0]
      const items = importedSection.findAll('.character-item')
      expect(items.length).toBe(12)

      const toggleBtn = importedSection.find('.button-group--toggle-only .btn-outline-secondary')
      expect(toggleBtn.exists()).toBe(false)
    })

    it('makes the imported characters button group sticky', async () => {
      const store = useEditorStore()
      const chars = Array.from({ length: 14 }, (_, i) => String.fromCharCode(65 + i)).join('')
      importC3Font(store, chars)

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const importedSection = wrapper.findAll('.character-section')[0]
      const buttonGroup = importedSection.find('.button-group')
      const style = getComputedStyle(buttonGroup.element)

      expect(style.position).toBe('sticky')
      expect(style.bottom).toBe('0px')
      expect(style.backgroundColor).toBe('rgb(248, 249, 250)')
    })
  })

  describe('appended characters', () => {
    it('shows only the first 12 appended characters by default when there are more', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(Array.from({ length: 14 }, (_, i) => String.fromCharCode(65 + i)))

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const appendedSection = wrapper.findAll('.character-section')[1]
      const items = appendedSection.findAll('.character-item')
      expect(items.length).toBe(12)

      const toggleBtn = appendedSection.find('.button-group__actions .btn-outline-secondary')
      expect(toggleBtn.exists()).toBe(true)
      expect(toggleBtn.text()).toBe('Show more')
    })

    it('shows all appended characters after clicking show more', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(Array.from({ length: 14 }, (_, i) => String.fromCharCode(65 + i)))

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const appendedSection = wrapper.findAll('.character-section')[1]
      const toggleBtn = appendedSection.find('.button-group__actions .btn-outline-secondary')
      await toggleBtn.trigger('click')
      await nextTick()

      const items = appendedSection.findAll('.character-item')
      expect(items.length).toBe(14)
      expect(toggleBtn.text()).toBe('Show less')
    })

    it('does not show the toggle button when appended characters are 12 or fewer', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'])

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const appendedSection = wrapper.findAll('.character-section')[1]
      const items = appendedSection.findAll('.character-item')
      expect(items.length).toBe(10)

      const toggleBtn = appendedSection.find('.button-group__actions .btn-outline-secondary')
      expect(toggleBtn.exists()).toBe(false)
    })

    it('makes the appended characters button group sticky', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(['C', 'D'])

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const appendedSection = wrapper.findAll('.character-section')[1]
      const buttonGroup = appendedSection.find('.button-group')
      const style = getComputedStyle(buttonGroup.element)

      expect(style.position).toBe('sticky')
      expect(style.bottom).toBe('0px')
      expect(style.backgroundColor).toBe('rgb(248, 249, 250)')
    })

    it('resets expansion when clearing all appended characters', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(Array.from({ length: 14 }, (_, i) => String.fromCharCode(65 + i)))

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const appendedSection = wrapper.findAll('.character-section')[1]
      const toggleBtn = appendedSection.find('.button-group__actions .btn-outline-secondary')
      await toggleBtn.trigger('click')
      await nextTick()

      expect(appendedSection.findAll('.character-item').length).toBe(14)

      const clearBtn = appendedSection.find('.button-group__actions .btn-outline-danger')
      await clearBtn.trigger('click')
      await nextTick()

      expect(store.c3AppendedEntries.length).toBe(0)
      expect(wrapper.findAll('.character-section').length).toBe(1)
    })

    it('selects the correct appended character by original index when collapsed', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(Array.from({ length: 14 }, (_, i) => String.fromCharCode(65 + i)))

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const appendedSection = wrapper.findAll('.character-section')[1]
      const items = appendedSection.findAll('.character-item')
      await items[5]!.trigger('click')
      await nextTick()

      expect(store.selectedCharIndex).toBe(5)
    })
  })

  describe('append input', () => {
    it('appends characters when clicking the append button', async () => {
      const store = useEditorStore()
      importC3Font(store)

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const textarea = wrapper.find('.form-group textarea')
      await textarea.setValue('CD')
      await nextTick()

      const appendBtn = wrapper.find('.append-btn')
      expect(appendBtn.exists()).toBe(true)
      expect(appendBtn.attributes('disabled')).toBeUndefined()

      await appendBtn.trigger('click')
      await nextTick()

      expect(store.c3AppendedEntries.map((e) => e.char)).toEqual(['C', 'D'])
      expect(wrapper.find('.success-feedback').exists()).toBe(true)
    })

    it('disables the append button when input is empty', async () => {
      const store = useEditorStore()
      importC3Font(store)

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const appendBtn = wrapper.find('.append-btn')
      expect(appendBtn.attributes('disabled')).toBeDefined()
    })

    it('skips duplicate characters and shows a warning', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(['C'])

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const textarea = wrapper.find('.form-group textarea')
      await textarea.setValue('CDE')
      await nextTick()

      await wrapper.find('.append-btn').trigger('click')
      await nextTick()

      expect(store.c3AppendedEntries.map((e) => e.char)).toEqual(['C', 'D', 'E'])
      const warning = wrapper.find('.warning-feedback')
      expect(warning.exists()).toBe(true)
      expect(warning.text()).toContain('C')
    })

    it('strips space characters on append without warning', async () => {
      const store = useEditorStore()
      importC3Font(store)

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const textarea = wrapper.find('.form-group textarea')
      await textarea.setValue('C D')
      await nextTick()

      await wrapper.find('.append-btn').trigger('click')
      await nextTick()

      expect(store.c3AppendedEntries.map((e) => e.char)).toEqual(['C', 'D'])
      expect(wrapper.find('.warning-feedback').exists()).toBe(false)
    })

    it('strips all Unicode whitespace characters on append', async () => {
      const store = useEditorStore()
      importC3Font(store)

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const textarea = wrapper.find('.form-group textarea')
      // tab, newline, non-breaking space, ideographic space
      await textarea.setValue('C\t\n\u00A0\u3000D')
      await nextTick()

      await wrapper.find('.append-btn').trigger('click')
      await nextTick()

      expect(store.c3AppendedEntries.map((e) => e.char)).toEqual(['C', 'D'])
      expect(wrapper.find('.warning-feedback').exists()).toBe(false)
    })

    it('deduplicates characters within the input itself', async () => {
      const store = useEditorStore()
      importC3Font(store)

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      const textarea = wrapper.find('.form-group textarea')
      await textarea.setValue('CCDD')
      await nextTick()

      await wrapper.find('.append-btn').trigger('click')
      await nextTick()

      expect(store.c3AppendedEntries.map((e) => e.char)).toEqual(['C', 'D'])
    })
  })

  describe('appended character margin popup', () => {
    it('keeps margin.top editable in C3 mode', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(['C'])

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      store.selectedCharIndex = 0
      await nextTick()

      const topInput = wrapper.find('.margin-popup .spacing-input')
      expect(topInput.exists()).toBe(true)
      expect(topInput.attributes('readonly')).toBeUndefined()
      expect(topInput.attributes('disabled')).toBeUndefined()
    })

    it('shows the final top offset for the selected appended character', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(['C'])
      store.c3AppendedEntries[0].distributionOffset = 5
      store.c3AppendedEntries[0].margin.top = 3

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      store.selectedCharIndex = 0
      await nextTick()

      const rows = wrapper.findAll('.display-width-info-row')
      const finalTopOffsetRow = rows.find((row) =>
        row.find('.display-width-info-label').text().includes('Final Top Offset')
      )
      expect(finalTopOffsetRow).toBeDefined()
      expect(finalTopOffsetRow!.find('.display-width-info-value').text()).toBe('8')
    })

    it('shows glyph height and distribution offset for the selected appended character', async () => {
      const store = useEditorStore()
      importC3Font(store)
      store.appendC3Characters(['C'])
      store.c3AppendedEntries[0].autoGlyphHeight = 14
      store.c3AppendedEntries[0].distributionOffset = 4

      wrapper = mount(CharacterInput, { attachTo: document.body })
      await nextTick()

      store.selectedCharIndex = 0
      await nextTick()

      const rows = wrapper.findAll('.display-width-info-row')
      const heightRow = rows.find((row) =>
        row.find('.display-width-info-label').text().includes('Glyph Height')
      )
      const offsetRow = rows.find((row) =>
        row.find('.display-width-info-label').text().includes('Distribution Offset')
      )

      expect(heightRow).toBeDefined()
      expect(offsetRow).toBeDefined()
      expect(heightRow!.find('.display-width-info-value').text()).toBe('14')
      expect(offsetRow!.find('.display-width-info-value').text()).toBe('4')
    })
  })
})
