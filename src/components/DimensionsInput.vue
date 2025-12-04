<template>
  <div class="dimensions-inputs">
    <input
      v-model.number="width"
      type="number"
      class="form-control dimension-input"
      :placeholder="widthPlaceholder"
      :min="min"
      :step="step"
    >
    <span class="dimension-separator">×</span>
    <input
      v-model.number="height"
      type="number"
      class="form-control dimension-input"
      :placeholder="heightPlaceholder"
      :min="min"
      :step="step"
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

// defineModel 的 type: Number 会自动处理字符串到数字的转换
const width = defineModel<number | undefined>('width', { type: Number })
const height = defineModel<number | undefined>('height', { type: Number })
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
