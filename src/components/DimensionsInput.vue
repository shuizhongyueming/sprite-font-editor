<template>
  <div class="dimensions-inputs">
    <input
      :value="widthModel"
      type="number"
      class="form-control dimension-input"
      :placeholder="widthPlaceholder"
      :min="min"
      :step="step"
      @input="handleWidthInput"
      @change="handleWidthChange"
      @blur="handleWidthChange"
      @keydown.enter="handleWidthChange"
    >
    <span class="dimension-separator">×</span>
    <input
      :value="heightModel"
      type="number"
      class="form-control dimension-input"
      :placeholder="heightPlaceholder"
      :min="min"
      :step="step"
      @input="handleHeightInput"
      @change="handleHeightChange"
      @blur="handleHeightChange"
      @keydown.enter="handleHeightChange"
    >
  </div>
</template>

<script setup lang="ts">
interface Props {
  min?: number
  step?: number
  widthPlaceholder?: string
  heightPlaceholder?: string
}

withDefaults(defineProps<Props>(), {
  min: 1,
  step: 1,
  widthPlaceholder: '宽度',
  heightPlaceholder: '高度',
})

const widthModel = defineModel<number | undefined>('width', { type: Number })
const heightModel = defineModel<number | undefined>('height', { type: Number })

const emit = defineEmits<{
  (e: 'update:width', value: number | undefined): void
  (e: 'update:height', value: number | undefined): void
  (e: 'change'): void
}>()

let widthValue: number | undefined = widthModel.value
let heightValue: number | undefined = heightModel.value

function handleWidthInput(event: Event) {
  const target = event.target as HTMLInputElement
  const val = target.value
  widthValue = val === '' ? undefined : parseInt(val) || undefined
}

function handleHeightInput(event: Event) {
  const target = event.target as HTMLInputElement
  const val = target.value
  heightValue = val === '' ? undefined : parseInt(val) || undefined
}

function handleWidthChange() {
  widthModel.value = widthValue
  emit('update:width', widthValue)
  emit('change')
}

function handleHeightChange() {
  heightModel.value = heightValue
  emit('update:height', heightValue)
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
