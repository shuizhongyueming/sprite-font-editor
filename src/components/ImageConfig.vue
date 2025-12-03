<template>
  <div class="image-config">
    <div class="form-group">
      <label>外边距 (margin)</label>
      <div class="margin-inputs">
        <div class="margin-row">
          <input
            v-model.number="margin.top"
            type="number"
            class="form-control margin-input"
            placeholder="上"
            min="0"
            @change="saveConfig"
          >
        </div>
        <div class="margin-row middle">
          <input
            v-model.number="margin.left"
            type="number"
            class="form-control margin-input"
            placeholder="左"
            min="0"
            @change="saveConfig"
          >
          <div class="margin-center"></div>
          <input
            v-model.number="margin.right"
            type="number"
            class="form-control margin-input"
            placeholder="右"
            min="0"
            @change="saveConfig"
          >
        </div>
        <div class="margin-row">
          <input
            v-model.number="margin.bottom"
            type="number"
            class="form-control margin-input"
            placeholder="下"
            min="0"
            @change="saveConfig"
          >
        </div>
      </div>
    </div>
    
    <div class="form-group">
      <label>内边距 (padding)</label>
      <div class="margin-inputs">
        <div class="margin-row">
          <input
            v-model.number="padding.top"
            type="number"
            class="form-control margin-input"
            placeholder="上"
            min="0"
            @change="saveConfig"
          >
        </div>
        <div class="margin-row middle">
          <input
            v-model.number="padding.left"
            type="number"
            class="form-control margin-input"
            placeholder="左"
            min="0"
            @change="saveConfig"
          >
          <div class="margin-center"></div>
          <input
            v-model.number="padding.right"
            type="number"
            class="form-control margin-input"
            placeholder="右"
            min="0"
            @change="saveConfig"
          >
        </div>
        <div class="margin-row">
          <input
            v-model.number="padding.bottom"
            type="number"
            class="form-control margin-input"
            placeholder="下"
            min="0"
            @change="saveConfig"
          >
        </div>
      </div>
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

.margin-inputs {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.margin-row {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
}

.margin-row.middle {
  align-items: center;
}

.margin-input {
  width: 60px !important;
  text-align: center;
}

.margin-center {
  width: 60px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e9ecef;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #6c757d;
}

.margin-center::before {
  content: '□';
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