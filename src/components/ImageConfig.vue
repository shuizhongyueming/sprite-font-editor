<template>
  <div class="image-config">
    <div class="form-group">
      <label>外边距 (margin)</label>
      <SpacingInput
        v-model="editorStore.imageConfig.margin"
        label="margin"
        @change="saveConfig"
      />
    </div>
    
    <div class="form-group">
      <label>内边距 (padding)</label>
      <SpacingInput
        v-model="editorStore.imageConfig.padding"
        label="padding"
        @change="saveConfig"
      />
    </div>
    
    <div class="form-group">
      <label>限制尺寸 (可选)</label>
      <DimensionsInput
        v-model:width="editorStore.imageConfig.width"
        v-model:height="editorStore.imageConfig.height"
        :min="1"
        width-placeholder="宽度"
        height-placeholder="高度"
        @change="saveConfig"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import SpacingInput from './SpacingInput.vue'
import DimensionsInput from './DimensionsInput.vue'

const editorStore = useEditorStore()

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