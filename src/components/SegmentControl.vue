<template>
  <div class="segment-control">
    <button
      v-for="option in options"
      :key="option.value"
      class="segment-btn"
      :class="{ active: modelValue === option.value }"
      @click="select(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
interface Option<T extends string | number> {
  value: T;
  label: string;
}

defineProps<{
  modelValue: string | number;
  options: Option<string | number>[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
}>();

function select(value: string | number) {
  emit('update:modelValue', value);
}
</script>

<style scoped>
.segment-control {
  display: flex;
  border: 1px solid #ced4da;
  border-radius: 4px;
  overflow: hidden;
}

.segment-btn {
  padding: 0.375rem 0.75rem;
  border: none;
  background-color: #fff;
  color: #495057;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
  border-right: 1px solid #ced4da;
}

.segment-btn:last-child {
  border-right: none;
}

.segment-btn:hover {
  background-color: #f8f9fa;
}

.segment-btn.active {
  background-color: #007bff;
  color: white;
}
</style>
