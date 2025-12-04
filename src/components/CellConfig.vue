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
      <div class="spacing-inputs">
        <div class="spacing-row">
          <input
            v-model.number="cellConfig.margin.top"
            type="number"
            class="form-control spacing-input"
            placeholder="上"
            min="0"
            @change="saveConfig"
          >
          <input
            v-model.number="cellConfig.margin.right"
            type="number"
            class="form-control spacing-input"
            placeholder="右"
            min="0"
            @change="saveConfig"
          >
          <input
            v-model.number="cellConfig.margin.bottom"
            type="number"
            class="form-control spacing-input"
            placeholder="下"
            min="0"
            @change="saveConfig"
          >
          <input
            v-model.number="cellConfig.margin.left"
            type="number"
            class="form-control spacing-input"
            placeholder="左"
            min="0"
            @change="saveConfig"
          >
        </div>
      </div>
    </div>
    
    <div class="form-group">
      <label>字符内边距 (padding)</label>
      <div class="spacing-inputs">
        <div class="spacing-row">
          <input
            v-model.number="cellConfig.padding.top"
            type="number"
            class="form-control spacing-input"
            placeholder="上"
            min="0"
            @change="saveConfig"
          >
          <input
            v-model.number="cellConfig.padding.right"
            type="number"
            class="form-control spacing-input"
            placeholder="右"
            min="0"
            @change="saveConfig"
          >
          <input
            v-model.number="cellConfig.padding.bottom"
            type="number"
            class="form-control spacing-input"
            placeholder="下"
            min="0"
            @change="saveConfig"
          >
          <input
            v-model.number="cellConfig.padding.left"
            type="number"
            class="form-control spacing-input"
            placeholder="左"
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
    
    <div class="form-group">
      <label>网格显示</label>
      <div class="grid-config">
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              v-model="gridConfig.enabled"
              type="checkbox"
              @change="saveConfig"
            >
            显示网格
          </label>
        </div>
        
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              v-model="gridConfig.cellBorder"
              type="checkbox"
              @change="saveConfig"
            >
            显示单元格边框
          </label>
        </div>
        
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              v-model="gridConfig.marginLines"
              type="checkbox"
              @change="saveConfig"
            >
            显示 margin 线
          </label>
        </div>
        
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              v-model="gridConfig.paddingLines"
              type="checkbox"
              @change="saveConfig"
            >
            显示 padding 线
          </label>
        </div>
        
        <div class="form-group sub-group">
          <label>边框颜色</label>
          <input
            v-model="gridConfig.cellBorderColor"
            type="color"
            class="form-control color-input"
            @change="saveConfig"
          >
        </div>
        
        <div class="form-group sub-group">
          <label>边框宽度</label>
          <input
            v-model.number="gridConfig.cellBorderWidth"
            type="number"
            class="form-control"
            min="1"
            max="5"
            @change="saveConfig"
          >
        </div>
      </div>
    </div>
    
    <div class="form-group">
      <label>插入点模式</label>
      <select
        v-model="insertPointConfig.mode"
        class="form-control"
        @change="saveConfig"
      >
        <option value="auto">
          自动检测
        </option>
        <option value="manual">
          手动选择
        </option>
      </select>
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

const gridConfig = computed({
  get: () => editorStore.gridConfig,
  set: (value) => {
    editorStore.gridConfig = value
  }
})

const insertPointConfig = computed({
  get: () => editorStore.insertPointConfig,
  set: (value) => {
    editorStore.insertPointConfig = value
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

/* 移除旧的样式 */
.margin-inputs,
.margin-row,
.margin-row.middle,
.margin-input,
.margin-center,
.margin-center::before {
  display: none;
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

.grid-config {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.checkbox-group {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #495057;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  margin: 0;
}

.sub-group {
  margin-left: 1.5rem;
  margin-bottom: 0 !important;
}

.color-input {
  width: 50px !important;
  height: 32px;
  padding: 2px !important;
  border: none !important;
}

.color-input:focus {
  box-shadow: none !important;
}
</style>