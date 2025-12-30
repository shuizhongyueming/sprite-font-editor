<template>
  <div class="image-config">
    <div class="form-group">
      <label>{{ t('fontSpriteSize') }}</label>
      <div class="size-inputs">
        <div class="size-input-group">
          <label>{{ t('width') }}</label>
          <input
            type="number"
            :value="editorStore.baseImageConfig.fontSpriteWidth || ''"
            :placeholder="String(editorStore.originalImageWidth || '')"
            min="1"
            @input="updateFontSpriteWidth"
          >
        </div>
        <div class="size-input-group">
          <label>{{ t('height') }}</label>
          <input
            type="number"
            :value="editorStore.baseImageConfig.fontSpriteHeight || ''"
            :placeholder="String(editorStore.originalImageHeight || '')"
            min="1"
            @input="updateFontSpriteHeight"
          >
        </div>
      </div>
    </div>

    <div class="form-group">
      <label>{{ t('imageMargin') }}</label>
      <SpacingInput
        :model-value="editorStore.baseImageConfig.margin"
        label="margin"
        @update:model-value="updateMargin"
      />
    </div>

    <div class="form-group">
      <label>{{ t('imagePadding') }}</label>
      <SpacingInput
        :model-value="editorStore.baseImageConfig.padding"
        label="padding"
        @update:model-value="updatePadding"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditorStore } from '@/stores/editor'
import SpacingInput from './SpacingInput.vue'
import { t } from '@/utils/i18n'

const editorStore = useEditorStore()

function updateFontSpriteWidth(event: Event) {
  const value = parseInt((event.target as HTMLInputElement).value) || 0;
  editorStore.baseImageConfig.fontSpriteWidth = value || undefined;
  editorStore.saveToLocalStorage();
}

function updateFontSpriteHeight(event: Event) {
  const value = parseInt((event.target as HTMLInputElement).value) || 0;
  editorStore.baseImageConfig.fontSpriteHeight = value || undefined;
  editorStore.saveToLocalStorage();
}

// 直接更新基础配置（整数像素值）
function updateMargin(margin: { top: number; right: number; bottom: number; left: number }) {
  editorStore.baseImageConfig.margin.top = Math.round(margin.top);
  editorStore.baseImageConfig.margin.right = Math.round(margin.right);
  editorStore.baseImageConfig.margin.bottom = Math.round(margin.bottom);
  editorStore.baseImageConfig.margin.left = Math.round(margin.left);
  editorStore.saveToLocalStorage();
}

function updatePadding(padding: { top: number; right: number; bottom: number; left: number }) {
  editorStore.baseImageConfig.padding.top = Math.round(padding.top);
  editorStore.baseImageConfig.padding.right = Math.round(padding.right);
  editorStore.baseImageConfig.padding.bottom = Math.round(padding.bottom);
  editorStore.baseImageConfig.padding.left = Math.round(padding.left);
  editorStore.saveToLocalStorage();
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

.size-inputs {
  display: flex;
  gap: 1rem;
}

.size-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.size-input-group label {
  font-size: 0.75rem;
  color: #6c757d;
}

.size-input-group input {
  padding: 0.375rem 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
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
