<template>
  <div class="spacing-inputs">
    <div class="spacing-row">
      <input
        v-model.number="modelValue.top"
        type="number"
        class="form-control spacing-input"
        :placeholder="`${label}上`"
        min="0"
      >
      <input
        v-model.number="modelValue.right"
        type="number"
        class="form-control spacing-input"
        :placeholder="`${label}右`"
        min="0"
      >
      <input
        v-model.number="modelValue.bottom"
        type="number"
        class="form-control spacing-input"
        :placeholder="`${label}下`"
        min="0"
      >
      <input
        v-model.number="modelValue.left"
        type="number"
        class="form-control spacing-input"
        :placeholder="`${label}左`"
        min="0"
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

// defineModel 自动创建 v-model 绑定，type 自动转换
const modelValue = defineModel<SpacingValue>({
  required: true,
  type: Object  // 告诉 Vue 这是一个对象类型
})
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
