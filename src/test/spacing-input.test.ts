import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SpacingInput from '@/components/SpacingInput.vue'

const baseValue = { top: 1, right: 2, bottom: 3, left: 4 }

describe('SpacingInput disabledSides', () => {
  it('enables all four inputs by default', () => {
    const wrapper = mount(SpacingInput, {
      props: { modelValue: { ...baseValue } },
    })

    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(4)
    for (const input of inputs) {
      expect(input.attributes('disabled')).toBeUndefined()
    }
  })

  it('disables the given sides with an explanatory tooltip', () => {
    const wrapper = mount(SpacingInput, {
      props: {
        modelValue: { ...baseValue },
        disabledSides: { right: '右侧无效', bottom: '下侧无效' },
      },
    })

    const [top, right, bottom, left] = wrapper.findAll('input')
    expect(top.attributes('disabled')).toBeUndefined()
    expect(left.attributes('disabled')).toBeUndefined()
    expect(right.attributes('disabled')).toBeDefined()
    expect(right.attributes('title')).toBe('右侧无效')
    expect(bottom.attributes('disabled')).toBeDefined()
    expect(bottom.attributes('title')).toBe('下侧无效')
  })

  it('preserves disabled side values when emitting changes', async () => {
    const wrapper = mount(SpacingInput, {
      props: {
        modelValue: { ...baseValue },
        disabledSides: { right: '右侧无效' },
      },
    })

    const left = wrapper.findAll('input')[3]
    await left.setValue(10)
    await left.trigger('change')

    const emitted = wrapper.emitted('update:model-value')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual({ top: 1, right: 2, bottom: 3, left: 10 })
  })
})
