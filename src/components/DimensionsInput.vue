<template>
  <div class="dimensions-inputs">
    <input
      :value="widthValue"
      type="number"
      class="form-control dimension-input"
      :placeholder="widthPlaceholder"
      :min="min"
      :step="step"
      @input="updateWidth(($event.target as HTMLInputElement).value)"
    >
    <span class="dimension-separator">×</span>
    <input
      :value="heightValue"
      type="number"
      class="form-control dimension-input"
      :placeholder="heightPlaceholder"
      :min="min"
      :step="step"
      @input="updateHeight(($event.target as HTMLInputElement).value)"
    >
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  width?: number
  height?: number
  min?: number
  step?: number
  widthPlaceholder?: string
  heightPlaceholder?: string
}

interface Emits {
  (e: 'update:width', value: number | undefined): void
  (e: 'update:height', value: number | undefined): void
  (e: 'change'): void
}

const props = withDefaults(defineProps<Props>(), {
  min: 1,
  step: 1,
  widthPlaceholder: '宽度',
  heightPlaceholder: '高度',
})

const emit = defineEmits<Emits>()

// 使用 computed 代理 props，使其响应式
const widthValue = computed(() => props.width ?? '')
const heightValue = computed(() => props.height ?? '')

function updateWidth(rawValue: string) {
  const numValue = rawValue ? parseInt(rawValue, 10) : undefined
  emit('update:width', numValue)
  emit('change')
}

function updateHeight(rawValue: string) {
  const numValue = rawValue ? parseInt(rawValue, 10) : undefined
  emit('update:height', numValue)
  emit('change')
}
</script>

<style scoped>
.dimensions-inputs {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.dimension-input {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.dimension-separator {
  font-weight: 500;
  color: #6c757d;
  user-select: none;
}

.form-control {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
  transition: border-color 0.15s ease-in-out;
  min-width: 0;
}

.form-control:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}
</style>
