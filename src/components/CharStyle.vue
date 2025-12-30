<template>
  <div class="char-style">
    <div class="form-group">
      <label>{{ t('font') }}</label>
      <div class="font-display">
        <span class="font-name">{{ characterStyle.fontFamily }}</span>
        <span
          v-if="!currentFont"
          class="font-status error"
        >{{ t('fontNotLoaded') }}</span>
        <span
          v-else
          class="font-status success"
        >{{ t('fontLoaded') }}</span>
      </div>
    </div>
    
    <div class="form-group">
      <label>{{ t('fontSize') }}</label>
      <input
        v-model.number="characterStyle.fontSize"
        type="number"
        class="form-control"
        min="8"
        max="72"
        @change="saveConfig"
      >
    </div>
    
    <div class="form-group">
      <label>{{ t('textColor') }}</label>
      <input
        v-model="characterStyle.color"
        type="color"
        class="color-input"
        @change="saveConfig"
      >
    </div>
    
    <div class="form-group">
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input
            v-model="characterStyle.pixelStyle"
            type="checkbox"
            @change="saveConfig"
          >
          <span class="checkmark" />
          {{ t('pixelStyle') }}
        </label>
      </div>
    </div>

    <div class="form-group">
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input
            v-model="characterStyle.outline.enabled"
            type="checkbox"
            @change="saveConfig"
          >
          <span class="checkmark" />
          {{ t('enableOutline') }}
        </label>
      </div>
    </div>
    
    <div
      v-if="characterStyle.outline.enabled"
      class="outline-settings"
    >
      <div class="form-group">
        <label>{{ t('outlineColor') }}</label>
        <input
          v-model="characterStyle.outline.color"
          type="color"
          class="color-input"
          @change="saveConfig"
        >
      </div>
      
      <div class="form-group">
        <label>{{ t('outlineWidth') }}</label>
        <input
          v-model.number="characterStyle.outline.width"
          type="number"
          class="form-control"
          min="1"
          max="10"
          @change="saveConfig"
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { t } from '@/utils/i18n'

const editorStore = useEditorStore()

const characterStyle = computed({
  get: () => editorStore.characterStyle,
  set: (value) => {
    editorStore.characterStyle = value
  }
})

const currentFont = computed(() => editorStore.currentFont)

function saveConfig() {
  editorStore.saveToLocalStorage()
}
</script>

<style scoped>
.char-style {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  font-size: 0.875rem;
  color: #495057;
  white-space: nowrap;
  min-width: 70px;
}

.font-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  padding: 0.375rem 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background-color: #f8f9fa;
}

.font-name {
  font-size: 0.875rem;
  color: #495057;
}

.font-status {
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  border-radius: 12px;
  font-weight: 500;
}

.font-status.error {
  background-color: #f8d7da;
  color: #721c24;
}

.font-status.success {
  background-color: #d4edda;
  color: #155724;
}

.color-input {
  width: 40px;
  height: 32px;
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

.checkbox-group {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 0.875rem;
  color: #495057;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  display: none;
}

.checkmark {
  width: 18px;
  height: 18px;
  border: 2px solid #ced4da;
  border-radius: 3px;
  margin-right: 0.5rem;
  position: relative;
  transition: all 0.2s;
}

.checkbox-label input[type="checkbox"]:checked + .checkmark {
  background-color: #007bff;
  border-color: #007bff;
}

.checkbox-label input[type="checkbox"]:checked + .checkmark::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.outline-settings {
  margin-left: 1.5rem;
  padding-left: 1rem;
  border-left: 2px solid #e9ecef;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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