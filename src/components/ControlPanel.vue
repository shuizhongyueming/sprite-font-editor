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
    
    <div class="panel-section">
      <h3>{{ t('insertPointInfo') }}</h3>
      <InsertPointInfo />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ImageConfig from './ImageConfig.vue'
import CellConfig from './CellConfig.vue'
import CharStyle from './CharStyle.vue'
import CharacterInput from './CharacterInput.vue'
import InsertPointInfo from './InsertPointInfo.vue'
import { t } from '@/utils/i18n'

const characterInputRef = ref()

defineExpose({
  characterInputRef
})
</script>

<style scoped>
.control-panel {
  width: 360px;
  background-color: #f8f9fa;
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
</style>