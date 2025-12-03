<template>
  <div class="cell-config">
    <div class="form-group">
      <label>单元格尺寸</label>
      <div class="dimension-inputs">
        <input
          v-model.number="cellConfig.width"
          type="number"
          class="form-control"
          placeholder="宽度"
          min="8"
          @change="saveConfig"
        >
        <span class="dimension-separator">×</span>
        <input
          v-model.number="cellConfig.height"
          type="number"
          class="form-control"
          placeholder="高度"
          min="8"
          @change="saveConfig"
        >
      </div>
    </div>
    
    <div class="form-group">
      <label>单元格间距 (margin)</label>
      <div class="margin-inputs">
        <div class="margin-row">
          <input
            v-model.number="cellConfig.margin.top"
            type="number"
            class="form-control margin-input"
            placeholder="上"
            min="0"
            @change="saveConfig"
          >
        </div>
        <div class="margin-row middle">
          <input
            v-model.number="cellConfig.margin.left"
            type="number"
            class="form-control margin-input"
            placeholder="左"
            min="0"
            @change="saveConfig"
          >
          <div class="margin-center" />
          <input
            v-model.number="cellConfig.margin.right"
            type="number"
            class="form-control margin-input"
            placeholder="右"
            min="0"
            @change="saveConfig"
          >
        </div>
        <div class="margin-row">
          <input
            v-model.number="cellConfig.margin.bottom"
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
      <label>字符内边距 (padding)</label>
      <div class="margin-inputs">
        <div class="margin-row">
          <input
            v-model.number="cellConfig.padding.top"
            type="number"
            class="form-control margin-input"
            placeholder="上"
            min="0"
            @change="saveConfig"
          >
        </div>
        <div class="margin-row middle">
          <input
            v-model.number="cellConfig.padding.left"
            type="number"
            class="form-control margin-input"
            placeholder="左"
            min="0"
            @change="saveConfig"
          >
          <div class="margin-center" />
          <input
            v-model.number="cellConfig.padding.right"
            type="number"
            class="form-control margin-input"
            placeholder="右"
            min="0"
            @change="saveConfig"
          >
        </div>
        <div class="margin-row">
          <input
            v-model.number="cellConfig.padding.bottom"
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
      <label>对齐方式</label>
      <div class="alignment-controls">
        <div class="alignment-row">
          <span class="alignment-label">水平:</span>
          <select
            v-model="cellAlignment.horizontal"
            class="form-control"
            @change="saveConfig"
          >
            <option value="left">
              左对齐
            </option>
            <option value="center">
              居中
            </option>
            <option value="right">
              右对齐
            </option>
          </select>
        </div>
        <div class="alignment-row">
          <span class="alignment-label">垂直:</span>
          <select
            v-model="cellAlignment.vertical"
            class="form-control"
            @change="saveConfig"
          >
            <option value="top">
              顶部
            </option>
            <option value="middle">
              居中
            </option>
            <option value="bottom">
              底部
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'

const editorStore = useEditorStore()

const cellConfig = computed({
  get: () => editorStore.cellConfig,
  set: (value) => {
    editorStore.cellConfig = value
  }
})

const cellAlignment = computed({
  get: () => editorStore.cellAlignment,
  set: (value) => {
    editorStore.cellAlignment = value
  }
})

function saveConfig() {
  editorStore.saveToLocalStorage()
}
</script>

<style scoped>
.cell-config {
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

.alignment-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.alignment-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.alignment-label {
  font-size: 0.875rem;
  color: #495057;
  min-width: 60px;
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