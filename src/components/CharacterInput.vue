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
            <div class="margin-inputs">
              <div class="margin-row">
                <input
                  v-model.number="entry.margin.top"
                  type="number"
                  class="form-control margin-input"
                  placeholder="上"
                  min="-10"
                  max="10"
                  @change="saveConfig"
                >
              </div>
              <div class="margin-row middle">
                <input
                  v-model.number="entry.margin.left"
                  type="number"
                  class="form-control margin-input"
                  placeholder="左"
                  min="-10"
                  max="10"
                  @change="saveConfig"
                >
                <div class="margin-center" />
                <input
                  v-model.number="entry.margin.right"
                  type="number"
                  class="form-control margin-input"
                  placeholder="右"
                  min="-10"
                  max="10"
                  @change="saveConfig"
                >
              </div>
              <div class="margin-row">
                <input
                  v-model.number="entry.margin.bottom"
                  type="number"
                  class="form-control margin-input"
                  placeholder="下"
                  min="-10"
                  max="10"
                  @change="saveConfig"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '@/stores/editor'

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
  align-items: flex-start;
  gap: 1rem;
  padding: 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background-color: white;
}

.character-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
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
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.margin-label {
  font-size: 0.75rem;
  color: #6c757d;
  font-weight: 500;
}

.margin-inputs {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.margin-row {
  display: flex;
  justify-content: center;
  gap: 0.125rem;
}

.margin-row.middle {
  align-items: center;
}

.margin-input {
  width: 40px !important;
  text-align: center;
  padding: 0.25rem 0.125rem !important;
  font-size: 0.75rem;
}

.margin-center {
  width: 40px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e9ecef;
  border-radius: 3px;
  font-size: 0.625rem;
  color: #6c757d;
}

.margin-center::before {
  content: '□';
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

.btn {
  padding: 0.25rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.btn-sm {
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
}

.btn-outline-danger {
  color: #dc3545;
  border-color: #dc3545;
  background-color: transparent;
}

.btn-outline-danger:hover {
  color: white;
  background-color: #dc3545;
}
</style>