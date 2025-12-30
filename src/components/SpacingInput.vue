<template>
  <div class="spacing-inputs">
    <div class="spacing-row">
      <input
        :value="modelValue.top"
        type="number"
        class="form-control spacing-input"
        :placeholder="`${label}上`"
        min="0"
        @input="handleTopInput"
        @change="handleChange"
        @blur="handleChange"
        @keydown.enter="handleChange"
      >
      <input
        :value="modelValue.right"
        type="number"
        class="form-control spacing-input"
        :placeholder="`${label}右`"
        min="0"
        @input="handleRightInput"
        @change="handleChange"
        @blur="handleChange"
        @keydown.enter="handleChange"
      >
      <input
        :value="modelValue.bottom"
        type="number"
        class="form-control spacing-input"
        :placeholder="`${label}下`"
        min="0"
        @input="handleBottomInput"
        @change="handleChange"
        @blur="handleChange"
        @keydown.enter="handleChange"
      >
      <input
        :value="modelValue.left"
        type="number"
        class="form-control spacing-input"
        :placeholder="`${label}左`"
        min="0"
        @input="handleLeftInput"
        @change="handleChange"
        @blur="handleChange"
        @keydown.enter="handleChange"
      >
    </div>
  </div>
</template>

<script setup lang="ts">
interface SpacingValue {
  top: number
  right: number
  bottom: number
  left: number
}

interface Props {
  label?: string
}

defineProps<Props>()

const modelValue = defineModel<SpacingValue>({
  required: true,
  type: Object
})

const emit = defineEmits<{
  (e: 'update:model-value', value: SpacingValue): void
  (e: 'change'): void
}>()

let currentTop = modelValue.value.top
let currentRight = modelValue.value.right
let currentBottom = modelValue.value.bottom
let currentLeft = modelValue.value.left

function handleTopInput(event: Event) {
  const target = event.target as HTMLInputElement
  currentTop = parseInt(target.value) || 0
}

function handleRightInput(event: Event) {
  const target = event.target as HTMLInputElement
  currentRight = parseInt(target.value) || 0
}

function handleBottomInput(event: Event) {
  const target = event.target as HTMLInputElement
  currentBottom = parseInt(target.value) || 0
}

function handleLeftInput(event: Event) {
  const target = event.target as HTMLInputElement
  currentLeft = parseInt(target.value) || 0
}

function handleChange() {
  const newValue = {
    top: currentTop,
    right: currentRight,
    bottom: currentBottom,
    left: currentLeft
  }
  modelValue.value = newValue
  emit('update:model-value', newValue)
  emit('change')
}
</script>

<style scoped>
.spacing-inputs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.spacing-row {
  display: flex;
  gap: 0.375rem;
}

.spacing-input {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-size: 0.8125rem;
  padding: 0.375rem 0.25rem;
}

.spacing-input::placeholder {
  font-size: 0.75rem;
  color: #6c757d;
}

.form-control {
  flex: 1;
  padding: 0.375rem 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
  transition: border-color 0.15s ease-in-out;
}

.form-control:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}
</style>
