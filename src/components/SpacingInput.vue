<template>
  <div class="spacing-inputs">
    <div class="spacing-row">
      <input
        :value="modelValue.top"
        type="number"
        class="form-control spacing-input"
        :placeholder="`${label}上`"
        min="0"
        @input="updateValue('top', ($event.target as HTMLInputElement).value)"
      >
      <input
        :value="modelValue.right"
        type="number"
        class="form-control spacing-input"
        :placeholder="`${label}右`"
        min="0"
        @input="updateValue('right', ($event.target as HTMLInputElement).value)"
      >
      <input
        :value="modelValue.bottom"
        type="number"
        class="form-control spacing-input"
        :placeholder="`${label}下`"
        min="0"
        @input="updateValue('bottom', ($event.target as HTMLInputElement).value)"
      >
      <input
        :value="modelValue.left"
        type="number"
        class="form-control spacing-input"
        :placeholder="`${label}左`"
        min="0"
        @input="updateValue('left', ($event.target as HTMLInputElement).value)"
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
  modelValue: SpacingValue
  label?: string
}

interface Emits {
  (e: 'update:modelValue', value: SpacingValue): void
  (e: 'change'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function updateValue(key: keyof SpacingValue, rawValue: string) {
  const value = parseInt(rawValue || '0', 10)
  const newValue = { ...props.modelValue, [key]: isNaN(value) ? 0 : value }
  
  emit('update:modelValue', newValue)
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