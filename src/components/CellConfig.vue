<template>
  <div class="cell-config">
    <div class="form-group">
      <label>{{ t('cellSize') }}</label>
      <DimensionsInput
        :width="editorStore.baseCellConfig.width"
        :height="editorStore.baseCellConfig.height"
        :min="8"
        :width-placeholder="t('width')"
        :height-placeholder="t('height')"
        @update:width="updateWidth"
        @update:height="updateHeight"
      />
    </div>

    <div class="form-group">
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

    <div class="form-group">
      <label>{{ t('alignment') }}</label>
      <div class="alignment-controls">
        <div class="alignment-row">
          <span class="alignment-label">{{ t('horizontal') }}</span>
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
        <div class="alignment-row">
          <span class="alignment-label">{{ t('vertical') }}</span>
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
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              v-model="gridConfig.enabled"
              type="checkbox"
              @change="saveConfig"
            >
            <span class="checkmark" />
            {{ t('showGrid') }}
          </label>
        </div>

        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              v-model="gridConfig.cellBorder"
              type="checkbox"
              @change="saveConfig"
            >
            <span class="checkmark" />
            {{ t('showCellBorder') }}
          </label>
        </div>

        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              v-model="gridConfig.marginLines"
              type="checkbox"
              @change="saveConfig"
            >
            <span class="checkmark" />
            {{ t('showMarginLines') }}
          </label>
        </div>

        <div class="checkbox-group">
          <label class="checkbox-label">
            <input
              v-model="gridConfig.paddingLines"
              type="checkbox"
              @change="saveConfig"
            >
            <span class="checkmark" />
            {{ t('showPaddingLines') }}
          </label>
        </div>

        <div class="form-group sub-group">
          <label>{{ t('borderColor') }}</label>
          <input
            v-model="gridConfig.cellBorderColor"
            type="color"
            class="form-control color-input"
            @change="saveConfig"
          >
        </div>

        <div class="form-group sub-group">
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

    <div class="form-group">
      <label>{{ t('insertPointMode') }}</label>
      <select
        v-model="insertPointConfig.mode"
        class="form-control"
        @change="saveConfig"
      >
        <option value="auto">
          {{ t('autoDetect') }}
        </option>
        <option value="manual">
          {{ t('manualSelect') }}
        </option>
      </select>
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
