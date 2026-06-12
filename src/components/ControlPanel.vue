<template>
  <div class="control-panel">
    <div class="panel-section">
      <h3>{{ t('imageSettings') }}</h3>
      <ImageConfig />
    </div>
    
    <div class="panel-section">
      <h3>{{ t('gridSettings') }}</h3>
      <CellConfig />
    </div>
    
    <div class="panel-section">
      <h3>{{ t('charStyle') }}</h3>
      <CharStyle />
    </div>
    
    <div class="panel-section">
      <h3>{{ t('charInput') }}</h3>
      <CharacterInput ref="characterInputRef" />
    </div>
    
    <div
      v-if="editorStore.isC3Mode"
      class="panel-section panel-section--c3"
    >
      <h3>{{ t('c3ModeActive') }}</h3>
      <div class="c3-info">
        <div class="c3-info__item">
          <span class="c3-info__label">{{ t('c3ImportedCount', { count: importedCount }) }}</span>
        </div>
        <div class="c3-info__item">
          <span class="c3-info__label">{{ t('c3AppendedCount', { count: appendedCount }) }}</span>
        </div>
        <div class="c3-info__item c3-info__item--input">
          <label for="c3-global-extra-spacing">{{ t('c3GlobalExtraSpacing') }}</label>
          <input
            id="c3-global-extra-spacing"
            :value="editorStore.c3GlobalExtraSpacing"
            type="number"
            class="form-control c3-extra-spacing-input"
            @change="handleGlobalExtraSpacingChange"
          >
        </div>
      </div>
    </div>

    <div class="panel-section">
      <h3>{{ t('insertPointInfo') }}</h3>
      <InsertPointInfo />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import ImageConfig from './ImageConfig.vue'
import CellConfig from './CellConfig.vue'
import CharStyle from './CharStyle.vue'
import CharacterInput from './CharacterInput.vue'
import InsertPointInfo from './InsertPointInfo.vue'
import { t } from '@/utils/i18n'
import { splitGraphemes } from '@/utils/grapheme'

const editorStore = useEditorStore()

const importedCount = computed(() => {
  return splitGraphemes(editorStore.importedCharacterSet).length
})

const appendedCount = computed(() => {
  return editorStore.c3AppendedEntries.length
})

const characterInputRef = ref()

function handleGlobalExtraSpacingChange(event: Event) {
  const target = event.target as HTMLInputElement
  const value = parseInt(target.value) || 0
  editorStore.setC3GlobalExtraSpacing(value)
}

defineExpose({
  characterInputRef
})
</script>

<style scoped>
.control-panel {
  width: 360px;
  background-color: #e9ecef;
  border-left: 1px solid #dee2e6;
  overflow-y: auto;
  padding: 1rem;
}

.panel-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.panel-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.panel-section h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
}

.panel-section--c3 {
  background-color: #e7f3ff;
  border-radius: 4px;
  padding: 0.75rem;
}

.c3-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.c3-info__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.c3-info__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
}

.c3-info__item--input {
  gap: 0.5rem;
}

.c3-info__item--input label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
}

.c3-extra-spacing-input {
  width: 80px;
  padding: 0.25rem 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
  text-align: center;
}

.c3-extra-spacing-input:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}
</style>