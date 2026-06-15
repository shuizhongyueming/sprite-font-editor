<template>
  <div class="cell-config">
    <div class="form-group">
      <label>{{ t('cellSize') }}</label>
      <div
        v-if="editorStore.isC3Mode"
        class="readonly-value"
      >
        {{ editorStore.baseCellConfig.width }} × {{ editorStore.baseCellConfig.height }}
      </div>
      <DimensionsInput
        v-else
        :width="editorStore.baseCellConfig.width"
        :height="editorStore.baseCellConfig.height"
        :min="8"
        :width-placeholder="t('width')"
        :height-placeholder="t('height')"
        @update:width="updateWidth"
        @update:height="updateHeight"
        @change="saveConfig"
      />
    </div>

    <div
      v-if="!editorStore.isC3Mode"
      class="form-group"
    >
      <label>{{ t('cellMargin') }}</label>
      <SpacingInput
        :model-value="editorStore.baseCellConfig.margin"
        label="margin"
        @update:model-value="updateMargin"
      />
    </div>

    <div class="form-group">
      <label>{{ t('cellPadding') }}</label>
      <SpacingInput
        :model-value="editorStore.baseCellConfig.padding"
        label="padding"
        @update:model-value="updatePadding"
      />
    </div>

    <div
      v-if="!editorStore.isC3Mode"
      class="form-group"
    >
      <label>{{ t('alignment') }}</label>
      <div class="inline-controls">
        <div class="control-item">
          <span class="control-label">{{ t('horizontal') }}</span>
          <select
            v-model="cellAlignment.horizontal"
            class="form-control"
            @change="saveConfig"
          >
            <option value="left">
              {{ t('leftAlign') }}
            </option>
            <option value="center">
              {{ t('centerAlign') }}
            </option>
            <option value="right">
              {{ t('rightAlign') }}
            </option>
          </select>
        </div>
        <div class="control-item">
          <span class="control-label">{{ t('vertical') }}</span>
          <select
            v-model="cellAlignment.vertical"
            class="form-control"
            @change="saveConfig"
          >
            <option value="top">
              {{ t('topAlign') }}
            </option>
            <option value="middle">
              {{ t('middleAlign') }}
            </option>
            <option value="bottom">
              {{ t('bottomAlign') }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label>{{ t('gridDisplay') }}</label>
      <div class="grid-config">
        <!-- Grid Lines Checkboxes -->
        <div class="checkbox-grid">
          <label class="checkbox-label">
            <input
              v-model="gridConfig.enabled"
              type="checkbox"
              @change="saveConfig"
            >
            {{ t('gridLines') }}
          </label>
          <label class="checkbox-label">
            <input
              v-model="gridConfig.cellBorder"
              type="checkbox"
              @change="saveConfig"
            >
            {{ t('cellBorder') }}
          </label>
          <label class="checkbox-label">
            <input
              v-model="gridConfig.marginLines"
              type="checkbox"
              @change="saveConfig"
            >
            {{ t('marginLine') }}
          </label>
          <label class="checkbox-label">
            <input
              v-model="gridConfig.paddingLines"
              type="checkbox"
              @change="saveConfig"
            >
            {{ t('paddingLine') }}
          </label>
        </div>

        <!-- Border Color & Width -->
        <div class="border-config">
          <div class="color-picker-wrapper">
            <label>{{ t('borderColor') }}</label>
            <input
              v-model="gridConfig.cellBorderColor"
              type="color"
              class="color-input"
              @change="saveConfig"
            >
          </div>
          <div class="width-input-wrapper">
            <label>{{ t('borderWidth') }}</label>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import SpacingInput from './SpacingInput.vue'
import DimensionsInput from './DimensionsInput.vue'
import { t } from '@/utils/i18n'

const editorStore = useEditorStore()

// 更新基础配置
function updateWidth(width: number | undefined) {
  if (width && width > 0) {
    editorStore.baseCellConfig.width = width;
  }
  saveConfig();
}

function updateHeight(height: number | undefined) {
  if (height && height > 0) {
    editorStore.baseCellConfig.height = height;
  }
  saveConfig();
}

// 直接更新基础配置（整数像素值）
function updateMargin(margin: { top: number; right: number; bottom: number; left: number }) {
  editorStore.baseCellConfig.margin.top = Math.round(margin.top);
  editorStore.baseCellConfig.margin.right = Math.round(margin.right);
  editorStore.baseCellConfig.margin.bottom = Math.round(margin.bottom);
  editorStore.baseCellConfig.margin.left = Math.round(margin.left);
  saveConfig();
}

function updatePadding(padding: { top: number; right: number; bottom: number; left: number }) {
  editorStore.baseCellConfig.padding.top = Math.round(padding.top);
  editorStore.baseCellConfig.padding.right = Math.round(padding.right);
  editorStore.baseCellConfig.padding.bottom = Math.round(padding.bottom);
  editorStore.baseCellConfig.padding.left = Math.round(padding.left);
  saveConfig();
}

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

.inline-controls {
  display: flex;
  gap: 0.75rem;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.control-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
  white-space: nowrap;
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

.checkbox-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #495057;
  cursor: pointer;
  white-space: nowrap;
}

.checkbox-label input[type="checkbox"] {
  margin: 0;
  width: 14px;
  height: 14px;
}

.border-config {
  display: flex;
  gap: 1rem;
}

.color-picker-wrapper,
.width-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-picker-wrapper label,
.width-input-wrapper label {
  font-size: 0.875rem;
  color: #495057;
  white-space: nowrap;
}

.color-input {
  width: 32px;
  height: 28px;
  padding: 0;
  border: 1px solid #ced4da;
  border-radius: 4px;
  cursor: pointer;
}

.color-input::-webkit-color-swatch-wrapper {
  padding: 1px;
}

.color-input::-webkit-color-swatch {
  border: none;
  border-radius: 3px;
}

.readonly-value {
  padding: 0.375rem 0.75rem;
  background-color: #e9ecef;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #495057;
  text-align: center;
}

.c3-locked-notice {
  padding: 0.5rem;
  background-color: #e7f3ff;
  border-radius: 4px;
  font-size: 0.8125rem;
  color: #004085;
}
</style>
