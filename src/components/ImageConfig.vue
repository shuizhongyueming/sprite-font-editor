<template>
  <div class="image-config">
    <div class="form-group">
      <label>外边距 (margin)</label>
      <SpacingInput
        v-model="margin"
        label="margin"
        @change="saveConfig"
      />
    </div>
    
    <div class="form-group">
      <label>内边距 (padding)</label>
      <SpacingInput
        v-model="padding"
        label="padding"
        @change="saveConfig"
      />
    </div>
    
    <div class="form-group">
      <label>限制尺寸 (可选)</label>
      <div class="dimension-inputs">
        <input
          v-model.number="width"
          type="number"
          class="form-control"
          placeholder="宽度"
          min="1"
          @change="saveConfig"
        >
        <span class="dimension-separator">×</span>
        <input
          v-model.number="height"
          type="number"
          class="form-control"
          placeholder="高度"
          min="1"
          @change="saveConfig"
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import SpacingInput from './SpacingInput.vue'

const editorStore = useEditorStore()

const margin = computed({
  get: () => editorStore.imageConfig.margin,
  set: (value) => {
    editorStore.imageConfig.margin = value
  }
})

const padding = computed({
  get: () => editorStore.imageConfig.padding,
  set: (value) => {
    editorStore.imageConfig.padding = value
  }
})

const width = computed({
  get: () => editorStore.imageConfig.width || '',
  set: (value) => {
    editorStore.imageConfig.width = value || undefined
  }
})

const height = computed({
  get: () => editorStore.imageConfig.height || '',
  set: (value) => {
    editorStore.imageConfig.height = value || undefined
  }
})

function saveConfig() {
  editorStore.saveToLocalStorage()
}
</script>

<style scoped>
.image-config {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  font-size: 0.875rem;
  color: #495057;
}

.dimension-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dimension-separator {
  font-weight: 500;
  color: #6c757d;
}

.form-control {
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