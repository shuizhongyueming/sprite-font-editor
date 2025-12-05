<template>
  <div class="character-input">
    <div class="form-group">
      <label>输入文字</label>
      <textarea
        v-model="textInput"
        class="form-control text-input"
        placeholder="请输入要渲染的文字..."
        rows="3"
        @input="handleTextInput"
      />
    </div>
    
    <div
      v-if="characterEntries.length > 0"
      class="character-list"
    >
      <div class="character-list-header">
        <span class="character-count">共 {{ characterEntries.length }} 个字符</span>
        <button 
          class="btn btn-sm btn-outline-danger" 
          @click="clearCharacters"
        >
          清空
        </button>
      </div>
      
      <div class="character-items">
        <div
          v-for="(entry, index) in characterEntries"
          :key="index"
          class="character-item"
        >
          <div class="character-display">
            <span class="character-char">{{ entry.char }}</span>
            <span class="character-index">#{{ index + 1 }}</span>
          </div>
          
          <div class="character-margin">
            <label class="margin-label">边距调整</label>
            <SpacingInput
              v-model="entry.margin"
              label="margin"
              @change="saveConfig"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import SpacingInput from './SpacingInput.vue'

const editorStore = useEditorStore()

const textInput = ref('')

const characterEntries = computed(() => editorStore.characterEntries)

function handleTextInput() {
  editorStore.updateCharacters(textInput.value)
  editorStore.saveToLocalStorage()
}

function clearCharacters() {
  textInput.value = ''
  editorStore.updateCharacters('')
  editorStore.saveToLocalStorage()
}

function saveConfig() {
  editorStore.saveToLocalStorage()
}
</script>

<style scoped>
.character-input {
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

.text-input {
  resize: vertical;
  min-height: 80px;
}

.character-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.character-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.character-count {
  font-size: 0.875rem;
  color: #6c757d;
}

.character-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.character-item {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background-color: white;
}

.character-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 40px;
}

.character-char {
  font-size: 1.5rem;
  font-weight: 500;
  color: #495057;
  line-height: 1;
}

.character-index {
  font-size: 0.75rem;
  color: #6c757d;
  margin-top: 0.25rem;
}

.character-margin {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.margin-label {
  font-size: 0.75rem;
  color: #6c757d;
  font-weight: 500;
}

</style>